from django.db import models
from django.conf import settings
from django.utils import timezone
import uuid

class AuditLog(models.Model):
    ACTION_CHOICES = (
        ('CREATE', 'Create'),
        ('UPDATE', 'Update'),
        ('DELETE', 'Delete'),
        ('LOGIN', 'Login'),
        ('LOGOUT', 'Logout'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(default=timezone.now)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='audit_logs',
        help_text="User who performed the action"
    )
    actor_userid = models.CharField(max_length=255, blank=True, null=True, help_text="Snapshot of user's username/ID")
    actor_employee_id = models.CharField(max_length=100, blank=True, null=True, help_text="Snapshot of employee ID")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    entity_type = models.CharField(max_length=100, help_text="Model name (e.g. Duty, User)")
    
    status = models.CharField(max_length=20, default='SUCCESS')
    details = models.TextField(blank=True, null=True, help_text="Human readable description of the action")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['entity_type']),
            models.Index(fields=['action']),
            models.Index(fields=['actor']),
        ]

    def __str__(self):
        return f"{self.action} - {self.entity_type} by {self.actor_userid or 'System'}"
