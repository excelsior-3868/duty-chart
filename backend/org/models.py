from django.db import models
from auditlogs.mixins import AuditableMixin

# Create your models here.
class Directorate(AuditableMixin, models.Model):
    directorate = models.CharField(max_length=255)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='sub_directorates')
    hierarchy_level = models.IntegerField(default=1)
    remarks = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'directorate'

    def __str__(self):
        return self.directorate

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Directorate '{self.directorate}'."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Directorate '{self.directorate}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Directorate '{self.directorate}'."
        return ""

class Department(AuditableMixin, models.Model):
    name = models.CharField(max_length=255)
    directorate = models.ForeignKey(Directorate, on_delete=models.CASCADE, related_name='departments')

    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        directorate_name = self.directorate.directorate if self.directorate else "Unknown"
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

class AccountingOffice(AuditableMixin, models.Model):
    name = models.CharField(max_length=255, db_column='account_office_name')
    directorate = models.ForeignKey(Directorate, on_delete=models.CASCADE, related_name='accounting_offices')

    class Meta:
        db_table = 'ac_offices'

    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Accounting Office '{self.name}'."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Accounting Office '{self.name}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Accounting Office '{self.name}'."
        return ""

class CCOffice(AuditableMixin, models.Model):
    name = models.CharField(max_length=255, db_column='cc_office_name')
    accounting_office = models.ForeignKey(AccountingOffice, on_delete=models.CASCADE, related_name='cc_offices', db_column='account_office_id')

    class Meta:
        db_table = 'cc_offices'

    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"CONFIGURATION: Created new CC Office '{self.name}'."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated CC Office '{self.name}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted CC Office '{self.name}'."
        return ""

class WorkingOffice(AuditableMixin, models.Model):
    name = models.CharField(max_length=255, db_column='name_of_office')
    directorate = models.ForeignKey(
        Directorate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='directorate_id'
    )
    ac_office = models.ForeignKey(
        'AccountingOffice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='ac_office_id'
    )
    cc_office = models.ForeignKey(
        'CCOffice',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        db_column='cc_office_id'
    )
    
    class Meta:
        db_table = 'working_office'
        
    def __str__(self):
        return self.name
        
    def get_audit_details(self, action, changes):
        return f"CONFIGURATION: {action.title()}d Working Office '{self.name}'."