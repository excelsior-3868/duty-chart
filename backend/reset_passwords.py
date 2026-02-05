import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from users.models import User

def reset_pwd(emp_id, pwd):
    try:
        u = User.objects.get(employee_id=emp_id)
        u.set_password(pwd)
        u.save()
        print(f"Successfully reset password for {emp_id} ({u.email}) to '{pwd}'")
    except User.DoesNotExist:
        print(f"User {emp_id} not found")

reset_pwd('9999', 'admin123')
reset_pwd('0002', 'admin123')
reset_pwd('0001', 'admin123')
