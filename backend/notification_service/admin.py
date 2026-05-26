from django.contrib import admin
from .models import Notification, SMSLog

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'notification_type', 'is_read', 'created_at')
    list_filter = ('notification_type', 'is_read', 'created_at')
    search_fields = ('user__username', 'title', 'message')

@admin.register(SMSLog)
class SMSLogAdmin(admin.ModelAdmin):
    list_display = ('phone', 'status', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('phone', 'message', 'response_raw')
