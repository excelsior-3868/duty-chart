# SMS Reminder Implementation Details

This document outlines the implementation of the SMS reminder system, specifically focusing on the recent optimizations for duty reminders.

## 1. Overview
The system provides two types of SMS reminders for employees with scheduled duties:
1.  **Daily Reminder (10:00 AM)**: Sent ONLY to employees with duties starting **after 6:00 PM**.
2.  **Hourly Reminder (1 Hour Before)**: Sent to ALL employees approximately 1 hour before their duty starts.

## 2. Files Involved

### Configuration
-   **[`backend/config/settings.py`](file:///e:/GitHub/duty-chart/backend/config/settings.py)**:
    -   Defines the Celery Beat schedule.
    -   **Change**: `send-duty-reminders-every-1-minute` runs every minute (`crontab(minute='*')`) to ensure precise 1-hour-before alerts.
    -   **Change**: `send-daily-duty-reminders-at-10am` runs everyday at 10:00 AM (`crontab(hour=10, minute=0)`).

### Business Logic
-   **[`backend/notification_service/tasks.py`](file:///e:/GitHub/duty-chart/backend/notification_service/tasks.py)**:
    -   Contains the Celery tasks that execute the logic.
    -   **`send_daily_duty_reminders`**: Queries duties for the current day.
        -   **Filter Added**: `schedule__start_time__gte='18:00:00'` ensures only evening/night shift duties trigger this reminder.
    -   **`send_duty_reminders`**: Runs every minute.
        -   Calculates a time window (starts in ~60 mins).
        -   Checks `SMSLog` to ensure the same reminder isn't sent twice (idempotency).
        -   Sends SMS if valid.

### Models
-   **[`backend/notification_service/models.py`](file:///e:/GitHub/duty-chart/backend/notification_service/models.py)** (`SMSLog`):
    -   **New Fields**: `duty` (ForeignKey) and `reminder_type` (CharField).
    -   **Constraint**: `UniqueConstraint(fields=['user', 'duty', 'reminder_type'])` ensures only one reminder of a specific type is ever created for a duty.

## 3. Workflow & Process

### A. Daily Reminder Flow (10:00 AM)
1.  **Trigger**: Celery Beat triggers `send_daily_duty_reminders` at 10:00 AM.
2.  **Filter**: Selects duties where `start_time >= 18:00`.
3.  **Idempotency**: Attempts to insert `SMSLog` with `reminder_type='DAILY_10AM'`.
    -   If successful: Sends SMS.
    -   If fails (IntegrityError): Skips (Duplicate).

### B. Hourly Reminder Flow (Every 1 Minute)
1.  **Trigger**: Celery Beat triggers `send_duty_reminders` every minute.
2.  **Window Calculation**:
    -   Calculates `window_start` (+45m) and `window_end` (+75m).
    -   Queries duties across candidate dates (handling midnight crossings).
3.  **Action**:
    -   Iterates duties in the window.
    -   **Atomic Claim**: Attempts to `INSERT` a `PENDING` log with `reminder_type='1_HOUR'`.
    -   **Send**: If insert succeeds, proceeds to send SMS via `async_send_sms`.
    -   **Update**: Updates log status to `SENT` or `FAILED` based on gateway response.

## 4. Deployment Instructions
To apply these changes:
1.  **Update Code**: Pull the latest changes to [`settings.py`](file:///e:/GitHub/duty-chart/backend/config/settings.py) and [`tasks.py`](file:///e:/GitHub/duty-chart/backend/notification_service/tasks.py).
2.  **Apply Migrations**: A migration is required for `SMSLog` changes.
    ```bash
    python manage.py migrate notification_service
    ```
3.  **Restart Celery Beat**: The schedule changes in `settings.py` require a restart of the Celery Beat service.
    ```bash
    # Example (if using systemd)
    sudo systemctl restart celery-beat
    ```
4.  **Restart Celery Worker**: Recommended to ensure new task logic is loaded.
    ```bash
    # Example
    sudo systemctl restart celery-worker
    ```
