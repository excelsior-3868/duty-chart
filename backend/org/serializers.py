from rest_framework import serializers
from .models import Directorate, Department, Office, SystemSetting, AccountingOffice, CCOffice, WorkingOffice, Holiday

class DirectorateSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='directorate')
    class Meta:
        model = Directorate
        fields = ['id', 'name', 'parent', 'hierarchy_level', 'remarks']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['parent_name'] = instance.parent.directorate if instance.parent else "None"
        return data

class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'directorate']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['directorate_name'] = instance.directorate.directorate
        return data

class OfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Office
        fields = ['id', 'name', 'department']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['department_name'] = instance.department.name
        data['directorate_name'] = instance.department.directorate.directorate
        return data
 

class AccountingOfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingOffice
        fields = ['id', 'name', 'directorate']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['directorate_name'] = instance.directorate.directorate if instance.directorate else "None"
        return data

class CCOfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = CCOffice
        fields = ['id', 'name', 'accounting_office']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['accounting_office_name'] = instance.accounting_office.name if instance.accounting_office else "None"
        return data

class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = '__all__'

class WorkingOfficeSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkingOffice
        fields = ['id', 'name', 'directorate', 'ac_office', 'cc_office', 'parent']
    
    def to_representation(self, instance):
        data = super().to_representation(instance)
        
        # Helper to recursively resolve directorate ID and name
        def resolve_directorate(office, visited=None):
            if visited is None:
                visited = set()
            if office.id in visited:
                return None, None
            visited.add(office.id)
            
            if office.directorate:
                return office.directorate_id, office.directorate.directorate
            if office.ac_office and office.ac_office.directorate:
                return office.ac_office.directorate_id, office.ac_office.directorate.directorate
            if office.parent:
                return resolve_directorate(office.parent, visited)
            return None, None

        dir_id, dir_name = resolve_directorate(instance)
        data['directorate'] = dir_id
        data['directorate_name'] = dir_name
        data['ac_office_name'] = instance.ac_office.name if instance.ac_office else None
        data['cc_office_name'] = instance.cc_office.name if instance.cc_office else None
        data['parent_name'] = instance.parent.name if instance.parent else None
        return data

class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ['id', 'date', 'name', 'is_public', 'created_at']