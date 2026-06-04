import time
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.conf import settings
from django.core import signing
from django.utils import timezone
from django.contrib.auth import get_user_model
from users.models import Permission, Role, RolePermission, UserPermission
from otp_service.models import OTPRequest
from .serializers import TokenObtainPair2FASerializer
from .permissions import validate_raw_mobile_token, MOBILE_SESSION_LIFETIME

User = get_user_model()

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Return identity details for the authenticated user.",
        security=[{'Bearer': []}],
    )
    def get(self, request):
        user = request.user
        full_name = getattr(user, "full_name", None)
        if not full_name:
            full_name = f"{user.first_name} {user.last_name}".strip()

        role = getattr(user, "role", None)
        permissions = []
        try:
            if role == "SUPERADMIN":
                permissions = list(Permission.objects.filter(is_active=True).values_list("slug", flat=True))
            else:
                role_obj = Role.objects.filter(slug=role, is_active=True).first()
                if role_obj:
                    role_perm_slugs = list(
                        RolePermission.objects.filter(role=role_obj).select_related("permission").values_list("permission__slug", flat=True)
                    )
                    permissions = role_perm_slugs
                direct_perm_slugs = list(
                    UserPermission.objects.filter(user=user).select_related("permission").values_list("permission__slug", flat=True)
                )
                seen = set()
                merged = []
                for slug in permissions + direct_perm_slugs:
                    if slug not in seen:
                        seen.add(slug)
                        merged.append(slug)
                permissions = merged
        except Exception:
            permissions = []

        image_url = None
        if user.image:
            image_url = request.build_absolute_uri(user.image.url)

        return Response({
            "id": user.id,
            "username": user.username,
            "full_name": full_name,
            "email": user.email,
            "employee_id": getattr(user, "employee_id", None),
            "role": role,
            "position_name": user.position.name if user.position else None,
            "office_name": user.office.name if user.office else None,
            "image": image_url,
            "office_id": getattr(user, "office_id", None),
            "position_id": getattr(user, "position_id", None),
            "phone_number": user.phone_number,
            "secondary_offices": list(user.secondary_offices.values_list('id', flat=True)) if hasattr(user, 'secondary_offices') else [],
            "permissions": permissions,
        })

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt

@method_decorator(csrf_exempt, name='dispatch')
class TokenObtainPair2FAView(TokenObtainPairView):
    serializer_class = TokenObtainPair2FASerializer

    def post(self, request, *args, **kwargs):
        from .recaptcha import verify_recaptcha
        from .permissions import validate_mobile_session_token

        # Mobile app carries a session token — skip reCAPTCHA for it
        is_mobile = False
        secret = getattr(settings, 'MOBILE_API_TOKEN', None)
        if secret:
            session_token = (
                request.headers.get('X-Mobile-Session-Token') or
                request.headers.get('Mobile-Session-Token')
            )
            if session_token:
                is_mobile = validate_mobile_session_token(session_token, secret)

        if not is_mobile:
            recaptcha_token = (
                request.data.get('recaptcha_token') or
                request.headers.get('X-Recaptcha-Token')
            )
            ok, _ = verify_recaptcha(recaptcha_token, action='login')
            if not ok:
                return Response(
                    {"detail": "reCAPTCHA verification failed. Please try again."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            access_token = response.data.get('access')
            refresh_token = response.data.get('refresh')
            if access_token:
                response.set_cookie(
                    'access',
                    access_token,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax'
                )
            if refresh_token:
                response.set_cookie(
                    'refresh',
                    refresh_token,
                    httponly=True,
                    secure=not settings.DEBUG,
                    samesite='Lax'
                )
        return response

@method_decorator(csrf_exempt, name='dispatch')
class Verify2FAView(APIView):
    permission_classes = []

    def post(self, request):
        username = request.data.get('username')
        otp = request.data.get('otp')
        
        if not username or not otp:
            return Response({"detail": "Username and OTP are required."}, status=status.HTTP_400_BAD_REQUEST)
            
        try:
            from django.db.models import Q
            user = User.objects.get(Q(email=username) | Q(username=username) | Q(employee_id=username))
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        except User.MultipleObjectsReturned:
            user = User.objects.filter(email=username).first()
        if not user.is_active:
            return Response({"detail": "Your Account is not active. Please contact your administrator."}, status=status.HTTP_403_FORBIDDEN)
            
        # Find the latest pending 2FA OTP request for this user
        # We also check recently expired ones to give a better error message
        otp_request = OTPRequest.objects.filter(
            user=user, 
            purpose='login_2fa'
        ).order_by('-created_at').first()
        
        if not otp_request:
            return Response({"detail": "No 2FA request found for this user. Please login again."}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_request.status != 'pending':
            return Response({"detail": f"OTP has already been {otp_request.status}. Please login again."}, status=status.HTTP_400_BAD_REQUEST)
            
        if otp_request.expires_at < timezone.now():
            return Response({"detail": "OTP has expired. Please login again."}, status=status.HTTP_400_BAD_REQUEST)
            
        # Validate OTP using NTC gateway if seq_no is present
        from otp_service.utils import validate_otp_ntc
        
        if otp_request.seq_no:
            success, msg = validate_otp_ntc(
                seq_no=otp_request.seq_no, 
                otp=otp, 
                phone=user.phone_number
            )
            if not success:
                # User-friendly message for incorrect OTP
                if "OTP Value Verification Failed" in msg:
                    return Response({"detail": "OTP Verification Failed. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
                return Response({"detail": f"OTP Validation Failed: {msg}"}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Fallback to local validation if no seq_no (e.g. for non-NTC channels if added later)
            if otp_request.otp_code and otp_request.otp_code != otp:
                return Response({"detail": "Invalid OTP code."}, status=status.HTTP_400_BAD_REQUEST)
             
        # Mark as consumed
        otp_request.status = 'consumed'
        otp_request.save()
        
        # Generate tokens
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        refresh_token = str(refresh)
        
        response = Response({
            'refresh': refresh_token,
            'access': access_token,
        })
        
        response.set_cookie(
            'access',
            access_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax'
        )
        response.set_cookie(
            'refresh',
            refresh_token,
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax'
        )
        return response


@method_decorator(csrf_exempt, name='dispatch')
class MobileAuthView(APIView):
    """
    Issue a short-lived (1-hour) mobile session token.

    Two verification modes depending on configuration:

    PRODUCTION (FIREBASE_PROJECT_NUMBER is set):
      The mobile app calls the Firebase App Check SDK to get a signed attestation
      from Google Play Integrity, then sends it here. Google proves the request
      comes from your genuine, unmodified APK on a real device — so even if
      someone extracts the APK binary, they cannot forge a valid App Check token.

        Header: X-Firebase-AppCheck: <firebase_app_check_token>

    DEVELOPMENT (FIREBASE_PROJECT_NUMBER not set):
      Falls back to the static MOBILE_API_TOKEN shared secret.

        Header: X-Mobile-Token: <MOBILE_API_TOKEN>

    Response (both modes): { session_token, expires_in, token_type }
    The returned session_token goes in X-Mobile-Session-Token for all other requests.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        from .app_check import verify_app_check_token

        required_secret = getattr(settings, 'MOBILE_API_TOKEN', None)
        if not required_secret or not required_secret.strip():
            return Response(
                {"detail": "Mobile API not configured on this server."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        project_number = getattr(settings, 'FIREBASE_PROJECT_NUMBER', None)

        if project_number:
            # --- PRODUCTION: Firebase App Check ---
            # The static MOBILE_API_TOKEN never leaves the server; the mobile
            # app proves its identity via Google Play Integrity instead.
            app_check_token = (
                request.headers.get('X-Firebase-AppCheck') or
                request.headers.get('Firebase-AppCheck')
            )
            if not verify_app_check_token(app_check_token):
                return Response(
                    {"detail": "App integrity check failed. Use the official app on a supported device."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        else:
            # --- DEVELOPMENT FALLBACK: static shared secret ---
            raw_token = (
                request.headers.get('X-Mobile-Token') or
                request.headers.get('Mobile-Api-Token')
            )
            if not raw_token:
                return Response(
                    {"detail": "Mobile API token header is required."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
            if not validate_raw_mobile_token(raw_token, required_secret):
                return Response(
                    {"detail": "Invalid mobile API token."},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

        session_token = signing.dumps(
            {'iat': int(time.time()), 'v': 1},
            key=required_secret,
            salt='mobile_app_session',
        )

        return Response({
            "session_token": session_token,
            "expires_in": MOBILE_SESSION_LIFETIME,
            "token_type": "mobile_session",
        })
