import os
import django
from datetime import date

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from duties.models import Duty, DutyChart, Schedule
from users.models import User
from rest_framework import serializers

def debug_upsert():
    # Attempt to mock what's happening in bulk_upsert
    # Based on the screenshot:
    # User ID: probably 7302 (employee_id)
    # Date Range: 2082-10-21 to 2082-10-23 (BS) -> I need to know AD dates
    
    # Let's find a user and schedule to test with
    u = User.objects.first()
    s = Schedule.objects.first()
    chart = DutyChart.objects.first()
    
    if not (u and s and chart):
        print("Missing test data")
        return

    data = [
        {
            "user": u.id,
            "office": u.office_id or chart.office_id,
            "schedule": s.id,
            "date": "2082-10-21", # This might fail parse_date if it expects YYYY-MM-DD
            "duty_chart": chart.id
        }
    ]
    
    # Simulate the logic
    for item in data:
        user_id = item.get("user")
        office_id = item.get("office")
        chart_id = item.get("duty_chart") # Corrected key
        schedule_id = item.get("schedule")
        duty_date_raw = item.get("date")
        
        from django.utils.dateparse import parse_date
        duty_date = parse_date(duty_date_raw)
        print(f"Parsed Date: {duty_date}")
        
        try:
            obj, was_created = Duty.objects.update_or_create(
                user_id=user_id,
                duty_chart_id=chart_id,
                schedule_id=schedule_id,
                date=duty_date,
                defaults={
                    "office_id": office_id,
                    "is_completed": item.get("is_completed", False),
                    "currently_available": item.get("currently_available", True),
                },
            )
            print(f"Object: {obj}, Created: {was_created}")
            
            from django.core.exceptions import ValidationError
            try:
                obj.full_clean()
                print("full_clean passed")
            except ValidationError as e:
                print(f"ValidationError in full_clean: {e}")
                
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    debug_upsert()
