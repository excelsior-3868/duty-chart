import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User

# List users and their responsibilities
for user in User.objects.all():
    print(f"User: {user.full_name} ({user.employee_id}) -> Responsibility: {user.responsibility}")
