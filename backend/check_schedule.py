import os
import django
from celery.schedules import crontab
from datetime import datetime
from zoneinfo import ZoneInfo

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.conf import settings

print(f"TIME_ZONE = {settings.TIME_ZONE}")
print(f"CELERY_TIMEZONE = {getattr(settings, 'CELERY_TIMEZONE', 'Not Set')}")
print(f"USE_TZ = {settings.USE_TZ}")

# Crontab for 10:00 AM
schedule = crontab(hour=10, minute=0)
now = datetime.now(ZoneInfo(settings.TIME_ZONE))
print(f"Current time (NPT): {now}")

# Evaluate when the next run is relative to now
# note: crontab generally operates on the 'app' timezone.
# We can't easily simulate Celery's internal logic without the app instance, 
# but we can check the timezone components.

print("Schedule definition: crontab(hour=10, minute=0)")

# Check if 10:00 AM NPT is 04:15 UTC.
npt_10am = now.replace(hour=10, minute=0, second=0, microsecond=0)
print(f"10:00 AM NPT: {npt_10am}")
print(f"10:00 AM NPT as UTC: {npt_10am.astimezone(ZoneInfo('UTC'))}")

# Check if 10:00 means 10:00 UTC
utc_10am = now.replace(hour=10, minute=0, second=0, microsecond=0, tzinfo=ZoneInfo('UTC'))
print(f"10:00 AM UTC: {utc_10am}")
print(f"10:00 AM UTC as NPT: {utc_10am.astimezone(ZoneInfo('Asia/Kathmandu'))}")
