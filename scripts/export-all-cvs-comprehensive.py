#!/usr/bin/env python3
"""
Export ALL candidate CVs from AIM database to local files
This version uses comprehensive search strategies to get all 755+ candidates
"""

import os
import json
import requests
import time

class ComprehensiveCVExporter:
    def __init__(self, output_dir="aim_cvs_complete"):
        """Initialize the CV exporter"""
        self.output_dir = output_dir

        # Create output directory
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
            print(f"📁 Created directory: {output_dir}")

    def get_all_candidates_comprehensive(self):
        """Get ALL candidates using comprehensive search strategies"""
        print("🔍 Fetching ALL candidates from AIM database...")
        print("   Using comprehensive search strategy to overcome 50-result API limit...")

        all_candidates = {}
        total_searches = 0

        # Comprehensive search strategies
        search_strategies = [
            # Broad professional terms
            {"query": "founder", "description": "All founders"},
            {"query": "co-founder", "description": "Co-founders"},
            {"query": "cofounder", "description": "Cofounders"},
            {"query": "technical", "description": "Technical people"},
            {"query": "entrepreneur", "description": "Entrepreneurs"},
            {"query": "startup", "description": "Startup experience"},
            {"query": "experience", "description": "General experience"},
            {"query": "engineer", "description": "Engineers"},
            {"query": "developer", "description": "Developers"},
            {"query": "manager", "description": "Managers"},
            {"query": "director", "description": "Directors"},
            {"query": "CEO", "description": "CEOs"},
            {"query": "CTO", "description": "CTOs"},

            # Industry domains
            {"query": "healthcare", "description": "Healthcare"},
            {"query": "fintech", "description": "FinTech"},
            {"query": "AI", "description": "AI/ML"},
            {"query": "machine learning", "description": "Machine Learning"},
            {"query": "blockchain", "description": "Blockchain"},
            {"query": "SaaS", "description": "SaaS"},
            {"query": "B2B", "description": "B2B"},
            {"query": "B2C", "description": "B2C"},
            {"query": "mobile", "description": "Mobile"},
            {"query": "web", "description": "Web"},
            {"query": "ecommerce", "description": "E-commerce"},
            {"query": "edtech", "description": "EdTech"},
            {"query": "biotech", "description": "BioTech"},
            {"query": "cleantech", "description": "CleanTech"},
            {"query": "food", "description": "Food & Beverage"},
            {"query": "logistics", "description": "Logistics"},
            {"query": "marketplace", "description": "Marketplace"},

            # Regional searches
            {"query": "Africa", "description": "Africa experience"},
            {"query": "Europe", "description": "Europe experience"},
            {"query": "Asia", "description": "Asia experience"},
            {"query": "America", "description": "America experience"},
            {"query": "North America", "description": "North America"},
            {"query": "Latin America", "description": "Latin America"},
            {"query": "Middle East", "description": "Middle East"},
            {"query": "Asia Pacific", "description": "Asia Pacific"},

            # Fundraising stages
            {"query": "Series A", "description": "Series A"},
            {"query": "Series B", "description": "Series B"},
            {"query": "Series C", "description": "Series C"},
            {"query": "seed", "description": "Seed funding"},
            {"query": "pre-seed", "description": "Pre-seed"},
            {"query": "fundraising", "description": "Fundraising"},
            {"query": "investment", "description": "Investment"},
            {"query": "venture", "description": "Venture"},

            # Technical skills
            {"query": "Python", "description": "Python"},
            {"query": "JavaScript", "description": "JavaScript"},
            {"query": "React", "description": "React"},
            {"query": "Node", "description": "Node.js"},
            {"query": "backend", "description": "Backend"},
            {"query": "frontend", "description": "Frontend"},
            {"query": "fullstack", "description": "Full Stack"},
            {"query": "mobile development", "description": "Mobile dev"},
            {"query": "data science", "description": "Data science"},
            {"query": "DevOps", "description": "DevOps"},
            {"query": "AWS", "description": "AWS"},
            {"query": "Google Cloud", "description": "Google Cloud"},

            # Common names (to catch more profiles)
            {"query": "John", "description": "Name: John"},
            {"query": "Sarah", "description": "Name: Sarah"},
            {"query": "David", "description": "Name: David"},
            {"query": "Maria", "description": "Name: Maria"},
            {"query": "Michael", "description": "Name: Michael"},
            {"query": "Jennifer", "description": "Name: Jennifer"},
            {"query": "Robert", "description": "Name: Robert"},
            {"query": "Lisa", "description": "Name: Lisa"},
            {"query": "James", "description": "Name: James"},
            {"query": "Emma", "description": "Name: Emma"},
            {"query": "William", "description": "Name: William"},
            {"query": "Olivia", "description": "Name: Olivia"},
            {"query": "Alexander", "description": "Name: Alexander"},
            {"query": "Sophia", "description": "Name: Sophia"},
            {"query": "Benjamin", "description": "Name: Benjamin"},

            # Education/degrees
            {"query": "MBA", "description": "MBA"},
            {"query": "PhD", "description": "PhD"},
            {"query": "Stanford", "description": "Stanford"},
            {"query": "Harvard", "description": "Harvard"},
            {"query": "MIT", "description": "MIT"},
            {"query": "Berkeley", "description": "Berkeley"},
            {"query": "university", "description": "University"},
            {"query": "college", "description": "College"},

            # Company/experience terms
            {"query": "Google", "description": "Ex-Google"},
            {"query": "Facebook", "description": "Ex-Facebook"},
            {"query": "Amazon", "description": "Ex-Amazon"},
            {"query": "Microsoft", "description": "Ex-Microsoft"},
            {"query": "Apple", "description": "Ex-Apple"},
            {"query": "Tesla", "description": "Ex-Tesla"},
            {"query": "Uber", "description": "Ex-Uber"},
            {"query": "Airbnb", "description": "Ex-Airbnb"},

            # Years of experience
            {"query": "5 years", "description": "5 years exp"},
            {"query": "10 years", "description": "10 years exp"},
            {"query": "15 years", "description": "15 years exp"},
            {"query": "years", "description": "Years experience"},

            # Letters and single characters (last resort)
            {"query": "a", "description": "Letter A"},
            {"query": "e", "description": "Letter E"},
            {"query": "i", "description": "Letter I"},
            {"query": "o", "description": "Letter O"},
            {"query": "u", "description": "Letter U"},
            {"query": "the", "description": "Common word: the"},
            {"query": "and", "description": "Common word: and"},
            {"query": "with", "description": "Common word: with"},
            {"query": "for", "description": "Common word: for"},
            {"query": "at", "description": "Common word: at"},
            {"query": "in", "description": "Common word: in"},
            {"query": "to", "description": "Common word: to"},
        ]

        print(f"   Will run {len(search_strategies)} different searches...")

        for i, strategy in enumerate(search_strategies, 1):
            try:
                print(f"   🔍 {i}/{len(search_strategies)} - {strategy['description']}: '{strategy['query']}'")
                total_searches += 1

                response = requests.post(
                    'http://localhost:3000/api/search',
                    json={'query': strategy['query']},
                    headers={'Content-Type': 'application/json'},
                    timeout=15
                )

                if response.status_code == 200:
                    data = response.json()
                    candidates = data.get('results', [])
                    new_candidates = 0

                    for candidate in candidates:
                        candidate_id = candidate.get('id')
                        if candidate_id and candidate_id not in all_candidates:
                            all_candidates[candidate_id] = candidate
                            new_candidates += 1

                    print(f"      Found {len(candidates)} results, {new_candidates} new (total unique: {len(all_candidates)})")
                else:
                    print(f"      ❌ Status {response.status_code}")

                time.sleep(0.5)  # Be nice to the API

            except Exception as e:
                print(f"      ❌ Error: {e}")
                continue

        unique_candidates = list(all_candidates.values())
        print(f"\n✅ FINAL RESULTS:")
        print(f"   📊 Ran {total_searches} searches")
        print(f"   🎯 TOTAL UNIQUE CANDIDATES FOUND: {len(unique_candidates)}")
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

    def export_all_cvs(self):
        """Export ALL candidate CVs to local files"""
        print("🚀 Starting COMPREHENSIVE CV export...")

        candidates = self.get_all_candidates_comprehensive()
        if not candidates:
            print("❌ No candidates found!")
            return

        print(f"\n📊 Ready to export {len(candidates)} candidates to local files")

        successful_exports = 0
        failed_exports = 0

        # Create index content
        index_lines = [
            f"AIM FOUNDING TO GIVE - COMPREHENSIVE CV EXPORT",
            f"=" * 60,
            f"Export Date: {time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"Total Candidates: {len(candidates)}",
            f"Output Directory: {os.path.abspath(self.output_dir)}",
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
                filepath = os.path.join(self.output_dir, filename)

                # Save to file
                with open(filepath, 'w', encoding='utf-8') as f:
                    f.write(cv_content)

                print(f"   ✅ Saved: {filename}")
                successful_exports += 1

                # Add to index
                index_lines.append(f"{i:4d}. {name}")
                index_lines.append(f"      File: {filename}")
                index_lines.append(f"      Email: {email}")
                index_lines.append(f"      Role: {headline}")
                index_lines.append("")

            except Exception as e:
                print(f"   ❌ Error processing {name}: {e}")
                failed_exports += 1

        # Save index file
        try:
            index_content = "\n".join(index_lines)
            index_path = os.path.join(self.output_dir, "0000_COMPREHENSIVE_INDEX.txt")
            with open(index_path, 'w', encoding='utf-8') as f:
                f.write(index_content)
            print("✅ Index file saved")
        except Exception as e:
            print(f"❌ Index save failed: {e}")

        print(f"\n🎉 COMPREHENSIVE EXPORT FINISHED!")
        print(f"✅ Successfully exported: {successful_exports} CVs")
        print(f"❌ Failed exports: {failed_exports}")
        print(f"📁 All files saved to: {os.path.abspath(self.output_dir)}")
        print(f"📋 Index file: {os.path.join(os.path.abspath(self.output_dir), '0000_COMPREHENSIVE_INDEX.txt')}")

        print(f"\n📤 NEXT STEPS:")
        print(f"   1. All CV files are ready in: {os.path.abspath(self.output_dir)}")
        print(f"   2. You can now upload this entire folder to Google Drive manually")
        print(f"   3. Or use Google Drive's desktop sync to upload automatically")

def main():
    try:
        exporter = ComprehensiveCVExporter()
        exporter.export_all_cvs()
    except Exception as e:
        print(f"❌ Fatal error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()