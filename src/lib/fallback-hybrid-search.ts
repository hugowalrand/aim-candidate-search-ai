import { VoyageAIClient } from 'voyageai'
import { CohereClient } from 'cohere-ai'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Profile } from '@/types'

// In-memory fallback implementation for when Typesense isn't available
export class FallbackHybridSearch {
  private voyageai: VoyageAIClient | null = null
  private cohere: CohereClient | null = null
  private gemini: GoogleGenerativeAI | null = null
  private candidates: Profile[] = []
  private embeddings: Map<string, number[]> = new Map()

  constructor() {
    // Initialize AI providers if API keys are available
    if (process.env.VOYAGE_API_KEY) {
      this.voyageai = new VoyageAIClient({
        apiKey: process.env.VOYAGE_API_KEY
      })
    }

    if (process.env.COHERE_API_KEY) {
      this.cohere = new CohereClient({
        token: process.env.COHERE_API_KEY
      })
    }

    if (process.env.GEMINI_API_KEY) {
      this.gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    }
  }

  async initialize(profiles: Profile[]): Promise<void> {
    console.log('🔄 Initializing Fallback Hybrid Search (in-memory)...')
    this.candidates = profiles

    // Generate embeddings if Voyage AI is available
    if (this.voyageai) {
      await this.generateEmbeddings(profiles)
    }

    console.log('✅ Fallback Hybrid Search ready!')
  }

  private async generateEmbeddings(profiles: Profile[]): Promise<void> {
    console.log('🧠 Generating embeddings with Voyage AI...')
    const batchSize = 100

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize)

      const texts = batch.map(profile =>
        `${profile.first_name} ${profile.last_name}. ${profile.cv_text} ${profile.nl_blob} Regions: ${profile.regions.join(', ')} Fundraising: ${profile.fundraising_bucket} Technical: ${profile.tech_cofounder ? 'Yes' : 'No'} Tags: ${profile.checkbox_tags.join(', ')}`
      )

      try {
        const response = await this.voyageai!.embed({
          input: texts,
          model: 'voyage-3.5-large',
          input_type: 'document',
          truncation: true
        })

        batch.forEach((profile, index) => {
          this.embeddings.set(profile.id, response.data[index].embedding)
        })

        console.log(`   Generated embeddings for batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(profiles.length/batchSize)}`)
      } catch (error) {
        console.warn('Voyage AI batch failed:', error)
      }
    }
  }

  async search(query: string, limit: number = 20): Promise<any[]> {
    console.log('🔍 Fallback hybrid search:', query)

    // Step 1: Parse query with OpenAI structured outputs
    const intent = await this.parseQuery(query)

    // Step 2: BM25-style keyword matching + semantic similarity
    const scoredCandidates = await this.scoreAllCandidates(query, intent)

    // Step 3: Rerank with Cohere if available
    const topCandidates = scoredCandidates.slice(0, 50)
    const rerankedResults = await this.rerankWithCohere(query, topCandidates)

    return rerankedResults.slice(0, limit)
  }

  private async parseQuery(query: string): Promise<any> {
    if (!this.gemini) {
      return this.heuristicParse(query)
    }

    try {
      const model = this.gemini.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: 0.1,
          topP: 0.8,
          topK: 10,
        }
      })

      const prompt = `Parse this candidate search query and return a JSON object with the exact structure specified below:

Query: "${query}"

Return JSON with this exact structure:
{
  "keywords": ["array", "of", "key", "terms"],
  "filters": {
    "regions": ["array of regions if mentioned"],
    "fundraising_required": boolean,
    "technical_required": boolean
  },
  "weights": {
    "keyword_match": 0.0-1.0,
    "semantic_similarity": 0.0-1.0,
    "regional_fit": 0.0-1.0,
    "fundraising_experience": 0.0-1.0,
    "technical_capability": 0.0-1.0
  }
}

Examples:
- "Technical founder" → technical_required: true, technical_capability: 0.9
- "Healthcare in Africa" → regions: ["Africa/Middle East"], regional_fit: 0.8
- "Raised Series A" → fundraising_required: true, fundraising_experience: 0.9

Return ONLY valid JSON, no explanation.`

      const result = await model.generateContent(prompt)
      const response = await result.response
      const text = response.text()

      // Clean and parse JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      throw new Error('No valid JSON found in response')
    } catch (error) {
      console.warn('Gemini parsing failed, using heuristics:', error)
      return this.heuristicParse(query)
    }
  }

  private heuristicParse(query: string): any {
    const lowerQuery = query.toLowerCase()

    return {
      keywords: query.split(/\s+/).filter(w => w.length > 2),
      filters: {
        technical_required: /technical|engineer|cto|developer/.test(lowerQuery),
        fundraising_required: /funding|raise|series|investor/.test(lowerQuery),
        regions: lowerQuery.includes('africa') ? ['Africa/Middle East'] : []
      },
      weights: {
        keyword_match: 0.3,
        semantic_similarity: this.voyageai ? 0.4 : 0,
        regional_fit: lowerQuery.includes('africa') || lowerQuery.includes('asia') ? 0.8 : 0.2,
        fundraising_experience: /funding|raise/.test(lowerQuery) ? 0.9 : 0.3,
        technical_capability: /technical/.test(lowerQuery) ? 0.9 : 0.3
      }
    }
  }

  private async scoreAllCandidates(query: string, intent: any): Promise<any[]> {
    const queryEmbedding = this.voyageai ?
      await this.getQueryEmbedding(query) : null

    const scoredCandidates = this.candidates.map(candidate => {
      const scores = {
        keyword: this.calculateKeywordScore(candidate, intent.keywords),
        semantic: queryEmbedding ? this.calculateSemanticScore(candidate, queryEmbedding) : 0,
        regional: this.calculateRegionalScore(candidate, intent.filters.regions || []),
        fundraising: this.calculateFundraisingScore(candidate),
        technical: this.calculateTechnicalScore(candidate)
      }

      // Weighted final score
      const finalScore =
        (scores.keyword * intent.weights.keyword_match) +
        (scores.semantic * intent.weights.semantic_similarity) +
        (scores.regional * intent.weights.regional_fit) +
        (scores.fundraising * intent.weights.fundraising_experience) +
        (scores.technical * intent.weights.technical_capability)

      return {
        profile: candidate,
        relevance_score: finalScore,
        match_factors: {
          bm25_score: scores.keyword,
          semantic_score: scores.semantic,
          factor_scores: {
            experience: scores.keyword,
            regional_fit: scores.regional,
            fundraising: scores.fundraising,
            technical: scores.technical,
            leadership: Math.min(candidate.score_business_dev || 0, 1)
          }
        },
        explanation: this.generateExplanation(candidate, scores, intent)
      }
    })

    return scoredCandidates.sort((a, b) => b.relevance_score - a.relevance_score)
  }

  private async getQueryEmbedding(query: string): Promise<number[] | null> {
    if (!this.voyageai) return null

    try {
      const response = await this.voyageai.embed({
        input: [query],
        model: 'voyage-3.5-large',
        input_type: 'query',
        truncation: true
      })
      return response.data[0].embedding
    } catch (error) {
      console.warn('Query embedding failed:', error)
      return null
    }
  }

  private calculateKeywordScore(candidate: Profile, keywords: string[]): number {
    const text = `${candidate.cv_text} ${candidate.nl_blob} ${candidate.checkbox_tags.join(' ')}`.toLowerCase()

    const matchedKeywords = keywords.filter(kw =>
      text.includes(kw.toLowerCase())
    )

    return matchedKeywords.length / Math.max(keywords.length, 1)
  }

  private calculateSemanticScore(candidate: Profile, queryEmbedding: number[]): number {
    const candidateEmbedding = this.embeddings.get(candidate.id)
    if (!candidateEmbedding) return 0

    // Cosine similarity
    const dotProduct = queryEmbedding.reduce((sum, q, i) => sum + q * candidateEmbedding[i], 0)
    const queryMagnitude = Math.sqrt(queryEmbedding.reduce((sum, q) => sum + q * q, 0))
    const candidateMagnitude = Math.sqrt(candidateEmbedding.reduce((sum, c) => sum + c * c, 0))

    return dotProduct / (queryMagnitude * candidateMagnitude)
  }

  private calculateRegionalScore(candidate: Profile, requiredRegions: string[]): number {
    if (requiredRegions.length === 0) return 0.5

    const matches = requiredRegions.filter(req =>
      candidate.regions.some(r => r.includes(req.replace('/Middle East', '')))
    )

    return matches.length / requiredRegions.length
  }

  private calculateFundraisingScore(candidate: Profile): number {
    const buckets = {
      'none': 0,
      '<=500k': 0.3,
      '500k-1M': 0.6,
      '1M-5M': 0.8,
      '5M+': 1.0
    }
    return buckets[candidate.fundraising_bucket] || 0
  }

  private calculateTechnicalScore(candidate: Profile): number {
    return candidate.tech_cofounder ? 1.0 : Math.max(candidate.score_tech_dev || 0, 0.2)
  }

  private async rerankWithCohere(query: string, candidates: any[]): Promise<any[]> {
    if (!this.cohere) {
      console.log('⚡ No Cohere API key, skipping rerank step')
      return candidates
    }

    try {
      const documents = candidates.map(c => {
        const profile = c.profile
        return `${profile.first_name} ${profile.last_name}: ${profile.cv_text.substring(0, 500)} Regions: ${profile.regions.join(', ')} Fundraising: ${profile.fundraising_bucket} Technical: ${profile.tech_cofounder ? 'Yes' : 'No'}`
      })

      console.log('🎯 Reranking with Cohere...')
      const rerankResponse = await this.cohere.rerank({
        model: 'rerank-v3.5',
        query,
        documents,
        topN: candidates.length,
        returnDocuments: false,
        rankFields: ['text']
      })

      return rerankResponse.results.map(result => {
        const original = candidates[result.index]
        return {
          ...original,
          rerank_score: result.relevanceScore,
          match_factors: {
            ...original.match_factors,
            rerank_score: result.relevanceScore
          }
        }
      }).sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))

    } catch (error) {
      console.warn('Cohere reranking failed:', error)
      return candidates
    }
  }

  private generateExplanation(candidate: Profile, scores: any, intent: any): string {
    const reasons = []

    if (scores.keyword > 0.6) {
      reasons.push(`Strong keyword match (${(scores.keyword * 100).toFixed(0)}%)`)
    }

    if (scores.semantic > 0.8) {
      reasons.push('Excellent semantic similarity')
    }

    if (scores.regional > 0.8) {
      reasons.push(`Regional expertise in ${candidate.regions.join(', ')}`)
    }

    if (scores.fundraising > 0.6) {
      reasons.push(`Fundraising experience (${candidate.fundraising_bucket})`)
    }

    if (scores.technical > 0.8) {
      reasons.push('Strong technical background')
    }

    return reasons.length > 0 ? reasons.join(' • ') : 'Good overall profile match'
  }
}