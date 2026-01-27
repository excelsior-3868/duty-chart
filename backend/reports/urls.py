# reports/urls.py
from django.urls import path
from .views import (
    DutyReportPreviewView,
    DutyReportFileView,
    DutyOptionsView,
)

urlpatterns = [
    path("duties/preview/", DutyReportPreviewView.as_view(), name="report-preview"),
    path("duties/file/", DutyReportFileView.as_view(), name="report-file"),
    path("duties/options/", DutyOptionsView.as_view(), name="report-duty-options"),
]