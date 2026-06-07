from django.shortcuts import render
from django.db import transaction
from rest_framework import viewsets, permissions, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from pyaxmlparser import APK
import os
import pandas as pd
import logging
from django.conf import settings
from django.utils.dateparse import parse_date
from users.permissions import SuperAdminOrReadOnly
from authentication.permissions import HasMobileAPIToken
from .models import Directorate, Department, Office, SystemSetting, AccountingOffice, CCOffice, WorkingOffice, Holiday
from .serializers import (
    DirectorateSerializer, DepartmentSerializer, 
    OfficeSerializer, SystemSettingSerializer,
    AccountingOfficeSerializer, CCOfficeSerializer, WorkingOfficeSerializer,
    HolidaySerializer
)

logger = logging.getLogger(__name__)

# Create your views here.

from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 15
    page_size_query_param = 'page_size'
    max_page_size = 100

class DirectorateViewSet(viewsets.ModelViewSet):
    queryset = Directorate.objects.all().order_by('id')
    serializer_class = DirectorateSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [(HasMobileAPIToken | SuperAdminOrReadOnly)()]
        return [SuperAdminOrReadOnly()]

    def get_queryset(self):
        queryset = Directorate.objects.all().order_by('id')
        search = self.request.query_params.get('search', None)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(directorate__icontains=search) | Q(parent__directorate__icontains=search))
        return queryset

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == 'true':
            return None
        return super().paginate_queryset(queryset)

    @transaction.atomic
    def perform_create(self, serializer):
        directorate_instance = serializer.save()
        WorkingOffice.objects.create(
            name=directorate_instance.directorate,
            directorate=directorate_instance
        )

    @transaction.atomic
    def perform_update(self, serializer):
        directorate_instance = serializer.save()
        WorkingOffice.objects.filter(directorate=directorate_instance).update(
            name=directorate_instance.directorate
        )

class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [(HasMobileAPIToken | SuperAdminOrReadOnly)()]
        return [SuperAdminOrReadOnly()]

    def get_queryset(self):
        queryset = Department.objects.all()
        directorate_id = self.request.query_params.get('directorate', None)
        if directorate_id:
            queryset = queryset.filter(directorate_id=directorate_id)
        return queryset

class OfficeViewSet(viewsets.ModelViewSet):
    queryset = WorkingOffice.objects.all()
    serializer_class = WorkingOfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = None

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [(HasMobileAPIToken | SuperAdminOrReadOnly)()]
        return [SuperAdminOrReadOnly()]

    def get_queryset(self):
        queryset = WorkingOffice.objects.select_related(
            'directorate', 'ac_office', 'ac_office__directorate', 'cc_office',
            'parent', 'parent__directorate', 'parent__ac_office', 'parent__ac_office__directorate',
            'parent__parent', 'parent__parent__directorate'
        ).all()
        
        user = self.request.user
        if user and user.is_authenticated:
            # Check permissions to see if they can view all offices
            from users.permissions import user_has_permission_slug
            can_see_all = getattr(user, 'role', None) == 'SUPERADMIN' or \
                          user_has_permission_slug(user, 'duties.view_any_office_chart') or \
                          user_has_permission_slug(user, 'duties.create_any_office_chart')
            
            if not can_see_all and getattr(user, 'office_id', None):
                queryset = queryset.filter(id=user.office_id)
                
        return queryset

class AccountingOfficeViewSet(viewsets.ModelViewSet):
    queryset = AccountingOffice.objects.all().order_by('id')
    serializer_class = AccountingOfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [(HasMobileAPIToken | SuperAdminOrReadOnly)()]
        return [SuperAdminOrReadOnly()]

    def get_queryset(self):
        queryset = AccountingOffice.objects.all().order_by('id')
        search = self.request.query_params.get('search', None)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(name__icontains=search) | Q(directorate__directorate__icontains=search))
        return queryset

    def paginate_queryset(self, queryset):
        if self.request.query_params.get('all') == 'true':
            return None
        return super().paginate_queryset(queryset)

class CCOfficeViewSet(viewsets.ModelViewSet):
    queryset = CCOffice.objects.all().order_by('id')
    serializer_class = CCOfficeSerializer
    permission_classes = [SuperAdminOrReadOnly]
    pagination_class = StandardResultsSetPagination

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [(HasMobileAPIToken | SuperAdminOrReadOnly)()]
        return [SuperAdminOrReadOnly()]

    def get_queryset(self):
        queryset = CCOffice.objects.all().order_by('id')
        search = self.request.query_params.get('search', None)
        if search:
            from django.db.models import Q
            queryset = queryset.filter(Q(name__icontains=search) | Q(accounting_office__name__icontains=search))
        return queryset

class SystemSettingViewSet(viewsets.ModelViewSet):
    queryset = SystemSetting.objects.all()
    serializer_class = SystemSettingSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_permissions(self):
        if self.action in ['update', 'partial_update', 'create', 'destroy']:
            return [permissions.IsAdminUser()]
        return [permissions.IsAuthenticated()]

    def list(self, request, *args, **kwargs):
        setting = SystemSetting.objects.first()
        if not setting:
            setting = SystemSetting.objects.create()
        serializer = self.get_serializer(setting)
        return Response(serializer.data)

    @action(detail=False, methods=['post'], parser_classes=[MultiPartParser, FormParser])
    def upload_apk(self, request):
        if not request.user.is_superuser and request.user.role != 'SUPERADMIN':
            return Response({"error": "Only Super Admins can upload APKs"}, status=status.HTTP_403_FORBIDDEN)
        
        file_obj = request.FILES.get('apk')
        if not file_obj:
            return Response({"error": "No APK file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file_obj.name.endswith('.apk'):
            return Response({"error": "Only .apk files are allowed"}, status=status.HTTP_400_BAD_REQUEST)

        target_dir = os.path.join(settings.BASE_DIR, 'mobileApp')
        if not os.path.exists(target_dir) and os.path.exists(os.path.join(settings.BASE_DIR.parent, 'mobileApp')):
             target_dir = os.path.join(settings.BASE_DIR.parent, 'mobileApp')
             
        if not os.path.exists(target_dir):
            os.makedirs(target_dir, exist_ok=True)
        
        file_path = os.path.join(target_dir, file_obj.name)
        
        try:
            with open(file_path, 'wb+') as destination:
                for chunk in file_obj.chunks():
                    destination.write(chunk)
            
            try:
                apk_data = APK(file_path)
                version_name = apk_data.version_name
            except Exception as version_error:
                print(f"Error extracting version: {version_error}")
                version_name = None

            setting = SystemSetting.objects.first()
            if not setting:
                setting = SystemSetting.objects.create()
            
            relative_path = f"mobileApp/{file_obj.name}"
            if setting.latest_app_version:
                setting.old_app_version = setting.latest_app_version
            
            setting.app_update_url = relative_path
            if version_name:
                setting.latest_app_version = version_name
            
            setting.save()

            return Response({
                "message": "APK uploaded successfully",
                "filename": file_obj.name,
                "url": relative_path,
                "version": version_name
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({"error": f"Failed to save APK: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class HolidayViewSet(viewsets.ModelViewSet):
    queryset = Holiday.objects.all().order_by('date')
    serializer_class = HolidaySerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    @action(detail=False, methods=['post'], url_path='preview-upload')
    def preview_upload(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({"error": "No file provided"}, status=400)
        
        try:
            import nepali_datetime
            from datetime import timedelta
            
            # Read all sheets
            xls = pd.ExcelFile(file)
            all_dfs = []
            for sheet_name in xls.sheet_names:
                df_sheet = pd.read_excel(xls, sheet_name=sheet_name)
                # Normalize columns for this sheet
                df_sheet.columns = [str(c).strip().lower() for c in df_sheet.columns]
                
                # Check if this sheet has at least some useful data
                if any(k in df_sheet.columns for k in ['date', 'date (bs)', 'date(bs)', 'bs date']):
                    all_dfs.append(df_sheet)
            
            if not all_dfs:
                return Response({"error": "No valid data found in any Excel sheet."}, status=400)
            
            df = pd.concat(all_dfs, ignore_index=True)
            
            # Map common names
            col_map = {
                'date (bs)': 'date_bs',
                'date(bs)': 'date_bs',
                'bs date': 'date_bs',
                'date': 'date',
                'holiday name': 'name',
                'holiday_name': 'name',
                'name': 'name',
                'days': 'days',
                'duration': 'days',
                'is_public': 'is_public',
                'public': 'is_public'
            }
            df = df.rename(columns=col_map)
            
            # Re-check columns after rename
            has_date = 'date' in df.columns
            has_date_bs = 'date_bs' in df.columns
            has_name = 'name' in df.columns
            
            if not (has_date or has_date_bs) or not has_name:
                return Response({
                    "error": "Missing required columns in merged data. Please ensure your file has 'Date (BS)' or 'Date' and 'Holiday Name'.",
                    "found_columns": list(df.columns)
                }, status=400)
            
            preview_data = []
            skipped_rows = []
            
            for i, row in df.iterrows():
                try:
                    d_parsed_list = [] # We'll store all expanded days here
                    
                    # 1. Try BS Date first
                    if has_date_bs and pd.notnull(row['date_bs']):
                        bs_val = str(row['date_bs']).strip()
                        if ' ' in bs_val: bs_val = bs_val.split(' ')[0]
                        
                        parts = []
                        if '/' in bs_val: parts = bs_val.split('/')
                        elif '-' in bs_val: parts = bs_val.split('-')
                        elif '.' in bs_val: parts = bs_val.split('.')
                        
                        if len(parts) == 3:
                            try:
                                p1, p2, p3 = map(int, parts)
                                bs_date = None
                                if p1 > 1000: # YYYY/MM/DD
                                    bs_date = nepali_datetime.date(p1, p2, p3)
                                elif p3 > 1000: # DD/MM/YYYY
                                    bs_date = nepali_datetime.date(p3, p2, p1)
                                
                                if bs_date:
                                    days = 1
                                    if 'days' in df.columns and pd.notnull(row['days']):
                                        try: days = int(float(row['days']))
                                        except: pass
                                    
                                    name = str(row.get('name', 'Holiday')).strip()
                                    if name == 'nan' or not name: name = "Holiday"
                                    
                                    is_public = row.get('is_public', True)
                                    if isinstance(is_public, str):
                                        is_public = is_public.lower() in ['true', 'yes', '1']
                                    
                                    for d_offset in range(days):
                                        # Use standard datetime.timedelta
                                        curr = bs_date + timedelta(days=d_offset)
                                        d_parsed_list.append({
                                            "date": str(curr.to_datetime_date()),
                                            "name": name if days == 1 else f"{name} (Day {d_offset + 1})",
                                            "is_public": bool(is_public)
                                        })
                            except Exception as e:
                                logger.error(f"BS Parse Error row {i}: {e}")

                    # 2. Try AD Date if no BS date found
                    if not d_parsed_list and has_date and pd.notnull(row['date']):
                        d = row['date']
                        ad_date = None
                        if isinstance(d, str): ad_date = parse_date(d)
                        elif hasattr(d, 'date'): ad_date = d.date()
                        
                        if ad_date:
                            name = str(row.get('name', 'Holiday')).strip()
                            d_parsed_list.append({
                                "date": str(ad_date),
                                "name": name if name != 'nan' else "Holiday",
                                "is_public": True
                            })

                    # 3. Add to results or skip
                    if d_parsed_list:
                        preview_data.extend(d_parsed_list)
                    else:
                        skipped_rows.append({
                            "row": i + 2,
                            "reason": "Could not parse date from provided columns",
                            "data": str(row.to_dict())
                        })

                except Exception as row_err:
                    logger.error(f"Row {i} fatal error: {row_err}")
                    skipped_rows.append({"row": i + 2, "reason": str(row_err)})
            
            return Response({
                "preview": preview_data,
                "skipped": skipped_rows,
                "total_rows": len(df)
            })
        except Exception as e:
            import traceback
            traceback.print_exc()
            return Response({"error": str(e)}, status=400)

    @action(detail=False, methods=['post'], url_path='bulk-upload')
    def bulk_upload(self, request):
        holidays_data = request.data
        if not isinstance(holidays_data, list):
            return Response({"error": "Expected a list of holidays"}, status=400)
        
        try:
            with transaction.atomic():
                count = 0
                for item in holidays_data:
                    Holiday.objects.update_or_create(
                        date=item['date'],
                        defaults={
                            'name': item['name'],
                            'is_public': item.get('is_public', True)
                        }
                    )
                    count += 1
            return Response({"message": f"Successfully uploaded {count} holidays"})
        except Exception as e:
            return Response({"error": str(e)}, status=400)
