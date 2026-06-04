import os
import sys
import django
from django.utils import timezone
from datetime import timedelta, datetime, time

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from duties.models import Duty

# Find duties with early morning shifts (00:00 to 05:45)
early_duties = Duty.objects.filter(
    schedule__start_time__gte=time(0, 0),
    schedule__start_time__lte=time(5, 45)
).select_related('schedule', 'user')

print(f"Found {early_duties.count()} duties in the 00:00 - 05:45 window.")

for d in early_duties.order_by('-date')[:10]:
    # Check if this duty has any SMS logs
    log_count = d.sms_logs_for_duty.count()
    print(f"Duty ID: {d.id}, Date: {d.date}, Start: {d.schedule.start_time}, User: {d.user.username}, SMS Logs: {log_count}")
