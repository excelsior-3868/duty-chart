from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Position, Permission, Role, RolePermission, UserPermission

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = (
        'employee_id', 'full_name', 'email', 'phone_number', 'role',
        'directorate', 'department', 'office','position', 'is_active'
    )
    list_filter = (
        'is_active', 'is_staff', 'role', 'directorate', 'department', 'office', 'secondary_offices'
    )
    search_fields = (
        'employee_id', 'full_name', 'email', 'phone_number',
        'directorate__name', 'department__name', 'office__name', 'secondary_offices__name'
    )
    ordering = ('full_name',)

    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {
            'fields': (
                'employee_id', 'full_name', 'email', 'phone_number', 'image', 'role',
                'directorate', 'department', 'office', 'secondary_offices', 'position'
            )
        }),
        ('Permissions', {
            'fields': (
                'is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions'
            )
        }),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': (
                'username', 'employee_id', 'full_name', 'email', 'phone_number',
                'directorate', 'department', 'office', 'secondary_offices', 'position',
                'password1', 'password2'
            ),
        }),
    )
    # Use filtered horizontal widget for groups/permissions, and autocomplete for office selections
    filter_horizontal = ('groups', 'user_permissions')
    autocomplete_fields = ('directorate', 'department', 'office', 'secondary_offices', 'position')
@admin.register(Position)
class PositionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "level")
    search_fields = ("name",)
    
@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "slug", "name", "is_active")
    search_fields = ("slug", "name")
    list_filter = ("is_active",)

@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("id", "slug", "name", "is_active")
    search_fields = ("slug", "name")
    list_filter = ("is_active",)

@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "role", "permission", "created_at")
    search_fields = ("role__slug", "permission__slug")
    list_filter = ("role", "permission")

@admin.register(UserPermission)
class UserPermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "permission", "created_at")
    search_fields = ("user__full_name", "user__email", "permission__slug")
    list_filter = ("permission",)
