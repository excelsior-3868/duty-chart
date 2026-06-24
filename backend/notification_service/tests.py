from django.test import TestCase, TransactionTestCase
from django.utils import timezone
from datetime import timedelta, datetime, time
from unittest.mock import patch, MagicMock
from django.contrib.auth import get_user_model
from duties.models import DutyChart, Duty, Schedule
from org.models import WorkingOffice
from notification_service.models import SMSLog
from notification_service.tasks import send_duty_reminders, send_daily_duty_reminders
from notification_service.signals import suppress_duty_notifications

User = get_user_model()

class NotificationLogicTest(TransactionTestCase):
    def setUp(self):
        # Setup Office
        self.office = WorkingOffice.objects.create(name="Test Office")
        
        # Setup User
        self.user = User.objects.create_user(
            username="testuser",
            password="password123",
            phone_number="+9779800000000",
            full_name="Test User",
            is_activated=True,
            office=self.office
        )
        
        # Setup Schedule (Notifiable type)
        self.notifiable_schedule = Schedule.objects.create(
            name="Morning Shift",
            start_time=time(9, 0),
            end_time=time(17, 0),
            shift_type="Shift",
            office=self.office
        )

    @patch('notification_service.utils.requests.get')
    def test_assignment_signal_respects_approval_status(self, mock_get):
        """Test that individual duty assignment signals only send SMS if chart is approved."""
        mock_get.return_value.status_code = 200
        mock_get.return_value.text = "0"

        # 1. Create Chart in DRAFT
        draft_chart = DutyChart.objects.create(
            office=self.office,
            effective_date=timezone.localdate(),
            status='draft',
            name="Draft Chart"
        )

        # Assign Duty to Draft Chart
        Duty.objects.create(
            user=self.user,
            office=self.office,
            schedule=self.notifiable_schedule,
            date=timezone.localdate(),
            duty_chart=draft_chart
        )
        
        # Verify no SMS Log was created with 'ASSIGNMENT' type
        self.assertFalse(SMSLog.objects.filter(user=self.user, reminder_type='ASSIGNMENT').exists())

        # 2. Create Chart in APPROVED
        approved_chart = DutyChart.objects.create(
            office=self.office,
            effective_date=timezone.localdate(),
            status='approved',
            name="Approved Chart"
        )

        # Assign Duty to Approved Chart
        Duty.objects.create(
            user=self.user,
            office=self.office,
            schedule=self.notifiable_schedule,
            date=timezone.localdate(),
            duty_chart=approved_chart
        )
        
        # Verify SMS Log exists
        self.assertTrue(SMSLog.objects.filter(user=self.user, reminder_type='ASSIGNMENT').exists())

    @patch('notification_service.utils.send_sms')
    def test_periodic_reminders_respect_approval_status(self, mock_send):
        """Test that periodic tasks only send reminders for approved charts."""
        mock_send.return_value = (True, "0")

        # Use aware datetimes to match task logic
        test_now = timezone.now()
        local_now = timezone.localtime(test_now)
        duty_date = local_now.date()
        
        # Schedule starting in 60 minutes local time
        start_time = (local_now + timedelta(minutes=60)).time()
        
        schedule = Schedule.objects.create(
            name="1 Hour Shift Unique",
            start_time=start_time,
            end_time=(local_now + timedelta(hours=2)).time(),
            shift_type="Shift",
            office=self.office
        )

        with patch('django.utils.timezone.now', return_value=test_now):
            # Create setting for the office to enable the schedule
            from notification_service.models import OfficeNotificationSetting
            OfficeNotificationSetting.objects.create(
                office=self.office,
                schedule_configs={
                    str(schedule.id): {
                        "enabled": True,
                        "advance_reminder_days": 0,
                        "advance_reminder_time": "00:00:00"
                    }
                }
            )

            # 1. Duty in DRAFT chart
            draft_chart = DutyChart.objects.create(
                office=self.office,
                effective_date=duty_date,
                status='draft'
            )
            Duty.objects.create(
                user=self.user,
                office=self.office,
                schedule=schedule,
                date=duty_date,
                duty_chart=draft_chart
            )

            # Run 1-hour reminder task
            send_duty_reminders()
            self.assertFalse(SMSLog.objects.filter(reminder_type='1_HOUR').exists())

            # 2. Duty in APPROVED chart
            approved_chart = DutyChart.objects.create(
                office=self.office,
                effective_date=duty_date,
                status='approved'
            )
            Duty.objects.create(
                user=self.user,
                office=self.office,
                schedule=schedule,
                date=duty_date,
                duty_chart=approved_chart
            )

            # Run 1-hour reminder task
            send_duty_reminders()
            self.assertTrue(SMSLog.objects.filter(reminder_type='1_HOUR').exists())

    @patch('notification_service.utils.send_sms')
    def test_daily_10am_reminder_logic(self, mock_send):
        """Test the 10 AM reminder logic."""
        mock_send.return_value = (True, "0")
        today = timezone.localdate()

        approved_chart = DutyChart.objects.create(
            office=self.office,
            effective_date=today,
            status='approved'
        )

        # Evening Shift (19:00), Notifiable type -> SHOULD SEND
        evening_schedule = Schedule.objects.create(
            name="Night Shift",
            start_time=time(19, 0),
            end_time=time(23, 0),
            shift_type="Shift",
            office=self.office
        )
        Duty.objects.create(user=self.user, schedule=evening_schedule, date=today, duty_chart=approved_chart)

        # Morning Shift (09:00), Notifiable type -> SHOULD NOT SEND
        morning_schedule_2 = Schedule.objects.create(
            name="Morning Shift 10AM Test",
            start_time=time(9, 0),
            end_time=time(17, 0),
            shift_type="Shift",
            office=self.office
        )
        Duty.objects.create(user=self.user, schedule=morning_schedule_2, date=today, duty_chart=approved_chart)

        # Run 10 AM reminder task
        send_daily_duty_reminders()
        
        daily_logs = SMSLog.objects.filter(reminder_type='DAILY_10AM')
        self.assertEqual(daily_logs.count(), 1)
        self.assertIn("Night Shift", daily_logs[0].message)

    def test_clean_notification_message(self):
        """Test that the helper cleans the dutychart URL patterns for dashboard notification messages."""
        from notification_service.utils import clean_notification_message
        
        # Test case 1: Assignment with link
        msg1 = 'Dear John Doe, You have been assigned to duty chart "Admin" at "CTO" for "Morning Shift" on 2083-01-26. Please visit https://dutychart.ntc.net.np for details.'
        self.assertEqual(
            clean_notification_message(msg1),
            'Dear John Doe, You have been assigned to duty chart "Admin" at "CTO" for "Morning Shift" on 2083-01-26.'
        )

        # Test case 2: Activation / Password Reset link
        msg2 = 'Dear John Doe, your DCMS account has been created. Please visit https://dutychart.ntc.net.np and use the Forgot Password option to set your new password.'
        self.assertEqual(
            clean_notification_message(msg2),
            'Dear John Doe, your DCMS account has been created. Please use the Forgot Password option to set your new password.'
        )

        # Test case 3: Role update link
        msg3 = "Dear John Doe, your system role of DCMS has been updated to 'Admin'. Please visit https://dutychart.ntc.net.np for details."
        self.assertEqual(
            clean_notification_message(msg3),
            "Dear John Doe, your system role of DCMS has been updated to 'Admin'."
        )

        # Test case 4: Simple visit URL
        msg4 = "Visit dutychart.ntc.net.np"
        self.assertEqual(
            clean_notification_message(msg4),
            ""
        )

