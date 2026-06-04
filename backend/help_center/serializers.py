from rest_framework import serializers
from .models import HelpDocument


class HelpDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = HelpDocument
        fields = [
            'id', 'title', 'description', 'document_type',
            'file', 'file_name', 'file_size', 'file_url',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
        ]
        read_only_fields = [
            'uploaded_by', 'uploaded_at',
            'file_name', 'file_size', 'file_url', 'uploaded_by_name',
        ]
        extra_kwargs = {
            'file': {'required': False},
        }

    def get_file_url(self, obj):
        if obj.file:
            return f"media/{obj.file.name}"
        return None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return getattr(obj.uploaded_by, 'full_name', str(obj.uploaded_by))
        return "Unknown"
