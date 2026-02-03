from django.db import models
from auditlogs.mixins import AuditableMixin

# Create your models here.
class Directorate(AuditableMixin, models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Directorate '{self.name}'."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Directorate '{self.name}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Directorate '{self.name}'."
        return ""

class Department(AuditableMixin, models.Model):
    name = models.CharField(max_length=255)
    directorate = models.ForeignKey(Directorate, on_delete=models.CASCADE, related_name='departments')

    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        directorate_name = self.directorate.name if self.directorate else "Unknown"
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Department '{self.name}' under '{directorate_name}'."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Department '{self.name}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Department '{self.name}'."
        return ""

class Office(AuditableMixin, models.Model):
    name = models.CharField(max_length=255)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name='offices')

    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        dept_name = self.department.name if self.department else "Unknown"
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Office '{self.name}' under '{dept_name}'."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Office '{self.name}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Office '{self.name}'."
        return ""

class SystemSetting(AuditableMixin, models.Model):
    is_2fa_enabled = models.BooleanField(default=False)
    session_timeout = models.IntegerField(default=60) # minutes
    auto_logout_idle = models.BooleanField(default=True)

    def __str__(self):
        return "Global System Settings"

    class Meta:
        verbose_name = "System Setting"
        verbose_name_plural = "System Settings"

    def get_audit_details(self, action, changes):
        if action == 'UPDATE':
            desc = "SYSTEM SETTINGS: Updated global security/session configurations."
            if 'is_2fa_enabled' in changes:
                state = "ENABLED" if self.is_2fa_enabled else "DISABLED"
                desc += f" 2FA is now {state}."
            return desc
        return "SYSTEM SETTINGS: Modified global configuration."