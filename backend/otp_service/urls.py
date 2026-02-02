from django.urls import path
from .views import (
    RequestOTPView, ValidateOTPView, ResetPasswordView, UserLookupView, 
    VerifyPasswordView, ChangePasswordView, SignupLookupView, SignupCompleteView
)

urlpatterns = [
    path('lookup/', UserLookupView.as_view(), name='otp_lookup'),
    path('request/', RequestOTPView.as_view(), name='otp_request'),
    path('validate/', ValidateOTPView.as_view(), name='otp_validate'),
    path('password/verify/', VerifyPasswordView.as_view(), name='password_verify'),
    path('password/reset/', ResetPasswordView.as_view(), name='password_reset'),
    path('password/change/', ChangePasswordView.as_view(), name='password_change'),
    path('signup/lookup/', SignupLookupView.as_view(), name='signup_lookup'),
    path('signup/complete/', SignupCompleteView.as_view(), name='signup_complete'),
]
