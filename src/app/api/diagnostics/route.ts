// API endpoint for running search diagnostics to identify bugs
import { NextRequest, NextResponse } from 'next/server'
import { SearchDiagnostics } from '@/lib/diagnostic-tests'

export async function POST(request: NextRequest) {
  try {
    console.log('🔬 Running search diagnostics to identify bugs...')

    const diagnostics = new SearchDiagnostics()
    const results = await diagnostics.runAllDiagnostics()

    const failedTests = results.filter(r => r.status === 'FAIL')
    const warningTests = results.filter(r => r.status === 'WARNING')
    const passedTests = results.filter(r => r.status === 'PASS')

    return NextResponse.json({
      success: true,
      summary: {
        total_tests: results.length,
        passed: passedTests.length,
        warnings: warningTests.length,
        failed: failedTests.length,
        overall_health: failedTests.length === 0 ? (warningTests.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION') : 'CRITICAL'
      },
      detailed_results: results,
      critical_issues: failedTests.map(test => ({
        test: test.test_name,
        issue: test.issue,
        fix_suggestion: test.fix_suggestion
      })),
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Diagnostics failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Diagnostics failed',
      message: String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Search Diagnostics',
    description: 'Runs comprehensive tests to identify search quality bugs',
    usage: 'POST to run diagnostic tests',
    tests: [
      'Score Range Validation - checks if scores are in valid 0-1 range',
      'Healthcare Relevance Detection - tests healthcare-specific search accuracy',
      'Search Result Consistency - validates deterministic behavior',
      'Scoring Accuracy - compares specific vs generic query scoring',
      'Relevance Matching - tests field-specific matching logic'
    ]
  })
}