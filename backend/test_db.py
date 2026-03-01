import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dutychart.settings')
django.setup()

from org.models import WorkingOffice
from users.models import User

inoc_office = WorkingOffice.objects.filter(name__icontains="INOC").first()
print(f"INOC Office: {inoc_office.name if inoc_office else 'Not found'}")

if inoc_office:
    user = User.objects.filter(office=inoc_office).first()
    if user:
        print(f"User in INOC: {user.full_name}, working office: {user.office.name if user.office else 'None'}, department: {user.department.name if user.department else 'None'}")
