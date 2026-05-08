from notification_service.models import SMSLog
from users.models import User
logs = SMSLog.objects.filter(reminder_type='ASSIGNMENT_CHART_223')
print(f'Total logs for chart 223: {logs.count()}')
user_ids = logs.values_list('user_id', flat=True)
for uid in set(user_ids):
    c = logs.filter(user_id=uid).count()
    if c > 1:
        print(f'Duplicate for user {uid}: {c}')
