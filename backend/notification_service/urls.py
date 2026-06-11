from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationViewSet, SMSLogViewSet, OfficeNotificationSettingViewSet

router = DefaultRouter()
router.register(r'sms-logs', SMSLogViewSet, basename='sms-logs')
router.register(r'office-settings', OfficeNotificationSettingViewSet, basename='office-settings')
router.register(r'', NotificationViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
