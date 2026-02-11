import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from duties.models import Schedule

print("All schedules with status='template':")
print("-" * 80)
templates = Schedule.objects.filter(status='template')
print(f"Total count: {templates.count()}")
print()

for t in templates:
    print(f"ID: {t.id}")
    print(f"  Name: {t.name}")
    print(f"  Status: {t.status}")
    print(f"  Office: {t.office_id} ({t.office.name_of_office if t.office else 'NULL'})")
    print(f"  Start: {t.start_time}, End: {t.end_time}")
    print()
