from notification_service.models import SMSLog
from users.models import User
user_ids = SMSLog.objects.filter(reminder_type__startswith='ASSIGNMENT_CHART_').values_list('user_id', flat=True)
for uid in set(user_ids):
    logs = SMSLog.objects.filter(user_id=uid, duty=None, reminder_type__startswith='ASSIGNMENT_CHART_')
    if logs.count() > 1:
        print(f'Duplicate logs for user {uid}: {logs.count()}')
