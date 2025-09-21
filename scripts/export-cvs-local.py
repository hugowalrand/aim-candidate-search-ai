#!/usr/bin/env python3
"""
Export all candidate CVs from AIM database to local files
(You can then manually upload to Google Drive or use Google Drive desktop app)
"""

import os
import json
import requests
import time
from pathlib import Path

class LocalCVExporter:
    def __init__(self, output_dir):
        """Initialize the local CV exporter"""
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        print(f"📁 Output directory: {self.output_dir.absolute()}")

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
            "founder entrepreneur",
            "technical cofounder"
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
                else:
                    print(f"   ❌ Search failed with status {response.status_code}")

                time.sleep(0.5)  # Avoid overwhelming the API

            except Exception as e:
                print(f"   ❌ Error with query '{query}': {e}")
                continue

        unique_candidates = list(all_candidates.values())
        print(f"✅ Total unique candidates found: {len(unique_candidates)}")
        return unique_candidates

    def create_text_cv(self, candidate):
        """Create a comprehensive text CV for a candidate"""
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

        # Contact Information
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

        # Professional Summary
        skills = candidate.get('skills', [])
        years_exp = candidate.get('years_experience')
        regions = candidate.get('regions', [])
        fundraising = candidate.get('fundraising_stage', '')
        tech_cofounder = candidate.get('tech_cofounder', False)

        if skills or years_exp or regions:
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

        # Full Profile Content
        combined_text = candidate.get('combined_text', '')
        if combined_text:
            lines.append("DETAILED PROFILE")
            lines.append("-" * 30)

            # Clean up combined text - split by pipe and format nicely
            sections = combined_text.split('|')
            for i, section in enumerate(sections):
                if section.strip():
                    if i == 0:
                        # First section is usually the summary
                        lines.append("📋 SUMMARY:")
                        lines.append(section.strip())
                        lines.append("")
                    elif 'CURRICULUM VITAE' in section or 'CANDIDATE PROFILE' in section:
                        lines.append("📄 FULL CV:")
                        lines.append(section.strip())
                        lines.append("")
                    else:
                        lines.append(section.strip())
                        lines.append("")

        # Candidate Tags
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

    def export_all_cvs(self):
        """Export all candidate CVs to local text files"""
        print(f"🚀 Starting CV export to local files...")

        candidates = self.get_all_candidates()
        if not candidates:
            print("❌ No candidates found. Exiting.")
            return

        successful_exports = 0
        failed_exports = 0

        # Create index file
        index_lines = [
            "AIM FOUNDING TO GIVE - CANDIDATE CV EXPORT INDEX",
            "=" * 60,
            f"Export Date: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Candidates: {len(candidates)}",
            "",
            "CANDIDATE LIST:",
            "-" * 30,
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
                # Create CV content
                cv_content = self.create_text_cv(candidate)

                # Save to file
                filename = f"{i:03d}_{safe_name}_CV.txt"
                filepath = self.output_dir / filename

                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(cv_content)

                print(f"   ✅ Saved: {filename}")
                successful_exports += 1

                # Add to index
                index_lines.append(f"{i:3d}. {name}")
                index_lines.append(f"     File: {filename}")
                index_lines.append(f"     Email: {email}")
                index_lines.append(f"     Role: {headline}")
                index_lines.append("")

            except Exception as e:
                print(f"   ❌ Error processing {name}: {e}")
                failed_exports += 1

        # Save index file
        index_file = self.output_dir / "000_INDEX.txt"
        with open(index_file, 'w', encoding='utf-8') as f:
            f.write("\n".join(index_lines))

        print(f"\n🎉 Export complete!")
        print(f"✅ Successfully exported: {successful_exports} CVs")
        print(f"❌ Failed exports: {failed_exports} files")
        print(f"📁 Files saved to: {self.output_dir.absolute()}")
        print(f"📋 Index file: 000_INDEX.txt")
        print(f"\n💡 To upload to Google Drive:")
        print(f"   1. Install Google Drive desktop app")
        print(f"   2. Copy the entire 'aim_cvs' folder to your Google Drive")
        print(f"   3. Or manually upload files to: https://drive.google.com/drive/folders/1cYM6IUBT2B1NR5_BLYgI6y8jBE8PrQQN")

def main():
    """Main function to run the CV export"""
    output_dir = "aim_cvs"

    try:
        exporter = LocalCVExporter(output_dir)
        exporter.export_all_cvs()
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()