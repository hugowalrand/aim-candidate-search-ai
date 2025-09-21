#!/usr/bin/env python3
"""
Examine candidate data structure to find PDF URLs
"""

import requests
import json

def examine_candidate_data():
    """Get a few candidates and examine their structure"""
    print("🔍 Examining candidate data structure...")

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

            if candidates:
                print(f"Found {len(candidates)} candidates. Examining first few...")

                for i, candidate in enumerate(candidates[:3], 1):
                    print(f"\n{'='*60}")
                    print(f"CANDIDATE {i}: {candidate.get('full_name', 'Unknown')}")
                    print(f"{'='*60}")

                    # Print all fields and their values
                    for key, value in candidate.items():
                        if isinstance(value, str) and len(value) > 200:
                            # Truncate very long strings
                            print(f"{key}: {value[:200]}...")
                        else:
                            print(f"{key}: {value}")

                    # Look for any field containing URLs
                    print(f"\n🔗 Fields containing 'http' or '.pdf':")
                    for key, value in candidate.items():
                        if isinstance(value, str):
                            if 'http' in value.lower() or '.pdf' in value.lower():
                                print(f"   {key}: {value}")

                    print(f"\n🔗 All string fields for pattern matching:")
                    for key, value in candidate.items():
                        if isinstance(value, str) and value.strip():
                            print(f"   {key}: {repr(value[:100])}")

            else:
                print("No candidates found")
        else:
            print(f"API error: {response.status_code}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    examine_candidate_data()