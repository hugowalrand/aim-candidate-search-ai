#!/usr/bin/env python3
"""
Access Typesense directly to get candidates with cv_url fields
"""

import requests
import json
import os

def query_typesense_direct():
    """Query Typesense directly to get all candidates with cv_url"""
    print("🔍 Querying Typesense directly for candidates with cv_url...")

    # Typesense configuration
    TYPESENSE_URL = "http://localhost:8108"
    API_KEY = "development-key"
    COLLECTION = "candidates"  # Assuming the collection name

    headers = {
        'X-TYPESENSE-API-KEY': API_KEY,
        'Content-Type': 'application/json'
    }

    try:
        # First, let's see what collections exist
        print("📊 Getting collections...")
        collections_response = requests.get(f"{TYPESENSE_URL}/collections", headers=headers)

        if collections_response.status_code == 200:
            collections = collections_response.json()
            print(f"Available collections: {[c['name'] for c in collections]}")
        else:
            print(f"❌ Failed to get collections: {collections_response.status_code}")
            return []

        # Try to get all documents from the candidates collection
        collection_name = "candidates"  # Update this based on actual collection name

        print(f"📊 Getting all documents from '{collection_name}' collection...")

        # Use search with empty query to get all documents
        search_params = {
            'q': '*',
            'query_by': 'full_name',
            'per_page': 250,  # Maximum allowed
            'page': 1
        }

        all_candidates = []
        page = 1

        while True:
            search_params['page'] = page
            print(f"   Fetching page {page}...")

            search_response = requests.get(
                f"{TYPESENSE_URL}/collections/{collection_name}/documents/search",
                headers=headers,
                params=search_params
            )

            if search_response.status_code == 200:
                data = search_response.json()
                hits = data.get('hits', [])

                if not hits:
                    break

                print(f"      Got {len(hits)} documents")

                for hit in hits:
                    candidate = hit.get('document', {})
                    all_candidates.append(candidate)

                # Check if there are more pages
                if len(hits) < search_params['per_page']:
                    break

                page += 1

            else:
                print(f"❌ Failed to search page {page}: {search_response.status_code}")
                print(f"Response: {search_response.text}")
                break

        print(f"✅ Total candidates retrieved: {len(all_candidates)}")

        # Check how many have cv_url
        candidates_with_cv = [c for c in all_candidates if c.get('cv_url')]
        print(f"📄 Candidates with cv_url: {len(candidates_with_cv)}")

        # Show sample data
        if all_candidates:
            print(f"\n🔍 Sample candidate fields:")
            sample = all_candidates[0]
            for key in sorted(sample.keys()):
                value = sample[key]
                if isinstance(value, str) and len(value) > 100:
                    print(f"   {key}: {value[:100]}...")
                else:
                    print(f"   {key}: {value}")

        return all_candidates

    except Exception as e:
        print(f"❌ Error querying Typesense: {e}")
        return []

def extract_cv_urls(candidates):
    """Extract candidates with valid CV URLs"""
    print(f"\n🔗 Extracting CV URLs from {len(candidates)} candidates...")

    candidates_with_urls = []

    for candidate in candidates:
        cv_url = candidate.get('cv_url', '')

        if cv_url and cv_url.strip():
            # Check if it looks like a valid URL
            if cv_url.startswith('http') or cv_url.startswith('www'):
                candidates_with_urls.append({
                    'id': candidate.get('id'),
                    'full_name': candidate.get('full_name') or f"{candidate.get('first_name', '')} {candidate.get('last_name', '')}".strip(),
                    'email': candidate.get('email'),
                    'cv_url': cv_url
                })

    print(f"✅ Found {len(candidates_with_urls)} candidates with valid CV URLs")

    # Show some examples
    if candidates_with_urls:
        print(f"\n📋 Sample CV URLs:")
        for i, candidate in enumerate(candidates_with_urls[:5], 1):
            print(f"   {i}. {candidate['full_name']}")
            print(f"      URL: {candidate['cv_url']}")

    return candidates_with_urls

def save_cv_urls(candidates_with_urls):
    """Save candidates with CV URLs to a JSON file"""
    output_file = "candidates_with_cv_urls.json"

    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(candidates_with_urls, f, indent=2, ensure_ascii=False)

        print(f"✅ Saved {len(candidates_with_urls)} candidates with CV URLs to: {output_file}")
        return output_file

    except Exception as e:
        print(f"❌ Failed to save CV URLs: {e}")
        return None

def main():
    print("🚀 Starting direct Typesense query for CV URLs...\n")

    # Query Typesense directly
    all_candidates = query_typesense_direct()

    if not all_candidates:
        print("❌ No candidates retrieved from Typesense")
        return

    # Extract candidates with CV URLs
    candidates_with_urls = extract_cv_urls(all_candidates)

    if not candidates_with_urls:
        print("❌ No candidates found with CV URLs")
        return

    # Save to file
    output_file = save_cv_urls(candidates_with_urls)

    if output_file:
        print(f"\n🎉 SUCCESS!")
        print(f"   📊 Total candidates: {len(all_candidates)}")
        print(f"   📄 With CV URLs: {len(candidates_with_urls)}")
        print(f"   📁 Saved to: {os.path.abspath(output_file)}")
        print(f"\n📤 Next: Use this data to download PDF files!")

if __name__ == "__main__":
    main()