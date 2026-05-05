import os
import django
import sys

# Setup Django environment
sys.path.append('/Users/subin/Github/duty-chart/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from notification_service.utils import send_sms

def test_sms():
    receiver = "9851129935"
    message = "Test SMS from Duty Chart System"
    print(f"Attempting to send test SMS to {receiver}...")
    success, response = send_sms(receiver, message)
    if success:
        print(f"SUCCESS: SMS sent. Response: {response}")
    else:
        print(f"FAILED: SMS not sent. Error: {response}")

if __name__ == "__main__":
    test_sms()
