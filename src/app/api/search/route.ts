// Pure AI talent search API - no filters, just find the best matches
import { NextRequest, NextResponse } from 'next/server'
import { PureSearchEngine } from '@/lib/search/pure-search'

let searchEngine: PureSearchEngine | null = null

function getSearchEngine() {
  if (!searchEngine) {
    searchEngine = new PureSearchEngine()
  }
  return searchEngine
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json()

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Please enter what type of co-founder or talent you are looking for' },
        { status: 400 }
      )
    }

    console.log('🔍 Pure AI search:', query)
    const startTime = Date.now()

    const engine = getSearchEngine()
    const results = await engine.search(query, 20)

    const searchTime = Date.now() - startTime

    return NextResponse.json({
      query,
      results,
      metadata: {
        total_results: results.length,
        search_time_ms: searchTime
      }
    })

  } catch (error) {
    console.error('❌ Search API error:', error)
    return NextResponse.json({
      error: 'Search failed',
      message: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Pure AI Talent Search',
    description: 'Describe exactly who you\'re looking for in natural language. Our AI will find the best matches and explain why they\'re perfect for you.',
    example_queries: [
      'AI technical co-founder with machine learning experience',
      'Healthcare startup founder with fundraising experience',
      'Experienced entrepreneur with B2B SaaS background',
      'FinTech founder with blockchain expertise',
      'Technical founder with experience in emerging markets'
    ]
  })
}