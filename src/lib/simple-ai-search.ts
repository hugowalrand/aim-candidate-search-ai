// Simple AI-powered search that actually works
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Profile } from '../types'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export class SimpleAISearch {
  private profiles: Profile[] = []

  async initialize(profiles: Profile[]) {
    this.profiles = profiles
    console.log(`🔍 SimpleAISearch initialized with ${profiles.length} profiles`)
  }

  async search(query: string, limit: number = 10): Promise<Array<Profile & { score: number, reasoning: string }>> {
    console.log('🎯 Starting simple AI search for:', query)

    // Create searchable text for each profile
    const searchableProfiles = this.profiles.map(profile => ({
      profile,
      searchText: this.createSearchableText(profile)
    }))

    // Use Gemini to analyze each profile against the query
    const results = []

    for (const { profile, searchText } of searchableProfiles.slice(0, 20)) { // Limit to first 20 for speed
      try {
        const score = await this.scoreProfile(query, profile, searchText)
        if (score.relevance > 0.3) { // Only include relevant results
          results.push({
            ...profile,
            score: Math.round(score.relevance * 100),
            reasoning: score.explanation
          })
        }
      } catch (error) {
        console.warn(`Failed to score profile ${profile.id}:`, error)
      }
    }

    // Sort by score and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  private createSearchableText(profile: Profile): string {
    const parts = [
      `Name: ${profile.first_name} ${profile.last_name}`,
      `Technical: ${profile.tech_cofounder ? 'Yes, technical co-founder' : 'Non-technical'}`,
      `Regions: ${profile.regions.join(', ')}`,
      `Fundraising: ${this.describeFundraising(profile.fundraising_bucket)}`,
      `Experience tags: ${profile.checkbox_tags.join(', ')}`,
      `Other info: ${profile.nl_blob}`
    ]

    return parts.filter(Boolean).join('\n')
  }

  private describeFundraising(bucket: string): string {
    switch (bucket) {
      case 'none': return 'No fundraising experience'
      case '<=500k': return 'Raised up to $500k'
      case '500k-1M': return 'Raised $500k-$1M'
      case '1M-5M': return 'Raised $1M-$5M'
      case '5M+': return 'Raised $5M or more'
      default: return 'Unknown fundraising experience'
    }
  }

  private async scoreProfile(query: string, profile: Profile, searchText: string): Promise<{ relevance: number, explanation: string }> {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 10,
      }
    })

    const prompt = `
You are evaluating how well a candidate matches a search query.

SEARCH QUERY: "${query}"

CANDIDATE INFO:
${searchText}

Analyze this candidate against the search query. Consider:
1. Direct keyword matches
2. Semantic relevance
3. Experience alignment
4. Skills matching

Return a JSON response with:
- relevance: float between 0.0 and 1.0 (0 = no match, 1 = perfect match)
- explanation: brief explanation of why this person matches or doesn't match

Be generous with relevance scores for good matches but strict about requiring actual relevance.

Examples:
- Query "mental health" + candidate with psychology background = high relevance
- Query "technical founder" + candidate marked as technical co-founder = high relevance
- Query "Africa experience" + candidate with African regions = high relevance
- Query "fundraising" + candidate with actual fundraising = high relevance

Format: {"relevance": 0.85, "explanation": "Strong match because..."}
`

    const result = await model.generateContent(prompt)
    const text = result.response.text()

    try {
      // Clean the response - remove markdown formatting
      const cleanText = text.replace(/```json\s*|\s*```/g, '').trim()
      const parsed = JSON.parse(cleanText)
      return {
        relevance: Math.max(0, Math.min(1, parsed.relevance || 0)),
        explanation: parsed.explanation || 'No explanation provided'
      }
    } catch (error) {
      console.warn('Failed to parse AI response:', text)
      return { relevance: 0, explanation: 'Failed to analyze' }
    }
  }
}