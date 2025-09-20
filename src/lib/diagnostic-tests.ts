// Focused diagnostic tests to identify search quality bugs
import { HybridSearchEngine } from './search/hybrid-search'

export interface DiagnosticResult {
  test_name: string
  status: 'PASS' | 'FAIL' | 'WARNING'
  issue: string
  details: any
  fix_suggestion?: string
}

export class SearchDiagnostics {
  private searchEngine: HybridSearchEngine

  constructor() {
    this.searchEngine = new HybridSearchEngine()
  }

  async runAllDiagnostics(): Promise<DiagnosticResult[]> {
    console.log('🔬 Running comprehensive search diagnostics...')

    const results: DiagnosticResult[] = []

    // Test 1: Score Range Validation
    results.push(await this.testScoreRanges())

    // Test 2: Healthcare Relevance Detection
    results.push(await this.testHealthcareDetection())

    // Test 3: Search Result Consistency
    results.push(await this.testSearchConsistency())

    // Test 4: Scoring Calculation Accuracy
    results.push(await this.testScoringAccuracy())

    // Test 5: Relevance Matching Logic
    results.push(await this.testRelevanceMatching())

    return results
  }

  private async testScoreRanges(): Promise<DiagnosticResult> {
    try {
      const results = await this.searchEngine.search('AI technical founder', 5)

      const invalidScores = results.filter(r => r.score < 0 || r.score > 1)
      const suspiciouslyHighScores = results.filter(r => r.score > 1)

      if (invalidScores.length > 0) {
        return {
          test_name: 'Score Range Validation',
          status: 'FAIL',
          issue: `Found ${invalidScores.length} results with invalid scores (should be 0-1)`,
          details: {
            invalid_scores: invalidScores.map(r => ({ name: r.full_name, score: r.score })),
            score_range: { min: Math.min(...results.map(r => r.score)), max: Math.max(...results.map(r => r.score)) }
          },
          fix_suggestion: 'Search scores should be normalized to 0-1 range. Check scoring calculation in hybrid search.'
        }
      }

      if (suspiciouslyHighScores.length > 0) {
        return {
          test_name: 'Score Range Validation',
          status: 'WARNING',
          issue: `Found ${suspiciouslyHighScores.length} results with suspiciously high scores (>1.0)`,
          details: {
            high_scores: suspiciouslyHighScores.map(r => ({ name: r.full_name, score: r.score }))
          },
          fix_suggestion: 'Scores >1.0 suggest potential double normalization or incorrect scaling'
        }
      }

      return {
        test_name: 'Score Range Validation',
        status: 'PASS',
        issue: 'All scores within expected range',
        details: {
          score_range: { min: Math.min(...results.map(r => r.score)), max: Math.max(...results.map(r => r.score)) },
          sample_scores: results.slice(0, 3).map(r => ({ name: r.full_name, score: r.score }))
        }
      }
    } catch (error) {
      return {
        test_name: 'Score Range Validation',
        status: 'FAIL',
        issue: 'Failed to execute score range test',
        details: { error: String(error) }
      }
    }
  }

  private async testHealthcareDetection(): Promise<DiagnosticResult> {
    try {
      // Create a controlled test with known healthcare terms
      const healthcareQuery = 'healthcare startup founder medical'
      const results = await this.searchEngine.search(healthcareQuery, 10)

      // Check if we get any healthcare-relevant results
      const healthcareRelevant = results.filter(result => {
        const text = `${result.full_name} ${result.headline} ${result.skills?.join(' ') || ''}`.toLowerCase()
        return text.includes('health') || text.includes('medical') || text.includes('clinical') ||
               text.includes('biotech') || text.includes('pharma')
      })

      if (healthcareRelevant.length === 0 && results.length > 0) {
        return {
          test_name: 'Healthcare Relevance Detection',
          status: 'FAIL',
          issue: 'Healthcare query returned no healthcare-relevant results',
          details: {
            query: healthcareQuery,
            total_results: results.length,
            healthcare_relevant: healthcareRelevant.length,
            sample_results: results.slice(0, 3).map(r => ({
              name: r.full_name,
              headline: r.headline,
              score: r.score
            }))
          },
          fix_suggestion: 'Check if healthcare terms are properly indexed and weighted in search'
        }
      }

      return {
        test_name: 'Healthcare Relevance Detection',
        status: healthcareRelevant.length > 0 ? 'PASS' : 'WARNING',
        issue: healthcareRelevant.length > 0 ? 'Healthcare relevance working' : 'Limited healthcare results',
        details: {
          total_results: results.length,
          healthcare_relevant: healthcareRelevant.length,
          relevance_percentage: results.length > 0 ? (healthcareRelevant.length / results.length * 100).toFixed(1) : '0'
        }
      }
    } catch (error) {
      return {
        test_name: 'Healthcare Relevance Detection',
        status: 'FAIL',
        issue: 'Failed to execute healthcare detection test',
        details: { error: String(error) }
      }
    }
  }

  private async testSearchConsistency(): Promise<DiagnosticResult> {
    try {
      const query = 'technical founder AI'

      // Run same query twice
      const results1 = await this.searchEngine.search(query, 5)
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay
      const results2 = await this.searchEngine.search(query, 5)

      // Check if results are consistent
      const inconsistencies = []
      for (let i = 0; i < Math.min(results1.length, results2.length); i++) {
        if (results1[i].id !== results2[i].id) {
          inconsistencies.push({
            position: i,
            first_run: results1[i].full_name,
            second_run: results2[i].full_name
          })
        }
      }

      return {
        test_name: 'Search Result Consistency',
        status: inconsistencies.length === 0 ? 'PASS' : 'WARNING',
        issue: inconsistencies.length === 0 ? 'Search results are consistent' : `${inconsistencies.length} position inconsistencies found`,
        details: {
          inconsistencies,
          first_run_count: results1.length,
          second_run_count: results2.length
        },
        fix_suggestion: inconsistencies.length > 0 ? 'Search results should be deterministic for same query' : undefined
      }
    } catch (error) {
      return {
        test_name: 'Search Result Consistency',
        status: 'FAIL',
        issue: 'Failed to execute consistency test',
        details: { error: String(error) }
      }
    }
  }

  private async testScoringAccuracy(): Promise<DiagnosticResult> {
    try {
      // Test with very specific vs very generic queries
      const specificQuery = 'AI machine learning technical co-founder with PhD computer science'
      const genericQuery = 'founder'

      const specificResults = await this.searchEngine.search(specificQuery, 5)
      const genericResults = await this.searchEngine.search(genericQuery, 5)

      const avgSpecificScore = specificResults.length > 0
        ? specificResults.reduce((sum, r) => sum + r.score, 0) / specificResults.length
        : 0

      const avgGenericScore = genericResults.length > 0
        ? genericResults.reduce((sum, r) => sum + r.score, 0) / genericResults.length
        : 0

      // Specific queries should generally have higher scores for top results
      const scoreRatio = avgGenericScore > 0 ? avgSpecificScore / avgGenericScore : 0

      return {
        test_name: 'Scoring Accuracy',
        status: scoreRatio > 1.2 ? 'PASS' : 'WARNING',
        issue: scoreRatio > 1.2 ? 'Specific queries score higher than generic' : 'Scoring may not properly weight specificity',
        details: {
          specific_avg_score: avgSpecificScore,
          generic_avg_score: avgGenericScore,
          score_ratio: scoreRatio,
          specific_top_result: specificResults[0] ? {
            name: specificResults[0].full_name,
            score: specificResults[0].score
          } : null,
          generic_top_result: genericResults[0] ? {
            name: genericResults[0].full_name,
            score: genericResults[0].score
          } : null
        }
      }
    } catch (error) {
      return {
        test_name: 'Scoring Accuracy',
        status: 'FAIL',
        issue: 'Failed to execute scoring accuracy test',
        details: { error: String(error) }
      }
    }
  }

  private async testRelevanceMatching(): Promise<DiagnosticResult> {
    try {
      // Test queries with clear expected matches
      const testCases = [
        { query: 'technical co-founder', expectedField: 'tech_cofounder', expectedValue: true },
        { query: 'Series A fundraising', expectedField: 'fundraising_stage', expectedValue: 'Series A' },
        { query: 'Africa experience', expectedField: 'regions', expectedContains: 'Africa' }
      ]

      const issues = []

      for (const testCase of testCases) {
        const results = await this.searchEngine.search(testCase.query, 3)

        let relevantCount = 0
        for (const result of results) {
          if (testCase.expectedField === 'tech_cofounder' && result.tech_cofounder === testCase.expectedValue) {
            relevantCount++
          } else if (testCase.expectedField === 'fundraising_stage' && result.fundraising_stage === testCase.expectedValue) {
            relevantCount++
          } else if (testCase.expectedField === 'regions' && result.regions?.some((r: string) => r.includes('Africa'))) {
            relevantCount++
          }
        }

        const relevanceRate = results.length > 0 ? relevantCount / results.length : 0
        if (relevanceRate < 0.3) {
          issues.push({
            query: testCase.query,
            relevant_count: relevantCount,
            total_count: results.length,
            relevance_rate: relevanceRate,
            expected: testCase
          })
        }
      }

      return {
        test_name: 'Relevance Matching',
        status: issues.length === 0 ? 'PASS' : 'FAIL',
        issue: issues.length === 0 ? 'Relevance matching working correctly' : `${issues.length} relevance matching issues found`,
        details: { issues }
      }
    } catch (error) {
      return {
        test_name: 'Relevance Matching',
        status: 'FAIL',
        issue: 'Failed to execute relevance matching test',
        details: { error: String(error) }
      }
    }
  }
}