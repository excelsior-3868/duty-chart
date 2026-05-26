from duties.models import Duty
from users.models import User

users = User.objects.filter(full_name__icontains='Subin')
for u in users:
    print(f"\nUser: {u.full_name} (ID: {u.id})")
    duties = Duty.objects.filter(user=u).select_related('duty_chart', 'schedule')
    for d in duties:
        print(f"  Chart: {d.duty_chart.name} (ID: {d.duty_chart_id}), Schedule: {d.schedule.name} (ID: {d.schedule_id}), Date: {d.date}")
