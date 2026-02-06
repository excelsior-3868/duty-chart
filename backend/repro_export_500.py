
import os
import django
import sys

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from duties.models import DutyChart
from duties.views import DutyChartExportFile
from rest_framework.test import APIRequestFactory, force_authenticate
from django.contrib.auth import get_user_model

def test_export():
    factory = APIRequestFactory()
    
    # Get a real chart
    chart = DutyChart.objects.first()
    if not chart:
        print("No DutyChart found")
        return

    # Get a real user
    User = get_user_model()
    admin = User.objects.filter(is_superuser=True).first()
    if not admin:
        print("No admin user found")
        return
    
    # Mock request
    view = DutyChartExportFile.as_view()
    
    for fmt in ["excel", "pdf", "docx"]:
        print(f"\nTesting format: {fmt}")
        request = factory.get(f'/api/export/duty-chart/download/?chart_id={chart.id}&export_format={fmt}&scope=full')
        force_authenticate(request, user=admin)
        
        try:
            response = view(request)
            print(f"Status: {response.status_code}")
            if hasattr(response, 'data') and response.data:
                print(f"Data: {response.data}")
            else:
                print("Response returned binary/no data")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    test_export()
