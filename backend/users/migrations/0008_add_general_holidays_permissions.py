from django.db import migrations


def add_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    RolePermission = apps.get_model('users', 'RolePermission')

    new_permissions = [
        {
            'slug': 'system.configure_general',
            'name': 'Configure General Settings',
            'description': 'Can access and configure the General settings tab',
        },
        {
            'slug': 'system.configure_holidays',
            'name': 'Configure Holidays',
            'description': 'Can access and configure the Holidays settings tab',
        },
    ]

    try:
        superadmin = Role.objects.get(slug='SUPERADMIN')
    except Role.DoesNotExist:
        superadmin = None

    for p_data in new_permissions:
        perm, _ = Permission.objects.get_or_create(
            slug=p_data['slug'],
            defaults={
                'name': p_data['name'],
                'description': p_data['description'],
                'is_active': True,
            }
        )
        if superadmin:
            RolePermission.objects.get_or_create(role=superadmin, permission=perm)


def remove_permissions(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(
        slug__in=['system.configure_general', 'system.configure_holidays']
    ).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0007_add_configure_notifications_permission'),
    ]

    operations = [
        migrations.RunPython(add_permissions, remove_permissions),
    ]
