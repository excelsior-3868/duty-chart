import os
import sys
import django

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from datetime import timedelta, datetime
from duties.models import Duty, Schedule
from notification_service.models import SMSLog

notifiable_types = ['Shift', 'On-Call', 'On call', 'shifted', 'on-call', 'on call', 'OnCall', 'oncall']

now = timezone.now()
print(f"Current Time (UTC): {now}")
print(f"Current Time (Local): {timezone.localtime(now)}")

# Check for duties starting in the next few hours
window_start = now + timedelta(minutes=45)
window_end = now + timedelta(minutes=75)
print(f"Checking window: {window_start} to {window_end}")

duties = Duty.objects.filter(
    date__in=[window_start.date(), window_end.date()],
    user__isnull=False,
    schedule__isnull=False
).select_related('user', 'schedule')

print(f"\nDuties in candidate window:")
for d in duties:
    st = d.schedule.shift_type
    start_time = d.schedule.start_time
    duty_start_dt = timezone.make_aware(datetime.combine(d.date, start_time))
    
    in_window = window_start <= duty_start_dt <= window_end
    is_notifiable = st in notifiable_types
    
    print(f"Duty ID: {d.id}, Date: {d.date}, Start: {start_time}, Type: {st}, User: {d.user.username}, In Window: {in_window}, Is Notifiable: {is_notifiable}")

# Check if ANY notifiable duties exist today/tomorrow
future_notifiable = Duty.objects.filter(
    date__gte=now.date(),
    schedule__shift_type__in=notifiable_types
).count()
print(f"\nTotal future notifiable duties: {future_notifiable}")

# Check if Celery Beat is working (by checking last task execution time if stored anywhere, or just looking at SMSLog timestamps)
last_log = SMSLog.objects.order_by('-created_at').first()
if last_log:
    print(f"\nLast SMS log (any type): {last_log.created_at}, Type: {last_log.reminder_type}, Status: {last_log.status}")
else:
    print("\nNo SMS logs found.")
