import os
import django
import sys

# Setup Django environment
sys.path.append(os.getcwd())
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from notification_service.utils import send_sms

def test_sms():
    receiver = "9851129935"
    message = "Dear Test, You have been assigned to duty chart 'Test CTO' at 'CTO' for the 'Evening Shift' on 2083-01-26. Please visit https://dutychart.ntc.net.np for the detail."
    print(f"Attempting to send test SMS to {receiver}...")
    success, response = send_sms(receiver, message)
    if success:
        print(f"SUCCESS: SMS sent. Response: {response}")
    else:
        print(f"FAILED: SMS not sent. Error: {response}")

if __name__ == "__main__":
    test_sms()
