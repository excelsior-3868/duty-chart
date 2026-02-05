from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from django.utils import timezone
from django.contrib.auth import get_user_model
from users.models import Permission, Role, RolePermission, UserPermission
from otp_service.models import OTPRequest
from .serializers import TokenObtainPair2FASerializer

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
            "department_name": user.department.name if user.department else None,
            "office_name": user.office.name if user.office else None,
            "image": image_url,
            "office_id": getattr(user, "office_id", None),
            "secondary_offices": list(user.secondary_offices.values_list('id', flat=True)) if hasattr(user, 'secondary_offices') else [],
            "permissions": permissions,
        })

class TokenObtainPair2FAView(TokenObtainPairView):
    serializer_class = TokenObtainPair2FASerializer

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
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        })
