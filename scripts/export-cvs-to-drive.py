#!/usr/bin/env python3
"""
Script to export all candidate CVs from AIM database to Google Drive
"""

import os
import json
import requests
from io import BytesIO
from googleapiclient.discovery import build
from google.oauth2.service_account import Credentials
from googleapiclient.http import MediaIoBaseUpload
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
import textwrap
import time

class CVExporter:
    def __init__(self, credentials_path, drive_folder_id):
        """Initialize the CV exporter with Google Drive credentials"""
        self.drive_folder_id = drive_folder_id

        # Setup Google Drive API
        scopes = ['https://www.googleapis.com/auth/drive.file']
        credentials = Credentials.from_service_account_file(
            credentials_path, scopes=scopes
        )
        self.drive_service = build('drive', 'v3', credentials=credentials)

        print("✅ Google Drive API initialized successfully")

    def get_all_candidates(self):
        """Fetch all candidates from the AIM search API"""
        print("🔍 Fetching all candidates from AIM database...")

        # Get a large search result to capture all candidates
        try:
            response = requests.post(
                'http://localhost:3000/api/search',
                json={'query': '*'},  # Wildcard search to get all
                headers={'Content-Type': 'application/json'},
                timeout=30
            )
            response.raise_for_status()
            data = response.json()

            candidates = data.get('results', [])
            print(f"✅ Found {len(candidates)} candidates in database")
            return candidates

        except Exception as e:
            print(f"❌ Error fetching candidates: {e}")
            return []

    def create_pdf_cv(self, candidate):
        """Create a formatted PDF CV for a candidate"""
        buffer = BytesIO()

        # Create PDF document
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                              rightMargin=72, leftMargin=72,
                              topMargin=72, bottomMargin=18)

        # Get styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=18,
            textColor='#2563eb',  # Blue color
            spaceAfter=30,
        )
        heading_style = ParagraphStyle(
            'CustomHeading',
            parent=styles['Heading2'],
            fontSize=14,
            textColor='#374151',  # Gray color
            spaceAfter=12,
        )

        # Build PDF content
        story = []

        # Title with candidate name
        name = candidate.get('full_name', 'Unknown Candidate')
        story.append(Paragraph(name, title_style))

        # Headline
        headline = candidate.get('headline', '')
        if headline:
            story.append(Paragraph(f"<b>{headline}</b>", styles['Normal']))
            story.append(Spacer(1, 12))

        # Contact info
        email = candidate.get('email', '')
        linkedin = candidate.get('linkedin_url', '')
        if email or linkedin:
            story.append(Paragraph("Contact Information", heading_style))
            if email:
                story.append(Paragraph(f"Email: {email}", styles['Normal']))
            if linkedin:
                story.append(Paragraph(f"LinkedIn: {linkedin}", styles['Normal']))
            story.append(Spacer(1, 12))

        # Skills
        skills = candidate.get('skills', [])
        if skills:
            story.append(Paragraph("Skills & Expertise", heading_style))
            skills_text = " • ".join(skills)
            story.append(Paragraph(skills_text, styles['Normal']))
            story.append(Spacer(1, 12))

        # Experience and regions
        regions = candidate.get('regions', [])
        years_exp = candidate.get('years_experience')
        if regions or years_exp:
            story.append(Paragraph("Professional Background", heading_style))
            if years_exp:
                story.append(Paragraph(f"Years of Experience: {years_exp}", styles['Normal']))
            if regions:
                regions_text = ", ".join(regions)
                story.append(Paragraph(f"Regional Experience: {regions_text}", styles['Normal']))
            story.append(Spacer(1, 12))

        # Full CV content from combined_text
        combined_text = candidate.get('combined_text', '')
        if combined_text:
            story.append(Paragraph("Detailed Profile", heading_style))

            # Clean up and format the combined text
            # Split by the CV section if it exists
            if 'CURRICULUM VITAE' in combined_text or 'CANDIDATE PROFILE' in combined_text:
                cv_parts = combined_text.split('CURRICULUM VITAE')
                if len(cv_parts) > 1:
                    cv_content = cv_parts[1]
                else:
                    cv_parts = combined_text.split('CANDIDATE PROFILE')
                    cv_content = cv_parts[1] if len(cv_parts) > 1 else combined_text
            else:
                cv_content = combined_text

            # Format the text into paragraphs
            paragraphs = cv_content.strip().split('\n\n')
            for para in paragraphs:
                if para.strip():
                    # Clean up the paragraph
                    clean_para = para.strip().replace('\n', ' ')
                    story.append(Paragraph(clean_para, styles['Normal']))
                    story.append(Spacer(1, 6))

        # Build the PDF
        doc.build(story)
        buffer.seek(0)
        return buffer

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

        # Skills
        skills = candidate.get('skills', [])
        if skills:
            lines.append("SKILLS & EXPERTISE")
            lines.append("-" * 20)
            lines.append(" • ".join(skills))
            lines.append("")

        # Experience
        years_exp = candidate.get('years_experience')
        regions = candidate.get('regions', [])
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
            lines.append(combined_text)

        return "\n".join(lines)

    def upload_to_drive(self, file_content, filename, mime_type):
        """Upload a file to Google Drive"""
        try:
            media = MediaIoBaseUpload(
                file_content,
                mimetype=mime_type,
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

    def export_all_cvs(self, format_type='both'):
        """Export all candidate CVs to Google Drive

        Args:
            format_type: 'pdf', 'txt', or 'both'
        """
        print(f"🚀 Starting CV export process (format: {format_type})")

        candidates = self.get_all_candidates()
        if not candidates:
            print("❌ No candidates found. Exiting.")
            return

        successful_uploads = 0
        failed_uploads = 0

        for i, candidate in enumerate(candidates, 1):
            name = candidate.get('full_name', f'Candidate_{candidate.get("id", i)}')
            safe_name = "".join(c for c in name if c.isalnum() or c in (' ', '-', '_')).strip()

            print(f"📄 Processing {i}/{len(candidates)}: {name}")

            try:
                # Create and upload PDF
                if format_type in ['pdf', 'both']:
                    pdf_buffer = self.create_pdf_cv(candidate)
                    pdf_filename = f"{safe_name}_CV.pdf"

                    result = self.upload_to_drive(pdf_buffer, pdf_filename, 'application/pdf')
                    if result:
                        print(f"   ✅ PDF uploaded: {pdf_filename}")
                        successful_uploads += 1
                    else:
                        failed_uploads += 1

                # Create and upload TXT
                if format_type in ['txt', 'both']:
                    txt_content = self.create_text_cv(candidate)
                    txt_buffer = BytesIO(txt_content.encode('utf-8'))
                    txt_filename = f"{safe_name}_CV.txt"

                    result = self.upload_to_drive(txt_buffer, txt_filename, 'text/plain')
                    if result:
                        print(f"   ✅ TXT uploaded: {txt_filename}")
                        successful_uploads += 1
                    else:
                        failed_uploads += 1

                # Small delay to avoid rate limits
                time.sleep(0.5)

            except Exception as e:
                print(f"   ❌ Error processing {name}: {e}")
                failed_uploads += 1

        print(f"\n🎉 Export complete!")
        print(f"✅ Successfully uploaded: {successful_uploads} files")
        print(f"❌ Failed uploads: {failed_uploads} files")
        print(f"📁 Files uploaded to: https://drive.google.com/drive/folders/{self.drive_folder_id}")

def main():
    """Main function to run the CV export"""

    # Configuration
    CREDENTIALS_PATH = "google-service-account.json"  # Update this path
    DRIVE_FOLDER_ID = "1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN"  # From your Google Drive URL

    # Check if credentials file exists
    if not os.path.exists(CREDENTIALS_PATH):
        print(f"❌ Error: Google Service Account credentials file not found at: {CREDENTIALS_PATH}")
        print("\nPlease:")
        print("1. Create a Google Service Account with Drive API access")
        print("2. Download the JSON credentials file")
        print("3. Place it in this directory as 'google-service-account.json'")
        print("4. Share your Google Drive folder with the service account email")
        return

    try:
        # Initialize exporter
        exporter = CVExporter(CREDENTIALS_PATH, DRIVE_FOLDER_ID)

        # Export all CVs (you can change 'both' to 'pdf' or 'txt')
        exporter.export_all_cvs(format_type='both')

    except Exception as e:
        print(f"❌ Fatal error: {e}")

if __name__ == "__main__":
    main()