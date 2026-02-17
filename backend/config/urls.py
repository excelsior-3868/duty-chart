"""
URL configuration for config project.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import path, include, re_path

from rest_framework.routers import DefaultRouter
from rest_framework import permissions
from rest_framework.authentication import SessionAuthentication, BasicAuthentication
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from drf_yasg.views import get_schema_view
from drf_yasg import openapi

# Local imports
from users.views import UserViewSet, PositionViewSet, RoleViewSet, PermissionViewSet, UserDashboardOfficeViewSet
from org.views import DirectorateViewSet, DepartmentViewSet, OfficeViewSet, SystemSettingViewSet, AccountingOfficeViewSet, CCOfficeViewSet
from authentication.views import TokenObtainPair2FAView, Verify2FAView
from duties.views import (
    DutyChartViewSet,
    DutyViewSet,
    BulkDocumentUploadView,
    RosterBulkUploadView,
    ScheduleView,  # your updated Schedule API
    DutyChartExportPreview,
    DutyChartExportFile,
    DutyChartImportTemplateView,
    DutyChartImportView,
)

print("URL configuration loaded", flush=True)

# ------------------------------------------------------------------------------
# Swagger / API documentation setup
# ------------------------------------------------------------------------------
schema_view = get_schema_view(
    openapi.Info(
        title="Duty Chart Management API",
        default_version="v1",
        description=(
            "Interactive API documentation for the Duty Chart Management System.\n"
            "Includes JWT authentication, duty scheduling with shift filters, "
            "bulk upload, bulk duty upsert, and rotation generation endpoints."
        ),
        terms_of_service="https://www.yourapp.com/terms/",
        contact=openapi.Contact(email="contact@yourapp.com"),
        license=openapi.License(name="Your License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
    authentication_classes=(SessionAuthentication, BasicAuthentication),
)

# Apply Bearer JWT security globally in Swagger
schema_view.security_definitions = {
    "Bearer": {
        "type": "apiKey",
        "name": "Authorization",
        "in": "header",
        "description": (
            "JWT Authorization header using the Bearer scheme. "
            "Example: 'Bearer <your JWT token>'"
        ),
    }
}
schema_view.security = [{"Bearer": []}]

# ------------------------------------------------------------------------------
# DRF Router registrations (single router for all ViewSets)
# ------------------------------------------------------------------------------
router = DefaultRouter()

# Users
router.register(r"users", UserViewSet)
router.register(r"positions", PositionViewSet)
router.register(r"roles", RoleViewSet)
router.register(r"permissions", PermissionViewSet)
router.register(r"user-dashboard-offices", UserDashboardOfficeViewSet, basename="user-dashboard-offices")

# Organization
router.register(r"directorates", DirectorateViewSet)
router.register(r"departments", DepartmentViewSet)
router.register(r"offices", OfficeViewSet)
router.register(r"accounting-offices", AccountingOfficeViewSet)
router.register(r"cc-offices", CCOfficeViewSet)
router.register(r"system-settings", SystemSettingViewSet, basename="system-settings")

# Duties
router.register(r"duty-charts", DutyChartViewSet)
router.register(r"duties", DutyViewSet)


# Schedule
router.register(r"schedule", ScheduleView, basename="schedule")

# ------------------------------------------------------------------------------
# URL patterns
# ------------------------------------------------------------------------------
urlpatterns = [
    # Duty Chart Export
    path(
        "api/v1/export/duty-chart/preview/",
        DutyChartExportPreview.as_view(),
        name="duty_chart_export_preview",
    ),
    path(
        "api/v1/export/duty-chart/download/",
        DutyChartExportFile.as_view(),
        name="duty_chart_export_download",
    ),
    path(
        "api/v1/duty-chart/import-template/",
        DutyChartImportTemplateView.as_view(),
        name="duty_chart_import_template",
    ),
    path(
        "api/v1/duty-chart/import/",
        DutyChartImportView.as_view(),
        name="duty_chart_import",
    ),

    path("admin/", admin.site.urls),

    # Specific API endpoints
    path("api/v1/auth/", include("authentication.urls")),
    path("api/v1/otp/", include("otp_service.urls")),
    path("api/v1/auditlogs/", include("auditlogs.urls")),
    path("api/v1/reports/", include("reports.urls")),
    path("api/v1/notifications/", include("notification_service.urls")),
    path(
        "api/v1/bulk-upload/",
        BulkDocumentUploadView.as_view(),
        name="bulk_document_upload",
    ),
    path(
        "api/v1/roster-bulk-upload/",
        RosterBulkUploadView.as_view(),
        name="roster_bulk_upload",
    ),


    # Router (Generic API endpoints) - Must be last for api/v1/ prefix
    path("api/v1/", include(router.urls)),

    # JWT Authentication
    path("api/token/", TokenObtainPair2FAView.as_view(), name="token_obtain_pair"),
    path("api/token/verify-2fa/", Verify2FAView.as_view(), name="token_verify_2fa"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("api/token/verify/", TokenVerifyView.as_view(), name="token_verify"),

    # Browsable API login
    path("api-auth/", include("rest_framework.urls")),

    # Swagger / ReDoc
    re_path(
        r"^swagger(?P<format>\.json|\.yaml)$",
        schema_view.without_ui(cache_timeout=0),
        name="schema-json",
    ),
    path(
        "swagger/",
        schema_view.with_ui("swagger", cache_timeout=0),
        name="schema-swagger-ui",
    ),
    path(
        "redoc/",
        schema_view.with_ui("redoc", cache_timeout=0),
        name="schema-redoc",
    ),
]

# ------------------------------------------------------------------------------
# Static & media in debug mode
# ------------------------------------------------------------------------------
if settings.DEBUG:
    urlpatterns += static(
        settings.STATIC_URL, document_root=settings.STATIC_ROOT
    )
    urlpatterns += static(
        settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
    )
