// API endpoint for testing search quality on real data
import { NextRequest, NextResponse } from 'next/server'
import { SearchQualityTester } from '@/lib/search-quality-test'

export async function POST(request: NextRequest) {
  try {
    console.log('🔬 Starting search quality assessment...')

    const tester = new SearchQualityTester()
    const results = await tester.runQualityTest()

    return NextResponse.json({
      success: true,
      quality_score: `${(results.overall_score * 100).toFixed(1)}%`,
      tests_passed: `${results.passed_tests}/${results.total_tests}`,
      summary: results.summary,
      detailed_results: results.results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Quality test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Quality test failed',
      message: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Search Quality Tester',
    description: 'Tests search quality using real data and real-world queries',
    usage: 'POST to run quality assessment',
    test_queries: [
      'AI technical founder with machine learning experience',
      'Healthcare startup founder Series A fundraising',
      'Technical founder with experience in Africa',
      'FinTech blockchain experience emerging markets',
      'Experienced startup founder with Series A'
    ]
  })
}