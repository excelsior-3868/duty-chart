# users/models.py
from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models
from org.models import Directorate, Department, Office  # import your org models
from django.core.validators import MinValueValidator, MaxValueValidator

class User(AbstractUser):
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
            ('USER', 'User'),
        ),
        default='USER',
    )

    office = models.ForeignKey(
        Office,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='users'
    )
    # Users can optionally be members of multiple offices in addition to their primary office
    secondary_offices = models.ManyToManyField(
        Office,
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

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username', 'employee_id', 'full_name']

    def clean(self):
        super().clean()
        # Ensure department belongs to the selected directorate
        if self.department and self.directorate:
            if self.department.directorate != self.directorate:
                raise ValidationError({
                    "department": "Selected department does not belong to the chosen directorate."
                })
        # Ensure office belongs to the selected department
        if self.office and self.department:
            if self.office.department != self.department:
                raise ValidationError({
                    "office": "Selected office does not belong to the chosen department."
                })

    def __str__(self):
        return self.full_name

class Position(models.Model):
    name = models.CharField(max_length=255)
    level = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    
    def __str__(self):
        return self.name

# ---------------- RBAC MODELS ----------------
class Permission(models.Model):
    slug = models.CharField(max_length=128, unique=True)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug

class Role(models.Model):
    slug = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.slug

class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name='role_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_roles')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('role', 'permission')

    def __str__(self):
        return f"{self.role.slug} -> {self.permission.slug}"

class UserPermission(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name='direct_permissions')
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name='permission_users')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'permission')

    def __str__(self):
        return f"{self.user_id} -> {self.permission.slug}"
