// Minimal search quality assessment using real data and real queries
import { HybridSearchEngine } from './search/hybrid-search'

export interface TestQuery {
  query: string
  description: string
  expected_type: 'technical' | 'healthcare' | 'fintech' | 'africa' | 'ai' | 'founder'
  min_expected_results: number
}

export interface QualityResult {
  query: TestQuery
  results_count: number
  avg_score: number
  top_result_relevance: number
  passed: boolean
  top_results: Array<{
    name: string
    headline: string
    score: number
    relevant: boolean
  }>
}

// Real-world test queries that matter for talent search
const QUALITY_TEST_QUERIES: TestQuery[] = [
  {
    query: "AI technical founder with machine learning experience",
    description: "Should find technical founders with AI/ML background",
    expected_type: 'ai',
    min_expected_results: 3
  },
  {
    query: "Healthcare startup founder Series A fundraising",
    description: "Should find healthcare founders with funding experience",
    expected_type: 'healthcare',
    min_expected_results: 2
  },
  {
    query: "Technical founder with experience in Africa",
    description: "Should find technical founders with Africa experience",
    expected_type: 'africa',
    min_expected_results: 2
  },
  {
    query: "FinTech blockchain experience emerging markets",
    description: "Should find fintech founders with blockchain/emerging market experience",
    expected_type: 'fintech',
    min_expected_results: 1
  },
  {
    query: "Experienced startup founder with Series A",
    description: "Should find founders with proven fundraising track record",
    expected_type: 'founder',
    min_expected_results: 5
  }
]

export class SearchQualityTester {
  private searchEngine: HybridSearchEngine

  constructor() {
    this.searchEngine = new HybridSearchEngine()
  }

  async runQualityTest(): Promise<{
    overall_score: number
    passed_tests: number
    total_tests: number
    results: QualityResult[]
    summary: string
  }> {
    console.log('🔬 Running search quality assessment on real data...')

    const results: QualityResult[] = []
    let passedTests = 0

    for (const testQuery of QUALITY_TEST_QUERIES) {
      console.log(`\n🧪 Testing: "${testQuery.query}"`)

      try {
        const searchResults = await this.searchEngine.search(testQuery.query, 10)

        // Calculate quality metrics
        const avgScore = searchResults.length > 0
          ? searchResults.reduce((sum, r) => sum + r.score, 0) / searchResults.length
          : 0

        const topResults = searchResults.slice(0, 3).map(result => ({
          name: result.full_name || 'Unknown',
          headline: result.headline || 'No headline',
          score: result.score,
          relevant: this.isResultRelevant(result, testQuery.expected_type)
        }))

        const topResultRelevance = topResults.length > 0
          ? topResults.filter(r => r.relevant).length / topResults.length
          : 0

        const passed = searchResults.length >= testQuery.min_expected_results &&
                      avgScore > 0.3 &&
                      topResultRelevance > 0.5

        if (passed) passedTests++

        const qualityResult: QualityResult = {
          query: testQuery,
          results_count: searchResults.length,
          avg_score: avgScore,
          top_result_relevance: topResultRelevance,
          passed,
          top_results: topResults
        }

        results.push(qualityResult)

        console.log(`   📊 Results: ${searchResults.length}, Avg Score: ${(avgScore * 100).toFixed(1)}%, Relevance: ${(topResultRelevance * 100).toFixed(1)}%`)
        console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}`)

      } catch (error) {
        console.error(`   ❌ Query failed: ${error}`)
        results.push({
          query: testQuery,
          results_count: 0,
          avg_score: 0,
          top_result_relevance: 0,
          passed: false,
          top_results: []
        })
      }
    }

    const overallScore = passedTests / QUALITY_TEST_QUERIES.length

    const summary = `
🎯 Search Quality Assessment Results:

📊 Overall Score: ${(overallScore * 100).toFixed(1)}% (${passedTests}/${QUALITY_TEST_QUERIES.length} tests passed)

${results.map(result => `
🧪 "${result.query.query}"
   ${result.passed ? '✅' : '❌'} ${result.results_count} results, ${(result.avg_score * 100).toFixed(1)}% avg score, ${(result.top_result_relevance * 100).toFixed(1)}% relevance
   Top results: ${result.top_results.map(r => `${r.name} (${(r.score * 100).toFixed(1)}%)`).join(', ') || 'None'}
`).join('')}

🔍 Quality Criteria:
   ✓ Min results found for each query type
   ✓ Average search scores > 30%
   ✓ Top 3 results relevance > 50%

${overallScore > 0.8 ? '🎉 Excellent search quality!' :
  overallScore > 0.6 ? '👍 Good search quality' :
  overallScore > 0.4 ? '⚠️ Acceptable but needs improvement' :
  '🚨 Poor search quality - needs immediate attention'}
`

    console.log(summary)

    return {
      overall_score: overallScore,
      passed_tests: passedTests,
      total_tests: QUALITY_TEST_QUERIES.length,
      results,
      summary
    }
  }

  private isResultRelevant(result: any, expectedType: string): boolean {
    const text = `${result.full_name} ${result.headline} ${result.skills?.join(' ') || ''} ${result.tags?.join(' ') || ''}`.toLowerCase()

    switch (expectedType) {
      case 'ai':
        return text.includes('ai') || text.includes('machine learning') || text.includes('ml') || text.includes('artificial intelligence')
      case 'healthcare':
        return text.includes('health') || text.includes('medical') || text.includes('clinical') || text.includes('biotech') || text.includes('pharma')
      case 'fintech':
        return text.includes('fintech') || text.includes('financial') || text.includes('blockchain') || text.includes('crypto') || text.includes('payments')
      case 'africa':
        return text.includes('africa') || result.regions?.some((r: string) => r.toLowerCase().includes('africa'))
      case 'founder':
        return text.includes('founder') || text.includes('ceo') || text.includes('entrepreneur') || result.fundraising_stage !== 'None'
      case 'technical':
        return result.tech_cofounder || text.includes('technical') || text.includes('engineer') || text.includes('developer')
      default:
        return true
    }
  }
}