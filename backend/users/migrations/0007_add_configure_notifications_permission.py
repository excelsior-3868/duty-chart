from django.db import migrations


def add_configure_notifications_permission(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    RolePermission = apps.get_model('users', 'RolePermission')

    perm, _ = Permission.objects.get_or_create(
        slug='system.configure_notifications',
        defaults={
            'name': 'Configure Notifications',
            'description': 'Can access and configure the Notifications settings tab',
            'is_active': True,
        }
    )

    for role_slug in ('SUPERADMIN', 'NETWORK_ADMIN'):
        try:
            role = Role.objects.get(slug=role_slug)
            RolePermission.objects.get_or_create(role=role, permission=perm)
        except Role.DoesNotExist:
            pass


def remove_configure_notifications_permission(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(slug='system.configure_notifications').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_merge_20260611_1557'),
    ]

    operations = [
        migrations.RunPython(
            add_configure_notifications_permission,
            remove_configure_notifications_permission,
        ),
    ]
