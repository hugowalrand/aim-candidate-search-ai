import Typesense from 'typesense'
import { VoyageAIClient } from 'voyageai'
import { CohereClient } from 'cohere-ai'
import OpenAI from 'openai'
import type { Profile } from '@/types'

interface SearchIntent {
  query: string
  keywords: string[]
  filters: {
    regions?: string[]
    fundraising_level?: string[]
    technical_required?: boolean
    experience_areas?: string[]
  }
  weights: {
    experience: number
    regional_fit: number
    fundraising: number
    technical: number
    leadership: number
  }
}

interface CandidateMatch {
  profile: Profile
  relevance_score: number
  rerank_score?: number
  explanation: string
  match_factors: {
    bm25_score: number
    semantic_score: number
    rerank_score?: number
    factor_scores: Record<string, number>
  }
}

export class HybridSearchEngine {
  private typesense: Typesense.Client
  private voyageai: VoyageAIClient
  private cohere: CohereClient
  private openai: OpenAI
  private collectionName = 'aim_candidates'

  constructor() {
    // Initialize Typesense (local for development, cloud for production)
    this.typesense = new Typesense.Client({
      nodes: [{
        host: process.env.TYPESENSE_HOST || 'localhost',
        port: parseInt(process.env.TYPESENSE_PORT || '8108'),
        protocol: process.env.TYPESENSE_PROTOCOL || 'http'
      }],
      apiKey: process.env.TYPESENSE_API_KEY || 'development-key',
      connectionTimeoutSeconds: 10
    })

    // Initialize AI providers
    this.voyageai = new VoyageAIClient({
      apiKey: process.env.VOYAGE_API_KEY
    })

    this.cohere = new CohereClient({
      token: process.env.COHERE_API_KEY
    })

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
  }

  async initialize(profiles: Profile[]): Promise<void> {
    console.log('🚀 Initializing Hybrid Search Engine...')

    // Create collection schema
    await this.createCollectionSchema()

    // Generate embeddings and index documents
    await this.indexCandidates(profiles)

    console.log('✅ Hybrid Search Engine ready!')
  }

  private async createCollectionSchema(): Promise<void> {
    try {
      // Drop existing collection
      await this.typesense.collections(this.collectionName).delete()
    } catch (error) {
      // Collection doesn't exist, that's fine
    }

    // Create collection with hybrid search support
    const schema = {
      name: this.collectionName,
      fields: [
        // Text fields for BM25
        { name: 'id', type: 'string' },
        { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' },
        { name: 'full_name', type: 'string' },
        { name: 'email', type: 'string', optional: true },
        { name: 'linkedin_url', type: 'string', optional: true },
        { name: 'cv_url', type: 'string' },

        // Rich text for semantic search
        { name: 'cv_text', type: 'string' },
        { name: 'nl_blob', type: 'string' },
        { name: 'combined_text', type: 'string' }, // For search

        // Structured filters
        { name: 'regions', type: 'string[]' },
        { name: 'fundraising_bucket', type: 'string' },
        { name: 'tech_cofounder', type: 'bool' },
        { name: 'checkbox_tags', type: 'string[]' },

        // Numeric scores
        { name: 'score_tech_dev', type: 'float' },
        { name: 'score_business_dev', type: 'float' },
        { name: 'score_design', type: 'float' },
        { name: 'score_marketing', type: 'float' },
        { name: 'score_operations', type: 'float' },
        { name: 'score_fundraising', type: 'float' },

        // Vector embedding for semantic search
        { name: 'embedding', type: 'float[]', embed: {
          from: ['combined_text'],
          model_config: {
            model_name: 'voyage-3.5-large',  // Latest Voyage model
            api_key: process.env.VOYAGE_API_KEY
          }
        }}
      ],
      default_sorting_field: 'score_fundraising'
    }

    await this.typesense.collections().create(schema)
    console.log('✅ Created Typesense collection with hybrid search schema')
  }

  private async indexCandidates(profiles: Profile[]): Promise<void> {
    console.log(`📊 Indexing ${profiles.length} candidates with embeddings...`)

    // Batch process embeddings
    const batchSize = 100
    const documents = []

    for (let i = 0; i < profiles.length; i += batchSize) {
      const batch = profiles.slice(i, i + batchSize)

      // Prepare text for embedding
      const textsToEmbed = batch.map(profile => {
        return `${profile.first_name} ${profile.last_name}. ${profile.cv_text} ${profile.nl_blob} Regions: ${profile.regions.join(', ')} Fundraising: ${profile.fundraising_bucket} Technical: ${profile.tech_cofounder ? 'Yes' : 'No'} Tags: ${profile.checkbox_tags.join(', ')}`
      })

      // Generate embeddings with Voyage AI
      let embeddings: number[][] = []
      if (process.env.VOYAGE_API_KEY) {
        try {
          const embeddingResponse = await this.voyageai.embed({
            input: textsToEmbed,
            model: 'voyage-3.5-large',
            input_type: 'document',
            truncation: true
          })
          embeddings = embeddingResponse.data.map(d => d.embedding)
        } catch (error) {
          console.warn('Voyage AI embedding failed, using zero vectors:', error)
          embeddings = textsToEmbed.map(() => new Array(1024).fill(0))
        }
      } else {
        embeddings = textsToEmbed.map(() => new Array(1024).fill(0))
      }

      // Prepare documents for Typesense
      const batchDocuments = batch.map((profile, index) => ({
        id: profile.id,
        first_name: profile.first_name,
        last_name: profile.last_name,
        full_name: `${profile.first_name} ${profile.last_name}`,
        email: profile.email || '',
        linkedin_url: profile.linkedin_url || '',
        cv_url: profile.cv_url,
        cv_text: profile.cv_text,
        nl_blob: profile.nl_blob,
        combined_text: textsToEmbed[index],
        regions: profile.regions,
        fundraising_bucket: profile.fundraising_bucket,
        tech_cofounder: profile.tech_cofounder,
        checkbox_tags: profile.checkbox_tags,
        score_tech_dev: profile.score_tech_dev,
        score_business_dev: profile.score_business_dev,
        score_design: profile.score_design,
        score_marketing: profile.score_marketing,
        score_operations: profile.score_operations,
        score_fundraising: profile.score_fundraising,
        embedding: embeddings[index]
      }))

      documents.push(...batchDocuments)
      console.log(`   Processed batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(profiles.length/batchSize)}`)
    }

    // Index all documents
    await this.typesense.collections(this.collectionName).documents().import(documents, {
      action: 'upsert'
    })

    console.log('✅ All candidates indexed with embeddings')
  }

  async search(queryText: string, limit: number = 20): Promise<CandidateMatch[]> {
    console.log(`🔍 Hybrid search: "${queryText}"`)

    // Step 1: Parse query intent with OpenAI Structured Outputs
    const intent = await this.parseQueryIntent(queryText)
    console.log('🧠 Parsed intent:', JSON.stringify(intent, null, 2))

    // Step 2: Hybrid search (BM25 + Vector) - retrieve top 200
    const hybridResults = await this.hybridRetrieve(queryText, intent, 200)
    console.log(`📊 Retrieved ${hybridResults.length} candidates from hybrid search`)

    // Step 3: Rerank top 50 with Cohere
    const topCandidates = hybridResults.slice(0, 50)
    const rerankedResults = await this.rerankCandidates(queryText, intent, topCandidates)
    console.log(`🎯 Reranked ${rerankedResults.length} candidates`)

    // Step 4: Return top results with explanations
    return rerankedResults.slice(0, limit)
  }

  private async parseQueryIntent(query: string): Promise<SearchIntent> {
    if (!process.env.OPENAI_API_KEY) {
      return this.fallbackQueryParsing(query)
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
          role: 'system',
          content: `Parse candidate search queries into structured filters and weights. Extract:
- keywords: key search terms
- filters: regions, fundraising_level, technical_required, experience_areas
- weights: importance (0-1) for experience, regional_fit, fundraising, technical, leadership`
        }, {
          role: 'user',
          content: query
        }],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "search_intent",
            schema: {
              type: "object",
              properties: {
                keywords: { type: "array", items: { type: "string" }},
                filters: {
                  type: "object",
                  properties: {
                    regions: { type: "array", items: { type: "string" }},
                    fundraising_level: { type: "array", items: { type: "string" }},
                    technical_required: { type: "boolean" },
                    experience_areas: { type: "array", items: { type: "string" }}
                  },
                  additionalProperties: false
                },
                weights: {
                  type: "object",
                  properties: {
                    experience: { type: "number", minimum: 0, maximum: 1 },
                    regional_fit: { type: "number", minimum: 0, maximum: 1 },
                    fundraising: { type: "number", minimum: 0, maximum: 1 },
                    technical: { type: "number", minimum: 0, maximum: 1 },
                    leadership: { type: "number", minimum: 0, maximum: 1 }
                  },
                  required: ["experience", "regional_fit", "fundraising", "technical", "leadership"],
                  additionalProperties: false
                }
              },
              required: ["keywords", "filters", "weights"],
              additionalProperties: false
            }
          }
        }
      })

      const parsed = JSON.parse(response.choices[0].message.content || '{}')
      return {
        query,
        ...parsed
      }
    } catch (error) {
      console.warn('OpenAI parsing failed, using fallback:', error)
      return this.fallbackQueryParsing(query)
    }
  }

  private fallbackQueryParsing(query: string): SearchIntent {
    const lowerQuery = query.toLowerCase()

    return {
      query,
      keywords: query.split(' ').filter(w => w.length > 2),
      filters: {
        technical_required: /technical|engineering|cto/.test(lowerQuery),
        regions: lowerQuery.includes('africa') ? ['Africa/Middle East'] :
                lowerQuery.includes('asia') ? ['Asia Pacific'] : [],
        fundraising_level: /series a|1m/.test(lowerQuery) ? ['1M-5M'] :
                          /series b|10m/.test(lowerQuery) ? ['5M+'] : [],
        experience_areas: []
      },
      weights: {
        experience: 0.8,
        regional_fit: lowerQuery.includes('africa') || lowerQuery.includes('asia') ? 0.9 : 0.3,
        fundraising: /funding|raise/.test(lowerQuery) ? 0.9 : 0.4,
        technical: /technical|engineering/.test(lowerQuery) ? 0.9 : 0.4,
        leadership: /lead|manage|founder/.test(lowerQuery) ? 0.8 : 0.5
      }
    }
  }

  private async hybridRetrieve(query: string, intent: SearchIntent, k: number): Promise<any[]> {
    // Build Typesense search parameters
    const searchParameters: any = {
      q: query,
      query_by: 'combined_text,full_name,cv_text,nl_blob,checkbox_tags',

      // Hybrid search: combine BM25 + vector search
      vector_query: 'embedding:(' + query + ', k:100)',

      // Filters from intent
      filter_by: this.buildFilters(intent.filters),

      // Sort and limit
      sort_by: '_text_match:desc,score_fundraising:desc',
      per_page: k,

      // Include match score
      include_fields: '*',
      exclude_fields: 'embedding' // Don't return large embedding vectors
    }

    const results = await this.typesense.collections(this.collectionName)
      .documents()
      .search(searchParameters)

    return results.hits || []
  }

  private buildFilters(filters: SearchIntent['filters']): string {
    const conditions = []

    if (filters.regions && filters.regions.length > 0) {
      const regionFilter = filters.regions.map(r => `regions:=${r}`).join(' || ')
      conditions.push(`(${regionFilter})`)
    }

    if (filters.fundraising_level && filters.fundraising_level.length > 0) {
      const fundingFilter = filters.fundraising_level.map(f => `fundraising_bucket:=${f}`).join(' || ')
      conditions.push(`(${fundingFilter})`)
    }

    if (filters.technical_required) {
      conditions.push('tech_cofounder:=true')
    }

    return conditions.join(' && ')
  }

  private async rerankCandidates(query: string, intent: SearchIntent, candidates: any[]): Promise<CandidateMatch[]> {
    if (!process.env.COHERE_API_KEY) {
      // Fallback: use hybrid scores only
      return candidates.map(hit => this.createCandidateMatch(hit, intent, hit.document))
    }

    try {
      // Prepare documents for reranking
      const documents = candidates.map(hit => {
        const doc = hit.document
        return `${doc.full_name}: ${doc.cv_text.substring(0, 500)} Regions: ${doc.regions.join(', ')} Fundraising: ${doc.fundraising_bucket} Technical: ${doc.tech_cofounder ? 'Yes' : 'No'}`
      })

      // Rerank with Cohere
      const rerankResponse = await this.cohere.rerank({
        model: 'rerank-v3.5',
        query,
        documents,
        topN: candidates.length,
        returnDocuments: false,
        rankFields: ['text']
      })

      // Combine rerank scores with original results
      const reranked = rerankResponse.results.map(result => {
        const originalHit = candidates[result.index]
        const candidateMatch = this.createCandidateMatch(originalHit, intent, originalHit.document)

        // Enhance with rerank score
        candidateMatch.rerank_score = result.relevanceScore
        candidateMatch.match_factors.rerank_score = result.relevanceScore

        return candidateMatch
      })

      // Sort by rerank score
      return reranked.sort((a, b) => (b.rerank_score || 0) - (a.rerank_score || 0))

    } catch (error) {
      console.warn('Cohere reranking failed, using hybrid scores:', error)
      return candidates.map(hit => this.createCandidateMatch(hit, intent, hit.document))
    }
  }

  private createCandidateMatch(hit: any, intent: SearchIntent, document: any): CandidateMatch {
    const bm25Score = hit.text_match_info?.score || hit.hybrid_search_info?.rank_fusion_score || 0
    const semanticScore = hit.vector_distance || 0

    // Calculate factor scores
    const factorScores = {
      experience: this.calculateExperienceScore(document, intent),
      regional_fit: this.calculateRegionalFitScore(document, intent),
      fundraising: this.calculateFundraisingScore(document),
      technical: this.calculateTechnicalScore(document),
      leadership: this.calculateLeadershipScore(document)
    }

    // Weighted relevance score
    const relevanceScore = Object.entries(factorScores).reduce((sum, [factor, score]) => {
      const weight = intent.weights[factor] || 0.5
      return sum + (score * weight)
    }, 0) / Object.keys(factorScores).length

    return {
      profile: document as Profile,
      relevance_score: relevanceScore,
      explanation: this.generateExplanation(document, factorScores, intent),
      match_factors: {
        bm25_score: bm25Score,
        semantic_score: semanticScore,
        factor_scores: factorScores
      }
    }
  }

  private calculateExperienceScore(doc: any, intent: SearchIntent): number {
    const text = (doc.cv_text + ' ' + doc.nl_blob).toLowerCase()
    const keywords = intent.keywords.join(' ').toLowerCase()

    const matchCount = intent.keywords.filter(kw =>
      text.includes(kw.toLowerCase())
    ).length

    return Math.min(matchCount / Math.max(intent.keywords.length, 1), 1)
  }

  private calculateRegionalFitScore(doc: any, intent: SearchIntent): number {
    if (!intent.filters.regions || intent.filters.regions.length === 0) {
      return 0.5 // neutral
    }

    const matches = intent.filters.regions.filter(reqRegion =>
      doc.regions.some(r => r.includes(reqRegion.replace('/Middle East', '')))
    )

    return matches.length / intent.filters.regions.length
  }

  private calculateFundraisingScore(doc: any): number {
    const buckets = {
      'none': 0,
      '<=500k': 0.3,
      '500k-1M': 0.6,
      '1M-5M': 0.8,
      '5M+': 1.0
    }
    return buckets[doc.fundraising_bucket] || 0
  }

  private calculateTechnicalScore(doc: any): number {
    return doc.tech_cofounder ? 1.0 : Math.max(doc.score_tech_dev || 0, 0.2)
  }

  private calculateLeadershipScore(doc: any): number {
    const leadershipTags = doc.checkbox_tags.filter(tag =>
      tag.includes('lead') || tag.includes('manage') || tag.includes('founder')
    ).length
    return Math.min((leadershipTags * 0.3) + (doc.score_business_dev || 0), 1.0)
  }

  private generateExplanation(doc: any, scores: Record<string, number>, intent: SearchIntent): string {
    const reasons = []

    if (scores.experience > 0.7) {
      reasons.push(`Strong experience match (${(scores.experience * 100).toFixed(0)}%)`)
    }

    if (scores.regional_fit > 0.8) {
      reasons.push(`Excellent regional fit - operates in ${doc.regions.join(', ')}`)
    }

    if (scores.fundraising > 0.6) {
      reasons.push(`Proven fundraising experience (${doc.fundraising_bucket})`)
    }

    if (scores.technical > 0.8 && intent.filters.technical_required) {
      reasons.push('Strong technical capability')
    }

    if (scores.leadership > 0.6) {
      reasons.push('Leadership and management experience')
    }

    return reasons.length > 0 ? reasons.join(' • ') : 'Good overall profile match'
  }
}