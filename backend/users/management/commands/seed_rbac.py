from django.core.management.base import BaseCommand
from users.models import Role, Permission, RolePermission

class Command(BaseCommand):
    help = 'Seed RBAC roles and permissions'

    def handle(self, *args, **options):
        # 1. Define Permissions (Matches standard IDs 1-20)
        permissions_data = [
            {"slug": "duties.view_chart", "name": "View Duty Chart", "description": "Can view duty charts"}, # 1
            {"slug": "duties.create_chart", "name": "Create Duty Chart", "description": "Can create new duty charts"}, # 2
            {"slug": "duties.edit_chart", "name": "Edit Duty Chart", "description": "Can edit existing duty charts"}, # 3
            {"slug": "duties.delete_chart", "name": "Delete Duty Chart", "description": "Can delete duty charts"}, # 4
            {"slug": "duties.generate_rotation", "name": "Generate Rotation", "description": "Can trigger automated duty rotation"}, # 5
            {"slug": "users.view_employee", "name": "View Employee", "description": "Can view employee details"}, # 6
            {"slug": "users.create_employee", "name": "Create Employee", "description": "Can create new employees"}, # 7
            {"slug": "users.edit_employee", "name": "Edit Employee", "description": "Can edit employee details"}, # 8
            {"slug": "users.delete_employee", "name": "Delete Employee", "description": "Can delete employees"}, # 9
            {"slug": "org.view_office", "name": "View Office", "description": "Can view office details"}, # 10
            {"slug": "org.manage_office", "name": "Manage Office", "description": "Can manage office settings"}, # 11
            {"slug": "system.manage_rbac", "name": "Manage RBAC", "description": "Can manage roles and permissions"}, # 12
            {"slug": "duties.create_duty", "name": "Create Duties", "description": "Creating Duties for the Duty Charts"}, # 13
            {"slug": "duties.export_chart", "name": "Export Chart", "description": "Exporting Chart on Duties"}, # 14
            {"slug": "duties.view_schedule", "name": "Viewing Schedule", "description": "Viewing Schedule"}, # 15
            {"slug": "duties.manage_schedule", "name": "Manage Schedule", "description": "Managing Schedule"}, # 16
            {"slug": "schedules.create", "name": "Schedule Create", "description": "Creating a Schedule for the Office"}, # 17
            {"slug": "schedules.view", "name": "View Schedule", "description": "Viewing and Listing the Schedule"}, # 18
            {"slug": "schedules.edit", "name": "Edit Schedule", "description": "Editing Schedule"}, # 19
            {"slug": "duties.delete", "name": "Remove Emp", "description": "Remove Employee From Duty"}, # 20
        ]

        self.stdout.write("Seeding permissions...")
        perms_map = {}
        for p_data in permissions_data:
            perm, created = Permission.objects.update_or_create(
                slug=p_data["slug"],
                defaults={
                    "name": p_data["name"],
                    "description": p_data["description"],
                    "is_active": True
                }
            )
            perms_map[p_data["slug"]] = perm
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created permission: {perm.slug}"))
            else:
                self.stdout.write(f"Updated permission: {perm.slug}")

        # 2. Define Roles
        roles_data = [
            {"slug": "SUPERADMIN", "name": "Super Admin"},
            {"slug": "OFFICE_ADMIN", "name": "Office Admin"},
            {"slug": "USER", "name": "Regular User"},
        ]

        self.stdout.write("Seeding roles...")
        roles_map = {}
        for r_data in roles_data:
            role, created = Role.objects.update_or_create(
                slug=r_data["slug"],
                defaults={
                    "name": r_data["name"],
                    "is_active": True
                }
            )
            roles_map[r_data["slug"]] = role
            if created:
                self.stdout.write(self.style.SUCCESS(f"Created role: {role.slug}"))
            else:
                self.stdout.write(f"Updated role: {role.slug}")

        # 3. Assign Permissions to Roles (EXACT MATCH with Screenshot)
        # SUPERADMIN: All 1-20
        # OFFICE_ADMIN: 1, 2, 3, 5, 6, 7, 8, 10, 13, 14, 16, 17, 18
        # USER: 1, 6, 14, 15, 18
        
        role_permissions = {
            "SUPERADMIN": list(perms_map.keys()), # 1-20
            "OFFICE_ADMIN": [
                "duties.view_chart", "duties.create_chart", "duties.edit_chart", 
                "duties.generate_rotation", "users.view_employee", "users.create_employee", 
                "users.edit_employee", "org.view_office", "duties.create_duty", 
                "duties.export_chart", "duties.manage_schedule", "schedules.create", "schedules.view"
            ],
            "USER": [
                "duties.view_chart", "users.view_employee", "duties.export_chart", 
                "duties.view_schedule", "schedules.view"
            ]
        }

        self.stdout.write("Assigning permissions to roles...")
        # Clear existing mappings to ensure exact match with seeder
        RolePermission.objects.all().delete()
        
        for role_slug, perm_slugs in role_permissions.items():
            role = roles_map[role_slug]
            for p_slug in perm_slugs:
                if p_slug in perms_map:
                    perm = perms_map[p_slug]
                    RolePermission.objects.get_or_create(role=role, permission=perm)
        
        self.stdout.write(self.style.SUCCESS("RBAC RolePermission seeding completed!"))
