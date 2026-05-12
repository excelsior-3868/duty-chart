import os
import django
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from duties.models import DutyChart
from duties.serializers import DutyChartSerializer
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

factory = APIRequestFactory()
request = factory.get('/')
# We need to simulate a request to get absolute URLs
serializer_context = {'request': Request(request)}

chart = DutyChart.objects.filter(name='Anuschi').first()
if chart:
    serializer = DutyChartSerializer(chart, context=serializer_context)
    print(json.dumps(serializer.data, indent=2))
else:
    print("Chart not found")
