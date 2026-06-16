from django.db import migrations


def add_permission(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Role = apps.get_model('users', 'Role')
    RolePermission = apps.get_model('users', 'RolePermission')

    perm, _ = Permission.objects.get_or_create(
        slug='duties.create_child_office_chart',
        defaults={
            'name': 'Create Child Office Chart',
            'description': 'Can create/view/edit duty charts for child offices in the org hierarchy',
            'is_active': True,
        }
    )

    for role_slug in ['SUPERADMIN', 'OFFICE_ADMIN']:
        try:
            role = Role.objects.get(slug=role_slug)
        except Role.DoesNotExist:
            continue
        RolePermission.objects.get_or_create(role=role, permission=perm)


def remove_permission(apps, schema_editor):
    Permission = apps.get_model('users', 'Permission')
    Permission.objects.filter(slug='duties.create_child_office_chart').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0008_add_general_holidays_permissions'),
    ]

    operations = [
        migrations.RunPython(add_permission, remove_permission),
    ]
