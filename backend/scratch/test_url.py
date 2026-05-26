import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from duties.models import AnusuchiDocument
from django.conf import settings

print(f"AWS_QUERYSTRING_AUTH: {settings.AWS_QUERYSTRING_AUTH}")
print(f"DEFAULT_FILE_STORAGE: {settings.DEFAULT_FILE_STORAGE}")

doc = AnusuchiDocument.objects.first()
if doc:
    print(f"Document ID: {doc.id}")
    print(f"Document Path: {doc.file.name}")
    print(f"Generated URL: {doc.file.url}")
else:
    print("No AnusuchiDocument found.")
