
import os
import django
import sys

# Add the project directory to sys.path
sys.path.append(os.getcwd())

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

try:
    from users import views
    print("Successfully imported users.views")
except Exception as e:
    print(f"Error importing users.views: {e}")
