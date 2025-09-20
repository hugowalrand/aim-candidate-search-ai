// Simplified talent search API using hybrid search
import { NextRequest, NextResponse } from 'next/server'
import { HybridSearchEngine } from '@/lib/search/hybrid-search'
import { typesenseClient } from '@/lib/search/typesense-client'
import { SearchResult } from '@/types/candidate'

let hybridEngine: HybridSearchEngine | null = null

function getSearchEngine() {
  if (!hybridEngine) {
    hybridEngine = new HybridSearchEngine()
  }
  return hybridEngine
}

export async function POST(request: NextRequest) {
  try {
    const { query, filters = {} } = await request.json()

    if (!query || query.trim().length === 0) {
      // Handle empty query case with filters
      if (Object.keys(filters).length > 0) {
        return await handleFilterOnlySearch(filters)
      }

      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Talent search request:', { query, filters })
    const startTime = Date.now()

    // Use hybrid search engine
    const engine = getSearchEngine()
    let results = await engine.search(query, 20)

    // Apply filters if provided
    if (Object.keys(filters).length > 0) {
      results = applyFilters(results, filters)
    }

    const searchTime = Date.now() - startTime

    return NextResponse.json({
      query,
      search_method: 'Hybrid: Intent Analysis → Vector + BM25 → Fusion → Rerank',
      filters_applied: Object.keys(filters),
      results,
      metadata: {
        total_results: results.length,
        search_time_ms: searchTime,
        filters_count: Object.keys(filters).length,
        api_status: {
          typesense: !!process.env.TYPESENSE_API_KEY,
          voyage_ai: !!process.env.VOYAGE_API_KEY,
          cohere: !!process.env.COHERE_API_KEY
        }
      }
    })

  } catch (error) {
    console.error('❌ Search API error:', error)
    return NextResponse.json({
      error: 'Search failed',
      message: String(error),
      fallback_recommendation: 'Try a simpler query or check API configuration'
    }, { status: 500 })
  }
}

async function handleFilterOnlySearch(filters: Record<string, any>): Promise<NextResponse> {
  try {
    console.log('🔍 Filter-only search:', filters)

    const filterClauses = []

    if (filters.tech_cofounder !== undefined) {
      filterClauses.push(`tech_cofounder:${filters.tech_cofounder}`)
    }

    if (filters.fundraising_stage && filters.fundraising_stage !== 'all') {
      filterClauses.push(`fundraising_stage:${filters.fundraising_stage}`)
    }

    if (filters.regions && filters.regions.length > 0) {
      const regionFilter = filters.regions.map((r: string) => `regions:${r}`).join(' || ')
      filterClauses.push(`(${regionFilter})`)
    }

    const results = await typesenseClient
      .collections('candidates')
      .documents()
      .search({
        q: '*',
        filter_by: filterClauses.length > 0 ? filterClauses.join(' && ') : undefined,
        per_page: 50
      })

    const candidates = (results.hits || []).map(hit => ({
      ...(hit.document as any),
      score: 50,
      explanation: 'Filter-only result',
      score_breakdown: {
        bm25_score: 0,
        vector_score: 0,
        rerank_score: 0.5,
        regional_match: 0.5,
        fundraising_match: 0.5,
        technical_match: 0.5,
        final_score: 0.5
      }
    }))

    return NextResponse.json({
      query: '',
      search_method: 'Filter Only',
      filters_applied: Object.keys(filters),
      results: candidates,
      metadata: {
        total_results: candidates.length,
        search_time_ms: 0,
        search_engine: 'filter',
        filters_count: Object.keys(filters).length
      }
    })

  } catch (error) {
    console.error('❌ Filter search failed:', error)
    return NextResponse.json({ error: 'Filter search failed' }, { status: 500 })
  }
}

function applyFilters(results: SearchResult[], filters: Record<string, any>): SearchResult[] {
  return results.filter(candidate => {
    // Tech co-founder filter
    if (filters.tech_cofounder !== undefined && candidate.tech_cofounder !== filters.tech_cofounder) {
      return false
    }

    // Fundraising stage filter
    if (filters.fundraising_stage && filters.fundraising_stage !== 'all') {
      if (candidate.fundraising_stage !== filters.fundraising_stage) {
        return false
      }
    }

    // Regions filter
    if (filters.regions && filters.regions.length > 0) {
      const candidateRegions = candidate.regions || []
      const hasMatchingRegion = filters.regions.some((filterRegion: string) =>
        candidateRegions.some(candidateRegion =>
          candidateRegion.toLowerCase().includes(filterRegion.toLowerCase())
        )
      )
      if (!hasMatchingRegion) {
        return false
      }
    }

    // Years of experience filter
    if (filters.min_experience !== undefined && (candidate.years_experience || 0) < filters.min_experience) {
      return false
    }

    return true
  })
}

export async function GET() {
  try {
    return NextResponse.json({
      status: 'ready',
      service: 'AIM Talent Search',
      search_method: 'Hybrid: Intent Analysis → Vector + BM25 → Fusion → Rerank',
      capabilities: [
        'Natural language talent search',
        'Semantic similarity matching',
        'Skills and experience extraction',
        'Regional and role-based filtering',
        'AI-powered result ranking',
        'Real-time search'
      ],
      technology: {
        search_backend: 'Typesense',
        embeddings: 'Voyage AI Large-2',
        reranking: 'Cohere Rerank-v3.5',
        intent_extraction: 'Gemini 2.5 Flash'
      },
      example_queries: [
        'Technical founder with B2B SaaS and Series A experience; Africa preferred',
        'Healthcare leader, East Africa, NGO background',
        'AI machine learning technical cofounder',
        'Mental health experience with startup background'
      ]
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: String(error)
    }, { status: 500 })
  }
}