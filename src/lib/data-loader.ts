import Papa from 'papaparse'
import fs from 'fs'
import path from 'path'
import type { Profile } from '../types'

export interface RawCSVRow {
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
  'Please use the check-boxes below to indicate any other relevant experience you might have. Please check all that apply.': string
  'Please use the check-boxes below to indicate your level of experience building tech. Only include things you have done (or you\'re very confident you could do) by yourself, from start to finish. Select all options that apply.': string
  'Please use the check-boxes below to indicate your level of experience with AI, LLMs, and machine learning technologies. Please check all that apply.': string
  'Please use the check-boxes below to indicate your level of experience as a founder. Please check all that apply.': string
  'If you made $150,000 USD in salary per year, how much would you donate to charity, to which exact organization(s), and why to these in particular?': string
  'Please rank the following four factors from most important to least important in evaluating the potential of a startup idea during the program: (A) Personal fit with idea (B) Total addressable market (C) Number of competitors in the market (D) Demonstrated customer willingness to pay. Please describe your reasoning for your ranking - we\'re interested to understand your thinking.': string
  [key: string]: string
}

let cachedProfiles: Profile[] | null = null
let cachedRawRows: RawCSVRow[] | null = null

// Clear cache for testing
cachedProfiles = null
cachedRawRows = null

export function loadRawCSVData(): RawCSVRow[] {
  if (cachedRawRows) {
    return cachedRawRows
  }

  try {
    const csvPath = path.join(process.cwd(), '..', 'test-data.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')

    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    })

    const rawRows = parseResult.data as RawCSVRow[]

    // For testing: limit to first 100 candidates to speed up embedding generation
    const limitedRows = rawRows.slice(0, 100)
    cachedRawRows = limitedRows

    console.log(`Loaded ${rawRows.length} raw CSV rows, limited to ${limitedRows.length} for testing`)
    return limitedRows

  } catch (error) {
    console.error('Failed to load raw CSV data:', error)
    return []
  }
}

export function loadProfilesFromCSV(): Profile[] {
  if (cachedProfiles) {
    return cachedProfiles
  }

  try {
    const csvPath = path.join(process.cwd(), '..', 'test-data.csv')
    const csvContent = fs.readFileSync(csvPath, 'utf-8')

    const parseResult = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    })

    const profiles = (parseResult.data as RawCSVRow[]).map(mapRowToProfile).filter(Boolean) as Profile[]
    cachedProfiles = profiles

    console.log(`Loaded ${profiles.length} profiles from CSV`)
    return profiles

  } catch (error) {
    console.error('Failed to load profiles from CSV:', error)
    return []
  }
}

function mapRowToProfile(row: RawCSVRow): Profile | null {
  try {
    // Generate ID from unique ID or fallback
    const id = row['Unique ID'] ||
      `${row['First name']}-${row['Last name']}-${row.Email}`.toLowerCase().replace(/[^a-z0-9]/g, '-')

    // Parse regions
    const regionsText = row['In what regions would you be interested in launching a startup and living in (for at least 2 years)? Please check all that apply.'] || ''
    const regions = regionsText
      .split(/[\n;,]/)
      .map(r => r.trim())
      .filter(r => r.length > 0)

    // Technical co-founder flag
    const techCofounder = (row['I could be a technical cofounder'] || '').toUpperCase().includes('YES')

    // Parse fundraising experience
    const fundraisingText = row['Please indicate your level of experience with commercial (non-philanthropic) fundraising.'] || ''
    let fundraisingBucket = 'none'

    if (fundraisingText.includes('≤$500k') || fundraisingText.includes('<= $500k')) {
      fundraisingBucket = '<=500k'
    } else if (fundraisingText.includes('$500k–$1M') || fundraisingText.includes('$500k-$1M')) {
      fundraisingBucket = '500k-1M'
    } else if (fundraisingText.includes('$1M–$5M') || fundraisingText.includes('$1M-$5M')) {
      fundraisingBucket = '1M-5M'
    } else if (fundraisingText.includes('$5M+')) {
      fundraisingBucket = '5M+'
    } else if (fundraisingText.toLowerCase().includes('raised') || fundraisingText.toLowerCase().includes('funding')) {
      fundraisingBucket = '<=500k'
    }

    // Parse scores (normalize to 0-1)
    const parseScore = (value: string, maxScore: number): number => {
      const num = parseFloat(value)
      return isNaN(num) ? 0 : Math.min(1, num / maxScore)
    }

    // Extract experience tags from various fields
    const checkboxTags: string[] = []
    const otherExp = row['Please use the check-boxes below to indicate any other relevant experience you might have. Please check all that apply.'] || ''

    if (otherExp.toLowerCase().includes('domain expertise')) checkboxTags.push('domain expertise')
    if (otherExp.toLowerCase().includes('managed') || otherExp.toLowerCase().includes('team of')) checkboxTags.push('managed >5')
    if (otherExp.toLowerCase().includes('startup') || otherExp.toLowerCase().includes('founder')) checkboxTags.push('startup experience')
    if (otherExp.toLowerCase().includes('technical') || otherExp.toLowerCase().includes('engineering')) checkboxTags.push('technical experience')

    // Create rich text content for search from ALL relevant fields
    const searchableText = [
      row['First name'],
      row['Last name'],
      regionsText,
      fundraisingText,
      otherExp,
      row['[OPTIONAL] Tell us about a non-professional accomplishment that you\'re proud of.'] || '',
      row['Which of these companies would you be most interested to found?'] || '',
      row['Please tell us about the nature of this funding - what type of funding was it (VC funding, angel investors, crowdfunding, etc) and what was your role in raising it?'] || '',
      row['If you made $150,000 USD in salary per year, how much would you donate to charity, to which exact organization(s), and why to these in particular?'] || '',
      row['Please rank the following four factors from most important to least important in evaluating the potential of a startup idea during the program: (A) Personal fit with idea (B) Total addressable market (C) Number of competitors in the market (D) Demonstrated customer willingness to pay. Please describe your reasoning for your ranking - we\'re interested to understand your thinking.'] || '',
      row['If I did not start a start-up through this program, my most likely alternative would be...'] || '',
      row['Can you describe your relationship to donating to charities in the past year?'] || ''
    ].filter(Boolean).join(' ')

    // Use the real searchable text as CV content (no more mock data)
    const realContent = searchableText

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

      cv_text: realContent,
      nl_blob: searchableText,
      created_at: Date.now(),
    }

  } catch (error) {
    console.warn('Failed to parse profile row:', error)
    return null
  }
}

function generateMockCV(row: RawCSVRow, regions: string[], tags: string[], fundraisingBucket: string): string {
  const name = `${row['First name']} ${row['Last name']}`

  // Generate realistic CV content based on profile data
  const experiences = []

  if (tags.includes('technical experience')) {
    experiences.push('Senior Software Engineer at TechCorp (2020-2023)')
    experiences.push('Led development of scalable microservices architecture')
  }

  if (tags.includes('startup experience')) {
    experiences.push('Co-founder at StartupXYZ (2018-2020)')
    experiences.push('Raised $500K in seed funding and grew team to 12 people')
  }

  if (tags.includes('managed >5')) {
    experiences.push('Engineering Manager at ScaleUp Inc (2019-2022)')
    experiences.push('Managed cross-functional team of 8 engineers')
  }

  if (regions.some(r => r.includes('Africa') || r.includes('Middle East'))) {
    experiences.push('Regional expansion project lead for MENA markets')
    experiences.push('Worked extensively with teams in Saudi Arabia and UAE')
  }

  if (regions.some(r => r.includes('Asia'))) {
    experiences.push('Led market research initiatives across Asia Pacific')
  }

  // Add some domain-specific content based on common search terms
  const domainContent = []

  if (Math.random() > 0.7) {
    domainContent.push('Experience in alternative protein sector and cultivated meat technologies')
  }

  if (Math.random() > 0.8) {
    domainContent.push('Previously worked with USAID on development projects in emerging markets')
  }

  if (Math.random() > 0.6) {
    domainContent.push('Led business development efforts targeting supermarket chains and retail partnerships')
  }

  const cv = `
CURRICULUM VITAE
${name}
Email: ${row.Email}

PROFESSIONAL EXPERIENCE
${experiences.length > 0 ? experiences.join('\n') : 'Product Manager at Innovation Labs (2019-2023)\nLed product development for emerging market solutions'}

${domainContent.length > 0 ? '\nSPECIALIZATIONS\n' + domainContent.join('\n') : ''}

EDUCATION
${tags.includes('technical experience') ? 'MS Computer Science, Tech University' : 'MBA Business Administration'}
BS ${Math.random() > 0.5 ? 'Engineering' : 'Business'}

SKILLS
- Strategic planning and execution
- Cross-cultural team management
- Market analysis and business development
- ${tags.includes('technical experience') ? 'Full-stack development and system architecture' : 'Financial modeling and fundraising'}

ACHIEVEMENTS
- ${fundraisingBucket !== 'none' ? 'Successfully raised funding for startup ventures' : 'Delivered projects worth $2M+ in value'}
- Built and scaled operations across ${regions.length > 1 ? 'multiple international markets' : 'emerging markets'}
- ${tags.includes('managed >5') ? 'Led high-performing teams of 5-15 people' : 'Collaborated with diverse international teams'}
`.trim()

  return cv
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    return date.toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}