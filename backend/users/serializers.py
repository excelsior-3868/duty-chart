from rest_framework import serializers
from rest_framework.validators import UniqueTogetherValidator
from django.core.exceptions import ValidationError

from duties.models import DutyChart, Duty, Document, RosterAssignment, Schedule
from org.models import WorkingOffice
from .models import User, Position, Role, Permission, UserDashboardOffice
class UserSerializer(serializers.ModelSerializer):
    # Explicitly expose secondary_offices for read/write via IDs
    secondary_offices = serializers.PrimaryKeyRelatedField(
        many=True, queryset=WorkingOffice.objects.all(), required=False
    )
    class Meta:
        model = User
        fields = '__all__'
        extra_kwargs = {
            'password': {'write_only': True, 'required': False},
            'username': {'required': False},
            'last_login': {'read_only': True},
            'date_joined': {'read_only': True},
        }

    def to_representation(self, instance):
        data = super().to_representation(instance)
        
        # Office Name
        try:
            data['office_name'] = instance.office.name if instance.office else None
        except Exception:
            data['office_name'] = None

        # Position Name/Alias
        try:
            data['position_name'] = instance.position.name if instance.position else None
            data['position_alias'] = instance.position.alias if instance.position else None
        except Exception:
            data['position_name'] = None
            data['position_alias'] = None

        # Department Name
        try:
            data['department_name'] = instance.department.name if instance.department else None
        except Exception:
             data['department_name'] = None

        # IDs
        try:
            data['directorate_id'] = instance.directorate_id
            data['department_id'] = instance.department_id
        except Exception:
            pass # these should exist on model instance
            
        return data
    
    def validate(self, attrs):
        request = self.context.get('request')
        user = request.user if request else None

        # RBAC: Check for role changes
        if 'role' in attrs:
            if not user or (not user.is_superuser and getattr(user, 'role', '') != 'SUPERADMIN' and not self._has_rbac_permission(user)):
                # If existing user, check if role is actually changing
                if self.instance and self.instance.role == attrs['role']:
                    pass
                else:
                    raise serializers.ValidationError({"role": "You do not have permission to assign roles."})
        
        return attrs

    def _has_rbac_permission(self, user):
        from users.permissions import user_has_permission_slug
        return user_has_permission_slug(user, 'system.manage_rbac')

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        instance = super().create(validated_data)
        if password:
            instance.set_password(password)
            instance.save()
        return instance
    
    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        if password:
            instance.set_password(password)
        return super().update(instance, validated_data)


class PositionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Position
        fields = [
            'id',
            'name',
            'alias',
            'level'
        ]

class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'slug', 'name', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ['id', 'slug', 'name', 'description', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


# ---------------- DUTY CHART ----------------
class DutyChartSerializer(serializers.ModelSerializer):
    class Meta:
        model = DutyChart
        fields = [
            'id',
            'office',
            'effective_date',
            'end_date',
            'employee_name',
            'phone_number',
            'position'
        ]

    def create(self, validated_data):
        instance = DutyChart(**validated_data)
        instance.full_clean()
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # Office is now a WorkingOffice
        if instance.office:
            data['office_name'] = instance.office.name
            data['directorate_name'] = instance.office.directorate.directorate if instance.office.directorate else None
            data['ac_office_name'] = instance.office.ac_office.name if instance.office.ac_office else None
            data['cc_office_name'] = instance.office.cc_office.name if instance.office.cc_office else None
        return data


# ---------------- DUTY ----------------
class DutySerializer(serializers.ModelSerializer):
    class Meta:
        model = Duty
        fields = [
            'id', 'user', 'duty_chart', 'date', 'shift',
            'is_completed', 'currently_available', 'start_time', 'end_time'
        ]

    def create(self, validated_data):
        instance = Duty(**validated_data)
        instance.full_clean()
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['user_name'] = instance.user.full_name
        data['office_name'] = instance.duty_chart.office.name
        return data


# ---------------- DOCUMENT ----------------
class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'file', 'description', 'uploaded_at']

    def create(self, validated_data):
        instance = Document(**validated_data)
        instance.full_clean()
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance


class BulkDocumentUploadSerializer(serializers.Serializer):
    files = serializers.ListField(
        child=serializers.FileField(),
        write_only=True
    )
    meta = serializers.CharField(
        required=False,
        help_text="Optional JSON string with metadata for each file"
    )

    def create(self, validated_data):
        uploaded_files = validated_data['files']
        docs = []
        for f in uploaded_files:
            doc = Document(file=f)
            doc.full_clean()
            doc.save()
            docs.append(doc)
        return docs


# ---------------- BULK UPLOAD ----------------
ALLOWED_HEADERS = [
    "Start Date",
    "End Date",
    "Start Time",
    "End Time",
    "Shift",
    "Employee Name",
    "Office",
    "Phone Number"
]

HEADER_MAP = {
    "Start Date": "start_date",
    "End Date": "end_date",
    "Start Time": "start_time",
    "End Time": "end_time",
    "Shift": "shift",
    "Employee Name": "employee_name",
    "Office": "office",
    "Phone Number": "phone_number",
}


class BulkUploadExcelSerializer(serializers.Serializer):
    file = serializers.FileField()
    dry_run = serializers.BooleanField(required=False, default=False)

    def validate_file(self, f):
        name = (f.name or "").lower()
        if not (name.endswith(".xlsx") or name.endswith(".xls")):
            raise serializers.ValidationError("Only .xlsx or .xls Excel files are allowed.")
        head = f.read(4)
        f.seek(0)
        if head != b'PK\x03\x04' and not name.endswith(".xls"):
            raise serializers.ValidationError("Invalid Excel file content.")
        return f


class RosterAssignmentSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source='office.name', read_only=True)

    class Meta:
        model = RosterAssignment
        fields = [
            'id',
            'start_date',
            'end_date',
            'start_time',
            'end_time',
            'shift',
            'employee_name',
            'office',
            'office_name',
            'phone_number',
            'created_at',
            'updated_at',
        ]
        validators = [
            UniqueTogetherValidator(
                queryset=RosterAssignment.objects.all(),
                fields=[
                    'employee_name', 'office',
                    'start_date', 'end_date',
                    'start_time', 'end_time', 'shift'
                ],
                message='An identical roster assignment already exists.'
            )
        ]

    def validate_office(self, value):
        if isinstance(value, str):
            office_obj = Office.objects.filter(name__iexact=value).first()
            if not office_obj:
                raise serializers.ValidationError(f"Office '{value}' not found.")
            return office_obj
        return value

    def create(self, validated_data):
        validated_data = self._normalize(validated_data)
        instance, _ = RosterAssignment.objects.update_or_create(
            employee_name=validated_data['employee_name'],
            office=validated_data['office'],
            start_date=validated_data['start_date'],
            end_date=validated_data['end_date'],
            start_time=validated_data['start_time'],
            end_time=validated_data['end_time'],
            shift=validated_data['shift'],
            defaults={k: v for k, v in validated_data.items()
                      if k not in ['employee_name', 'office', 'start_date',
                                   'end_date', 'start_time', 'end_time', 'shift']}
        )
        instance.full_clean()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.full_clean()
        instance.save()
        return instance

    def _normalize(self, data):
        if 'employee_name' in data and isinstance(data['employee_name'], str):
            data['employee_name'] = data['employee_name'].strip()
        return data


# ---------------- SCHEDULE ----------------
class ScheduleSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source='office.name', read_only=True)

    class Meta:
        model = Schedule
        fields = [
            'start_date', 'end_date', 'start_time', 'end_time',
            'shift', 'employee_name', 'office', 'office_name',
            'phone_number', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        validators = [
            UniqueTogetherValidator(
                queryset=Schedule.objects.all(),
                fields=[
                    'employee_name', 'office', 'start_date', 'end_date',
                    'start_time', 'end_time', 'shift'
                ],
                message='An identical schedule already exists.'
            )
        ]

class UserDashboardOfficeSerializer(serializers.ModelSerializer):
    office_name = serializers.ReadOnlyField(source='office.name')
    user = serializers.HiddenField(default=serializers.CurrentUserDefault())
    
    class Meta:
        model = UserDashboardOffice
        fields = ['id', 'user', 'office', 'office_name', 'order']
        validators = [
            UniqueTogetherValidator(
                queryset=UserDashboardOffice.objects.all(),
                fields=['user', 'office']
            )
        ]
