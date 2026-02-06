import os
import time
import django
import sys

# Setup Django environment
sys.path.append("/home/subin/duty-chart/backend")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from duties.models import Duty, DutyChart
from django.db import connection

def test_preview_performance(chart_id, page_size=10):
    start_time = time.time()
    
    chart = DutyChart.objects.get(pk=chart_id)
    qs = Duty.objects.filter(duty_chart_id=chart.id).select_related(
        "user", "office", "schedule", "user__directorate", "user__department", "user__position"
    )
    
    print(f"Counting duties for chart {chart_id}...")
    cnt_start = time.time()
    total = qs.count()
    print(f"Count: {total} (took {time.time() - cnt_start:.4f}s)")
    
    print(f"Fetching page 1 (size {page_size})...")
    fetch_start = time.time()
    items = list(qs.order_by("date")[0:page_size])
    print(f"Fetched {len(items)} items (took {time.time() - fetch_start:.4f}s)")
    
    print(f"Processing rows...")
    proc_start = time.time()
    for d in items:
        user = d.user
        office = d.office
        schedule = d.schedule
        _ = {
            "date": d.date.isoformat(),
            "employee_id": getattr(user, "employee_id", None),
            "full_name": getattr(user, "full_name", None) or getattr(user, "username", None),
            "phone_number": getattr(user, "phone_number", None),
            "directorate": getattr(getattr(user, "directorate", None), "name", None) if user else None,
            "department": getattr(getattr(user, "department", None), "name", None) if user else None,
            "office": getattr(office, "name", None) or (getattr(getattr(user, "office", None), "name", None) if user else None),
            "schedule": getattr(schedule, "name", None),
            "start_time": getattr(schedule, "start_time", None).strftime("%H:%M") if getattr(schedule, "start_time", None) else None,
            "end_time": getattr(schedule, "end_time", None).strftime("%H:%M") if getattr(schedule, "end_time", None) else None,
        }
    print(f"Processed rows (took {time.time() - proc_start:.4f}s)")
    
    print(f"Total logic time: {time.time() - start_time:.4f}s")
    
    # Check SQL queries
    print(f"\nTotal SQL queries: {len(connection.queries)}")
    # for q in connection.queries:
    #     print(f"SQL: {q['sql']}\nTime: {q['time']}\n")

if __name__ == "__main__":
    # Get any chart ID
    latest_chart = DutyChart.objects.latest('id')
    if latest_chart:
        test_preview_performance(latest_chart.id)
    else:
        print("No duty charts found.")
