from rest_framework import serializers
from .models import Directorate, Department, Office, SystemSetting, AccountingOffice, CCOffice

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