#!/usr/bin/env python3
"""
Test Google Drive upload functionality
"""

import os
import json
import requests
from io import BytesIO
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseUpload
import time

def test_drive_connection():
    """Test basic Google Drive connection"""
    CREDENTIALS_PATH = "google-service-account.json"
    DRIVE_FOLDER_ID = "1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN"

    if not os.path.exists(CREDENTIALS_PATH):
        print(f"❌ Credentials not found: {CREDENTIALS_PATH}")
        return False

    print("🔑 Setting up Google Drive API...")
    try:
        scopes = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file'
        ]
        credentials = Credentials.from_service_account_file(
            CREDENTIALS_PATH, scopes=scopes
        )

        # Try without delegation first
        drive_service = build('drive', 'v3', credentials=credentials)

        print("✅ Google Drive API initialized")

        # Test upload with a simple file
        test_content = f"Test file created at {time.strftime('%Y-%m-%d %H:%M:%S')}"
        buffer = BytesIO(test_content.encode('utf-8'))

        media = MediaIoBaseUpload(
            buffer,
            mimetype='text/plain',
            resumable=True
        )

        file_metadata = {
            'name': 'test_upload.txt',
            'parents': [DRIVE_FOLDER_ID]
        }

        print("📤 Testing file upload...")
        file = drive_service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id,name'
        ).execute()

        print(f"✅ Test upload successful: {file.get('name')} (ID: {file.get('id')})")
        return True

    except Exception as e:
        print(f"❌ Drive connection failed: {e}")
        return False

def get_sample_candidates():
    """Get a few candidates to test with"""
    print("🔍 Fetching sample candidates...")

    try:
        response = requests.post(
            'http://localhost:3000/api/search',
            json={'query': 'founder'},
            headers={'Content-Type': 'application/json'},
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            candidates = data.get('results', [])
            print(f"✅ Found {len(candidates)} candidates")
            return candidates[:5]  # Just first 5 for testing
        else:
            print(f"❌ API error: {response.status_code}")
            return []

    except Exception as e:
        print(f"❌ Error fetching candidates: {e}")
        return []

if __name__ == "__main__":
    print("🧪 Testing Google Drive upload functionality...\n")

    if test_drive_connection():
        print("\n🔍 Testing candidate fetching...")
        candidates = get_sample_candidates()
        if candidates:
            print(f"✅ Successfully fetched {len(candidates)} sample candidates")
            for i, candidate in enumerate(candidates, 1):
                name = candidate.get('full_name', 'Unknown')
                print(f"   {i}. {name}")
        else:
            print("❌ No candidates found")
    else:
        print("❌ Drive connection test failed")