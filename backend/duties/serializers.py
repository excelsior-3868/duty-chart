from rest_framework import serializers
from .models import DutyChart, Duty, Document, RosterAssignment, Schedule
from org.models import Office
from rest_framework.validators import UniqueTogetherValidator
from django.core.exceptions import ValidationError

from org.models import Office
 # adjust import if needed


class DutyChartSerializer(serializers.ModelSerializer):
    schedules = serializers.PrimaryKeyRelatedField(queryset=Schedule.objects.all(), many=True, required=False)

    class Meta:
        model = DutyChart
        fields = [
            'id',
            'office',
            'effective_date',
            'end_date',
            'name',
            'schedules',
        ]

    # ✅ CHANGE: Call full_clean() so model-level validations (Nepal phone number format, end_date > effective_date) run
    def create(self, validated_data):
        schedules = validated_data.pop('schedules', [])
        instance = DutyChart(**validated_data)
        try:
            instance.full_clean()  # runs model.clean() + field validators
        except ValidationError as e:
            message = getattr(e, 'message_dict', None) or {'detail': str(e)}
            raise serializers.ValidationError(message)
        instance.save()
        if schedules:
            instance.schedules.set(schedules)
        return instance

    def update(self, instance, validated_data):
        schedules = validated_data.pop('schedules', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        try:
            instance.full_clean()  # re-validate on update
        except ValidationError as e:
            message = getattr(e, 'message_dict', None) or {'detail': str(e)}
            raise serializers.ValidationError(message)
        instance.save()
        if schedules is not None:
            instance.schedules.set(schedules)
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['office_name'] = instance.office.name
        data['department_name'] = instance.office.department.name
        data['directorate_name'] = instance.office.department.directorate.name
        data['schedule_names'] = [s.name for s in instance.schedules.all()]
        return data


class DutySerializer(serializers.ModelSerializer):
    class Meta:
        model = Duty
        fields = [
            'id', 'user', 'office', 'schedule', 'date', 'duty_chart',
            'is_completed', 'currently_available'
        ]

    def validate(self, attrs):
        # Ensure a user is not assigned multiple shifts (duties) on the same day
        user = attrs.get('user') or getattr(self.instance, 'user', None)
        date = attrs.get('date') or getattr(self.instance, 'date', None)

        if user and date:
            qs = Duty.objects.filter(user=user, date=date)
            if self.instance and getattr(self.instance, 'pk', None):
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                # Use 'detail' to make sure frontend toast displays this message
                raise serializers.ValidationError({
                    'detail': 'Same person cannot have duties of two shifts in the same day.'
                })

        return attrs
    # Call full_clean() and convert Django ValidationError -> DRF ValidationError
    # so the API responds with 400 and a clear message instead of 500.
    def create(self, validated_data):
        instance = Duty(**validated_data)
        try:
            instance.full_clean()
        except ValidationError as e:
            # e.message_dict usually contains field-specific errors
            # e.messages is a list of non-field errors
            message = getattr(e, 'message_dict', None) or {'detail': e.messages}
            raise serializers.ValidationError(message)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        try:
            instance.full_clean()
        except ValidationError as e:
            message = getattr(e, 'message_dict', None) or {'detail': e.messages}
            raise serializers.ValidationError(message)
        instance.save()
        return instance

    def to_representation(self, instance):
        data = super().to_representation(instance)
        user = instance.user
        data['user_name'] = getattr(user, 'full_name', None)
        data['office_name'] = getattr(instance.office, 'name', None)
        data['schedule_name'] = instance.schedule.name if instance.schedule else None
        data['start_time'] = instance.schedule.start_time if instance.schedule else None
        data['end_time'] = instance.schedule.end_time if instance.schedule else None
        data['duty_chart_name'] = getattr(instance.duty_chart, 'name', None)
        data['phone_number'] = user.phone_number if user else None
        data['user_office_name'] = user.office.name if user and user.office else None
        data['user_department_name'] = user.department.name if user and user.department else None
        data['user_directorate_name'] = user.directorate.name if user and user.directorate else None
        data['position_name'] = user.position.name if user and user.position else None
        data['email'] = user.email if user else None
        return data


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = ['id', 'file', 'description', 'uploaded_at']

    # ✅ CHANGE: Call full_clean() so model-level validations (file size limit, checksum generation) run
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

    # ✅ CHANGE: Validate each Document instance with full_clean() before saving
    def create(self, validated_data):
        uploaded_files = validated_data['files']
        meta = validated_data.get('meta')
        docs = []
        for f in uploaded_files:
            doc = Document(file=f)
            doc.full_clean()  # enforce size/checksum rules
            doc.save()
            docs.append(doc)
        return docs


# ---------------- NEW STRICT BULK UPLOAD SERIALIZERS ----------------

# Must match exactly what your Excel parser expects:
# Must match exactly what your roster bulk upload Excel template expects:
ALLOWED_HEADERS = [
    "Start Date",
    "End Date",
    "Start Time",
    "End Time",
    "Shift",
    "Employee Name",
    "Office",
    "Phone Number"  # keep/remove depending on your template
]

# Map from Excel column names -> RosterAssignment model field names
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
    """
    Strict Excel upload: accepts only .xls/.xlsx,
    validates headers EXACTLY as in the provided spec.
    """
    file = serializers.FileField()
    dry_run = serializers.BooleanField(required=False, default=False)

    def validate_file(self, f):
        name = (f.name or "").lower()
        if not (name.endswith(".xlsx") or name.endswith(".xls")):
            raise serializers.ValidationError("Only .xlsx or .xls Excel files are allowed.")
        # Check OpenXML / XLS magic bytes
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
            '__all__'
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
        """
        Allow office to be provided as either an ID or a case-insensitive name.
        """
        if isinstance(value, str):
            office_obj = Office.objects.filter(name__iexact=value).first()
            if not office_obj:
                raise serializers.ValidationError(
                    f"Office '{value}' not found."
                )
            return office_obj
        return value

    def create(self, validated_data):
        validated_data = self._normalize(validated_data)
        instance, created = RosterAssignment.objects.update_or_create(
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
        """
        Optional normalization to enforce consistent casing/spacing
        before uniqueness checks.
        """
        if 'employee_name' in data and isinstance(data['employee_name'], str):
            data['employee_name'] = data['employee_name'].strip()
        return data



class ScheduleSerializer(serializers.ModelSerializer):
    office_name = serializers.CharField(source='office.name', read_only=True)

    class Meta:
        model = Schedule
        fields = [
            'id', 'name', 'start_time', 'end_time',
            'office', 'office_name', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'office': {'required': False, 'allow_null': True},
            'status': {'required': False}
        }

    def validate(self, attrs):
        # Manual uniqueness check that handles NULL office
        # Only check if we have enough info
        name = attrs.get('name') or (self.instance.name if self.instance else None)
        office = attrs.get('office') if 'office' in attrs else (self.instance.office if self.instance else None)
        start_time = attrs.get('start_time') or (self.instance.start_time if self.instance else None)
        end_time = attrs.get('end_time') or (self.instance.end_time if self.instance else None)

        if name and start_time and end_time:
            # Check for existing
            qs = Schedule.objects.filter(
                name=name,
                office=office,
                start_time=start_time,
                end_time=end_time
            )
            
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
                
            if qs.exists():
                raise serializers.ValidationError({
                    'detail': 'A schedule with these parameters already exists.'
                })
            
        return attrs
