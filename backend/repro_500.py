import os
import django
import requests

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from duties.models import Duty, DutyChart, Schedule
from users.models import User
from rest_framework import serializers

def reproduce():
    # Attempt to call the internal view logic
    from duties.views import DutyViewSet
    from rest_framework.test import APIRequestFactory
    
    factory = APIRequestFactory()
    u = User.objects.get(employee_id='7302') # Subin
    s = Schedule.objects.get(id=12) # WFH(Late Evening)
    office_id = u.office_id
    
    # Payload similar to what frontend sends
    data = [
        {"user": u.id, "office": office_id, "schedule": s.id, "date": "2026-02-04", "duty_chart": None},
        {"user": u.id, "office": office_id, "schedule": s.id, "date": "2026-02-05", "duty_chart": None},
        {"user": u.id, "office": office_id, "schedule": s.id, "date": "2026-02-06", "duty_chart": None},
    ]
    
    request = factory.post('/api/duties/bulk-upsert/', data, format='json')
    # Mock user
    from django.contrib.auth import get_user_model
    admin = get_user_model().objects.filter(is_superuser=True).first()
    request.user = admin
    
    view = DutyViewSet.as_view({'post': 'bulk_upsert'})
    try:
        response = view(request)
        print(f"Status: {response.status_code}")
        print(f"Data: {response.data}")
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    reproduce()
