Infrastructure Upgraded: Celery, Redis & Real-Time Notifications
I have successfully upgraded the infrastructure from simple polling and manual commands to a production-ready setup using Celery, Redis, and Django Channels.

Key Changes
1. Robust Background Tasks (Celery)
Automatic Reminders: The 
send_duty_reminders
 logic now runs as a background task.
Asynchronous SMS: SMS messages are now sent asynchronously, meaning the server doesn't "wait" for the gateway to respond, making the app much faster.
Scheduled Monitoring: Configured Celery Beat to check for upcoming duties every 15 minutes.
2. Instant Real-Time Notifications (Django Channels)
WebSockets: Replaced frontend polling with a persistent WebSocket connection.
Zero Latency: When you assign a duty, the notification appears instantly on the assigned user's screen without them needing to refresh or wait for a poll cycle.
JWT Security: Integrated a custom WebSocket middleware that secures connections using the same JWT tokens as your API.
Production Setup Instructions
To enable these new features on your production server, follow these steps:

Step 1: Install Redis
If Redis is not installed, run:

sudo apt-get install redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
Step 2: Update Requirements
Run the following in your backend directory:

pip install -r requirements.txt
Step 3: Run the Services

In production, you now need to run three separate processes:

Daphne (The ASGI Server): Replaces runserver or gunicorn for WebSocket support.

daphne -b 0.0.0.0 -p 8000 config.asgi:application
Celery Worker: Handles the background tasks (SMS sending).

celery -A config worker -l info
Celery Beat: Handles the scheduling (Periodic checks for reminders).

celery -A config beat -l info