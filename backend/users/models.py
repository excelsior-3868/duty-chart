# users/models.py
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from org.models import Directorate, Department, Office, WorkingOffice
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db.models.signals import post_delete
from django.dispatch import receiver
from auditlogs.mixins import AuditableMixin

class User(AuditableMixin, AbstractUser):
    employee_id = models.CharField(max_length=50, unique=True)
    full_name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=20)
    image = models.ImageField(upload_to='user_images/', null=True, blank=True)
    role = models.CharField(
        max_length=32,
        choices=(
            ('SUPERADMIN', 'SuperAdmin'),
            ('OFFICE_ADMIN', 'Office Admin'),
            ('NETWORK_ADMIN', 'Network Admin'),
            ('USER', 'User'),
        ),
        default='USER',
    )
    is_activated = models.BooleanField(default=False)

    office = models.ForeignKey(
        WorkingOffice,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    secondary_offices = models.ManyToManyField(
        WorkingOffice,
        related_name='secondary_members',
        blank=True,
        help_text='Other offices this user belongs to (secondary memberships).'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    directorate = models.ForeignKey(
        Directorate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    position = models.ForeignKey(
        "users.Position",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )

    USERNAME_FIELD = 'employee_id'
    REQUIRED_FIELDS = ['username', 'email', 'full_name']

    def save(self, *args, **kwargs):
        if self.pk:
            try:
                old_user = User.objects.get(pk=self.pk)
                if old_user.image and self.image != old_user.image:
                    old_user.image.delete(save=False)
            except User.DoesNotExist:
                pass
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.department and self.directorate:
            if self.department.directorate != self.directorate:
                raise ValidationError({"department": "Selected department does not belong to the chosen directorate."})
        if self.office and self.department:
            pass # Working Office is now independent of Department
            # if self.office.department != self.department:
            #     raise ValidationError({"office": "Selected office does not belong to the chosen department."})

    def __str__(self):
        return self.full_name

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"USER MANAGEMENT: Created new user account for {self.full_name} (ID: {self.employee_id})."
        elif action == 'UPDATE':
            fields = ", ".join(changes.keys())
            return f"USER MANAGEMENT: Updated account for {self.full_name}. Modified: {fields}."
        elif action == 'DELETE':
            return f"USER MANAGEMENT: Removed user account for {self.full_name} (ID: {self.employee_id})."
        return ""

class Position(AuditableMixin, models.Model):
    name = models.CharField(max_length=255)
    alias = models.CharField(max_length=255, null=True, blank=True)
    level = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    
    def __str__(self):
        return self.name

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Position/Designation '{self.name}' (Level: {self.level})."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Position '{self.name}'."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Position '{self.name}'."
        return ""

# ---------------- RBAC MODELS ----------------
class Permission(AuditableMixin, models.Model):
    slug = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug

    def get_audit_details(self, action, changes):
        return f"RBAC: {action.capitalize()}d system permission '{self.slug}'."

class Role(AuditableMixin, models.Model):
    slug = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug

    def get_audit_details(self, action, changes):
        return f"RBAC: {action.capitalize()}d system role '{self.slug}'."

class RolePermission(AuditableMixin, models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_roles')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role.slug} -> {self.permission.slug}"

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"RBAC: Assigned permission '{self.permission.slug}' to role '{self.role.slug}'."
        elif action == 'DELETE':
            return f"RBAC: Removed permission '{self.permission.slug}' from role '{self.role.slug}'."
        return ""

class UserPermission(AuditableMixin, models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='direct_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'permission')

    def __str__(self):
        return f"{self.user_id} -> {self.permission.slug}"

    def get_audit_details(self, action, changes):
        return f"RBAC: Modified direct permissions for User ID {self.user_id}."

class UserDashboardOffice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='dashboard_offices')
    office = models.ForeignKey(WorkingOffice, on_delete=models.CASCADE, related_name='dashboard_users')
    order = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = ('user', 'office')
        verbose_name = "User Dashboard Office"
        verbose_name_plural = "User Dashboard Offices"

    def __str__(self):
        return f"{self.user.username} - {self.office.name}"

    def get_audit_details(self, action, changes):
        return ""

@receiver(post_delete, sender=User)
def delete_user_image(sender, instance, **kwargs):
    if instance.image:
        instance.image.delete(save=False)
