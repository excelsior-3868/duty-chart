from django.core.management.base import BaseCommand
from users.models import Role, Permission, RolePermission

class Command(BaseCommand):
    help = 'Seed RBAC roles and permissions'

    def handle(self, *args, **options):
        # 0. Cleanup: Delete old/conflicting permission slugs
        old_slugs = ["duties.edit_chart", "duties.editchart"]
        deleted_count, _ = Permission.objects.filter(slug__in=old_slugs).delete()
        if deleted_count > 0:
            self.stdout.write(self.style.WARNING(f"Deleted {deleted_count} old permission slugs."))

        # 1. Define Permissions (Matches standard IDs 1-20)
        permissions_data = [
            {"slug": "duties.view_chart", "name": "View Duty Chart", "description": "Can view duty charts"}, # 1
            {"slug": "duties.create_chart", "name": "Create Duty Chart", "description": "Can create new duty charts"}, # 2
            {"slug": "duties.edit_dutychart", "name": "Edit Duty Chart", "description": "Can edit existing duty charts"}, # 3
            {"slug": "duties.delete_chart", "name": "Delete Duty Chart", "description": "Can delete duty charts"}, # 4
            {"slug": "duties.create_any_office_chart", "name": "Create Duty Chart (Any Office)", "description": "Can create duty charts in any office"}, # New
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
            {"slug": "duties.view_schedule", "name": "Duty Schedule View", "description": "Can view the Duty Schedule page"}, # 15
            {"slug": "duties.manage_schedule", "name": "Manage Duty Schedule", "description": "Can manage and edit Duty Schedules"}, # 16
            {"slug": "schedules.create", "name": "Schedule Create", "description": "Creating a Schedule for the Office"}, # 17
            {"slug": "schedules.view", "name": "View Schedule", "description": "Viewing and Listing the Schedule"}, # 18
            {"slug": "schedules.edit", "name": "Edit Schedule", "description": "Editing Schedule"}, # 19
            {"slug": "schedules.delete", "name": "Delete Schedule", "description": "Deleting Schedule"}, # 20
            {"slug": "duties.delete", "name": "Remove Emp", "description": "Remove Employee From Duty"}, # 21
            {"slug": "users.create_any_office_employee", "name": "Create Employee (Any Office)", "description": "Can create employees in any office"}, # 21
            {"slug": "system.view_settings", "name": "Access Settings Menu", "description": "Can access the settings menu"}, # 22
            {"slug": "duties.view_available_shifts", "name": "View Available Shifts", "description": "Can view the Available Shift tab"}, # 23
            {"slug": "duties.view_any_office_chart", "name": "View Any Office Chart", "description": "Can view duty charts from any office"}, # 24
            {"slug": "schedule_templates.view", "name": "View Schedule Templates", "description": "Can view schedule templates"}, # 25
            {"slug": "schedule_templates.create", "name": "Create Schedule Templates", "description": "Can create schedule templates"}, # 26
            {"slug": "schedule_templates.edit", "name": "Edit Schedule Templates", "description": "Can edit schedule templates"}, # 27
            {"slug": "schedule_templates.delete", "name": "Delete Schedule Templates", "description": "Can delete schedule templates"}, # 28
            {"slug": "schedules.view_office_schedule", "name": "View Office Schedule", "description": "Can access Office Schedule page"}, # 29
            {"slug": "duties.assign_employee", "name": "Assign Employee", "description": "Can assign employee to duty chart"}, # 30
            {"slug": "duties.assign_any_office_employee", "name": "Assign Employee (Any Office)", "description": "Can assign employees from any office to a duty"}, # 31
            {"slug": "schedules.view_any_office", "name": "View Any Office Schedule", "description": "Can view schedules from any office"}, # 32
            
            # New Org Permissions
            {"slug": "org.view_directorate", "name": "View Directorates", "description": "Can view and manage directorates"},
            {"slug": "org.view_accounting_office", "name": "View Accounting Offices", "description": "Can view and manage accounting offices"},
            {"slug": "org.view_cc_office", "name": "View CC Offices", "description": "Can view and manage CC offices"},
            {"slug": "duties.remove_other_office_employee", "name": "Remove Other Office Employee", "description": "Can remove employees from other offices from a duty chart"},
            
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
            {"slug": "NETWORK_ADMIN", "name": "Network Admin"},
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
                "duties.view_chart", "duties.create_chart", "duties.edit_dutychart", 
                "duties.generate_rotation", "users.view_employee", "users.create_employee", 
                "users.edit_employee", "org.view_office", "duties.create_duty", 
                "duties.export_chart", "duties.manage_schedule", "schedules.create", "schedules.view",
                "system.view_settings", "schedules.view_office_schedule", "duties.view_available_shifts",
                "schedule_templates.view", "duties.assign_employee", "duties.assign_any_office_employee", "schedules.delete",
                "duties.delete"
            ],


            "USER": [
                "duties.view_chart", "users.view_employee", "duties.export_chart", 
                "duties.view_schedule", "schedules.view", "schedules.view_office_schedule",
                "duties.view_available_shifts"
            ],
            "NETWORK_ADMIN": [
                "duties.view_chart", "users.view_employee", "duties.view_schedule", 
                "schedules.view", "schedules.view_office_schedule", "duties.view_available_shifts"
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
