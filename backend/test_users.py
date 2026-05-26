import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dutychart.settings')
django.setup()
from users.models import User
from org.models import WorkingOffice

for u in User.objects.filter(is_activated=True)[:5]:
    print(f"User: {u.full_name}, Office: {u.office.name if u.office else 'None'}")
