#!/usr/bin/env python3
"""
Download PDF CVs from JotForm links for all AIM candidates
"""

import os
import json
import requests
import time
from urllib.parse import unquote
import re

class PDFCVDownloader:
    def __init__(self, output_dir="aim_pdf_cvs"):
        """Initialize the PDF CV downloader"""
        self.output_dir = output_dir

        # Create output directory
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"📁 Created directory: {output_dir}")

    def get_all_candidates(self):
        """Get all candidates from the API"""
        print("🔍 Fetching all candidates from AIM database...")

        all_candidates = {}

        # Use broad search terms to get maximum coverage
        search_queries = [
            "founder", "technical", "entrepreneur", "startup", "experience",
            "co-founder", "healthcare", "AI", "fintech", "Series A", "Africa",
            "engineer", "developer", "CEO", "CTO", "manager"
        ]

        for query in search_queries:
            try:
                print(f"   🔍 Searching: '{query}'")
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
                        if candidate_id and candidate_id not in all_candidates:
                            all_candidates[candidate_id] = candidate

                    print(f"      Found {len(candidates)} results (total unique: {len(all_candidates)})")

                time.sleep(0.5)  # Be nice to the API

            except Exception as e:
                print(f"      ❌ Error: {e}")
                continue

        unique_candidates = list(all_candidates.values())
        print(f"✅ TOTAL UNIQUE CANDIDATES: {len(unique_candidates)}")
        return unique_candidates

    def extract_pdf_url(self, candidate):
        """Extract PDF URL from candidate data"""
        # Check various fields where the PDF URL might be stored
        combined_text = candidate.get('combined_text', '')

        # Look for JotForm PDF URLs in the combined text
        jotform_patterns = [
            r'https://www\.jotform\.com/uploads/[^/]+/[^/]+/[^/]+/[^\s]+\.pdf',
            r'https://jotform\.com/uploads/[^/]+/[^/]+/[^/]+/[^\s]+\.pdf'
        ]

        for pattern in jotform_patterns:
            matches = re.findall(pattern, combined_text, re.IGNORECASE)
            if matches:
                return matches[0]

        # Also check if there's a direct PDF URL field
        pdf_fields = ['pdf_url', 'resume_url', 'cv_url', 'file_url']
        for field in pdf_fields:
            if field in candidate and candidate[field]:
                url = candidate[field]
                if url.endswith('.pdf') or 'jotform.com' in url:
                    return url

        return None

    def download_pdf(self, url, filename):
        """Download PDF from URL"""
        try:
            print(f"      📥 Downloading: {filename}")

            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }

            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()

            # Check if it's actually a PDF
            if response.headers.get('content-type', '').lower() not in ['application/pdf', 'application/octet-stream']:
                print(f"      ⚠️ Not a PDF file: {response.headers.get('content-type', 'unknown')}")
                return False

            filepath = os.path.join(self.output_dir, filename)
            with open(filepath, 'wb') as f:
                f.write(response.content)

            # Verify file size
            if os.path.getsize(filepath) < 1000:  # Less than 1KB is suspicious
                print(f"      ⚠️ File too small ({os.path.getsize(filepath)} bytes)")
                os.remove(filepath)
                return False

            print(f"      ✅ Downloaded: {filename} ({len(response.content)} bytes)")
            return True

        except Exception as e:
            print(f"      ❌ Download failed: {e}")
            return False

    def sanitize_filename(self, name):
        """Create safe filename from candidate name"""
        # Remove/replace invalid characters
        safe_name = re.sub(r'[<>:"/\\|?*]', '', name)
        safe_name = safe_name.replace(' ', '_')
        # Limit length
        if len(safe_name) > 100:
            safe_name = safe_name[:100]
        return safe_name

    def download_all_pdfs(self):
        """Download all PDF CVs"""
        print("🚀 Starting PDF CV download...")

        candidates = self.get_all_candidates()
        if not candidates:
            print("❌ No candidates found!")
            return

        print(f"\n📊 Processing {len(candidates)} candidates...")

        successful_downloads = 0
        failed_downloads = 0
        no_pdf_url = 0

        # Create summary file
        summary_lines = [
            f"AIM PDF CV DOWNLOAD SUMMARY",
            f"=" * 50,
            f"Download Date: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Candidates: {len(candidates)}",
            "",
            "DOWNLOAD RESULTS:",
            "-" * 30,
        ]

        for i, candidate in enumerate(candidates, 1):
            name = candidate.get('full_name', f'Candidate_{candidate.get("id", i)}')
            candidate_id = candidate.get('id', str(i))

            print(f"📄 {i}/{len(candidates)}: {name}")

            # Extract PDF URL
            pdf_url = self.extract_pdf_url(candidate)

            if not pdf_url:
                print(f"      ⚠️ No PDF URL found")
                no_pdf_url += 1
                summary_lines.append(f"{i:3d}. {name} - NO PDF URL")
                continue

            print(f"      🔗 PDF URL: {pdf_url}")

            # Create filename
            safe_name = self.sanitize_filename(name)
            filename = f"{i:03d}_{safe_name}_{candidate_id}.pdf"

            # Download PDF
            if self.download_pdf(pdf_url, filename):
                successful_downloads += 1
                summary_lines.append(f"{i:3d}. {name} - ✅ DOWNLOADED - {filename}")
            else:
                failed_downloads += 1
                summary_lines.append(f"{i:3d}. {name} - ❌ FAILED - {pdf_url}")

            # Small delay between downloads
            time.sleep(0.5)

        # Save summary
        try:
            summary_content = "\n".join(summary_lines + [
                "",
                "FINAL STATS:",
                f"✅ Successful downloads: {successful_downloads}",
                f"❌ Failed downloads: {failed_downloads}",
                f"⚠️ No PDF URL: {no_pdf_url}",
                f"📁 Files saved to: {os.path.abspath(self.output_dir)}"
            ])

            summary_path = os.path.join(self.output_dir, "000_DOWNLOAD_SUMMARY.txt")
            with open(summary_path, 'w', encoding='utf-8') as f:
                f.write(summary_content)

            print("✅ Summary file saved")
        except Exception as e:
            print(f"❌ Summary save failed: {e}")

        print(f"\n🎉 PDF DOWNLOAD FINISHED!")
        print(f"✅ Successfully downloaded: {successful_downloads} PDFs")
        print(f"❌ Failed downloads: {failed_downloads}")
        print(f"⚠️ No PDF URL found: {no_pdf_url}")
        print(f"📁 All files saved to: {os.path.abspath(self.output_dir)}")

        if successful_downloads > 0:
            print(f"\n📤 NEXT STEPS:")
            print(f"   Upload the folder '{self.output_dir}' to Google Drive")
            print(f"   Target folder: https://drive.google.com/drive/folders/1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN")

def main():
    try:
        downloader = PDFCVDownloader()
        downloader.download_all_pdfs()
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()