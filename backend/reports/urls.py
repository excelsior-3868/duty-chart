# reports/urls.py
from django.urls import path
from .views import (
    DutyReportPreviewView,
    DutyReportFileView,
    DutyReportNewFileView,
    DutyOptionsView,
)

urlpatterns = [
    path("duties/preview/", DutyReportPreviewView.as_view(), name="report-preview"),
    path("duties/file/", DutyReportFileView.as_view(), name="report-file"),
    path("duties/file-new/", DutyReportNewFileView.as_view(), name="report-file-new"),
    path("duties/options/", DutyOptionsView.as_view(), name="report-duty-options"),
]