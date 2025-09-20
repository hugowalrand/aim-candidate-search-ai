// Transform CSV data to production candidate model
import type { RawCSVRow } from './data-loader'
import type { Candidate } from '@/types/candidate'
import { createCombinedText } from './search/embedding-service'

export function transformCandidateData(row: RawCSVRow): Candidate | null {
  try {
    const id = row['Unique ID'] ||
      `${row['First name']}-${row['Last name']}-${row.Email}`.toLowerCase().replace(/[^a-z0-9]/g, '-')

    // Parse regions and normalize them
    const regionsText = row['In what regions would you be interested in launching a startup and living in (for at least 2 years)? Please check all that apply.'] || ''
    const regions = normalizeRegions(regionsText)

    // Technical co-founder capability
    const tech_cofounder = (row['I could be a technical cofounder'] || '').toUpperCase().includes('YES')

    // Parse fundraising experience and normalize
    const fundraisingText = row['Please indicate your level of experience with commercial (non-philanthropic) fundraising.'] || ''
    const fundraising_stage = normalizeFundraisingStage(fundraisingText)

    // Extract skills from various fields
    const skills = extractSkills(row)

    // Extract experience tags
    const tags = extractTags(row)

    // Create headline from available information
    const headline = createHeadline(row, tech_cofounder, fundraising_stage, regions)

    // Combine all text content for notes
    const notes = combineNotesContent(row)

    // Create CV text from form responses
    const cv_text = createCVText(row)

    const candidate: Candidate = {
      id,
      full_name: `${row['First name'] || ''} ${row['Last name'] || ''}`.trim(),
      headline,
      locations: [], // Will be populated from regions
      regions,
      email: row.Email,
      linkedin_url: row['LinkedIn URL'],
      skills,
      fundraising_stage,
      tech_cofounder,
      notes,
      cv_text,
      tags,
      years_experience: estimateExperience(row),
      last_active_utc: new Date().toISOString()
    }

    // Generate combined text for search
    candidate.combined_text = createCombinedText(candidate)

    return candidate

  } catch (error) {
    console.warn('Failed to transform candidate:', error)
    return null
  }
}

function normalizeRegions(regionsText: string): string[] {
  const regionMap: Record<string, string> = {
    'africa': 'Africa',
    'europe': 'Europe',
    'uk': 'Europe',
    'united kingdom': 'Europe',
    'asia': 'Asia Pacific',
    'asia pacific': 'Asia Pacific',
    'north america': 'North America',
    'united states': 'North America',
    'canada': 'North America',
    'usa': 'North America',
    'latin america': 'Latin America',
    'south america': 'Latin America',
    'middle east': 'Middle East',
    'remote': 'Remote'
  }

  const regions = regionsText
    .toLowerCase()
    .split(/[\n;,\/]/)
    .map(r => r.trim())
    .filter(r => r.length > 0)
    .map(region => {
      // Check for exact matches first
      if (regionMap[region]) return regionMap[region]

      // Check for partial matches
      for (const [key, value] of Object.entries(regionMap)) {
        if (region.includes(key) || key.includes(region)) {
          return value
        }
      }

      // Return capitalized original if no match
      return region.charAt(0).toUpperCase() + region.slice(1)
    })

  // Remove duplicates
  return [...new Set(regions)]
}

function normalizeFundraisingStage(fundraisingText: string): string {
  const text = fundraisingText.toLowerCase()

  if (text.includes('$5m') || text.includes('5m+') || text.includes('series b') || text.includes('series c')) {
    return 'Series B+'
  }
  if (text.includes('$1m') || text.includes('1m-5m') || text.includes('series a')) {
    return 'Series A'
  }
  if (text.includes('$500k') || text.includes('500k') || text.includes('seed')) {
    return 'Seed'
  }
  if (text.includes('raised') || text.includes('funding') || text.includes('angel')) {
    return 'Preseed'
  }

  return 'None'
}

function extractSkills(row: RawCSVRow): string[] {
  const skills = new Set<string>()

  // Technical skills
  const techExp = row['Please use the check-boxes below to indicate your level of experience building tech. Only include things you have done (or you\'re very confident you could do) by yourself, from start to finish. Select all options that apply.'] || ''
  if (techExp.includes('Full stack')) skills.add('Full Stack Development')
  if (techExp.includes('Frontend')) skills.add('Frontend Development')
  if (techExp.includes('Backend')) skills.add('Backend Development')
  if (techExp.includes('Mobile')) skills.add('Mobile Development')
  if (techExp.includes('DevOps')) skills.add('DevOps')

  // AI/ML skills
  const aiExp = row['Please use the check-boxes below to indicate your level of experience with AI, LLMs, and machine learning technologies. Please check all that apply.'] || ''
  if (aiExp.includes('LLM')) skills.add('LLM/AI')
  if (aiExp.includes('Machine Learning')) skills.add('Machine Learning')
  if (aiExp.includes('Data Science')) skills.add('Data Science')

  // Founder skills
  const founderExp = row['Please use the check-boxes below to indicate your level of experience as a founder. Please check all that apply.'] || ''
  if (founderExp.includes('fundraising')) skills.add('Fundraising')
  if (founderExp.includes('team')) skills.add('Team Management')
  if (founderExp.includes('product')) skills.add('Product Management')

  // Other experience
  const otherExp = row['Please use the check-boxes below to indicate any other relevant experience you might have. Please check all that apply.'] || ''
  if (otherExp.includes('domain expertise')) skills.add('Domain Expertise')
  if (otherExp.includes('managed')) skills.add('Management')
  if (otherExp.includes('startup')) skills.add('Startup Experience')

  return Array.from(skills)
}

function extractTags(row: RawCSVRow): string[] {
  const tags = new Set<string>()

  // Add AIM tag since these are AIM candidates
  tags.add('AIM_2024')

  // Add technical tag if applicable
  if ((row['I could be a technical cofounder'] || '').toUpperCase().includes('YES')) {
    tags.add('technical_cofounder')
  }

  // Add fundraising experience tags
  const fundraisingText = row['Please indicate your level of experience with commercial (non-philanthropic) fundraising.'] || ''
  if (fundraisingText.includes('raised') || fundraisingText.includes('funding')) {
    tags.add('fundraising_experience')
  }

  // Add domain tags based on company interests
  const companyInterest = row['Which of these companies would you be most interested to found?'] || ''
  if (companyInterest.includes('healthcare') || companyInterest.includes('health')) {
    tags.add('healthcare')
  }
  if (companyInterest.includes('climate') || companyInterest.includes('sustainable')) {
    tags.add('climate')
  }
  if (companyInterest.includes('education')) {
    tags.add('education')
  }

  return Array.from(tags)
}

function createHeadline(row: RawCSVRow, tech_cofounder: boolean, fundraising_stage: string, regions: string[]): string {
  const parts = []

  if (tech_cofounder) {
    parts.push('Technical Co-founder')
  } else {
    parts.push('Founder')
  }

  if (fundraising_stage && fundraising_stage !== 'None') {
    parts.push(`${fundraising_stage} Experience`)
  }

  // Add primary region
  if (regions.length > 0) {
    parts.push(regions[0])
  }

  // Add domain from company interest
  const companyInterest = row['Which of these companies would you be most interested to found?'] || ''
  if (companyInterest.includes('healthcare')) parts.push('Healthcare')
  if (companyInterest.includes('climate')) parts.push('Climate Tech')
  if (companyInterest.includes('education')) parts.push('EdTech')
  if (companyInterest.includes('fintech')) parts.push('FinTech')

  return parts.join(' • ')
}

function combineNotesContent(row: RawCSVRow): string {
  const notes = [
    row['[OPTIONAL] Tell us about a non-professional accomplishment that you\'re proud of.'],
    row['Please tell us about the nature of this funding - what type of funding was it (VC funding, angel investors, crowdfunding, etc) and what was your role in raising it?'],
    row['If you made $150,000 USD in salary per year, how much would you donate to charity, to which exact organization(s), and why to these in particular?'],
    row['Please rank the following four factors from most important to least important in evaluating the potential of a startup idea during the program: (A) Personal fit with idea (B) Total addressable market (C) Number of competitors in the market (D) Demonstrated customer willingness to pay. Please describe your reasoning for your ranking - we\'re interested to understand your thinking.']
  ].filter(Boolean).join('\n\n')

  return notes
}

function createCVText(row: RawCSVRow): string {
  // Create a structured CV from the form responses
  const sections = []

  sections.push(`CANDIDATE PROFILE\n${row['First name']} ${row['Last name']}`)

  if (row.Email) sections.push(`Email: ${row.Email}`)
  if (row['LinkedIn URL']) sections.push(`LinkedIn: ${row['LinkedIn URL']}`)

  // Experience section
  const techExp = row['Please use the check-boxes below to indicate your level of experience building tech. Only include things you have done (or you\'re very confident you could do) by yourself, from start to finish. Select all options that apply.']
  const founderExp = row['Please use the check-boxes below to indicate your level of experience as a founder. Please check all that apply.']
  const otherExp = row['Please use the check-boxes below to indicate any other relevant experience you might have. Please check all that apply.']

  if (techExp || founderExp || otherExp) {
    sections.push('EXPERIENCE')
    if (techExp) sections.push(`Technical: ${techExp}`)
    if (founderExp) sections.push(`Founder: ${founderExp}`)
    if (otherExp) sections.push(`Other: ${otherExp}`)
  }

  // Accomplishments
  const accomplishment = row['[OPTIONAL] Tell us about a non-professional accomplishment that you\'re proud of.']
  if (accomplishment) {
    sections.push('ACCOMPLISHMENTS')
    sections.push(accomplishment)
  }

  // Interests and giving
  const giving = row['If you made $150,000 USD in salary per year, how much would you donate to charity, to which exact organization(s), and why to these in particular?']
  if (giving) {
    sections.push('PHILANTHROPIC INTERESTS')
    sections.push(giving)
  }

  return sections.join('\n\n')
}

function estimateExperience(row: RawCSVRow): number {
  // Simple heuristic to estimate years of experience
  const otherExp = row['Please use the check-boxes below to indicate any other relevant experience you might have. Please check all that apply.'] || ''
  const founderExp = row['Please use the check-boxes below to indicate your level of experience as a founder. Please check all that apply.'] || ''

  if (otherExp.includes('10+ years') || founderExp.includes('10+ years')) return 10
  if (otherExp.includes('5-10 years') || founderExp.includes('5-10 years')) return 7
  if (otherExp.includes('3-5 years') || founderExp.includes('3-5 years')) return 4
  if (otherExp.includes('1-3 years') || founderExp.includes('1-3 years')) return 2

  // Default estimate based on fundraising stage
  const fundraisingText = row['Please indicate your level of experience with commercial (non-philanthropic) fundraising.'] || ''
  if (fundraisingText.includes('$5m') || fundraisingText.includes('5m+')) return 8
  if (fundraisingText.includes('$1m') || fundraisingText.includes('1m-5m')) return 5
  if (fundraisingText.includes('$500k') || fundraisingText.includes('500k')) return 3

  return 2 // Default for new founders
}