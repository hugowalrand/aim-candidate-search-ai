// Production reranking service using Cohere Rerank 3.5
import { Candidate } from '@/types/candidate'

interface CohereRerankRequest {
  model: string
  query: string
  documents: Array<{
    id: string
    text: string
  }>
  top_k?: number
  rank_fields?: string[]
}

interface CohereRerankResponse {
  results: Array<{
    index: number
    relevance_score: number
    document?: {
      id: string
      text: string
    }
  }>
  meta: {
    api_version: {
      version: string
    }
  }
}

export class RerankService {
  private readonly apiKey: string
  private readonly model = 'rerank-v3.5'

  constructor() {
    this.apiKey = process.env.COHERE_API_KEY || ''
    if (!this.apiKey) {
      console.warn('⚠️ COHERE_API_KEY not found, reranking will be disabled')
    }
  }

  async rerank(
    query: string,
    candidates: Candidate[],
    topK: number = 20
  ): Promise<Array<{ candidate: Candidate; rerank_score: number }>> {
    if (!this.apiKey) {
      console.warn('⚠️ Cohere API key missing, skipping rerank')
      return candidates.slice(0, topK).map(candidate => ({
        candidate,
        rerank_score: 0.5 // Default neutral score
      }))
    }

    if (candidates.length === 0) {
      return []
    }

    try {
      // Prepare documents for reranking (keep snippets to ~500-800 chars)
      const documents = candidates.map((candidate, index) => ({
        id: index.toString(),
        text: this.createRerankSnippet(candidate)
      }))

      const request: CohereRerankRequest = {
        model: this.model,
        query,
        documents,
        top_k: Math.min(topK, candidates.length)
      }

      console.log(`🎯 Reranking ${candidates.length} candidates with Cohere ${this.model}`)

      const response = await fetch('https://api.cohere.com/v1/rerank', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(request)
      })

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unable to read error')
        console.error('Cohere API error details:', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody
        })
        throw new Error(`Cohere API error: ${response.status} ${response.statusText}`)
      }

      const data: CohereRerankResponse = await response.json()

      // Map results back to candidates with scores
      const rerankedResults = data.results.map(result => ({
        candidate: candidates[result.index],
        rerank_score: result.relevance_score
      }))

      console.log(`✅ Reranked to top ${rerankedResults.length} candidates`)
      console.log(`📊 Score range: ${Math.min(...rerankedResults.map(r => r.rerank_score)).toFixed(3)} - ${Math.max(...rerankedResults.map(r => r.rerank_score)).toFixed(3)}`)

      return rerankedResults

    } catch (error) {
      console.error('❌ Reranking failed:', error)

      // Fallback: return original order with neutral scores
      return candidates.slice(0, topK).map(candidate => ({
        candidate,
        rerank_score: 0.5
      }))
    }
  }

  private createRerankSnippet(candidate: Candidate): string {
    // Create a focused snippet for reranking (~500-800 chars)
    // Prioritize topical relevance and domain expertise

    const parts = [
      candidate.full_name,
      candidate.headline,

      // Include ALL skills to maximize topical matching potential
      candidate.skills?.length ? `Skills: ${candidate.skills.join(', ')}` : null,

      // Include key attributes
      `${candidate.tech_cofounder ? 'Technical co-founder' : 'Non-technical'}`,
      candidate.fundraising_stage && candidate.fundraising_stage !== 'None' ? `Fundraising: ${candidate.fundraising_stage}` : null,
      candidate.regions?.length ? `Regions: ${candidate.regions.join(', ')}` : null,

      // Include more contextual information for better topical matching
      candidate.tags?.length ? `Tags: ${candidate.tags.join(', ')}` : null,

      // Extract key context from CV/notes - prioritize first portion which usually contains role/company info
      candidate.cv_text?.substring(0, 400), // Increased CV context
      candidate.notes?.substring(0, 150) // Focused notes context
    ]

    return parts
      .filter(Boolean)
      .join(' • ')
      .substring(0, 1200) // Increased context limit for better matching
  }
}