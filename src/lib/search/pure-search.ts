// Pure AI search - no filters, just find the best matches and explain why
import { Candidate, SearchResult } from '@/types/candidate'
import { typesenseClient } from './typesense-client'
import { EmbeddingService } from './embedding-service'
import { RerankService } from './rerank-service'
import { SimpleIntentService, SimpleQueryIntent } from './simple-intent'

export class PureSearchEngine {
  private embeddingService: EmbeddingService
  private rerankService: RerankService
  private intentService: SimpleIntentService

  constructor() {
    this.embeddingService = new EmbeddingService()
    this.rerankService = new RerankService()
    this.intentService = new SimpleIntentService()
  }

  async search(query: string, limit: number = 20): Promise<SearchResult[]> {
    console.log(`🔍 Pure AI search: "${query}"`)
    const startTime = Date.now()

    try {
      // Extract simple keywords
      const intent = this.intentService.extractIntent(query)

      // Run hybrid search - no filters, just find matches
      const [vectorResults, bm25Results] = await Promise.all([
        this.vectorSearch(query, 100),
        this.keywordSearch(query, intent, 100)
      ])

      console.log(`📊 Results: ${vectorResults.length} vector + ${bm25Results.length} keyword`)

      // Fusion using Reciprocal Rank Fusion
      const fusedResults = this.fuseResults(vectorResults, bm25Results, 50)

      // Rerank for final quality
      const rerankedResults = await this.rerankService.rerank(query, fusedResults, limit)

      // Generate smart explanations
      const finalResults = this.generateExplanations(query, rerankedResults)

      const totalTime = Date.now() - startTime
      console.log(`✅ Pure search completed in ${totalTime}ms - ${finalResults.length} results`)

      return finalResults

    } catch (error) {
      console.error('❌ Pure search failed:', error)
      return []
    }
  }

  private async vectorSearch(query: string, limit: number): Promise<Candidate[]> {
    try {
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query)
      if (queryEmbedding.length === 0) return []

      const results = await typesenseClient
        .multiSearch
        .perform({
          searches: [{
            collection: 'candidates',
            q: '*',
            vector_query: `embedding:([${queryEmbedding.join(',')}]){k:${limit}}`,
            per_page: limit,
            query_by: ''
          }]
        })

      const searchResult = results.results?.[0]
      const candidates = (searchResult?.hits || [])
        .map(hit => hit.document as Candidate)
        .filter(Boolean)

      console.log(`🧠 Vector search: ${candidates.length} results`)
      return candidates

    } catch (error) {
      console.error('❌ Vector search failed:', error)
      return []
    }
  }

  private async keywordSearch(query: string, intent: SimpleQueryIntent, limit: number): Promise<Candidate[]> {
    try {
      // Simple keyword search - no complex filtering
      const searchTerms = [query, ...intent.keywords].join(' ')

      const results = await typesenseClient
        .collections('candidates')
        .documents()
        .search({
          q: searchTerms,
          query_by: 'combined_text,full_name,headline,skills',
          per_page: limit,
          sort_by: '_text_match:desc'
        })

      const candidates = (results.hits || [])
        .map(hit => hit.document as Candidate)
        .filter(Boolean)

      console.log(`🔤 Keyword search: ${candidates.length} results`)
      return candidates

    } catch (error) {
      console.error('❌ Keyword search failed:', error)
      return []
    }
  }

  private fuseResults(vectorResults: Candidate[], keywordResults: Candidate[], limit: number): Candidate[] {
    // Reciprocal Rank Fusion
    const k = 60
    const candidateScores = new Map<string, { candidate: Candidate; score: number }>()

    // Score vector results
    vectorResults.forEach((candidate, index) => {
      const rrfScore = 1 / (k + index + 1)
      candidateScores.set(candidate.id, {
        candidate,
        score: rrfScore
      })
    })

    // Score keyword results
    keywordResults.forEach((candidate, index) => {
      const rrfScore = 1 / (k + index + 1)
      const existing = candidateScores.get(candidate.id)
      candidateScores.set(candidate.id, {
        candidate,
        score: (existing?.score || 0) + rrfScore
      })
    })

    const fusedResults = Array.from(candidateScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.candidate)

    console.log(`🔀 Fused to ${fusedResults.length} candidates`)
    return fusedResults
  }

  private generateExplanations(
    query: string,
    rerankedResults: Array<{ candidate: Candidate; rerank_score: number }>
  ): SearchResult[] {

    return rerankedResults.map(({ candidate, rerank_score }) => {
      // Analyze what makes this candidate a great match
      const queryLower = query.toLowerCase()
      const candidateText = (candidate.combined_text || '').toLowerCase()
      const headline = candidate.headline || ''
      const skills = candidate.skills || []

      // Find specific matches
      const matchReasons = []

      // Check headline relevance
      if (headline) {
        const headlineWords = headline.toLowerCase().split(/\s+/)
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2)
        const headlineMatches = queryWords.filter(qw =>
          headlineWords.some(hw => hw.includes(qw) || qw.includes(hw))
        )
        if (headlineMatches.length > 0) {
          matchReasons.push(`Strong profile match: ${headline}`)
        }
      }

      // Check skill relevance
      const relevantSkills = skills.filter(skill =>
        queryLower.split(/\s+/).some(qw =>
          skill.toLowerCase().includes(qw) || qw.includes(skill.toLowerCase())
        )
      )
      if (relevantSkills.length > 0) {
        matchReasons.push(`Relevant expertise: ${relevantSkills.slice(0, 3).join(', ')}`)
      }

      // Check technical capability if relevant
      if (queryLower.includes('technical') || queryLower.includes('tech') || queryLower.includes('engineering')) {
        if (candidate.tech_cofounder) {
          matchReasons.push('✓ Technical co-founder capability')
        }
      }

      // Check experience level
      if (candidate.years_experience) {
        matchReasons.push(`${candidate.years_experience} years of experience`)
      }

      // Check regional relevance if mentioned
      const queryRegions = ['africa', 'europe', 'asia', 'america'].filter(region =>
        queryLower.includes(region)
      )
      if (queryRegions.length > 0 && candidate.regions) {
        const matchingRegions = candidate.regions.filter(region =>
          queryRegions.some(qr => region.toLowerCase().includes(qr))
        )
        if (matchingRegions.length > 0) {
          matchReasons.push(`Experience in ${matchingRegions.join(', ')}`)
        }
      }

      // Generate a clear explanation of why this candidate is a good match
      let explanation = ''
      if (matchReasons.length > 0) {
        explanation = matchReasons.join(' • ')
      } else {
        // Fallback explanation based on rerank score
        if (rerank_score > 0.7) {
          explanation = 'Excellent semantic match for your requirements'
        } else if (rerank_score > 0.5) {
          explanation = 'Strong alignment with your search criteria'
        } else {
          explanation = 'Good potential match based on profile analysis'
        }
      }

      return {
        ...candidate,
        score: rerank_score,
        explanation,
        score_breakdown: {
          final_score: rerank_score,
          match_strength: rerank_score > 0.7 ? 'Excellent' : rerank_score > 0.5 ? 'Strong' : 'Good'
        }
      }
    })
  }
}