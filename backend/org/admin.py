from django.contrib import admin
from .models import Directorate, Department, Office


@admin.register(Directorate)
class DirectorateAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "directorate")
    list_filter = ("directorate",)
    search_fields = ("name",)


@admin.register(Office)
class OfficeAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "department", "get_directorate")
    list_filter = ("department",)
    search_fields = ("name", "department__name")

    def get_directorate(self, obj):
        # this shows the parent directorate in Office admin
        return obj.department.directorate.name if obj.department and obj.department.directorate else "-"
    get_directorate.short_description = "Directorate"
    get_directorate.admin_order_field = "department__directorate__name"