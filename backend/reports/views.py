# reports/views.py
import io
from datetime import datetime

from django.http import FileResponse
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model

from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
import openpyxl
from openpyxl.styles import Font, Alignment, Border, Side

from duties.models import Duty, DutyChart
from .permissions import IsAdminOrSelf

User = get_user_model()


# ---------------------------
# Helper: Parse user_id[] or comma-separated
# ---------------------------
def _parse_user_ids(request):
    raw = request.GET.getlist("user_id[]") or request.GET.getlist("user_id")
    if not raw:
        s = request.GET.get("user_id")
        if s:
            raw = [s]

    ids = []
    for entry in raw:
        for part in str(entry).split(","):
            try:
                ids.append(int(part.strip()))
            except Exception:
                continue

    # dedupe, preserve order
    seen, out = set(), []
    for i in ids:
        if i not in seen:
            seen.add(i)
            out.append(i)
    return out


# ---------------------------
# Duty options (dropdown)
# ---------------------------
class DutyOptionsView(APIView):
    permission_classes = [IsAdminOrSelf]

    def get(self, request):
        qs = DutyChart.objects.all().order_by("effective_date")
        return Response([
            {"id": c.id, "name": c.name or f"{c.office.name} - {c.effective_date}"}
            for c in qs
        ])


# ---------------------------
# Preview JSON (unchanged behavior)
# ---------------------------
class DutyReportPreviewView(APIView):
    permission_classes = [IsAdminOrSelf]

    def get(self, request):
        date_from = request.GET.get("date_from")
        date_to = request.GET.get("date_to")
        if not (date_from and date_to):
            return Response({"groups": []})

        all_users = request.GET.get("all_users") == "1"
        user_ids = [] if all_users else _parse_user_ids(request)
        duty_id = request.GET.get("duty_id")

        if not request.user.is_staff:
            user_ids = [request.user.id]

        qs = Duty.objects.select_related("user", "schedule", "office").filter(
            date__range=[date_from, date_to]
        )

        if user_ids:
            qs = qs.filter(user_id__in=user_ids)
        elif duty_id:
            qs = qs.filter(duty_chart_id=duty_id)

        qs = qs.order_by("user_id", "date", "schedule__start_time")

        groups = {}
        for d in qs:
            uid = d.user.id
            groups.setdefault(uid, {
                "user_id": uid,
                "user_name": getattr(d.user, "full_name", str(d.user)),
                "employee_id": getattr(d.user, "employee_id", "-"),
                "office": d.office.name if d.office else "-",
                "rows": []
            })["rows"].append({
                "id": d.id,
                "date": str(d.date),
                "weekday": d.date.strftime("%A"),
                "schedule": getattr(d.schedule, "name", "-"),
                "start_time": str(d.schedule.start_time) if d.schedule else "-",
                "end_time": str(d.schedule.end_time) if d.schedule else "-",
                "is_completed": d.is_completed,
                "currently_available": d.currently_available,
            })

        return Response({"groups": list(groups.values())})


# ---------------------------
# DOCX EXPORT — अनुसूची-१
# FULL REPLACEMENT (FINAL)
# ---------------------------
class DutyReportFileView(APIView):
    permission_classes = [IsAdminOrSelf]

    def get(self, request):
        # -----------------------
        # PARAMS
        # -----------------------
        duty_id = request.GET.get("duty_id")
        all_users = request.GET.get("all_users") == "1"
        date_from = request.GET.get("date_from")
        date_to = request.GET.get("date_to")

        # -----------------------
        # FULL CHART MODE
        # -----------------------
        if all_users and duty_id:
            try:
                chart = DutyChart.objects.get(id=duty_id)
                date_from = chart.effective_date
                date_to = chart.end_date or chart.effective_date
            except DutyChart.DoesNotExist:
                return Response({"error": "Invalid duty chart"}, status=400)

        # -----------------------
        # RANGE MODE VALIDATION
        # -----------------------
        if not (date_from and date_to):
            return Response({"error": "Missing dates"}, status=400)

        # -----------------------
        # QUERYSET
        # -----------------------
        qs = Duty.objects.select_related(
            "user", "schedule", "office"
        ).filter(
            date__range=[date_from, date_to]
        )

        if duty_id:
            qs = qs.filter(duty_chart_id=duty_id)

        if not request.user.is_staff:
            qs = qs.filter(user=request.user)

        qs = qs.order_by("date", "schedule__start_time")

        # -----------------------
        # EXCEL GENERATION
        # -----------------------
        fmt = request.GET.get("format", "docx")
        if fmt == "excel":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Duty Chart"

            # Headers
            headers = [
                "SN", "Designation", "Name", "Phone", 
                "Work Description", "Target", "Timeline", "Remarks"
            ]
            ws.append(headers)

            # Styling Headers
            for cell in ws[1]:
                cell.font = Font(bold=True)
                cell.alignment = Alignment(horizontal="center")

            # Data
            sn = 1
            for d in qs:
                row = [
                    sn,
                    getattr(d.user.position, "name", "-") if d.user.position else "-",
                    getattr(d.user, "full_name", "-"),
                    getattr(d.user, "phone_number", "-"),
                    "", # Work Description
                    "", # Target
                    str(d.date),
                    ""  # Remarks
                ]
                ws.append(row)
                sn += 1
            
            # Auto-adjust column width (simple)
            for col in ws.columns:
                max_length = 0
                column = col[0].column_letter # Get the column name
                for cell in col:
                    try:
                        if len(str(cell.value)) > max_length:
                            max_length = len(cell.value)
                    except:
                        pass
                adjusted_width = (max_length + 2)
                ws.column_dimensions[column].width = adjusted_width

            bio = io.BytesIO()
            wb.save(bio)
            bio.seek(0)

            return FileResponse(
                bio,
                as_attachment=True,
                filename=f"Duty_Chart_{date_from}_{date_to}.xlsx",
                content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )

        # -----------------------
        # DOCX GENERATION
        # -----------------------
        doc = Document()
        doc.styles["Normal"].font.size = Pt(11)

        def center(text, bold=False):
            p = doc.add_paragraph()
            r = p.add_run(text)
            r.bold = bold
            p.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        # Header
        center("अनुसूची-१", True)
        center("(परिच्छेद - ३ को दफा ८ र १० सँग सम्बन्धित)")
        center("नेपाल दूरसंचार कम्पनी लिमिटेड (नेपाल टेलिकम)")
        center("सिफ्ट ड्यूटीमा खटाउनु अघि भर्नु पर्ने बिवरण")

        # Meta
        meta = doc.add_paragraph()
        meta.add_run("कार्यालयको नाम:- ").bold = True
        meta.add_run(qs.first().office.name if qs.exists() and qs.first().office else "-")

        meta.add_run("\nबिभाग/शाखाको नाम:- ").bold = True
        meta.add_run("Integrated Network Operation Center (iNOC)")

        meta.add_run("\nमिति:- ").bold = True
        meta.add_run(f"{date_from} देखि {date_to} सम्म")

        meta.add_run("\nड्यूटीको बर्गिकरण:- ").bold = True
        meta.add_run("वर्क फ्रम होम ड्युटी (23:00 – भोलिपल्ट 07:00)")

        doc.add_paragraph("\nकाममा खटाईएको बिवरण:-")

        # Table
        table = doc.add_table(rows=2, cols=8)
        table.style = "Table Grid"

        headers = [ 
           "सि.नं.", 
           "काममा खटाउनु पर्ने कर्मचारीहरुको बिवरण", 
           "", 
           "", 
           "कामको बिवरण", 
           "लक्ष्य", 
           "समय सिमा (२३:०० - भोलिपल्ट ०७:००)",
           "कैफियत", 
        ]

        for i, h in enumerate(headers): 
            table.rows[0].cells[i].text = h 
            
        table.rows[0].cells[1].merge(table.rows[0].cells[3])
        
        sub_headers = ["", "पद", "नाम", "सम्पर्क नं.", "", "", ""] 
        for i, h in enumerate(sub_headers): 
            table.rows[1].cells[i].text = h

        sn = 1
        for d in qs:
            row = table.add_row().cells
            row[0].text = str(sn)
            row[1].text = getattr(d.user.position, "name", "-") if d.user.position else "-"
            row[2].text = getattr(d.user, "full_name", "-")
            row[3].text = getattr(d.user, "phone_number", "-")
            row[4].text = ""
            row[5].text = ""
            row[6].text = str(d.date)
            row[7].text = ""
            sn += 1

        # Footer
        doc.add_paragraph(
            "\nकम्पनीको सिफ्ट ड्यूटी निर्देशिका बमोजिम तपाईंहरुलाई माथि उल्लेखित "
            "समयसीमा भित्र कार्य सम्पन्न गर्ने गरी ड्यूटीमा खटाईएको छ | "
            "उक्त कार्य सम्पन्न गरे पश्चात् अनुसूची २ बमोजिम कार्य सम्पन्न गरेको "
            "प्रमाणित गराई पेश गर्नुहुन अनुरोध छ |"
        )

        doc.add_paragraph("\nकाममा खटाउने अधिकार प्राप्त पदाधिकारीको बिवरण:-")
        doc.add_paragraph("नाम:-")
        doc.add_paragraph("पद:-")
        doc.add_paragraph("दस्तखत:-")
        doc.add_paragraph("मिति:-")

        # Response
        bio = io.BytesIO()
        doc.save(bio)
        bio.seek(0)

        return FileResponse(
            bio,
            as_attachment=True,
            filename=f"Duty_Chart_{date_from}_{date_to}.docx",
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )