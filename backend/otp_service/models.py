from django.db import models
from django.utils import timezone
from django.conf import settings
import uuid

class OTPRequest(models.Model):
    PURPOSE_CHOICES = (
        ('forgot_password', 'Forgot Password'),
        ('change_password', 'Change Password'),
    )
    CHANNEL_CHOICES = (
        ('sms_ntc', 'NTC SMS'),
        ('email', 'Email'),
    )
    STATUS_CHOICES = (
        ('pending', 'Pending'),
        ('validated', 'Validated'),
        ('expired', 'Expired'),
        ('consumed', 'Consumed'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='otp_requests')
    phone = models.CharField(max_length=20, blank=True, null=True)
    channel = models.CharField(max_length=20, choices=CHANNEL_CHOICES)
    
    # Store NTC sequence number or internal email OTP reference
    seq_no = models.CharField(max_length=100, blank=True, null=True)
    
    # For email OTPs, we might store the hashed OTP or just use this record to track the request
    # If using NTC, they validate it, so we rely on seq_no.
    # If using Email, we need to generate code.
    otp_code = models.CharField(max_length=6, blank=True, null=True) # Hashed in real app, keeping simple for internal email logic if needed
    
    purpose = models.CharField(max_length=32, choices=PURPOSE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    attempts = models.IntegerField(default=0)
    
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def is_expired(self):
        return timezone.now() > self.expires_at

    def __str__(self):
        return f"{self.user.email} - {self.purpose} ({self.status})"
