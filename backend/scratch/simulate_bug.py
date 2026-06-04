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

# Simulate the logic in tasks.py
def simulate_logic(test_now_utc):
    print(f"\n--- Simulating for UTC: {test_now_utc} ---")
    local_time = timezone.localtime(test_now_utc)
    print(f"Local Time (Kathmandu): {local_time}")
    
    window_start = test_now_utc + timedelta(minutes=45)
    window_end = test_now_utc + timedelta(minutes=75)
    
    candidate_dates = [window_start.date(), window_end.date()]
    candidate_dates = list(set(candidate_dates))
    
    print(f"UTC Dates used for filtering: {candidate_dates}")
    
    # Check if a duty exists at Local Time + 1 hour
    target_local_dt = local_time + timedelta(hours=1)
    target_date = target_local_dt.date()
    print(f"Target Duty Date (Local): {target_date}")
    
    if target_date not in candidate_dates:
        print(f"!!! BUG DETECTED: The duty for {target_date} would be MISSED because the filter only looks for {candidate_dates}")
    else:
        print("Logic works for this timestamp.")

# Case 1: Middle of the day (Local: 14:00, UTC: 08:15)
simulate_logic(datetime(2026, 5, 12, 8, 15, tzinfo=timezone.utc))

# Case 2: Early morning (Local: 03:00 AM May 13, UTC: 21:15 PM May 12)
simulate_logic(datetime(2026, 5, 12, 21, 15, tzinfo=timezone.utc))
