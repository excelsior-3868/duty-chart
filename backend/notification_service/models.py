from django.db import models
from django.conf import settings
from auditlogs.mixins import AuditableMixin

class Notification(AuditableMixin, models.Model):
    NOTIFICATION_TYPES = (
        ('ASSIGNMENT', 'Duty Assignment'),
        ('REMINDER', 'Duty Reminder'),
        ('SYSTEM', 'System Alert'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notifications')
    title = models.CharField(max_length=255)
    message = models.TextField()
    notification_type = models.CharField(max_length=20, choices=NOTIFICATION_TYPES, default='SYSTEM')
    link = models.CharField(max_length=255, blank=True, null=True)
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'notification_type', 'created_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.title}"

    def get_audit_details(self, action, changes):
        fullname = getattr(self.user, 'full_name', self.user.username)
        return f"NOTIFICATION: {action.capitalize()}d notification for {fullname}."

class SMSLog(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_logs')
    duty = models.ForeignKey('duties.Duty', on_delete=models.SET_NULL, null=True, blank=True, related_name='sms_logs_for_duty')
    phone = models.CharField(max_length=20)
    message = models.TextField()
    status = models.CharField(max_length=50, default='pending')
    reminder_type = models.CharField(max_length=50, default='GENERAL', help_text="Type of reminder (e.g., 1_HOUR, DAILY, ASSIGNMENT)")
    response_raw = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'duty', 'reminder_type'],
                name='unique_sms_reminder_per_duty'
            )
        ]

    def __str__(self):
        return f"To {self.phone} - {self.status}"


class OfficeNotificationSetting(AuditableMixin, models.Model):
    office = models.OneToOneField('org.WorkingOffice', on_delete=models.CASCADE, related_name='notification_setting')
    enable_advance_reminder = models.BooleanField(default=True)
    advance_reminder_days = models.IntegerField(default=1)
    advance_reminder_time = models.TimeField(default="18:00:00")
    advance_reminder_template = models.TextField(blank=True, null=True)
    allowed_shifts = models.JSONField(default=list, blank=True, null=True)
    allowed_duty_charts = models.JSONField(default=list, blank=True, null=True)
    schedule_configs = models.JSONField(default=dict, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'office_notification_setting'
        ordering = ['id']

    def __str__(self):
        return f"Notification Setting for {self.office.name}"

    def get_audit_details(self, action, changes):
        office_name = self.office.name if self.office else "Unknown Office"
        return f"NOTIFICATION_SETTING: {action.capitalize()}d notification settings for {office_name}."


