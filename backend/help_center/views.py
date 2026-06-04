from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied
from .models import HelpDocument
from .serializers import HelpDocumentSerializer

# Roles allowed to manage (upload/edit/delete) documents
CAN_MANAGE_ROLES = {'SUPERADMIN', 'NETWORK_ADMIN', 'OFFICE_ADMIN'}

# Office name keywords for ITD / COO restriction (case-insensitive)
ALLOWED_OFFICE_KEYWORDS = ('itd', 'coo')


def _office_is_allowed(user) -> bool:
    """Returns True if the user's primary or any secondary office is ITD or COO."""
    office = getattr(user, 'office', None)
    if office:
        name = (office.name or '').lower()
        if any(kw in name for kw in ALLOWED_OFFICE_KEYWORDS):
            return True
    secondary = getattr(user, 'secondary_offices', None)
    if secondary:
        for o in secondary.all():
            if any(kw in (o.name or '').lower() for kw in ALLOWED_OFFICE_KEYWORDS):
                return True
    return False


def _check_manage_permission(user):
    """
    Raises PermissionDenied if the user cannot manage Help Center documents.
    Rules:
      - SUPERADMIN: always allowed
      - NETWORK_ADMIN or OFFICE_ADMIN: only if office is ITD or COO
      - Any other role: denied
    """
    role = getattr(user, 'role', '')
    if role == 'SUPERADMIN':
        return
    if role in ('NETWORK_ADMIN', 'OFFICE_ADMIN'):
        if _office_is_allowed(user):
            return
        raise PermissionDenied(
            "Only users from ITD or COO offices can manage Help Center documents."
        )
    raise PermissionDenied(
        "Only Superadmin, Network Admin (ITD/COO), or Office Admin (ITD/COO) can manage documents."
    )


class HelpDocumentViewSet(viewsets.ModelViewSet):
    queryset = HelpDocument.objects.all()
    serializer_class = HelpDocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']

    def perform_create(self, serializer):
        _check_manage_permission(self.request.user)
        f = self.request.FILES.get('file')
        serializer.save(
            uploaded_by=self.request.user,
            file_name=f.name if f else '',
            file_size=f.size if f else None,
        )

    def perform_update(self, serializer):
        _check_manage_permission(self.request.user)
        f = self.request.FILES.get('file')
        if f:
            instance = serializer.instance
            if instance.file:
                instance.file.delete(save=False)
            serializer.save(file_name=f.name, file_size=f.size)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        _check_manage_permission(self.request.user)
        instance.file.delete(save=False)
        instance.delete()

    def get_queryset(self):
        qs = HelpDocument.objects.all()
        doc_type = self.request.query_params.get('document_type')
        if doc_type:
            qs = qs.filter(document_type=doc_type)
        return qs
