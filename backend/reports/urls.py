# reports/urls.py
from django.urls import path
from .views import (
    DutyReportPreviewView,
    DutyReportFileView,
    DutyReportNewFileView,
    DutyOptionsView,
    SummaryReportView,
    OfficeAdoptionReportView,
)

urlpatterns = [
    path("duties/preview/", DutyReportPreviewView.as_view(), name="report-preview"),
    path("duties/file/", DutyReportFileView.as_view(), name="report-file"),
    path("duties/file-new/", DutyReportNewFileView.as_view(), name="report-file-new"),
    path("duties/options/", DutyOptionsView.as_view(), name="report-duty-options"),
    path("summary/", SummaryReportView.as_view(), name="report-summary"),
    path("duties/adoption/", OfficeAdoptionReportView.as_view(), name="report-adoption"),
]