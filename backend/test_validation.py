import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'dutychart.settings')
django.setup()

from users.serializers import UserSerializer
# Test dummy data
data = {
    'full_name': 'Test User',
    'employee_id': 'EMP1234',
    'email': 'test@ntc.net.np',
    'username': 'EMP1234',
    'office': 1,
    'position': 1,
    'role': 'USER',
    'is_active': True,
    'password': 'Password123!',
}
serializer = UserSerializer(data=data)
if not serializer.is_valid():
    print("Validation Errors:", serializer.errors)
else:
    print("Valid!")
