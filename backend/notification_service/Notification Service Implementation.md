Infrastructure Upgrade: Real-Time Notifications & Background Tasks
This plan outlines the transition from manual management commands and frontend polling to a professional production setup using Celery for background tasks and Django Channels for real-time notifications.

User Review Required
IMPORTANT

This upgrade requires a Redis server to be installed on your production environment. Please confirm that Redis is either already installed or can be installed.

NOTE

We will be moving from WSGI to ASGI to support WebSockets (Django Channels).

Proposed Changes
Backend Dependencies
[MODIFY] 
requirements.txt
Add celery
Add redis
Add channels
Add channels-redis
Celery Configuration
[NEW] 
celery.py
Initialize Celery App.
Configure automatic task discovery.
[MODIFY] 
init
.py
Ensure Celery app is loaded when Django starts.
Background Tasks
[NEW] 
tasks.py
Create a send_duty_reminders celery task.
This will replace the manual send_reminders management command.
Django Channels (Real-Time)
[MODIFY] 
settings.py
Add channels to INSTALLED_APPS.
Configure ASGI_APPLICATION.
Configure CHANNEL_LAYERS (Redis backing).
[NEW] 
asgi.py
Configure ASGI routing for WebSockets.
[NEW] 
consumers.py
Implement NotificationConsumer for WebSocket connections.
[NEW] 
routing.py
Define WebSocket URL patterns.
Frontend Integration
[MODIFY] 
NotificationBell.tsx
Replace data polling with a WebSocket connection.
Update UI to react to real-time events.
Verification Plan
Automated Tests
Verification of Celery task execution via logs.
WebSocket connection test using browser dev tools.
Manual Verification
Assign a duty and observe the notification appearing instantly in the header without refreshing.
Set a reminder and verify the SMS/Notification is sent by the Celery worker.

Comment
Ctrl+Alt+M
its not installed in the Server. Need to install it