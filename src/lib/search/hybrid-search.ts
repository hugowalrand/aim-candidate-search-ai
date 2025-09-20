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

      // Stage B: Multi-tier search strategy for better recall
      const [vectorResults, strictBm25Results, relaxedBm25Results] = await Promise.all([
        this.vectorSearch(query, 100),
        this.bm25Search(query, intent, 100), // Strict search with filters
        this.relaxedBm25Search(query, intent, 150) // Relaxed search for more results
      ])

      // Combine BM25 results (strict + relaxed) and deduplicate
      const allBm25Results = this.deduplicateCandidates([...strictBm25Results, ...relaxedBm25Results])

      console.log(`📊 Search results: ${vectorResults.length} vector + ${strictBm25Results.length} strict BM25 + ${relaxedBm25Results.length} relaxed BM25 = ${allBm25Results.length} total BM25`)

      // Stage C: Fusion (Reciprocal Rank Fusion)
      const fusedResults = this.fuseResults(vectorResults, allBm25Results, Math.min(100, allBm25Results.length + vectorResults.length))

      // Stage D: Cross-encoder reranking with Cohere
      const rerankedResults = await this.rerankService.rerank(query, fusedResults, limit)

      // Stage E: Generate explanations
      const finalResults = this.generateExplanations(
        query,
        intent,
        rerankedResults,
        vectorResults,
        allBm25Results
      )

      const totalTime = Date.now() - startTime
      console.log(`✅ Hybrid search completed in ${totalTime}ms`)
      console.log(`📊 Pipeline: ${vectorResults.length} vector + ${allBm25Results.length} BM25 → ${fusedResults.length} fused → ${finalResults.length} final`)

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
        vector_query: `embedding:([${queryEmbedding.join(',')}]){k:${limit}}`,
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

  private expandDomainKeywords(keywords: string[]): string[] {
    const domainExpansions: { [key: string]: string[] } = {
      // Healthcare domain expansions
      'healthcare': ['healthcare', 'biotech', 'pharma', 'pharmaceutical', 'medical', 'clinical', 'drug discovery', 'precision medicine', 'digital health', 'health tech', 'life sciences'],
      'health': ['health', 'healthcare', 'biotech', 'medical', 'clinical', 'wellness', 'digital health'],
      'medical': ['medical', 'healthcare', 'clinical', 'biotech', 'pharma', 'drug discovery'],
      'biotech': ['biotech', 'biotechnology', 'life sciences', 'pharmaceutical', 'drug discovery', 'clinical trials', 'precision medicine'],
      'pharma': ['pharma', 'pharmaceutical', 'drug discovery', 'biotech', 'clinical trials', 'regulatory affairs'],

      // Tech domain expansions
      'AI': ['AI', 'artificial intelligence', 'machine learning', 'ML', 'deep learning', 'neural networks', 'LLM'],
      'machine learning': ['machine learning', 'ML', 'AI', 'artificial intelligence', 'deep learning', 'data science'],
      'blockchain': ['blockchain', 'crypto', 'cryptocurrency', 'DeFi', 'web3', 'smart contracts', 'distributed ledger'],
      'fintech': ['fintech', 'financial technology', 'payments', 'banking', 'trading', 'cryptocurrency', 'blockchain'],

      // Business expansions
      'startup': ['startup', 'entrepreneur', 'founder', 'early stage', 'venture'],
      'founder': ['founder', 'cofounder', 'co-founder', 'entrepreneur', 'CEO', 'startup'],
      'enterprise': ['enterprise', 'B2B', 'corporate', 'business', 'commercial', 'SaaS'],

      // Experience expansions
      'Series A': ['Series A', 'fundraising', 'venture capital', 'investment', 'funding round'],
      'fundraising': ['fundraising', 'Series A', 'Series B', 'venture capital', 'investment', 'funding'],

      // Regional expansions
      'Europe': ['Europe', 'European', 'EU', 'London', 'Berlin', 'Paris', 'Amsterdam'],
      'Africa': ['Africa', 'African', 'Nigeria', 'Kenya', 'South Africa', 'Ghana'],
      'Asia': ['Asia', 'Asian', 'Singapore', 'India', 'China', 'Japan', 'Southeast Asia']
    }

    const expandedSet = new Set(keywords)

    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase()
      if (domainExpansions[lowerKeyword]) {
        domainExpansions[lowerKeyword].forEach(synonym => expandedSet.add(synonym))
      }
    }

    return Array.from(expandedSet)
  }

  private async bm25Search(query: string, intent: QueryIntent, limit: number): Promise<Candidate[]> {
    try {
      // Expand keywords with domain synonyms for better semantic matching
      const expandedKeywords = this.expandDomainKeywords([
        ...intent.must_have_keywords,
        ...intent.nice_to_have_keywords
      ])

      // Build search query with expanded keywords
      const searchTerms = [
        ...expandedKeywords,
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
        // Filter for candidates with actual fundraising stages (not None, null or empty)
        filterClauses.push('fundraising_stage:[* TO *] && fundraising_stage:!=None')
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
      // Detailed match analysis
      const matches = []
      const warnings = []

      // Query term analysis - check which specific terms from the query match
      const queryTerms = query.toLowerCase().split(/\s+/)
      const candidateText = (candidate.combined_text || '').toLowerCase()
      const matchedQueryTerms = queryTerms.filter(term =>
        candidateText.includes(term) && term.length > 2 // Skip short words
      )

      if (matchedQueryTerms.length > 0) {
        matches.push(`Query terms: ${matchedQueryTerms.join(', ')}`)
      }

      // Intent keyword matches with detailed breakdown
      const mustHaveMatches = intent.must_have_keywords.filter(keyword =>
        candidateText.includes(keyword.toLowerCase())
      )
      const niceToHaveMatches = intent.nice_to_have_keywords.filter(keyword =>
        candidateText.includes(keyword.toLowerCase())
      )

      if (mustHaveMatches.length > 0) {
        matches.push(`Core requirements: ${mustHaveMatches.join(', ')}`)
      }
      if (niceToHaveMatches.length > 0) {
        matches.push(`Additional matches: ${niceToHaveMatches.join(', ')}`)
      }

      // Missing critical requirements
      const missingMustHave = intent.must_have_keywords.filter(keyword =>
        !candidateText.includes(keyword.toLowerCase())
      )
      if (missingMustHave.length > 0) {
        warnings.push(`Missing: ${missingMustHave.join(', ')}`)
      }

      // Regional analysis
      if (candidate.regions && intent.regions.length > 0) {
        const regionMatches = candidate.regions.filter(region =>
          intent.regions.some(ir => ir.toLowerCase() === region.toLowerCase())
        )
        if (regionMatches.length > 0) {
          matches.push(`Target regions: ${regionMatches.join(', ')}`)
        } else {
          warnings.push(`Regions: ${candidate.regions.join(', ')} (not preferred: ${intent.regions.join(', ')})`)
        }
      }

      // Technical capability analysis
      if (intent.tech_required) {
        if (candidate.tech_cofounder) {
          matches.push('✓ Technical co-founder capability')
        } else {
          warnings.push('⚠ Not a technical co-founder')
        }
      }

      // Fundraising experience analysis
      if (intent.fundraising_required) {
        if (candidate.fundraising_stage && candidate.fundraising_stage !== 'None') {
          matches.push(`✓ Fundraising experience: ${candidate.fundraising_stage}`)
        } else {
          warnings.push('⚠ No fundraising experience')
        }
      }

      // Skills analysis
      if (candidate.skills && candidate.skills.length > 0) {
        const relevantSkills = candidate.skills.filter(skill =>
          queryTerms.some(term => skill.toLowerCase().includes(term))
        )
        if (relevantSkills.length > 0) {
          matches.push(`Relevant skills: ${relevantSkills.join(', ')}`)
        }
      }

      // Experience level
      if (candidate.years_experience) {
        matches.push(`${candidate.years_experience} years experience`)
      }

      // Calculate detailed score breakdown
      const vectorRank = vectorResults.findIndex(c => c.id === candidate.id)
      const bm25Rank = bm25Results.findIndex(c => c.id === candidate.id)

      // More sophisticated scoring
      const keywordMatchRatio = matchedQueryTerms.length / Math.max(queryTerms.length, 1)
      const intentMatchRatio = mustHaveMatches.length / Math.max(intent.must_have_keywords.length, 1)

      const score_breakdown = {
        bm25_score: bm25Rank >= 0 ? Math.max(0, 1 - (bm25Rank / 100)) : 0,
        vector_score: vectorRank >= 0 ? Math.max(0, 1 - (vectorRank / 100)) : 0,
        rerank_score: rerank_score,
        keyword_match_ratio: keywordMatchRatio,
        intent_match_ratio: intentMatchRatio,
        regional_match: (candidate.regions?.some(r => intent.regions.includes(r))) ? 0.9 : 0.1,
        fundraising_match: (candidate.fundraising_stage && candidate.fundraising_stage !== 'None') ? 0.8 : 0.2,
        technical_match: candidate.tech_cofounder ? 0.9 : 0.1,
        final_score: rerank_score
      }

      // Generate comprehensive explanation
      let explanation = ''

      if (matches.length > 0) {
        explanation += `✅ ${matches.join(' • ')}`
      }

      if (warnings.length > 0) {
        explanation += (explanation ? ' | ' : '') + `⚠️ ${warnings.join(' • ')}`
      }

      if (!explanation) {
        explanation = `Matched ${matchedQueryTerms.length}/${queryTerms.length} query terms (${Math.round(keywordMatchRatio * 100)}% match)`
      }

      // Add search method indicator
      const searchMethod = vectorRank >= 0 && bm25Rank >= 0 ? 'Hybrid' :
                          vectorRank >= 0 ? 'Semantic' : 'Keyword'

      return {
        ...candidate,
        score: Math.round(rerank_score * 100),
        explanation: `[${searchMethod}] ${explanation}`,
        score_breakdown
      }
    })
  }

  private async relaxedBm25Search(query: string, intent: QueryIntent, limit: number): Promise<Candidate[]> {
    try {
      // More relaxed search - just keywords without strict filtering
      const searchTerms = [
        ...intent.must_have_keywords,
        ...intent.nice_to_have_keywords,
        query
      ].filter(Boolean).join(' ')

      console.log('🔤 Relaxed BM25 search terms:', searchTerms)

      // Only add region preference (not requirement) if specified
      const softFilters = []
      if (intent.regions.length > 0) {
        // Use regions as ranking factors rather than strict filters
        const regionBoost = intent.regions
          .map(region => `regions:${region}^2`)
          .join(' OR ')
      }

      const searchParams = {
        q: searchTerms || query,
        query_by: 'combined_text,full_name,headline,skills', // Fixed: only use available schema fields
        per_page: limit,
        sort_by: '_text_match:desc'
        // No strict filters - rely on ranking
      }

      console.log('🔤 Relaxed BM25 search params:', searchParams)

      const results = await typesenseClient
        .collections('candidates')
        .documents()
        .search(searchParams)

      console.log('🔤 Relaxed BM25 search results:', {
        found: results.found,
        out_of: results.out_of,
        hits_count: results.hits?.length || 0
      })

      const candidates = (results.hits || [])
        .map(hit => hit.document as Candidate)
        .filter(Boolean)

      console.log(`🔤 Relaxed BM25 search: ${candidates.length} results`)
      return candidates

    } catch (error) {
      console.error('❌ Relaxed BM25 search failed:', error)
      return []
    }
  }

  private deduplicateCandidates(candidates: Candidate[]): Candidate[] {
    const seen = new Set<string>()
    const unique: Candidate[] = []

    for (const candidate of candidates) {
      if (!seen.has(candidate.id)) {
        seen.add(candidate.id)
        unique.push(candidate)
      }
    }

    console.log(`🔧 Deduplicated ${candidates.length} → ${unique.length} candidates`)
    return unique
  }
}