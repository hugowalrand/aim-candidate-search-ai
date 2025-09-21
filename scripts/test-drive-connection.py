#!/usr/bin/env python3
"""
Test Google Drive connection
"""

import os
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseUpload
from io import BytesIO
import time

CREDENTIALS_PATH = "google-service-account.json"
DRIVE_FOLDER_ID = "1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN"

print("🔑 Testing Google Drive connection...")

try:
    # Setup Google Drive API
    scopes = ['https://www.googleapis.com/auth/drive.file']
    credentials = Credentials.from_service_account_file(
        CREDENTIALS_PATH, scopes=scopes
    )
    drive_service = build('drive', 'v3', credentials=credentials)
    print("✅ Google Drive API initialized")

    # Test upload a simple file
    test_content = "This is a test file from AIM CV Export script.\nTimestamp: " + str(time.time())
    buffer = BytesIO(test_content.encode('utf-8'))

    media = MediaIoBaseUpload(buffer, mimetype='text/plain')
    file_metadata = {
        'name': 'test_connection.txt',
        'parents': [DRIVE_FOLDER_ID]
    }

    print("📤 Testing file upload...")
    file = drive_service.files().create(
        body=file_metadata,
        media_body=media,
        fields='id,name'
    ).execute()

    print(f"✅ Test file uploaded successfully!")
    print(f"   File ID: {file.get('id')}")
    print(f"   File Name: {file.get('name')}")
    print(f"📁 Check your Google Drive folder for the test file")

except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()

    if "403" in str(e):
        print("\n💡 This looks like a permissions issue!")
        print("Please make sure you've shared the Google Drive folder with:")
        print("drive-api-script@youtubev2-467611.iam.gserviceaccount.com")
        print("And given it 'Editor' permissions.")