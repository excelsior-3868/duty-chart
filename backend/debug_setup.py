import os
import sys
import django

print("Python executable:", sys.executable)
print("CWD:", os.getcwd())
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
try:
    django.setup()
    print("Django setup successful")
    from auditlogs.models import AuditLog
    print("AuditLog imported successfully")
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
