import uuid
from django.conf import settings
from django.db import models
from auditlogs.mixins import AuditableMixin


def help_document_upload_path(instance, filename):
    safe = "".join(c for c in filename if c.isalnum() or c in "._- ").strip()
    return f"Documentation/{instance.document_type}/{safe}"


class HelpDocument(AuditableMixin, models.Model):
    DOCUMENT_TYPES = [
        ('document', 'Document'),
        ('notice', 'Notice'),
        ('circular', 'Circular'),
        ('manual', 'Manual'),
        ('order', 'Order'),
        ('other', 'Other'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES, default='document')
    file = models.FileField(upload_to=help_document_upload_path)
    file_name = models.CharField(max_length=255, blank=True)
    file_size = models.PositiveIntegerField(null=True, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='help_documents',
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self):
        return self.title

    def get_audit_details(self, action, changes):
        uploader = getattr(self.uploaded_by, 'full_name', None) or getattr(self.uploaded_by, 'username', 'Unknown') if self.uploaded_by else 'Unknown'
        if action == 'CREATE':
            return f"HELP CENTER: Uploaded '{self.title}' ({self.get_document_type_display()}) by {uploader}."
        if action == 'UPDATE':
            changed_fields = ", ".join(changes.keys())
            return f"HELP CENTER: Updated '{self.title}' ({self.get_document_type_display()}). Fields changed: {changed_fields}."
        if action == 'DELETE':
            return f"HELP CENTER: Deleted '{self.title}' ({self.get_document_type_display()}) by {uploader}."
        return ""
