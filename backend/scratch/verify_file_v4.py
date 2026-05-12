import os
import boto3
import requests
from botocore.config import Config
from dotenv import load_dotenv

load_dotenv()

# Force Signature Version 4
s3_config = Config(
    signature_version='s3v4',
)

s3 = boto3.client(
    's3',
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
    endpoint_url=os.getenv('AWS_S3_ENDPOINT_URL'),
    region_name=os.getenv('AWS_S3_REGION_NAME', 'garage'),
    verify=False,
    config=s3_config
)

bucket = os.getenv('AWS_STORAGE_BUCKET_NAME')
key = 'Software_and_Security_Wing_(ITD)/Anuschi/2026-05-07/anusuchi_00201be8c49fa605ae3129d8bf4_TSnbOCr.jpg'

print(f"Checking object '{key}' in bucket '{bucket}' with S3V4...")

url = s3.generate_presigned_url(
    'get_object',
    Params={'Bucket': bucket, 'Key': key},
    ExpiresIn=3600
)

print(f"Generated URL: {url}")

response = requests.get(url, verify=False)
print(f"Status Code: {response.status_code}")
if response.status_code == 200:
    print("SUCCESS: File exists and is accessible with S3V4 signed URL.")
else:
    print(f"FAILURE: {response.text}")
