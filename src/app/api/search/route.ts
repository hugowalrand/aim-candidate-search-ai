// Production hybrid search API endpoint
import { NextRequest, NextResponse } from 'next/server'
import { HybridSearchEngine } from '@/lib/search/hybrid-search'

let searchEngine: HybridSearchEngine | null = null

function getSearchEngine() {
  if (!searchEngine) {
    searchEngine = new HybridSearchEngine()
  }
  return searchEngine
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Production hybrid search query:', query)
    const startTime = Date.now()

    const searchEngine = getSearchEngine()
    const results = await searchEngine.search(query, 20)

    const searchTime = Date.now() - startTime

    return NextResponse.json({
      query,
      search_method: 'Hybrid: Intent→Vector+BM25→RRF→Cohere Rerank',
      results,
      metadata: {
        total_results: results.length,
        search_time_ms: searchTime,
        pipeline_stages: [
          'Intent extraction (Gemini 2.5 Flash)',
          'Vector search (Voyage 3.5-large)',
          'BM25 text search (Typesense)',
          'Reciprocal Rank Fusion',
          'Cross-encoder reranking (Cohere 3.5)'
        ],
        api_status: {
          google_ai: !!process.env.GOOGLE_API_KEY,
          voyage_ai: !!process.env.VOYAGE_API_KEY,
          cohere: !!process.env.COHERE_API_KEY,
          typesense: !!process.env.TYPESENSE_API_KEY
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

export async function GET() {
  try {
    const searchEngine = getSearchEngine()

    return NextResponse.json({
      status: 'ready',
      search_engine: 'production_hybrid',
      capabilities: [
        'Natural language query understanding',
        'Intent extraction with structured outputs',
        'Hybrid retrieval (Vector + BM25)',
        'Reciprocal Rank Fusion',
        'Cross-encoder reranking',
        'Explainable search results'
      ],
      models: {
        intent_extraction: 'Gemini 2.5 Flash',
        embeddings: 'Voyage 3.5-large',
        reranking: 'Cohere Rerank 3.5',
        search_backend: 'Typesense 29.x'
      },
      example_queries: [
        'Technical founder with B2B SaaS and Series A experience; Africa preferred',
        'Healthcare leader, East Africa, NGO background, RCTs',
        'Ops leader for property management, French/English bilingual',
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