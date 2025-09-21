#!/usr/bin/env python3
"""
Simple script to export all candidate CVs from AIM database to Google Drive
"""

import os
import json
import requests
from io import BytesIO
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseUpload
import time

class SimpleCVExporter:
    def __init__(self, credentials_path, drive_folder_id):
        """Initialize the CV exporter with Google Drive credentials"""
        self.drive_folder_id = drive_folder_id

        print("🔑 Setting up Google Drive API...")
        # Setup Google Drive API
        scopes = ['https://www.googleapis.com/auth/drive.file']
        credentials = Credentials.from_service_account_file(
            credentials_path, scopes=scopes
        )
        self.drive_service = build('drive', 'v3', credentials=credentials)
        print("✅ Google Drive API initialized successfully")

    def get_all_candidates(self):
        """Fetch all candidates using multiple search queries"""
        print("🔍 Fetching all candidates from AIM database...")

        all_candidates = {}  # Use dict to avoid duplicates
        search_queries = [
            "technical founder",
            "healthcare founder",
            "AI machine learning",
            "startup entrepreneur",
            "fintech blockchain",
            "Africa experience",
            "Series A fundraising",
            "cofounder co-founder",
            "*"  # Wildcard
        ]

        for query in search_queries:
            try:
                print(f"   Searching with: '{query}'")
                response = requests.post(
                    'http://localhost:3000/api/search',
                    json={'query': query},
                    headers={'Content-Type': 'application/json'},
                    timeout=10
                )

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get('results', [])
                    for candidate in candidates:
                        candidate_id = candidate.get('id')
                        if candidate_id:
                            all_candidates[candidate_id] = candidate

                    print(f"   Found {len(candidates)} candidates (total unique: {len(all_candidates)})")

                time.sleep(1)  # Avoid overwhelming the API

            except Exception as e:
                print(f"   ❌ Error with query '{query}': {e}")
                continue

        unique_candidates = list(all_candidates.values())
        print(f"✅ Total unique candidates found: {len(unique_candidates)}")
        return unique_candidates

    def create_text_cv(self, candidate):
        """Create a simple text CV for a candidate"""
        lines = []

        # Header
        name = candidate.get('full_name', 'Unknown Candidate')
        headline = candidate.get('headline', '')

        lines.append(f"{'=' * 60}")
        lines.append(f"{name.upper()}")
        if headline:
            lines.append(f"{headline}")
        lines.append(f"{'=' * 60}")
        lines.append("")

        # Contact
        email = candidate.get('email', '')
        linkedin = candidate.get('linkedin_url', '')
        if email or linkedin:
            lines.append("CONTACT INFORMATION")
            lines.append("-" * 20)
            if email:
                lines.append(f"Email: {email}")
            if linkedin:
                lines.append(f"LinkedIn: {linkedin}")
            lines.append("")

        # Quick info
        skills = candidate.get('skills', [])
        years_exp = candidate.get('years_experience')
        regions = candidate.get('regions', [])

        if skills:
            lines.append("SKILLS & EXPERTISE")
            lines.append("-" * 20)
            lines.append(" • ".join(skills))
            lines.append("")

        if years_exp or regions:
            lines.append("PROFESSIONAL BACKGROUND")
            lines.append("-" * 25)
            if years_exp:
                lines.append(f"Years of Experience: {years_exp}")
            if regions:
                lines.append(f"Regional Experience: {', '.join(regions)}")
            lines.append("")

        # Full content
        combined_text = candidate.get('combined_text', '')
        if combined_text:
            lines.append("DETAILED PROFILE")
            lines.append("-" * 16)

            # Clean up combined text
            clean_text = combined_text.replace('|', '\n')
            lines.append(clean_text)

        return "\n".join(lines)

    def upload_to_drive(self, file_content, filename):
        """Upload a text file to Google Drive"""
        try:
            # Create text buffer
            if isinstance(file_content, str):
                buffer = BytesIO(file_content.encode('utf-8'))
            else:
                buffer = file_content

            media = MediaIoBaseUpload(
                buffer,
                mimetype='text/plain',
                resumable=True
            )

            file_metadata = {
                'name': filename,
                'parents': [self.drive_folder_id]
            }

            file = self.drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,name'
            ).execute()

            return file

        except Exception as e:
            print(f"❌ Error uploading {filename}: {e}")
            return None

    def export_all_cvs(self):
        """Export all candidate CVs to Google Drive as text files"""
        print(f"🚀 Starting CV export process...")

        candidates = self.get_all_candidates()
        if not candidates:
            print("❌ No candidates found. Exiting.")
            return

        successful_uploads = 0
        failed_uploads = 0

        for i, candidate in enumerate(candidates, 1):
            name = candidate.get('full_name', f'Candidate_{candidate.get("id", i)}')
            # Create safe filename
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')

            print(f"📄 Processing {i}/{len(candidates)}: {name}")

            try:
                # Create and upload TXT file
                txt_content = self.create_text_cv(candidate)
                txt_filename = f"{safe_name}_CV.txt"

                result = self.upload_to_drive(txt_content, txt_filename)
                if result:
                    print(f"   ✅ Uploaded: {txt_filename}")
                    successful_uploads += 1
                else:
                    failed_uploads += 1

                # Small delay to avoid rate limits
                time.sleep(0.3)

            except Exception as e:
                print(f"   ❌ Error processing {name}: {e}")
                failed_uploads += 1

        print(f"\n🎉 Export complete!")
        print(f"✅ Successfully uploaded: {successful_uploads} files")
        print(f"❌ Failed uploads: {failed_uploads} files")
        print(f"📁 Files uploaded to: https://drive.google.com/drive/folders/{self.drive_folder_id}")

def main():
    """Main function to run the CV export"""
    CREDENTIALS_PATH = "google-service-account.json"
    DRIVE_FOLDER_ID = "1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN"

    if not os.path.exists(CREDENTIALS_PATH):
        print(f"❌ Error: Google Service Account credentials file not found at: {CREDENTIALS_PATH}")
        return

    try:
        exporter = SimpleCVExporter(CREDENTIALS_PATH, DRIVE_FOLDER_ID)
        exporter.export_all_cvs()
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()