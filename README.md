# 🚀 AIM Candidate Search - Production AI System

A production-grade AI-powered candidate search system with state-of-the-art hybrid search capabilities for AIM staff to find and evaluate candidates using natural language queries.

## Quick Start

### 1. Environment Setup

Create `.env.local` with your API keys:

```bash
# Google AI API - for structured query parsing (Gemini 2.5 Flash)
GOOGLE_API_KEY=your_google_api_key

# Voyage AI - for high-quality embeddings (voyage-3-large)
VOYAGE_API_KEY=your_voyage_api_key

# Cohere - for result reranking (rerank-v3.5)
COHERE_API_KEY=your_cohere_api_key

# Affinda - for resume parsing
AFFINDA_API_KEY=your_affinda_api_key

# Typesense - local development
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=development-key
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Typesense (if using cloud)

If you're using Typesense Cloud, you can skip this step as the collection will be created automatically. For local Typesense:

```bash
npx ts-node scripts/seed-typesense.ts
```

### 4. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Usage

### Authentication
- Access the app at `http://localhost:3000`
- Enter the password you set in `APP_BASIC_PASSWORD`

### Data Ingestion (Admin Tab)
1. Go to the "Admin" tab
2. Upload your CSV file (exported from Airtable/Google Sheets)
3. Choose whether to use mock CVs (for development) or parse real CVs
4. Click "Start Ingestion"
5. Monitor the progress log

### Searching (Search Tab)
1. Use the search box for natural language queries like:
   - "sold to supermarkets in Saudi Arabia"
   - "worked at USAID"
   - "alt-protein startup"
2. Apply filters:
   - Regions
   - Technical co-founder only
   - Fundraising experience
   - Minimum scores for Start Fit and Tech-AI
   - Exclude flagged profiles
3. Results show highlighted snippets from CVs as evidence
4. Add candidates to shortlist using the "Add to Shortlist" button

### Shortlist Management
- Click the "Shortlist" button (top-right) to open the shortlist panel
- Remove individuals from shortlist
- Export shortlist as CSV with essential fields
- Clear entire shortlist

## Features

✅ **CSV Ingestion**: Upload and parse CSV exports from Airtable/Sheets
✅ **CV Parsing**: Supports Affinda Resume Parser and LlamaParse (with fallback)
✅ **Hybrid Search**: Combines keyword and semantic search with highlighting
✅ **Smart Filters**: Regions, fundraising, scores, technical co-founder flags
✅ **Evidence Snippets**: Shows highlighted text from CVs that match queries
✅ **Shortlist Management**: Add, remove, and export candidate shortlists
✅ **Basic Authentication**: Simple password gate for the entire application
✅ **Responsive UI**: Works on desktop and mobile devices

## CSV Format Expected

The application expects CSV files with these columns (missing columns are gracefully handled):

- `Submission Date`
- `First name`, `Last name`
- `Email`
- `LinkedIn URL`
- `Please upload your CV:` (PDF URL)
- `In what regions would you be interested in launching a startup...`
- `I could be a technical cofounder`
- `Please indicate your level of experience with commercial (non-philanthropic) fundraising.`
- `MC IQ /30`
- `MC Val Fit Sub /40`
- `Start Fit Sub /112`
- `AFG Tech [Dev] /23`
- `AFG Tech [AI] /22`
- `Tripped LLM or AIM Screens /2`
- `Unique ID`

## Development Mode

For development without API keys:
1. Set `useMockCvs` to `true` in the Admin panel
2. Mock CV data will be generated for testing
3. The app works fully without external CV parsing services

## Architecture

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS
- **Search**: Typesense Cloud for hybrid search with highlighting
- **CV Parsing**: Affinda Resume Parser (primary) + LlamaParse (fallback)
- **Data Flow**: CSV → Parse CVs → Index in Typesense → Search & Filter
- **Storage**: No persistent database - everything indexed in Typesense

## Acceptance Tests

The MVP passes these key tests:

1. **Data Ingestion**: Processes 500+ CV rows without manual intervention
2. **Natural Language Search**:
   - "sold to supermarkets in Saudi Arabia" → returns relevant matches with snippets
   - "worked at USAID" → highlights USAID mentions in CV text
   - "alt-protein startup" → finds alternative protein/cultivated meat mentions
3. **Filtering**: Tech-AI ≥0.7 AND Exclude flagged → correctly filters results
4. **Shortlist Export**: Exports CSV with first name, last name, email, LinkedIn, CV URL
5. **Authentication**: Password gate protects the entire application

## Support & Issues

For support or bug reports, check the console logs first. Common issues:

- **Typesense connection**: Verify your API key and host settings
- **CSV parsing errors**: Check CSV format and encoding (UTF-8 recommended)
- **CV parsing failures**: Expected with demo API keys - use mock CV mode for development
