# ======================================================================
# FULL views.py (your existing code kept) + UPDATED DutyChartExportFile
# Changes:
#   ✅ PDF export now uses WeasyPrint ONLY (best for Nepali) + FontConfiguration
#   ✅ No xhtml2pdf fallback (it breaks Nepali shaping)
#   ✅ No file:// font-path guessing (use installed fonts in Docker)
#
# NOTE:
#   - You said you will run PDF export from Docker even during Windows dev.
#   - Ensure Docker has fonts + fontconfig (your Dockerfile is already close).
# ======================================================================

from datetime import timedelta
import datetime
import os
import platform
import pandas as pd
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

from django.shortcuts import render, get_object_or_404
from django.core.exceptions import ValidationError

from rest_framework import viewsets, permissions, status, renderers
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import HttpResponse, JsonResponse
from django.utils.dateparse import parse_date
from io import BytesIO
import openpyxl

# WeasyPrint import moved to lazy loading (only when PDF export is requested)
# to avoid Windows compatibility issues with GTK libraries
WEASYPRINT_AVAILABLE = False

from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from drf_spectacular.utils import extend_schema, OpenApiExample, OpenApiParameter

from org.models import Office
from users.permissions import (
    AdminOrReadOnly,
    SuperAdminOrReadOnly,
    IsSuperAdmin,
    IsOfficeAdmin,
    IsOfficeScoped,
    get_allowed_office_ids,
)

from .models import DutyChart, Duty, RosterAssignment, Schedule
from .serializers import (
    DutyChartSerializer,
    DutySerializer,
    BulkDocumentUploadSerializer,
    DocumentSerializer,
    ScheduleSerializer,
    ALLOWED_HEADERS,
    HEADER_MAP,
    RosterAssignmentSerializer,
)

import logging
logger = logging.getLogger(__name__)


class ScheduleView(viewsets.ModelViewSet):
    queryset = Schedule.objects.all()
    serializer_class = ScheduleSerializer
    permission_classes = [AdminOrReadOnly]

    @swagger_auto_schema(
        operation_description="List schedules, optionally filtered by office and/or duty chart.",
        manual_parameters=[
            openapi.Parameter("office", openapi.IN_QUERY, description="Filter by Office ID", type=openapi.TYPE_INTEGER),
            openapi.Parameter("duty_chart", openapi.IN_QUERY, description="Filter by Duty Chart ID (schedules linked to chart)", type=openapi.TYPE_INTEGER),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Schedule.objects.all()
        office_id = self.request.query_params.get("office", None)
        duty_chart_id = self.request.query_params.get("duty_chart", None)

        user = self.request.user
        allowed = None
        if not IsSuperAdmin().has_permission(self.request, self):
            allowed = get_allowed_office_ids(user)
            if allowed:
                from django.db.models import Q
                queryset = queryset.filter(Q(office_id__in=allowed) | Q(office_id__isnull=True))

        # Apply office filter if provided
        if office_id:
            if allowed and int(office_id) not in allowed:
                queryset = queryset.none()
            else:
                from django.db.models import Q
                # Deduplicate: if an office has a schedule with the same name, hide the template
                local_names = Schedule.objects.filter(office_id=office_id).values_list('name', flat=True)
                queryset = queryset.filter(
                    Q(office_id=office_id) |
                    (Q(office_id__isnull=True) & ~Q(name__in=local_names))
                )

        # Apply duty_chart filter if provided (via M2M on DutyChart.schedules)
        if duty_chart_id:
            queryset = queryset.filter(duty_charts__id=duty_chart_id)

        # Avoid duplicates when both filters intersect
        queryset = queryset.distinct()

        return queryset

    def perform_create(self, serializer):
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return

        status_val = self.request.data.get("status")
        office_id = self.request.data.get("office")

        # Allow creating global templates (office=null) if status is 'template'
        if status_val == "template" and not office_id:
            serializer.save()
            return

        allowed = get_allowed_office_ids(self.request.user)
        if not office_id or int(office_id) not in allowed:
            raise ValidationError("Not allowed to create schedule for this office.")
        serializer.save()

    def perform_update(self, serializer):
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return

        status_val = self.request.data.get("status") or getattr(serializer.instance, "status", None)
        office_id = self.request.data.get("office") or getattr(serializer.instance, "office_id", None)

        if status_val == "template" and not office_id:
            serializer.save()
            return

        allowed = get_allowed_office_ids(self.request.user)
        if not office_id or int(office_id) not in allowed:
            raise ValidationError("Not allowed to update schedule for this office.")
        serializer.save()

    @action(detail=False, methods=["post"], url_path="sync-from-roster")
    def sync_from_roster(self, request):
        """
        Pulls all RosterAssignment entries and inserts/updates them into Schedule.
        Dates are ignored; unique schedules are by name+office+start/end times.
        """
        roster_entries = RosterAssignment.objects.all()
        created_count, updated_count = 0, 0

        for ra in roster_entries:
            # Resolve office by name string from roster assignment
            office_obj = None
            if isinstance(ra.office, str) and ra.office:
                office_obj = Office.objects.filter(name__iexact=ra.office.strip()).first()
            elif hasattr(ra, "office") and ra.office and hasattr(ra.office, "pk"):
                office_obj = ra.office

            if not office_obj:
                # Skip if office cannot be resolved
                continue

            obj, created = Schedule.objects.update_or_create(
                name=ra.shift or "Schedule",
                office=office_obj,
                start_time=ra.start_time,
                end_time=ra.end_time,
                defaults={"status": "active"},
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        return Response(
            {"message": "Schedule sync complete", "created": created_count, "updated": updated_count},
            status=status.HTTP_200_OK,
        )


class BulkDocumentUploadView(APIView):
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    @swagger_auto_schema(
        operation_description="Upload multiple documents in one request.",
        manual_parameters=[
            openapi.Parameter(name="files", in_=openapi.IN_FORM, type=openapi.TYPE_FILE, description="Multiple files to upload", required=True),
            openapi.Parameter(name="meta", in_=openapi.IN_FORM, type=openapi.TYPE_STRING, description="Optional JSON mapping filenames to metadata (e.g. description)", required=False),
        ],
        responses={201: DocumentSerializer(many=True)},
    )
    def post(self, request, *args, **kwargs):
        serializer = BulkDocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        documents = serializer.save()
        return Response(DocumentSerializer(documents, many=True).data, status=status.HTTP_201_CREATED)


class DutyChartViewSet(viewsets.ModelViewSet):
    queryset = DutyChart.objects.all()
    serializer_class = DutyChartSerializer
    permission_classes = [AdminOrReadOnly]

    @swagger_auto_schema(
        operation_description="List duty charts, optionally filtered by office ID.",
        manual_parameters=[
            openapi.Parameter("office", openapi.IN_QUERY, description="Filter by office ID", type=openapi.TYPE_INTEGER)
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = DutyChart.objects.all()
        office_id = self.request.query_params.get("office", None)
        user = self.request.user
        if not IsSuperAdmin().has_permission(self.request, self):
            allowed = get_allowed_office_ids(user)
            if allowed:
                queryset = queryset.filter(office_id__in=allowed)
        if office_id:
            if not IsSuperAdmin().has_permission(self.request, self):
                allowed = get_allowed_office_ids(user)
                if allowed and int(office_id) not in allowed:
                    return DutyChart.objects.none()
            queryset = queryset.filter(office_id=office_id)
        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return
        allowed = get_allowed_office_ids(user)
        office_id = self.request.data.get("office")
        if not office_id or int(office_id) not in allowed:
            raise ValidationError("Not allowed to create duty chart for this office.")
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return
        allowed = get_allowed_office_ids(user)
        office_id = self.request.data.get("office") or getattr(serializer.instance, "office_id", None)
        if not office_id or int(office_id) not in allowed:
            raise ValidationError("Not allowed to update duty chart for this office.")
        serializer.save()


class DutyViewSet(viewsets.ModelViewSet):
    queryset = Duty.objects.all()
    serializer_class = DutySerializer
    permission_classes = [AdminOrReadOnly]

    @swagger_auto_schema(
        operation_description="List duties, optionally filtered by office, user, schedule, and/or date.",
        manual_parameters=[
            openapi.Parameter("office", openapi.IN_QUERY, description="Filter by Office ID", type=openapi.TYPE_INTEGER),
            openapi.Parameter("user", openapi.IN_QUERY, description="Filter by User ID", type=openapi.TYPE_INTEGER),
            openapi.Parameter("schedule", openapi.IN_QUERY, description="Filter by Schedule ID", type=openapi.TYPE_INTEGER),
            openapi.Parameter("date", openapi.IN_QUERY, description="Filter by date (YYYY-MM-DD)", type=openapi.TYPE_STRING, format=openapi.FORMAT_DATE),
            openapi.Parameter("duty_chart", openapi.IN_QUERY, description="Filter by Duty Chart ID", type=openapi.TYPE_INTEGER),
        ],
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    def get_queryset(self):
        queryset = Duty.objects.all()
        office_id = self.request.query_params.get("office", None)
        user_id = self.request.query_params.get("user", None)
        schedule_id = self.request.query_params.get("schedule", None)
        date = self.request.query_params.get("date", None)
        duty_chart_id = self.request.query_params.get("duty_chart", None)

        user = self.request.user
        if not IsSuperAdmin().has_permission(self.request, self):
            allowed = get_allowed_office_ids(user)
            if allowed:
                queryset = queryset.filter(office_id__in=allowed)

        if office_id:
            if not IsSuperAdmin().has_permission(self.request, self):
                allowed = get_allowed_office_ids(user)
                if allowed and int(office_id) not in allowed:
                    return Duty.objects.none()
            queryset = queryset.filter(office_id=office_id)
        if user_id:
            queryset = queryset.filter(user_id=user_id)
        if schedule_id:
            queryset = queryset.filter(schedule_id=schedule_id)
        if date:
            queryset = queryset.filter(date=date)
        if duty_chart_id:
            queryset = queryset.filter(duty_chart_id=duty_chart_id)

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return
        allowed = get_allowed_office_ids(user)
        office_id = self.request.data.get("office")
        if office_id is None:
            chart_id = self.request.data.get("duty_chart")
            if chart_id:
                chart = DutyChart.objects.filter(id=chart_id).first()
                office_id = getattr(chart, "office_id", None)
        if not office_id or int(office_id) not in allowed:
            raise ValidationError("Not allowed to create duty for this office.")
        serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if IsSuperAdmin().has_permission(self.request, self):
            serializer.save()
            return
        allowed = get_allowed_office_ids(user)
        office_id = self.request.data.get("office") or getattr(serializer.instance, "office_id", None)
        if office_id is None:
            chart = getattr(serializer.instance, "duty_chart", None)
            office_id = getattr(chart, "office_id", None)
        if not office_id or int(office_id) not in allowed:
            raise ValidationError("Not allowed to update duty for this office.")
        serializer.save()

    @swagger_auto_schema(
        method="post",
        operation_description="Bulk create or update duties with shift values.",
        request_body=openapi.Schema(
            type=openapi.TYPE_ARRAY,
            items=openapi.Items(
                type=openapi.TYPE_OBJECT,
                properties={
                    "user": openapi.Schema(type=openapi.TYPE_INTEGER),
                    "office": openapi.Schema(type=openapi.TYPE_INTEGER),
                    "schedule": openapi.Schema(type=openapi.TYPE_INTEGER),
                    "date": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATE),
                    "is_completed": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                    "currently_available": openapi.Schema(type=openapi.TYPE_BOOLEAN),
                },
            ),
        ),
    )
    @action(detail=False, methods=["post"], url_path="bulk-upsert")
    def bulk_upsert(self, request):
        data = request.data
        if not IsSuperAdmin().has_permission(request, self):
            allowed = get_allowed_office_ids(request.user)
            for item in data:
                office_id = item.get("office")
                if not office_id or int(office_id) not in allowed:
                    raise ValidationError("Not allowed to upsert duty for this office.")
        created, updated = 0, 0
        for item in data:
            obj, was_created = Duty.objects.update_or_create(
                user_id=item["user"],
                office_id=item["office"],
                schedule_id=item["schedule"],
                date=item["date"],
                defaults={
                    "duty_chart_id": item.get("duty_chart"),
                    "is_completed": item.get("is_completed", False),
                    "currently_available": item.get("currently_available", True),
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1
        return Response({"created": created, "updated": updated}, status=status.HTTP_200_OK)

    @swagger_auto_schema(
        method="post",
        operation_description="Generate a rotation of duties for a user in a date range, cycling shifts.",
        request_body=openapi.Schema(
            type=openapi.TYPE_OBJECT,
            properties={
                "user": openapi.Schema(type=openapi.TYPE_INTEGER),
                "duty_chart": openapi.Schema(type=openapi.TYPE_INTEGER),
                "start_date": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATE),
                "end_date": openapi.Schema(type=openapi.TYPE_STRING, format=openapi.FORMAT_DATE),
                "pattern": openapi.Schema(
                    type=openapi.TYPE_ARRAY,
                    items=openapi.Items(type=openapi.TYPE_STRING),
                    description="List of shifts in order to rotate",
                ),
                "overwrite": openapi.Schema(type=openapi.TYPE_BOOLEAN, default=False),
            },
            required=["user", "duty_chart", "start_date", "end_date", "pattern"],
        ),
    )
    @action(detail=False, methods=["post"], url_path="generate-rotation")
    def generate_rotation(self, request):
        user_id = request.data["user"]
        chart_id = request.data["duty_chart"]
        start_date = request.data["start_date"]
        end_date = request.data["end_date"]
        pattern = request.data["pattern"]
        overwrite = request.data.get("overwrite", False)

        if not IsSuperAdmin().has_permission(request, self):
            chart = DutyChart.objects.filter(id=chart_id).first()
            office_id = getattr(chart, "office_id", None)
            allowed = get_allowed_office_ids(request.user)
            if not office_id or int(office_id) not in allowed:
                raise ValidationError("Not allowed to generate rotation for this office.")

        start = datetime.date.fromisoformat(start_date)
        end = datetime.date.fromisoformat(end_date)
        if end < start:
            return Response({"detail": "end_date must be after or equal to start_date"}, status=status.HTTP_400_BAD_REQUEST)

        days = (end - start).days + 1
        created, updated, skipped = 0, 0, 0

        for i in range(days):
            duty_date = start + timedelta(days=i)
            shift_val = pattern[i % len(pattern)]
            if overwrite:
                obj, was_created = Duty.objects.update_or_create(
                    user_id=user_id,
                    duty_chart_id=chart_id,
                    date=duty_date,
                    defaults={"shift": shift_val},
                )
                if was_created:
                    created += 1
                else:
                    updated += 1
            else:
                obj, was_created = Duty.objects.get_or_create(
                    user_id=user_id,
                    duty_chart_id=chart_id,
                    date=duty_date,
                    defaults={"shift": shift_val},
                )
                if was_created:
                    created += 1
                else:
                    skipped += 1

        return Response({"created": created, "updated": updated, "skipped": skipped}, status=status.HTTP_200_OK)


# ✅ New Roster Bulk Upload View:
class RosterBulkUploadView(APIView):
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    querryset = RosterAssignment.objects.all()

    @swagger_auto_schema(
        operation_description=("Bulk upload roster assignments from Excel.\n\n" f"**Required columns:** {', '.join(ALLOWED_HEADERS)}"),
        manual_parameters=[
            openapi.Parameter(
                name="file",
                in_=openapi.IN_FORM,
                type=openapi.TYPE_FILE,
                description=f'Excel file (.xls/.xlsx) with columns: {", ".join(ALLOWED_HEADERS)}',
                required=True,
            )
        ],
        responses={201: "Roster assignments created/updated successfully"},
    )
    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response({"detail": "File is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file_obj)
        except Exception as e:
            return Response({"detail": f"Invalid Excel file: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        # Normalize headers
        df.columns = [str(c).strip() for c in df.columns]

        # Strict header check
        if list(df.columns) != ALLOWED_HEADERS:
            missing = [c for c in ALLOWED_HEADERS if c not in df.columns]
            extra = [c for c in df.columns if c not in ALLOWED_HEADERS]
            msg_parts = []
            if missing:
                msg_parts.append(f"Missing columns: {', '.join(missing)}")
            if extra:
                msg_parts.append(f"Unexpected columns: {', '.join(extra)}")
            return Response({"detail": " | ".join(msg_parts)}, status=status.HTTP_400_BAD_REQUEST)

        created_count, updated_count, failed_count = 0, 0, 0
        errors = []

        for idx, row in df.iterrows():
            try:
                row_dict = {HEADER_MAP[col]: row[col] for col in ALLOWED_HEADERS}

                # Resolve office FK if needed
                if isinstance(row_dict.get("office"), str):
                    office_obj = Office.objects.filter(name__iexact=row_dict["office"]).first()
                    if not office_obj:
                        failed_count += 1
                        errors.append(f"Row {idx+2}: Office '{row_dict['office']}' not found")
                        continue
                    row_dict["office"] = office_obj

                serializer = RosterAssignmentSerializer(data=row_dict)
                serializer.is_valid(raise_exception=True)
                instance = serializer.save()

                # Track created vs updated
                if getattr(instance, "_state", None) and not instance._state.adding:
                    updated_count += 1
                else:
                    created_count += 1

            except Exception as e:
                failed_count += 1
                errors.append(f"Row {idx+2}: {e}")

        detail = f"Created: {created_count}, Updated: {updated_count}, Failed: {failed_count}"
        resp = {"detail": detail}
        if errors:
            resp["errors"] = errors[:10]  # Limit returned errors for safety

        return Response(resp, status=status.HTTP_201_CREATED)


# ------------------------------------------------------------------------------
# Duty Chart Export: Preview (JSON) and File (Excel/PDF)
# ------------------------------------------------------------------------------

class DutyChartExportPreview(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_description=("Preview duty data for a duty chart with optional date range and pagination."),
        manual_parameters=[
            openapi.Parameter("chart_id", openapi.IN_QUERY, description="Duty Chart ID", type=openapi.TYPE_INTEGER, required=True),
            openapi.Parameter("scope", openapi.IN_QUERY, description="Scope: 'full' or 'range'", type=openapi.TYPE_STRING, default="range"),
            openapi.Parameter("start_date", openapi.IN_QUERY, description="Start date (YYYY-MM-DD) when scope=range", type=openapi.TYPE_STRING),
            openapi.Parameter("end_date", openapi.IN_QUERY, description="End date (YYYY-MM-DD) when scope=range", type=openapi.TYPE_STRING),
            openapi.Parameter("page", openapi.IN_QUERY, description="Page number (default 1)", type=openapi.TYPE_INTEGER),
            openapi.Parameter("page_size", openapi.IN_QUERY, description="Items per page (default 50)", type=openapi.TYPE_INTEGER),
        ],
    )
    def get(self, request):
        chart_id = request.query_params.get("chart_id")
        scope = (request.query_params.get("scope") or "range").lower()
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        page = int(request.query_params.get("page") or 1)
        page_size = int(request.query_params.get("page_size") or 50)

        if not chart_id:
            return Response({"detail": "chart_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        chart = get_object_or_404(DutyChart, pk=int(chart_id))
        qs = Duty.objects.filter(duty_chart_id=chart.id).select_related("user", "office", "schedule")

        if scope == "range":
            if not start_date_str or not end_date_str:
                return Response({"detail": "start_date and end_date are required when scope=range"}, status=status.HTTP_400_BAD_REQUEST)
            start_date = parse_date(start_date_str)
            end_date = parse_date(end_date_str)
            if not start_date or not end_date:
                return Response({"detail": "Invalid start_date or end_date"}, status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(date__gte=start_date, date__lte=end_date)

        total = qs.count()
        offset = (page - 1) * page_size
        items = list(qs.order_by("date")[offset : offset + page_size])

        def duty_to_row(d: Duty):
            user = d.user
            office = d.office
            schedule = d.schedule
            return {
                "date": d.date.isoformat(),
                "employee_id": getattr(user, "employee_id", None),
                "full_name": getattr(user, "full_name", None) or getattr(user, "username", None),
                "phone_number": getattr(user, "phone_number", None),
                "directorate": getattr(getattr(user, "directorate", None), "name", None) if user else None,
                "department": getattr(getattr(user, "department", None), "name", None) if user else None,
                "office": getattr(office, "name", None) or (getattr(getattr(user, "office", None), "name", None) if user else None),
                "schedule": getattr(schedule, "name", None),
                "start_time": getattr(schedule, "start_time", None).strftime("%H:%M") if getattr(schedule, "start_time", None) else None,
                "end_time": getattr(schedule, "end_time", None).strftime("%H:%M") if getattr(schedule, "end_time", None) else None,
            }

        rows = [duty_to_row(d) for d in items]

        payload = {
            "chart": {
                "id": chart.id,
                "name": chart.name,
                "office": getattr(chart.office, "name", None),
                "effective_date": chart.effective_date.isoformat(),
                "end_date": chart.end_date.isoformat() if chart.end_date else None,
            },
            "columns": [
                {"key": "date", "label": "Date"},
                {"key": "employee_id", "label": "Employee ID"},
                {"key": "full_name", "label": "Employee Name"},
                {"key": "phone_number", "label": "Phone"},
                {"key": "directorate", "label": "Directorate"},
                {"key": "department", "label": "Department"},
                {"key": "office", "label": "Office"},
                {"key": "schedule", "label": "Schedule"},
                {"key": "start_time", "label": "Start Time"},
                {"key": "end_time", "label": "End Time"},
            ],
            "pagination": {"page": page, "page_size": page_size, "total": total},
            "rows": rows,
        }

        return Response(payload, status=status.HTTP_200_OK)


# ------------------------------------------------------------------------------
# Content Negotiation helper (keep your existing behavior)
# ------------------------------------------------------------------------------
from rest_framework.negotiation import DefaultContentNegotiation

class IgnoreFormatContentNegotiation(DefaultContentNegotiation):
    def get_format_suffix(self, request):
        return None  # Ignore the 'format' query parameter suffix


# ------------------------------------------------------------------------------
# UPDATED: DutyChartExportFile (Excel/PDF/DOCX)
#   ✅ PDF = WeasyPrint only + Nepali font family names
#   ✅ Works reliably in Linux/Docker (your intended runtime)
# ------------------------------------------------------------------------------
class DutyChartExportFile(APIView):
    permission_classes = [permissions.IsAuthenticated]
    content_negotiation_class = IgnoreFormatContentNegotiation

    def get(self, request):
        chart_id = request.query_params.get("chart_id")
        out_format = (request.query_params.get("export_format") or request.query_params.get("format") or "").lower()
        scope = (request.query_params.get("scope") or "range").lower()
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")

        if not chart_id:
            return Response({"detail": "chart_id is required"}, status=status.HTTP_400_BAD_REQUEST)

        chart = get_object_or_404(DutyChart, pk=int(chart_id))
        qs = Duty.objects.filter(duty_chart_id=chart.id).select_related("user", "office", "schedule")

        if scope == "range":
            if not start_date_str or not end_date_str:
                return Response({"detail": "start_date and end_date are required when scope=range"}, status=status.HTTP_400_BAD_REQUEST)
            start_date = parse_date(start_date_str)
            end_date = parse_date(end_date_str)
            if not start_date or not end_date:
                return Response({"detail": "Invalid start_date or end_date"}, status=status.HTTP_400_BAD_REQUEST)
            qs = qs.filter(date__gte=start_date, date__lte=end_date)

        rows = []
        for d in qs.order_by("date"):
            user = d.user
            office = d.office
            schedule = d.schedule
            pos = getattr(user, "position", None) if user else None

            rows.append(
                [
                    d.date.isoformat(),
                    getattr(user, "employee_id", "") or "",
                    (getattr(user, "full_name", "") or getattr(user, "username", "")) if user else "",
                    getattr(user, "phone_number", "") if user else "",
                    getattr(getattr(user, "directorate", None), "name", "") if user else "",
                    getattr(getattr(user, "department", None), "name", "") if user else "",
                    getattr(office, "name", "") or (getattr(getattr(user, "office", None), "name", "") if user else ""),
                    getattr(schedule, "name", "") or "",
                    getattr(schedule, "start_time", None).strftime("%H:%M") if getattr(schedule, "start_time", None) else "",
                    getattr(schedule, "end_time", None).strftime("%H:%M") if getattr(schedule, "end_time", None) else "",
                    getattr(pos, "name", "-") if pos else "-",
                ]
            )

        # ---------------- Excel ----------------
        if out_format == "excel":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Duty Export"
            headers = ["Date", "Employee ID", "Employee Name", "Phone", "Directorate", "Department", "Office", "Schedule", "Start Time", "End Time", "Position"]
            ws.append(headers)
            for r in rows:
                ws.append(r)
            bio = BytesIO()
            wb.save(bio)
            bio.seek(0)
            filename = f"duty_chart_{chart.id}_{datetime.date.today().isoformat()}.xlsx"
            resp = HttpResponse(bio.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            resp["Content-Disposition"] = f'attachment; filename="{filename}"'
            return resp

        # ---------------- PDF (WeasyPrint ONLY) ----------------
        if out_format == "pdf":
            # Lazy import so Windows host doesn't need GTK (you will run this inside Docker anyway)
            try:
                from weasyprint import HTML, CSS
                from weasyprint.text.fonts import FontConfiguration
            except Exception as e:
                return Response(
                    {
                        "detail": (
                            "WeasyPrint is not available in this runtime. "
                            "Run PDF export inside Docker (Linux image) where WeasyPrint deps are installed. "
                            f"Error: {str(e)}"
                        )
                    },
                    status=status.HTTP_501_NOT_IMPLEMENTED,
                )

            headers_np = ["सि.नं.", "पद", "नाम", "सम्पर्क नं.", "कामको बिवरण", "लक्ष्य", "समय सिमा", "कैफियत"]

            table_rows_html = ""
            for idx, r in enumerate(rows, start=1):
                row_data = [str(idx), r[10], r[2], r[3], "", "", r[0], ""]
                table_rows_html += "<tr>" + "".join([f"<td>{cell}</td>" for cell in row_data]) + "</tr>"

            html_str = f"""
            <html>
            <head>
                <meta charset="utf-8" />
            </head>
            <body>
                <div class="center header">
                    <div class="bold">अनुसूची-१</div>
                    <div>(परिच्छेद - ३ को दफा ८ र १० सँग सम्बन्धित)</div>
                    <div class="bold title">नेपाल दूरसंचार कम्पनी लिमिटेड (नेपाल टेलिकम)</div>
                    <div class="bold">सिफ्ट ड्यूटीमा खटाउनु अघि भर्नु पर्ने बिवरण</div>
                </div>

                <div class="meta">
                    <div><strong>कार्यालयको नाम:-</strong> {getattr(chart.office, 'name', '-')}</div>
                    <div><strong>बिभाग/शाखाको नाम:-</strong> Integrated Network Operation Center (iNOC)</div>
                    <div><strong>मिति:-</strong> {start_date_str or chart.effective_date} देखि {end_date_str or chart.end_date}</div>
                    <div><strong>ड्यूटीको बर्गिकरण:-</strong> {chart.name or "-"}</div>
                </div>

                <table>
                    <thead>
                        <tr>{"".join([f"<th>{h}</th>" for h in headers_np])}</tr>
                    </thead>
                    <tbody>
                        {table_rows_html}
                    </tbody>
                </table>

                <div class="note">
                    कम्पनीको सिफ्ट ड्यूटी निर्देशिका बमोजिम तपाईंहरुलाई माथि उल्लेखित समयसीमा भित्र कार्य सम्पन्न गर्ने गरी ड्यूटीमा खटाईएको छ |
                    उक्त कार्य सम्पन्न गरे पश्चात् अनुसूची २ बमोजिम कार्य सम्पन्न गरेको प्रमाणित गराई पेश गर्नुहुन अनुरोध छ |
                </div>

                <div class="sign">
                    <strong>काममा खटाउने अधिकार प्राप्त पदाधिकारीको बिवरण:-</strong><br/>
                    नाम:- <br/>
                    पद:- <br/>
                    दस्तखत:- <br/>
                    मिति:-
                </div>
            </body>
            </html>
            """

            css_str = """
            @page { size: A4; margin: 1.5cm; }
            body {
                font-family: "Noto Sans Devanagari", "Nirmala UI", "Mangal", "DejaVu Sans", sans-serif;
                font-size: 10pt;
                line-height: 1.4;
            }
            .center { text-align: center; }
            .bold { font-weight: bold; }
            .header { margin-bottom: 25px; }
            .title { font-size: 14pt; }
            .meta { margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #000; padding: 5px; text-align: left; vertical-align: top; }
            th { background: #f2f2f2; font-weight: bold; }
            .note { margin-top: 25px; }
            .sign { margin-top: 30px; }
            """

            try:
                font_config = FontConfiguration()
                pdf_bytes = HTML(string=html_str, base_url=".").write_pdf(
                    stylesheets=[CSS(string=css_str, font_config=font_config)],
                    font_config=font_config,
                )
            except Exception as e:
                return Response({"detail": f"PDF generation failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            filename = f"duty_chart_{chart.id}_{datetime.date.today().isoformat()}.pdf"
            resp = HttpResponse(pdf_bytes, content_type="application/pdf")
            resp["Content-Disposition"] = f'attachment; filename="{filename}"'
            return resp

        # ---------------- DOCX ----------------
        if out_format == "docx":
            doc = Document()

            style = doc.styles["Normal"]
            style.font.size = Pt(11)

            p = doc.add_paragraph("अनुसूची-१\n(परिच्छेद - ३ को दफा ८ र १० सँग सम्बन्धित)")
            p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
            p.runs[0].bold = True

            p = doc.add_paragraph("नेपाल दूरसंचार कम्पनी लिमिटेड (नेपाल टेलिकम)")
            p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

            p = doc.add_paragraph("सिफ्ट ड्यूटीमा खटाउनु अघि भर्नु पर्ने बिवरण")
            p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

            doc.add_paragraph("")

            meta = doc.add_paragraph()
            meta.add_run("कार्यालयको नाम:- ").bold = True
            meta.add_run(getattr(chart.office, "name", "-"))
            meta.add_run("\n")

            meta.add_run("बिभाग/शाखाको नाम:- ").bold = True
            meta.add_run("Integrated Network Operation Center (iNOC)")
            meta.add_run("\n")

            meta.add_run("मिति:- ").bold = True
            meta.add_run(f"{start_date_str or chart.effective_date} देखि {end_date_str or chart.end_date}")
            meta.add_run("\n")

            meta.add_run("ड्यूटीको बर्गिकरण:- ").bold = True
            meta.add_run(chart.name or "-")
            meta.add_run("\n")

            meta.add_run("काममा खटाईएको बिवरण:- ").bold = True
            doc.add_paragraph("")

            headers = ["सि.नं.", "पद", "नाम", "सम्पर्क नं.", "कामको बिवरण", "लक्ष्य", "समय सिमा", "कैफियत"]

            table = doc.add_table(rows=1, cols=len(headers))
            table.style = "Table Grid"
            for i, h in enumerate(headers):
                table.rows[0].cells[i].text = h

            for idx, r in enumerate(rows, start=1):
                cells = table.add_row().cells
                cells[0].text = str(idx)
                cells[1].text = r[10]  # Position
                cells[2].text = r[2]   # Name
                cells[3].text = r[3]   # Phone
                cells[4].text = ""
                cells[5].text = ""
                cells[6].text = r[0]   # Date
                cells[7].text = ""

            doc.add_paragraph("")
            doc.add_paragraph(
                "कम्पनीको सिफ्ट ड्यूटी निर्देशिका बमोजिम तपाईंहरुलाई माथि उल्लेखित समयसीमा भित्र कार्य सम्पन्न गर्ने गरी ड्यूटीमा खटाईएको छ | "
                "उक्त कार्य सम्पन्न गरे पश्चात् अनुसूची २ बमोजिम कार्य सम्पन्न गरेको प्रमाणित गराई पेश गर्नुहुन अनुरोध छ |"
            )

            doc.add_paragraph("")
            doc.add_paragraph("काममा खटाउने अधिकार प्राप्त पदाधिकारीको बिवरण:-")
            sign = doc.add_paragraph()
            sign.add_run("नाम:- \nपद:- \nदस्तखत:- \nमिति:- ")

            bio = BytesIO()
            doc.save(bio)
            bio.seek(0)

            filename = f"duty_chart_{chart.id}_{datetime.date.today().isoformat()}.docx"
            resp = HttpResponse(
                bio.getvalue(),
                content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
            resp["Content-Disposition"] = f'attachment; filename="{filename}"'
            return resp

        return Response({"detail": f"Unsupported format: {out_format}"}, status=status.HTTP_400_BAD_REQUEST)


class DutyChartImportTemplateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Download Excel template for duty chart import.",
        manual_parameters=[
            openapi.Parameter("office_id", openapi.IN_QUERY, type=openapi.TYPE_INTEGER, required=True),
            openapi.Parameter("start_date", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=True),
            openapi.Parameter("end_date", openapi.IN_QUERY, type=openapi.TYPE_STRING, required=True),
            openapi.Parameter("schedule_ids", openapi.IN_QUERY, type=openapi.TYPE_ARRAY, items=openapi.Items(type=openapi.TYPE_INTEGER), required=True),
        ],
    )
    def get(self, request):
        office_id = request.query_params.get("office_id")
        start_date_str = request.query_params.get("start_date")
        end_date_str = request.query_params.get("end_date")
        # Handle both 'schedule_ids' and Axios-style 'schedule_ids[]'
        schedule_ids = request.query_params.getlist("schedule_ids") or request.query_params.getlist("schedule_ids[]")

        missing = []
        if not office_id: missing.append("office_id")
        if not start_date_str: missing.append("start_date")
        if not end_date_str: missing.append("end_date")
        if not schedule_ids: missing.append("schedule_ids")

        if missing:
            return Response({"detail": f"Missing parameters: {', '.join(missing)}"}, status=status.HTTP_400_BAD_REQUEST)

        office = get_object_or_404(Office, pk=int(office_id))
        start_date = parse_date(start_date_str)
        end_date = parse_date(end_date_str)
        schedules = Schedule.objects.filter(id__in=[int(sid) for sid in schedule_ids])

        if not (start_date and end_date):
            return Response({"detail": "Invalid dates"}, status=status.HTTP_400_BAD_REQUEST)

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Duty Import Template"

        headers = ["Date", "Employee ID", "Employee Name", "Phone", "Directorate", "Department", "Office", "Schedule", "Start Time", "End Time", "Position"]
        ws.append(headers)

        days = (end_date - start_date).days + 1
        row_idx = 2
        for sch in schedules:
            for i in range(days):
                duty_date = start_date + timedelta(days=i)
                # Formulas for lookup from Reference sheet
                # Ref Sheet Col Order: Full Name (A), ID (B), Phone (C), Dir (D), Dept (E), Pos (F), Combined (G)
                match_val = f"MATCH(B{row_idx}, 'Reference - Office Users'!$G$2:$G$1000, 0)"
                
                def get_f(col_idx):
                    ref_col = f"'Reference - Office Users'!${chr(64+col_idx)}2:${chr(64+col_idx)}1000"
                    return f'=IF(B{row_idx}<>"", IFERROR(INDEX({ref_col}, {match_val}), ""), "")'

                f_name = get_f(1) # Full Name
                f_phone = get_f(3)
                f_dir = get_f(4)
                f_dept = get_f(5)
                f_pos = get_f(6)

                ws.append([
                    duty_date.isoformat(),
                    "",       # Employee ID (Dropdown: ID - Name)
                    f_name,   # Employee Name (Auto-populated)
                    f_phone,
                    f_dir,
                    f_dept,
                    office.name,
                    sch.name,
                    sch.start_time.strftime("%H:%M"),
                    sch.end_time.strftime("%H:%M"),
                    f_pos
                ])
                row_idx += 1

        # Add Data Validation (Combined ID - Name Dropdown)
        from openpyxl.worksheet.datavalidation import DataValidation
        dv = DataValidation(type="list", formula1="'Reference - Office Users'!$G$2:$G$1000", allow_blank=True)
        dv.add(f"B2:B{row_idx}")
        ws.add_data_validation(dv)
        
        # Auto-adjust column width for Column B (Employee ID)
        ws.column_dimensions['B'].width = 30

        # Add a sheet for reference users from this office
        ws_users = wb.create_sheet("Reference - Office Users")
        # Column Order: Full Name, Employee ID, Phone, Directorate, Department, Position, ID - Name
        ws_users.append(["Full Name", "Employee ID", "Phone", "Directorate", "Department", "Position", "ID - Name"])
        from users.models import User
        users = User.objects.filter(office=office)
        for u in users:
            ws_users.append([
                u.full_name,
                u.employee_id,
                u.phone_number,
                getattr(u.directorate, 'name', ''),
                getattr(u.department, 'name', ''),
                getattr(u.position, 'name', ''),
                f"{u.employee_id} - {u.full_name}"
            ])

        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)

        filename = f"duty_template_{office.name}_{start_date_str}.xlsx"
        resp = HttpResponse(bio.getvalue(), content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = f'attachment; filename="{filename}"'
        return resp


class DutyChartImportView(APIView):
    permission_classes = [AdminOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    @swagger_auto_schema(
        operation_description="Import duty chart from filled Excel template.",
        manual_parameters=[
            openapi.Parameter("office", openapi.IN_FORM, type=openapi.TYPE_INTEGER, required=True),
            openapi.Parameter("name", openapi.IN_FORM, type=openapi.TYPE_STRING, required=True),
            openapi.Parameter("effective_date", openapi.IN_FORM, type=openapi.TYPE_STRING, required=True),
            openapi.Parameter("end_date", openapi.IN_FORM, type=openapi.TYPE_STRING, required=False),
            openapi.Parameter("file", openapi.IN_FORM, type=openapi.TYPE_FILE, required=True),
        ],
    )
    def post(self, request):
        file_obj = request.FILES.get("file")
        office_id = request.data.get("office")
        name = request.data.get("name")
        effective_date_str = request.data.get("effective_date")
        end_date_str = request.data.get("end_date")
        schedule_ids = request.data.getlist("schedule_ids") # Might be optional if inferred from file

        if not (file_obj and office_id and effective_date_str):
            return Response({"detail": "file, office, and effective_date are required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            df = pd.read_excel(file_obj)
        except Exception as e:
            return Response({"detail": f"Invalid Excel file: {e}"}, status=status.HTTP_400_BAD_REQUEST)

        office = get_object_or_404(Office, pk=int(office_id))
        
        from users.models import User

        # 1. Create Duty Chart
        chart = DutyChart.objects.create(
            office=office,
            name=name,
            effective_date=parse_date(effective_date_str),
            end_date=parse_date(end_date_str) if end_date_str else None
        )
        if schedule_ids:
            chart.schedules.set([int(sid) for sid in schedule_ids])

        created_count = 0
        errors = []

        # 2. Parse Rows and Create Duties
        for idx, row in df.iterrows():
            row_date_val = row.get("Date")
            emp_id = row.get("Employee ID")
            emp_name = row.get("Employee Name")
            sch_name = row.get("Schedule")
            
            # If both ID and Name are missing, skip
            if (pd.isna(emp_id) or not str(emp_id).strip()) and (pd.isna(emp_name) or not str(emp_name).strip()):
                continue

            try:
                # Find User - prioritize ID, fallback to Name
                user = None
                emp_id_str = str(emp_id).strip() if not pd.isna(emp_id) else ""
                
                # If Employee ID contains " - ", extract the ID part
                if " - " in emp_id_str:
                    emp_id_str = emp_id_str.split(" - ")[0].strip()

                if emp_id_str:
                    user = User.objects.filter(employee_id__iexact=emp_id_str).first()
                
                if not user and not pd.isna(emp_name) and str(emp_name).strip():
                    user = User.objects.filter(full_name__iexact=str(emp_name).strip()).first() or \
                           User.objects.filter(username__iexact=str(emp_name).strip()).first()

                if not user:
                    errors.append(f"Row {idx+2}: User '{emp_id or emp_name}' not found.")
                    continue

                # Find Schedule
                schedule = Schedule.objects.filter(name=str(sch_name).strip(), office=office).first()
                if not schedule:
                    # Fallback to global schedule if not found in office
                    schedule = Schedule.objects.filter(name=str(sch_name).strip(), office__isnull=True).first()
                
                if not schedule:
                    errors.append(f"Row {idx+2}: Schedule '{sch_name}' not found.")
                    continue

                # Parse Date
                if isinstance(row_date_val, datetime.datetime):
                    duty_date = row_date_val.date()
                else:
                    duty_date = parse_date(str(row_date_val))

                if not duty_date:
                    errors.append(f"Row {idx+2}: Invalid date format.")
                    continue

                Duty.objects.create(
                    user=user,
                    office=office,
                    schedule=schedule,
                    date=duty_date,
                    duty_chart=chart
                )
                created_count += 1
            except Exception as e:
                errors.append(f"Row {idx+2}: {str(e)}")

        return Response({
            "detail": "Import complete",
            "chart_id": chart.id,
            "created_duties": created_count,
            "errors": errors[:10]
        }, status=status.HTTP_201_CREATED)

