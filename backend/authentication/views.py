# authentication/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from drf_yasg.utils import swagger_auto_schema
from drf_yasg import openapi
from users.models import Permission, Role, RolePermission, UserPermission

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    @swagger_auto_schema(
        operation_description="Return identity details for the authenticated user. Use the Authorize button with a Bearer access token obtained from /api/token/.",
        manual_parameters=[
            openapi.Parameter(
                name='Authorization',
                in_=openapi.IN_HEADER,
                type=openapi.TYPE_STRING,
                description="Bearer token: 'Bearer <access_token>'",
                required=True
            )
        ],
        security=[{'Bearer': []}],
    )
    def get(self, request):
        user = request.user

        full_name = getattr(user, "full_name", None)
        if not full_name:
            full_name = f"{user.first_name} {user.last_name}".strip()

        employee_id = getattr(user, "employee_id", None)

        secondary_office_ids = []
        try:
            secondary_office_ids = list(user.secondary_offices.values_list('id', flat=True))
        except Exception:
            secondary_office_ids = []

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
                # Union and keep order stable
                seen = set()
                merged = []
                for slug in permissions + direct_perm_slugs:
                    if slug not in seen:
                        seen.add(slug)
                        merged.append(slug)
                permissions = merged
        except Exception:
            permissions = []

        return Response({
            "id": user.id,
            "full_name": full_name,
            "email": user.email,
            "employee_id": employee_id,
            "is_staff": user.is_staff,
            "role": role,
            "office_id": getattr(user, "office_id", None),
            "secondary_offices": secondary_office_ids,
            "permissions": permissions,
        })
