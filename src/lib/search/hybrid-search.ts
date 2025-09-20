// Production hybrid search engine following expert recommendations
import { Candidate, QueryIntent, SearchResult } from '@/types/candidate'
import { typesenseClient } from './typesense-client'
import { EmbeddingService } from './embedding-service'
import { IntentExtractionService } from './intent-extraction'
import { RerankService } from './rerank-service'

export class HybridSearchEngine {
  private embeddingService: EmbeddingService
  private intentService: IntentExtractionService
  private rerankService: RerankService

  constructor() {
    this.embeddingService = new EmbeddingService()
    this.intentService = new IntentExtractionService()
    this.rerankService = new RerankService()
  }

  async search(query: string, limit: number = 20): Promise<SearchResult[]> {
    console.log(`🔍 Starting hybrid search: "${query}"`)
    const startTime = Date.now()

    try {
      // Stage A: Intent extraction with Gemini 2.5 Flash
      const intent = await this.intentService.extractIntent(query)

      // Stage B: Dual retrieval (Vector + BM25)
      const [vectorResults, bm25Results] = await Promise.all([
        this.vectorSearch(query, 100),
        this.bm25Search(query, intent, 100)
      ])

      // Stage C: Fusion (Reciprocal Rank Fusion)
      const fusedResults = this.fuseResults(vectorResults, bm25Results, 50)

      // Stage D: Cross-encoder reranking with Cohere
      const rerankedResults = await this.rerankService.rerank(query, fusedResults, limit)

      // Stage E: Generate explanations
      const finalResults = this.generateExplanations(
        query,
        intent,
        rerankedResults,
        vectorResults,
        bm25Results
      )

      const totalTime = Date.now() - startTime
      console.log(`✅ Hybrid search completed in ${totalTime}ms`)
      console.log(`📊 Pipeline: ${vectorResults.length} vector + ${bm25Results.length} BM25 → ${fusedResults.length} fused → ${finalResults.length} final`)

      return finalResults

    } catch (error) {
      console.error('❌ Hybrid search failed:', error)

      // Fallback to simple BM25 search
      console.log('🔧 Falling back to BM25-only search')
      const fallbackResults = await this.bm25Search(query, {
        must_have_keywords: query.split(' '),
        nice_to_have_keywords: [],
        regions: [],
        exclude_regions: [],
        fundraising_required: false,
        tech_required: false,
        weights: { lexical: 1, semantic: 0, regional: 0, fundraising: 0, technical: 0 }
      }, limit)

      return fallbackResults.map(candidate => ({
        ...candidate,
        score: 50, // Default fallback score
        explanation: 'Fallback search result (keyword matching only)',
        score_breakdown: {
          bm25_score: 0.5,
          vector_score: 0,
          rerank_score: 0,
          regional_match: 0,
          fundraising_match: 0,
          technical_match: 0,
          final_score: 0.5
        }
      }))
    }
  }

  private async vectorSearch(query: string, limit: number): Promise<Candidate[]> {
    try {
      console.log('🧠 Generating query embedding...')
      const queryEmbedding = await this.embeddingService.generateQueryEmbedding(query)
      console.log(`🧠 Query embedding length: ${queryEmbedding.length}`)

      if (queryEmbedding.length === 0) {
        console.warn('⚠️ No query embedding available, skipping vector search')
        return []
      }

      const searchParams = {
        q: '*',
        vector_query: `embedding:(${queryEmbedding.join(',')}){k:${limit}}`,
        per_page: limit,
        query_by: ''
      }

      console.log('🧠 Executing vector search with params:', {
        q: searchParams.q,
        vector_query: `embedding:([${queryEmbedding.length} dimensions]){k:${limit}}`,
        per_page: searchParams.per_page
      })

      // Use POST for multi_search to handle large vectors
      const results = await typesenseClient
        .multiSearch
        .perform({
          searches: [{
            ...searchParams,
            collection: 'candidates'
          }]
        })

      const searchResult = results.results?.[0]
      console.log('🧠 Raw vector search results:', {
        found: searchResult?.found || 0,
        out_of: searchResult?.out_of || 0,
        hits_count: searchResult?.hits?.length || 0
      })

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

  private async bm25Search(query: string, intent: QueryIntent, limit: number): Promise<Candidate[]> {
    try {
      // Build search query with keywords
      const searchTerms = [
        ...intent.must_have_keywords,
        ...intent.nice_to_have_keywords,
        query // Include original query
      ].filter(Boolean).join(' ')

      console.log('🔤 BM25 search terms:', searchTerms)
      console.log('🔤 Intent keywords:', {
        must_have: intent.must_have_keywords,
        nice_to_have: intent.nice_to_have_keywords
      })

      // Build filter query
      const filterClauses = []

      if (intent.regions.length > 0) {
        const regionFilter = intent.regions
          .map(region => `regions:${region}`)
          .join(' || ')
        filterClauses.push(`(${regionFilter})`)
      }

      if (intent.exclude_regions.length > 0) {
        const excludeFilter = intent.exclude_regions
          .map(region => `regions:!=${region}`)
          .join(' && ')
        filterClauses.push(`(${excludeFilter})`)
      }

      if (intent.tech_required) {
        filterClauses.push('tech_cofounder:true')
      }

      if (intent.fundraising_required) {
        filterClauses.push('fundraising_stage:!=""')
      }

      const searchParams = {
        q: searchTerms || query,
        query_by: 'combined_text,full_name,headline,skills',
        filter_by: filterClauses.length > 0 ? filterClauses.join(' && ') : undefined,
        per_page: limit,
        sort_by: '_text_match:desc'
      }

      console.log('🔤 BM25 search params:', searchParams)

      const results = await typesenseClient
        .collections('candidates')
        .documents()
        .search(searchParams)

      console.log('🔤 Raw BM25 search results:', {
        found: results.found,
        out_of: results.out_of,
        hits_count: results.hits?.length || 0
      })

      const candidates = (results.hits || [])
        .map(hit => hit.document as Candidate)
        .filter(Boolean)

      console.log(`🔤 BM25 search: ${candidates.length} results`)
      return candidates

    } catch (error) {
      console.error('❌ BM25 search failed:', error)
      return []
    }
  }

  private fuseResults(vectorResults: Candidate[], bm25Results: Candidate[], limit: number): Candidate[] {
    // Reciprocal Rank Fusion (RRF) - more robust than weighted combination
    const k = 60 // RRF constant
    const candidateScores = new Map<string, { candidate: Candidate; score: number }>()

    // Score vector results
    vectorResults.forEach((candidate, index) => {
      const rrfScore = 1 / (k + index + 1)
      candidateScores.set(candidate.id, {
        candidate,
        score: (candidateScores.get(candidate.id)?.score || 0) + rrfScore
      })
    })

    // Score BM25 results
    bm25Results.forEach((candidate, index) => {
      const rrfScore = 1 / (k + index + 1)
      const existing = candidateScores.get(candidate.id)
      candidateScores.set(candidate.id, {
        candidate,
        score: (existing?.score || 0) + rrfScore
      })
    })

    // Sort by fused score and return top results
    const fusedResults = Array.from(candidateScores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(result => result.candidate)

    console.log(`🔀 Fused to ${fusedResults.length} candidates using RRF`)
    return fusedResults
  }

  private generateExplanations(
    query: string,
    intent: QueryIntent,
    rerankedResults: Array<{ candidate: Candidate; rerank_score: number }>,
    vectorResults: Candidate[],
    bm25Results: Candidate[]
  ): SearchResult[] {
    return rerankedResults.map(({ candidate, rerank_score }, index) => {
      // Calculate match explanations
      const matches = []

      // Keyword matches
      const keywordMatches = intent.must_have_keywords.filter(keyword =>
        candidate.combined_text?.toLowerCase().includes(keyword.toLowerCase())
      )
      if (keywordMatches.length > 0) {
        matches.push(`Keywords: ${keywordMatches.join(', ')}`)
      }

      // Regional matches
      if (candidate.regions && intent.regions.length > 0) {
        const regionMatches = candidate.regions.filter(region =>
          intent.regions.some(ir => ir.toLowerCase() === region.toLowerCase())
        )
        if (regionMatches.length > 0) {
          matches.push(`Regions: ${regionMatches.join(', ')}`)
        }
      }

      // Technical match
      if (intent.tech_required && candidate.tech_cofounder) {
        matches.push('Technical co-founder')
      }

      // Fundraising match
      if (intent.fundraising_required && candidate.fundraising_stage && candidate.fundraising_stage !== 'None') {
        matches.push(`Fundraising: ${candidate.fundraising_stage}`)
      }

      // Calculate score breakdown
      const vectorRank = vectorResults.findIndex(c => c.id === candidate.id)
      const bm25Rank = bm25Results.findIndex(c => c.id === candidate.id)

      const score_breakdown = {
        bm25_score: bm25Rank >= 0 ? 1 - (bm25Rank / 100) : 0,
        vector_score: vectorRank >= 0 ? 1 - (vectorRank / 100) : 0,
        rerank_score: rerank_score,
        regional_match: (candidate.regions?.length && intent.regions.length) ? 0.8 : 0.2,
        fundraising_match: (candidate.fundraising_stage && candidate.fundraising_stage !== 'None') ? 0.8 : 0.2,
        technical_match: candidate.tech_cofounder ? 0.9 : 0.1,
        final_score: rerank_score
      }

      return {
        ...candidate,
        score: Math.round(rerank_score * 100),
        explanation: matches.length > 0
          ? `Strong match: ${matches.join(' • ')}`
          : 'Semantic similarity match',
        score_breakdown
      }
    })
  }
}