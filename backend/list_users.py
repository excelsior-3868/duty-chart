import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User
print(f"{'Username':<20} {'Email':<30} {'Role':<15} {'Is Active'}")
print("-" * 80)
for u in User.objects.all():
    print(f"{u.employee_id:<20} {u.email:<30} {u.role:<15} {u.is_active}")
