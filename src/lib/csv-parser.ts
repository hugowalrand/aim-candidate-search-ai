import Papa from 'papaparse'
import type { Profile } from '../types'

export interface CSVRow {
  'Submission Date': string
  'First name': string
  'Last name': string
  'Email': string
  'LinkedIn URL': string
  'Please upload your CV:': string
  'In what regions would you be interested in launching a startup and living in (for at least 2 years)? Please check all that apply.': string
  'I could be a technical cofounder': string
  'Please indicate your level of experience with commercial (non-philanthropic) fundraising.': string
  'MC IQ /30': string
  'MC Val Fit Sub /40': string
  'Start Fit Sub /112': string
  'AFG Tech [Dev] /23': string
  'AFG Tech [AI] /22': string
  'Tripped LLM or AIM Screens /2': string
  'Unique ID': string
  [key: string]: string // For other columns we might not map
}

export function parseCSV(csvText: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing warnings:', results.errors)
        }
        resolve(results.data as CSVRow[])
      },
      error: reject,
    })
  })
}

export function mapCSVRowToProfile(row: CSVRow, cvText: string = ''): Profile {
  // Generate ID from unique ID or fallback to email + linkedin
  const id = row['Unique ID'] ||
    (row.Email + row['LinkedIn URL']).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()

  // Parse regions
  const regionsText = row['In what regions would you be interested in launching a startup and living in (for at least 2 years)? Please check all that apply.'] || ''
  const regions = regionsText
    .split(/[;\n,]/)
    .map(r => r.trim())
    .filter(r => r.length > 0)

  // Map tech cofounder
  const techCofounder = (row['I could be a technical cofounder'] || '').toUpperCase() === 'YES'

  // Map fundraising bucket
  const fundraisingText = row['Please indicate your level of experience with commercial (non-philanthropic) fundraising.'] || ''
  let fundraisingBucket = 'none'
  if (fundraisingText.includes('≤$500k') || fundraisingText.includes('<=$500k')) {
    fundraisingBucket = '<=500k'
  } else if (fundraisingText.includes('$500k–$1M') || fundraisingText.includes('$500k-$1M')) {
    fundraisingBucket = '500k-1M'
  } else if (fundraisingText.includes('$1M–$5M') || fundraisingText.includes('$1M-$5M')) {
    fundraisingBucket = '1M-5M'
  } else if (fundraisingText.includes('$5M+')) {
    fundraisingBucket = '5M+'
  }

  // Parse scores (normalize to 0-1)
  const parseScore = (value: string, maxScore: number): number => {
    const num = parseFloat(value)
    return isNaN(num) ? 0 : num / maxScore
  }

  // Extract checkbox tags from various experience columns
  const checkboxTags: string[] = []

  // Add some dummy tags based on common patterns in the data
  if (cvText.toLowerCase().includes('founder')) checkboxTags.push('founder experience')
  if (cvText.toLowerCase().includes('manager') || cvText.toLowerCase().includes('managed')) {
    checkboxTags.push('managed >5')
  }
  if (cvText.toLowerCase().includes('domain')) checkboxTags.push('domain expertise')

  // Create natural language blob for search
  const nlBlob = [
    row['First name'],
    row['Last name'],
    regionsText,
    fundraisingText,
    cvText.substring(0, 500), // First 500 chars of CV
  ].filter(Boolean).join(' ')

  return {
    id,
    first_name: row['First name'] || '',
    last_name: row['Last name'] || '',
    email: row.Email,
    linkedin_url: row['LinkedIn URL'],
    cv_url: row['Please upload your CV:'] || '',
    submission_date: formatDate(row['Submission Date']),

    tech_cofounder: techCofounder,
    regions,
    fundraising_bucket: fundraisingBucket,

    score_iq: parseScore(row['MC IQ /30'], 30),
    score_value_fit: parseScore(row['MC Val Fit Sub /40'], 40),
    score_start_fit: parseScore(row['Start Fit Sub /112'], 112),
    score_tech_dev: parseScore(row['AFG Tech [Dev] /23'], 23),
    score_tech_ai: parseScore(row['AFG Tech [AI] /22'], 22),
    flag_llm_screen: parseFloat(row['Tripped LLM or AIM Screens /2']) || 0,

    checkbox_tags: checkboxTags,

    cv_text: cvText,
    nl_blob: nlBlob,
    created_at: Date.now(),
  }
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}