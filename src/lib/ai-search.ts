import OpenAI from 'openai'
import { pipeline, env } from '@xenova/transformers'
import type { Profile } from '@/types'

// Disable local models to use remote ones for now
env.allowRemoteModels = true

interface SearchIntent {
  query: string
  keywords: string[]
  requirements: {
    experience_areas?: string[]
    skills?: string[]
    regions?: string[]
    fundraising_level?: string
    technical_role?: boolean
    leadership_experience?: boolean
  }
  weight_preferences: {
    experience_match: number
    skill_match: number
    regional_fit: number
    fundraising_track_record: number
    technical_expertise: number
    leadership_potential: number
  }
}

interface RankedCandidate {
  profile: Profile
  score: number
  reasoning: string
  match_factors: {
    experience_match: number
    skill_match: number
    regional_fit: number
    fundraising_score: number
    technical_score: number
    leadership_score: number
  }
}

export class AISearch {
  private openai: OpenAI | null = null
  private embedder: any = null

  constructor() {
    // Initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      })
    }
  }

  async initialize() {
    try {
      // Load sentence transformer for embeddings
      this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
    } catch (error) {
      console.warn('Could not initialize embeddings:', error)
    }
  }

  async parseSearchIntent(query: string): Promise<SearchIntent> {
    if (this.openai) {
      return await this.parseWithOpenAI(query)
    } else {
      return this.parseWithHeuristics(query)
    }
  }

  private async parseWithOpenAI(query: string): Promise<SearchIntent> {
    try {
      const prompt = `
Analyze this candidate search query and extract structured requirements:
"${query}"

Return JSON with:
- keywords: array of key search terms
- requirements: object with experience_areas, skills, regions, fundraising_level, technical_role, leadership_experience
- weight_preferences: importance weights (0-1) for experience_match, skill_match, regional_fit, fundraising_track_record, technical_expertise, leadership_potential

Example:
Query: "Find someone with B2B SaaS experience in emerging markets who can raise Series A funding"
Response: {
  "keywords": ["B2B", "SaaS", "emerging markets", "Series A", "fundraising"],
  "requirements": {
    "experience_areas": ["B2B", "SaaS", "software"],
    "skills": ["business development", "product management"],
    "regions": ["emerging markets", "developing countries"],
    "fundraising_level": "series_a",
    "technical_role": true,
    "leadership_experience": true
  },
  "weight_preferences": {
    "experience_match": 0.9,
    "skill_match": 0.8,
    "regional_fit": 0.7,
    "fundraising_track_record": 0.9,
    "technical_expertise": 0.6,
    "leadership_potential": 0.8
  }
}
`

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })

      const result = JSON.parse(response.choices[0].message.content || '{}')
      return {
        query,
        ...result
      }
    } catch (error) {
      console.warn('OpenAI parsing failed:', error)
      return this.parseWithHeuristics(query)
    }
  }

  private parseWithHeuristics(query: string): SearchIntent {
    const lowerQuery = query.toLowerCase()

    // Extract keywords
    const keywords = query.split(' ').filter(word => word.length > 2)

    // Identify requirements using patterns
    const requirements: any = {}

    // Experience areas
    const experiencePatterns = [
      { pattern: /b2b|enterprise|business/, area: 'B2B' },
      { pattern: /saas|software|platform/, area: 'SaaS' },
      { pattern: /fintech|financial|banking/, area: 'Fintech' },
      { pattern: /health|medical|healthcare/, area: 'Healthcare' },
      { pattern: /ecommerce|retail|marketplace/, area: 'E-commerce' },
      { pattern: /ai|artificial intelligence|machine learning/, area: 'AI/ML' },
    ]

    requirements.experience_areas = experiencePatterns
      .filter(p => p.pattern.test(lowerQuery))
      .map(p => p.area)

    // Regional indicators
    const regionPatterns = [
      { pattern: /africa|african|nigeria|kenya|ghana/, region: 'Africa/Middle East' },
      { pattern: /asia|asian|india|singapore|china/, region: 'Asia Pacific' },
      { pattern: /europe|european|uk|germany|france/, region: 'Europe/UK' },
      { pattern: /latin america|brazil|mexico|colombia/, region: 'Latin America' },
      { pattern: /us|usa|america|canada/, region: 'United States/Canada' },
      { pattern: /emerging market|developing/, region: 'emerging markets' }
    ]

    requirements.regions = regionPatterns
      .filter(p => p.pattern.test(lowerQuery))
      .map(p => p.region)

    // Fundraising indicators
    if (/raise|funding|investor|series|seed|venture/.test(lowerQuery)) {
      if (/series a|1m|million/.test(lowerQuery)) {
        requirements.fundraising_level = 'series_a'
      } else if (/series b|10m|growth/.test(lowerQuery)) {
        requirements.fundraising_level = 'series_b'
      } else {
        requirements.fundraising_level = 'any'
      }
    }

    // Technical role
    requirements.technical_role = /technical|engineering|developer|cto|architect/.test(lowerQuery)

    // Leadership experience
    requirements.leadership_experience = /lead|manage|team|director|vp|head/.test(lowerQuery)

    // Set weight preferences based on query focus
    const weight_preferences = {
      experience_match: 0.8,
      skill_match: 0.7,
      regional_fit: requirements.regions.length > 0 ? 0.8 : 0.3,
      fundraising_track_record: requirements.fundraising_level ? 0.9 : 0.4,
      technical_expertise: requirements.technical_role ? 0.8 : 0.4,
      leadership_potential: requirements.leadership_experience ? 0.8 : 0.5
    }

    return {
      query,
      keywords,
      requirements,
      weight_preferences
    }
  }

  async searchAndRank(profiles: Profile[], intent: SearchIntent, limit: number = 20): Promise<RankedCandidate[]> {
    const candidates: RankedCandidate[] = []

    for (const profile of profiles) {
      const matchFactors = await this.calculateMatchFactors(profile, intent)
      const score = this.calculateOverallScore(matchFactors, intent.weight_preferences)
      const reasoning = this.generateReasoning(profile, matchFactors, intent)

      candidates.push({
        profile,
        score,
        reasoning,
        match_factors: matchFactors
      })
    }

    // Sort by score and return top results
    return candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  private async calculateMatchFactors(profile: Profile, intent: SearchIntent) {
    const factors = {
      experience_match: 0,
      skill_match: 0,
      regional_fit: 0,
      fundraising_score: 0,
      technical_score: 0,
      leadership_score: 0
    }

    // Experience match - check CV content and profile data
    if (intent.requirements.experience_areas?.length) {
      const experienceText = (profile.cv_text + ' ' + profile.nl_blob).toLowerCase()
      const matchedAreas = intent.requirements.experience_areas.filter(area =>
        experienceText.includes(area.toLowerCase())
      )
      factors.experience_match = matchedAreas.length / intent.requirements.experience_areas.length
    }

    // Skill match - semantic matching against CV
    const skillKeywords = intent.keywords.join(' ').toLowerCase()
    const profileContent = (profile.cv_text + ' ' + profile.nl_blob).toLowerCase()

    // Simple keyword overlap for now (can be enhanced with embeddings)
    const keywordMatches = intent.keywords.filter(keyword =>
      profileContent.includes(keyword.toLowerCase())
    ).length
    factors.skill_match = Math.min(keywordMatches / Math.max(intent.keywords.length, 1), 1)

    // Regional fit
    if (intent.requirements.regions?.length) {
      const regionMatches = intent.requirements.regions.filter(reqRegion => {
        if (reqRegion === 'emerging markets') {
          return profile.regions.some(r =>
            r.includes('Africa') || r.includes('Asia') || r.includes('Latin America')
          )
        }
        return profile.regions.some(r => r.includes(reqRegion.replace('/Middle East', '')))
      })
      factors.regional_fit = regionMatches.length / intent.requirements.regions.length
    } else {
      factors.regional_fit = 0.5 // neutral if no regional preference
    }

    // Fundraising score
    const fundraisingBuckets = {
      'none': 0,
      '<=500k': 0.3,
      '500k-1M': 0.6,
      '1M-5M': 0.8,
      '5M+': 1.0
    }
    factors.fundraising_score = fundraisingBuckets[profile.fundraising_bucket] || 0

    // Technical score
    factors.technical_score = profile.tech_cofounder ? 1.0 : 0.2
    if (profile.score_tech_dev > 0) {
      factors.technical_score = Math.max(factors.technical_score, profile.score_tech_dev)
    }

    // Leadership score - based on checkbox tags and content
    const leadershipIndicators = profile.checkbox_tags.filter(tag =>
      tag.includes('managed') || tag.includes('lead') || tag.includes('founder')
    ).length
    const cvLeadership = profileContent.includes('lead') || profileContent.includes('manage') ? 0.5 : 0
    factors.leadership_score = Math.min((leadershipIndicators * 0.3) + cvLeadership, 1.0)

    return factors
  }

  private calculateOverallScore(factors: any, weights: any): number {
    let weightedSum = 0
    let totalWeight = 0

    for (const [factor, value] of Object.entries(factors)) {
      const weight = weights[factor] || 0.5
      weightedSum += (value as number) * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0
  }

  private generateReasoning(profile: Profile, factors: any, intent: SearchIntent): string {
    const reasons = []

    if (factors.experience_match > 0.7) {
      reasons.push(`Strong experience match (${(factors.experience_match * 100).toFixed(0)}%)`)
    }

    if (factors.regional_fit > 0.8) {
      reasons.push(`Excellent regional fit - operates in ${profile.regions.join(', ')}`)
    }

    if (factors.fundraising_score > 0.6) {
      reasons.push(`Proven fundraising experience (${profile.fundraising_bucket})`)
    }

    if (factors.technical_score > 0.8 && intent.requirements.technical_role) {
      reasons.push('Technical co-founder capability')
    }

    if (factors.leadership_score > 0.6) {
      reasons.push('Leadership and management experience')
    }

    if (reasons.length === 0) {
      reasons.push('Good overall profile match')
    }

    return reasons.join(' • ')
  }
}

export default AISearch