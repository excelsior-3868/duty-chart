from __future__ import annotations
import hashlib
import uuid
from pathlib import Path
import datetime
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.db import models, transaction
from django.db.models import Q
from django.utils import timezone
import re
from auditlogs.mixins import AuditableMixin

date = models.DateField(default=timezone.now)

def document_upload_to(instance: 'Document', filename: str) -> str:
    return f"documents/{instance.uploaded_at:%Y/%m}/{filename}"

def file_checksum(django_file, chunk_size: int = 1024 * 1024) -> str:
    pos = django_file.tell()
    django_file.seek(0)
    h = hashlib.sha256()
    for chunk in iter(lambda: django_file.read(chunk_size), b''):
        h.update(chunk)
    django_file.seek(pos)
    return h.hexdigest()

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.FileField(upload_to="documents/%Y/%m/%d/")
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(
        help_text="File size in bytes",
        validators=[MinValueValidator(1), MaxValueValidator(getattr(settings, 'MAX_UPLOAD_SIZE', 50 * 1024 * 1024))]
    )
    checksum = models.CharField(max_length=64, unique=True, help_text="SHA-256 checksum for deduplication")
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="uploaded_documents")
    uploaded_at = models.DateTimeField(default=timezone.now)
    description = models.TextField(blank=True)

    class Meta:
        ordering = ['-uploaded_at']

    def __str__(self) -> str:
        return f"{Path(self.filename).name} ({self.size} bytes)"

    def clean(self):
        super().clean()
        if self.file and not self.checksum:
            self.checksum = file_checksum(self.file)

class DutyChart(AuditableMixin, models.Model):
    office = models.ForeignKey('org.WorkingOffice', on_delete=models.CASCADE, related_name='duty_charts')
    effective_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    schedules = models.ManyToManyField(
        'Schedule',
        related_name='duty_charts',
        blank=True,
        help_text="Schedules (shifts) covered by this duty chart."
    )
    def clean(self):
        super().clean()
        if self.end_date and self.end_date < self.effective_date:
            raise ValidationError({'end_date': "End date must be after effective date."})

    def __str__(self):
        period_end = self.end_date.strftime("%Y-%m-%d") if self.end_date else "open-ended"
        period_start = self.effective_date.strftime("%Y-%m-%d")
        title = self.name or "Duty Chart"
        return f"{self.office.name} – {period_start} to {period_end} ({title})"

    def get_audit_details(self, action, changes):
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Duty Chart '{self.name or 'Unnamed'}' for {self.office.name}."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Duty Chart '{self.name or 'Unnamed'}' settings."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Duty Chart '{self.name or 'Unnamed'}' for {self.office.name}."
        return ""

class Schedule(AuditableMixin, models.Model):
    status = models.CharField(max_length=20, default="template")
    start_time = models.TimeField()
    end_time = models.TimeField()
    name = models.CharField(max_length=100, help_text="Schedule name (e.g., 'Morning Shift', 'Night Duty')")
    office = models.ForeignKey('org.WorkingOffice', on_delete=models.CASCADE, related_name='schedules', blank=True, null=True)
    shift_type = models.CharField(max_length=50, blank=True, null=True, help_text="Type of shift (e.g. Regular, On-Call)")
    alias = models.CharField(max_length=20, blank=True, null=True, help_text="Short code or alias for the shift")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                fields=['name', 'office', 'start_time', 'end_time'],
                name='uniq_schedule_name_office_times',
            ),
        ]

    def __str__(self):
        office_str = self.office.name if self.office else "No office"
        return f"{self.name} – {office_str}"

    def clean(self):
        errors = {}
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            errors['end_time'] = "End time must be after start time."
        if errors:
            raise ValidationError(errors)

    def get_audit_details(self, action, changes):
        office_str = self.office.name if self.office else "Global"
        times = f"{self.start_time.strftime('%H:%M')} - {self.end_time.strftime('%H:%M')}"
        if action == 'CREATE':
            return f"CONFIGURATION: Created new Shift/Schedule '{self.name}' ({times}) at {office_str}."
        elif action == 'UPDATE':
            return f"CONFIGURATION: Updated Shift '{self.name}' ({times})."
        elif action == 'DELETE':
            return f"CONFIGURATION: Deleted Shift '{self.name}' from {office_str}."
        return ""

class RosterShift(models.Model):
    name = models.CharField(max_length=50, unique=True)
    def __str__(self):
        return self.name

class RosterAssignment(AuditableMixin, models.Model):
    status = models.CharField(max_length=20, default="pending")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    start_time = models.TimeField(default=datetime.time(9, 0))
    end_time = models.TimeField(default=datetime.time(17, 0))
    shift = models.CharField(max_length=20)
    employee_name = models.CharField(max_length=255, default="__Missing__")
    phone_number = models.CharField(max_length=20, blank=True, null=True)
    office = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['start_date', 'employee_name']
        constraints = [
            models.UniqueConstraint(
                fields=['employee_name', 'office', 'start_date', 'end_date', 'start_time', 'end_time', 'shift'],
                name='uniq_rosterassignment_emp_office_span_times_shift',
            ),
        ]

    def __str__(self):
        date_str = self.start_date.strftime("%Y-%m-%d") if self.start_date else "No date"
        office_str = self.office or "No office"
        shift_str = (self.shift.strip().title() if self.shift else "No shift")
        return f"{self.employee_name} – {date_str} {shift_str} @ {office_str}"

    def clean(self):
        errors = {}
        if self.end_date and self.start_date and self.end_date < self.start_date:
            errors['end_date'] = "End date cannot be before start date."
        if (self.start_date and self.end_date and self.start_date == self.end_date and self.end_time and self.start_time and self.end_time <= self.start_time):
            errors['end_time'] = "End time must be after start time on the same day."
        if self.phone_number:
            nepal_pattern = r'^\+977\d{10}$'
            if not re.match(nepal_pattern, self.phone_number):
                self.phone_number = None
        if errors:
            raise ValidationError(errors)

class Duty(AuditableMixin, models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='duties', null=True, blank=True)
    office = models.ForeignKey('org.WorkingOffice', on_delete=models.CASCADE, related_name='duties', null=True, blank=True)
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='duties', null=True, blank=True)
    date = models.DateField()
    is_completed = models.BooleanField(default=False)
    currently_available = models.BooleanField(default=True)
    duty_chart = models.ForeignKey('DutyChart', on_delete=models.CASCADE, related_name='duties', null=True, blank=True)

    class Meta:
        unique_together = ['user', 'duty_chart', 'date', 'schedule']

    def clean(self):
        super().clean()
        errors = {}

        if self.user and not self.user.is_activated:
            errors['user'] = "Deactivated employees cannot be assigned duties."

        if self.duty_chart:
            if self.date and self.duty_chart.effective_date and self.date < self.duty_chart.effective_date:
                errors['date'] = "Duty date must be on or after the duty chart effective date."
            if self.date and self.duty_chart.end_date and self.date > self.duty_chart.end_date:
                errors['date'] = "Duty date must be on or before the duty chart end date."

        if self.user and self.date and self.schedule:
            new_start = self.schedule.start_time
            new_end = self.schedule.end_time
            overlapping_duties = Duty.objects.filter(user=self.user, date=self.date).exclude(pk=self.pk)
            for existing_duty in overlapping_duties:
                if existing_duty.schedule == self.schedule:
                     raise ValidationError({'schedule': f"User is already assigned to the shift '{existing_duty.schedule.name}' on this day."})
                if existing_duty.schedule:
                    existing_start = existing_duty.schedule.start_time
                    existing_end = existing_duty.schedule.end_time
                    if new_start < existing_end and new_end > existing_start:
                         raise ValidationError({'schedule': f"Time overlap detected! User already has a duty '{existing_duty.schedule.name}' ({existing_start.strftime('%H:%M')} - {existing_end.strftime('%H:%M')}) which overlaps with this shift."})
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        user_name = getattr(self.user, 'full_name', 'Unknown') if self.user else 'Unassigned'
        schedule_name = self.schedule.name if self.schedule and hasattr(self.schedule, 'name') else 'No Schedule'
        date_str = self.date.strftime("%Y-%m-%d") if self.date else 'No Date'
        return f"{user_name} – {date_str} ({schedule_name})"

    def get_audit_details(self, action, changes):
        user_obj = self.user
        office_obj = self.office
        schedule_obj = self.schedule
        user_name = user_obj.full_name if user_obj else "Unassigned"
        emp_id = getattr(user_obj, 'employee_id', 'N/A') if user_obj else "N/A"
        office_name = office_obj.name if office_obj else "Unknown Office"
        schedule_name = schedule_obj.name if schedule_obj else "Unknown Shift"
        timings = ""
        if schedule_obj and hasattr(schedule_obj, 'start_time') and schedule_obj.start_time:
            start_str = schedule_obj.start_time.strftime('%H:%M')
            end_str = schedule_obj.end_time.strftime('%H:%M') if hasattr(schedule_obj, 'end_time') and schedule_obj.end_time else '??:??'
            timings = f" ({start_str} - {end_str})"
        date_str = self.date.strftime('%Y-%m-%d') if self.date else "Unknown Date"
        day_name = self.date.strftime('%A') if self.date else ""
        if action == 'CREATE':
            return f"NEW ASSIGNMENT: Assigned {user_name} (ID: {emp_id}) to {schedule_name}{timings} at {office_name} for {day_name}, {date_str}."
        elif action == 'UPDATE':
            return f"MODIFIED: Updated duty for {user_name} (ID: {emp_id}) on {day_name}, {date_str} at {office_name}."
        elif action == 'DELETE':
            return f"REMOVED: Deleted {schedule_name} assignment for {user_name} (ID: {emp_id}) on {day_name}, {date_str} at {office_name}."
        return ""
