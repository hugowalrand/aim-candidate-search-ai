// Production ingestion API endpoint
import { NextResponse } from 'next/server'
import { IngestionService } from '@/lib/ingestion-service'

export async function POST() {
  console.log('🚀 Starting ingestion via API')

  try {
    const ingestionService = new IngestionService()
    const result = await ingestionService.ingestCandidates()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully ingested ${result.count} candidates`,
        count: result.count,
        errors: result.errors.length > 0 ? result.errors : undefined
      })
    } else {
      return NextResponse.json({
        success: false,
        message: 'Ingestion failed',
        count: result.count,
        errors: result.errors
      }, { status: 500 })
    }

  } catch (error) {
    console.error('❌ Ingestion API error:', error)
    return NextResponse.json({
      success: false,
      message: 'Ingestion API error',
      error: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  try {
    const ingestionService = new IngestionService()
    const health = await ingestionService.healthCheck()
    const stats = await ingestionService.getCollectionStats()

    return NextResponse.json({
      status: 'ready',
      health,
      collection_stats: stats,
      endpoints: {
        ingest: 'POST /api/ingest',
        search: 'POST /api/search'
      }
    })

  } catch (error) {
    return NextResponse.json({
      status: 'error',
      error: String(error)
    }, { status: 500 })
  }
}