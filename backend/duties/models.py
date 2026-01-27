from __future__ import annotations

import hashlib
import uuid
from pathlib import Path
import datetime
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from django.db import models
from django.utils import timezone
from django.conf import settings

from django.conf import settings
import re
import datetime

date = models.DateField(default=timezone.now)



def document_upload_to(instance: 'Document', filename: str) -> str:
    """Dynamic upload path for documents based on upload date."""
    return f"documents/{instance.uploaded_at:%Y/%m}/{filename}"


def file_checksum(django_file, chunk_size: int = 1024 * 1024) -> str:
    """Compute SHA-256 checksum for a file in chunks to avoid memory overload."""
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
        # ✅ Validation: Ensure file size > 0 and <= MAX_UPLOAD_SIZE (default 50MB if not set)
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
        # ✅ Validation: Auto-generate checksum if missing (ensures deduplication works even outside serializers)
        if self.file and not self.checksum:
            self.checksum = file_checksum(self.file)

    @classmethod
    def build_from_inmemory(cls, f, user, meta: dict | None = None) -> 'Document':
        """Factory method for creating Document from an in-memory file."""
        checksum = file_checksum(f)
        f.seek(0)
        description = str(meta.get('description', '')).strip() if meta else ''
        return cls(
            file=f,
            filename=getattr(f, 'name', 'uploaded.bin'),
            size=getattr(f, 'size', f.size if hasattr(f, 'size') else 0),
            content_type=getattr(f, 'content_type', ''),
            checksum=checksum,
            description=description,
            uploaded_by=user,
        )


class DutyChart(models.Model):
    office = models.ForeignKey('org.Office', on_delete=models.CASCADE, related_name='duty_charts')
    effective_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    name = models.CharField(max_length=255, blank=True, null=True)
    # Schedules (shifts) covered by this duty chart
    schedules = models.ManyToManyField(
        'Schedule',
        related_name='duty_charts',
        blank=True,
        help_text="Schedules (shifts) covered by this duty chart."
    )
    def clean(self):
        super().clean()
        # ✅ Validation: End date must be after effective date
        if self.end_date and self.end_date < self.effective_date:
            raise ValidationError({'end_date': "End date must be after effective date."})

    def __str__(self):
        """Readable representation including office, period, and optional name.

        Example: "Kathmandu Office – 2025-01-01 to 2025-03-31 (Incident Response)"
        """
        period_end = self.end_date.strftime("%Y-%m-%d") if self.end_date else "open-ended"
        period_start = self.effective_date.strftime("%Y-%m-%d")
        title = self.name or (getattr(self, 'employee_name', None) or "Duty Chart")
        return f"{self.office.name} – {period_start} to {period_end} ({title})"


# duties/models.py


class Schedule(models.Model):
    # Keep the link to the actual user account
   # user = models.ForeignKey(
       # settings.AUTH_USER_MODEL,
        #on_delete=models.CASCADE,
        #related_name="schedules"
    #)

    # Match RosterAssignment's required/optional fields
    status = models.CharField(max_length=20, default="pending")

    start_time = models.TimeField()
    end_time = models.TimeField()

    name = models.CharField(max_length=100, help_text="Schedule name (e.g., 'Morning Shift', 'Night Duty')")

    # Keep office as CharField to match RosterAssignment exactly
    office = models.ForeignKey('org.Office', on_delete=models.CASCADE, related_name='schedules', blank=True, null=True)

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
        """
        Centralized validation for time fields only.
        """
        errors = {}
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            errors['end_time'] = "End time must be after start time."
        if errors:
            raise ValidationError(errors)

    @classmethod
    def from_roster_assignment(cls, roster):
        """
        Create a Schedule instance from a RosterAssignment object.
        Maps shift/time and office; dates are not used.
        """
        return cls(
            status=roster.status,
            start_time=roster.start_time,
            end_time=roster.end_time,
            name=roster.shift or "Schedule",
            # Note: office resolution by name/string should be handled by caller
        )


class RosterShift(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name

REQUIRED_COLUMNS = [
    "Start Date", "End Date", "Employee Name", "Start Time",
    "End Time", "Shift", "Phone no.", "Office"
]


class RosterAssignment(models.Model):
    status = models.CharField(max_length=20, default="pending")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)  # ✅ can be empty

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
                fields=[
                    'employee_name', 'office',
                    'start_date', 'end_date',
                    'start_time', 'end_time', 'shift'
                ],
                name='uniq_rosterassignment_emp_office_span_times_shift',
            ),
        ]

        """
       
        Descriptive label for admin drop‑downs, relations, and logs.
        Example: "John Doe – 2025-08-27 Morning @ Kathmandu Office"
        """
    def __str__(self):
        date_str = self.start_date.strftime("%Y-%m-%d") if self.start_date else "No date"
        office_str = self.office or "No office"
        shift_str = (self.shift.strip().title() if self.shift else "No shift")
        return f"{self.employee_name} – {date_str} {shift_str} @ {office_str}"

       


    def clean(self):
        """
        Centralized validation – keeps admin, API, and bulk uploads consistent.
        """
        errors = {}

        # Date logic
        if self.end_date and self.start_date and self.end_date < self.start_date:
            errors['end_date'] = "End date cannot be before start date."

        # Time logic (same-day)
        if (
            self.start_date
            and self.end_date
            and self.start_date == self.end_date
            and self.end_time
            and self.start_time
            and self.end_time <= self.start_time
        ):
            errors['end_time'] = "End time must be after start time on the same day."

        # Phone number validation
        if self.phone_number:
            nepal_pattern = r'^\+977\d{10}$'
            if not re.match(nepal_pattern, self.phone_number):
                # Using None instead of "__Missing__" to avoid polluting UI/exports
                self.phone_number = None

        if errors:
            raise ValidationError(errors)


class Duty(models.Model):
    user = models.ForeignKey('users.User', on_delete=models.CASCADE, related_name='duties', null=True, blank=True)
    office = models.ForeignKey('org.Office', on_delete=models.CASCADE, related_name='duties', null=True, blank=True)
    schedule = models.ForeignKey(Schedule, on_delete=models.CASCADE, related_name='duties', null=True, blank=True)
    date = models.DateField()
    is_completed = models.BooleanField(default=False)
    currently_available = models.BooleanField(default=True)
    duty_chart = models.ForeignKey(
        'DutyChart',
        on_delete=models.CASCADE,
        related_name='duties',
        null=True,
        blank=True,
        help_text="The DutyChart this duty belongs to."
    )

    class Meta:
        # Ensure uniqueness per user, duty chart, schedule, and date
        unique_together = ['user', 'duty_chart', 'date', 'schedule']

    def clean(self):
        super().clean()
        errors = {}

        # ✅ Validation: Duty date must be within the duty_chart's effective period
        if self.duty_chart:
            if self.date and self.duty_chart.effective_date and self.date < self.duty_chart.effective_date:
                errors['date'] = "Duty date must be on or after the duty chart effective date."
            if self.date and self.duty_chart.end_date and self.date > self.duty_chart.end_date:
                errors['date'] = "Duty date must be on or before the duty chart end date."

        # Schedules no longer carry date ranges, so no schedule-date validation

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        """Readable duty representation including user, date, and schedule name."""
        user_name = getattr(self.user, 'full_name', 'Unknown') if self.user else 'Unassigned'
        schedule_name = self.schedule.name if self.schedule and hasattr(self.schedule, 'name') else 'No Schedule'
        date_str = self.date.strftime("%Y-%m-%d") if self.date else 'No Date'
        return f"{user_name} – {date_str} ({schedule_name})"
