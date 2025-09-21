#!/usr/bin/env python3
"""
Export ALL candidate CVs from AIM database directly to Google Drive
This version gets ALL candidates by fetching from Typesense directly
"""

import os
import json
import requests
from io import BytesIO
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseUpload
import time

class CompleteCVExporter:
    def __init__(self, credentials_path, drive_folder_id):
        """Initialize the CV exporter"""
        self.drive_folder_id = drive_folder_id

        print("🔑 Setting up Google Drive API...")
        # Try to setup Google Drive API with domain-wide delegation
        scopes = [
            'https://www.googleapis.com/auth/drive',
            'https://www.googleapis.com/auth/drive.file'
        ]
        credentials = Credentials.from_service_account_file(
            credentials_path, scopes=scopes
        )

        # Try delegating to a user if that helps
        try:
            # You might need to replace with your actual email
            delegated_credentials = credentials.with_subject("drive-api-script@youtubev2-467611.iam.gserviceaccount.com")
            self.drive_service = build('drive', 'v3', credentials=delegated_credentials)
        except:
            self.drive_service = build('drive', 'v3', credentials=credentials)

        print("✅ Google Drive API initialized successfully")

    def get_all_candidates_comprehensive(self):
        """Get ALL candidates using every possible approach"""
        print("🔍 Fetching ALL candidates from AIM database...")

        all_candidates = {}

        # Method 1: Try large batches with different queries
        search_strategies = [
            # Broad searches
            {"query": "founder", "description": "All founders"},
            {"query": "technical", "description": "Technical people"},
            {"query": "entrepreneur", "description": "Entrepreneurs"},
            {"query": "startup", "description": "Startup experience"},
            {"query": "experience", "description": "General experience"},
            {"query": "co-founder", "description": "Co-founders"},
            {"query": "cofounder", "description": "Cofounders"},

            # Specific domains
            {"query": "healthcare", "description": "Healthcare"},
            {"query": "fintech", "description": "FinTech"},
            {"query": "AI", "description": "AI/ML"},
            {"query": "machine learning", "description": "Machine Learning"},
            {"query": "blockchain", "description": "Blockchain"},
            {"query": "SaaS", "description": "SaaS"},
            {"query": "B2B", "description": "B2B"},
            {"query": "mobile", "description": "Mobile"},

            # Regional searches
            {"query": "Africa", "description": "Africa experience"},
            {"query": "Europe", "description": "Europe experience"},
            {"query": "Asia", "description": "Asia experience"},
            {"query": "America", "description": "America experience"},

            # Fundraising
            {"query": "Series A", "description": "Series A"},
            {"query": "Series B", "description": "Series B"},
            {"query": "seed", "description": "Seed funding"},
            {"query": "fundraising", "description": "Fundraising"},

            # Skills
            {"query": "Python", "description": "Python"},
            {"query": "JavaScript", "description": "JavaScript"},
            {"query": "React", "description": "React"},
            {"query": "backend", "description": "Backend"},
            {"query": "frontend", "description": "Frontend"},
            {"query": "mobile development", "description": "Mobile dev"},
            {"query": "data science", "description": "Data science"},

            # Common names to catch more
            {"query": "John", "description": "Name: John"},
            {"query": "Sarah", "description": "Name: Sarah"},
            {"query": "David", "description": "Name: David"},
            {"query": "Maria", "description": "Name: Maria"},
            {"query": "Michael", "description": "Name: Michael"},

            # Letters to get everyone
            {"query": "a", "description": "Letter A"},
            {"query": "b", "description": "Letter B"},
            {"query": "c", "description": "Letter C"},
            {"query": "d", "description": "Letter D"},
            {"query": "e", "description": "Letter E"},

            # Last resort - single chars and wildcards
            {"query": "*", "description": "Wildcard"},
            {"query": "", "description": "Empty query"},
        ]

        for strategy in search_strategies:
            try:
                print(f"   🔍 {strategy['description']}: '{strategy['query']}'")

                response = requests.post(
                    'http://localhost:3000/api/search',
                    json={'query': strategy['query']},
                    headers={'Content-Type': 'application/json'},
                    timeout=15
                )

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get('results', [])

                    for candidate in candidates:
                        candidate_id = candidate.get('id')
                        if candidate_id and candidate_id not in all_candidates:
                            all_candidates[candidate_id] = candidate

                    print(f"      Found {len(candidates)} new (total unique: {len(all_candidates)})")
                else:
                    print(f"      ❌ Status {response.status_code}")

                time.sleep(0.5)  # Be nice to the API

            except Exception as e:
                print(f"      ❌ Error: {e}")
                continue

        unique_candidates = list(all_candidates.values())
        print(f"✅ TOTAL UNIQUE CANDIDATES FOUND: {len(unique_candidates)}")
        return unique_candidates

    def create_text_cv(self, candidate):
        """Create a comprehensive text CV"""
        lines = []

        # Header
        name = candidate.get('full_name', 'Unknown Candidate')
        headline = candidate.get('headline', '')
        candidate_id = candidate.get('id', '')

        lines.append(f"{'=' * 80}")
        lines.append(f"{name.upper()}")
        if headline:
            lines.append(f"{headline}")
        if candidate_id:
            lines.append(f"ID: {candidate_id}")
        lines.append(f"{'=' * 80}")
        lines.append("")

        # Contact
        email = candidate.get('email', '')
        linkedin = candidate.get('linkedin_url', '')
        if email or linkedin:
            lines.append("CONTACT INFORMATION")
            lines.append("-" * 30)
            if email:
                lines.append(f"📧 Email: {email}")
            if linkedin:
                lines.append(f"🔗 LinkedIn: {linkedin}")
            lines.append("")

        # Professional info
        skills = candidate.get('skills', [])
        years_exp = candidate.get('years_experience')
        regions = candidate.get('regions', [])
        fundraising = candidate.get('fundraising_stage', '')
        tech_cofounder = candidate.get('tech_cofounder', False)

        lines.append("PROFESSIONAL SUMMARY")
        lines.append("-" * 30)
        if years_exp:
            lines.append(f"🎯 Years of Experience: {years_exp}")
        if tech_cofounder:
            lines.append(f"💻 Technical Co-founder: Yes")
        if fundraising and fundraising != 'None':
            lines.append(f"💰 Fundraising Experience: {fundraising}")
        if regions:
            lines.append(f"🌍 Regional Experience: {', '.join(regions)}")
        if skills:
            lines.append(f"🛠️ Skills: {' • '.join(skills)}")
        lines.append("")

        # Full content
        combined_text = candidate.get('combined_text', '')
        if combined_text:
            lines.append("COMPLETE PROFILE")
            lines.append("-" * 30)
            lines.append(combined_text.replace('|', '\n'))
            lines.append("")

        # Tags
        tags = candidate.get('tags', [])
        if tags:
            lines.append("TAGS")
            lines.append("-" * 10)
            lines.append(f"🏷️ {' • '.join(tags)}")
            lines.append("")

        lines.append("=" * 80)
        lines.append(f"Exported from AIM Founding to Give Database")
        lines.append(f"Export Date: {time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("=" * 80)

        return "\n".join(lines)

    def upload_to_drive(self, content, filename):
        """Upload text content to Google Drive"""
        try:
            buffer = BytesIO(content.encode('utf-8'))

            media = MediaIoBaseUpload(
                buffer,
                mimetype='text/plain',
                resumable=True
            )

            # Create the file metadata
            file_metadata = {
                'name': filename,
                'parents': [self.drive_folder_id]
            }

            # Upload the file
            file = self.drive_service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id,name'
            ).execute()

            return file

        except Exception as e:
            print(f"❌ Upload error for {filename}: {e}")
            return None

    def export_all_cvs(self):
        """Export ALL candidate CVs"""
        print("🚀 Starting COMPLETE CV export...")

        candidates = self.get_all_candidates_comprehensive()
        if not candidates:
            print("❌ No candidates found!")
            return

        print(f"\n📊 Ready to export {len(candidates)} candidates to Google Drive")

        successful_uploads = 0
        failed_uploads = 0

        # Create index content
        index_lines = [
            f"AIM FOUNDING TO GIVE - COMPLETE CV EXPORT",
            f"=" * 60,
            f"Export Date: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Candidates: {len(candidates)}",
            "",
            "COMPLETE CANDIDATE LIST:",
            "-" * 40,
        ]

        for i, candidate in enumerate(candidates, 1):
            name = candidate.get('full_name', f'Candidate_{candidate.get("id", i)}')
            email = candidate.get('email', 'No email')
            headline = candidate.get('headline', 'No headline')

            # Create safe filename
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()
            safe_name = safe_name.replace(' ', '_')

            print(f"📄 Processing {i}/{len(candidates)}: {name}")

            try:
                # Create CV
                cv_content = self.create_text_cv(candidate)
                filename = f"{i:04d}_{safe_name}_CV.txt"

                # Upload to Drive
                result = self.upload_to_drive(cv_content, filename)

                if result:
                    print(f"   ✅ Uploaded: {filename}")
                    successful_uploads += 1
                else:
                    failed_uploads += 1

                # Add to index
                index_lines.append(f"{i:4d}. {name}")
                index_lines.append(f"      File: {filename}")
                index_lines.append(f"      Email: {email}")
                index_lines.append(f"      Role: {headline}")
                index_lines.append("")

                # Small delay to avoid rate limits
                time.sleep(0.2)

            except Exception as e:
                print(f"   ❌ Error processing {name}: {e}")
                failed_uploads += 1

        # Upload index file
        try:
            index_content = "\n".join(index_lines)
            index_result = self.upload_to_drive(index_content, "0000_COMPLETE_INDEX.txt")
            if index_result:
                print("✅ Index file uploaded")
        except Exception as e:
            print(f"❌ Index upload failed: {e}")

        print(f"\n🎉 COMPLETE EXPORT FINISHED!")
        print(f"✅ Successfully uploaded: {successful_uploads} CVs")
        print(f"❌ Failed uploads: {failed_uploads}")
        print(f"📁 All files in Google Drive: https://drive.google.com/drive/folders/{self.drive_folder_id}")

def main():
    CREDENTIALS_PATH = "google-service-account.json"
    DRIVE_FOLDER_ID = "1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN"

    if not os.path.exists(CREDENTIALS_PATH):
        print(f"❌ Credentials not found: {CREDENTIALS_PATH}")
        return

    try:
        exporter = CompleteCVExporter(CREDENTIALS_PATH, DRIVE_FOLDER_ID)
        exporter.export_all_cvs()
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()