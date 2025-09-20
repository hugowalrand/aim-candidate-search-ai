// Production embedding service using Voyage AI 3.5-large
import { Candidate } from '@/types/candidate'

interface VoyageEmbedRequest {
  input: string | string[]
  model: string
  input_type: 'query' | 'document'
  truncation?: boolean
}

interface VoyageEmbedResponse {
  data: Array<{
    embedding: number[]
    index: number
  }>
  model: string
  usage: {
    total_tokens: number
  }
}

export class EmbeddingService {
  private readonly apiKey: string
  private readonly model = 'voyage-3-large'
  private lastRequestTime = 0
  private readonly rateLimitDelay = 3000 // 3 seconds between requests

  constructor() {
    this.apiKey = process.env.VOYAGE_API_KEY || ''
    if (!this.apiKey) {
      console.warn('⚠️ VOYAGE_API_KEY not found, embeddings will be disabled')
    }
  }

  private async applyRateLimit() {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delayTime = this.rateLimitDelay - timeSinceLastRequest
      console.log(`⏳ Rate limiting: waiting ${delayTime}ms`)
      await new Promise(resolve => setTimeout(resolve, delayTime))
    }
    this.lastRequestTime = Date.now()
  }

  private async retryRequest<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await this.applyRateLimit()
        return await fn()
      } catch (error: any) {
        const is429 = error.message?.includes('429') || error.message?.includes('Too Many Requests')
        const isLastAttempt = i === maxRetries - 1

        if (is429 && !isLastAttempt) {
          const backoffDelay = Math.pow(2, i) * 2000 // Exponential backoff: 2s, 4s, 8s
          console.log(`⚠️ Rate limit hit, retrying in ${backoffDelay}ms (attempt ${i + 1}/${maxRetries})`)
          await new Promise(resolve => setTimeout(resolve, backoffDelay))
          continue
        }

        throw error
      }
    }
    throw new Error('Max retries exceeded')
  }

  async generateDocumentEmbeddings(texts: string[]): Promise<number[][]> {
    if (!this.apiKey) {
      console.warn('⚠️ Voyage API key missing, returning empty embeddings')
      return texts.map(() => [])
    }

    try {
      return await this.retryRequest(async () => {
        const response = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            input: texts,
            model: this.model,
            input_type: 'document',
            truncation: true
          } as VoyageEmbedRequest)
        })

        if (!response.ok) {
          throw new Error(`Voyage API error: ${response.status} ${response.statusText}`)
        }

        const data: VoyageEmbedResponse = await response.json()

        // Sort by index to maintain order
        const sortedEmbeddings = data.data
          .sort((a, b) => a.index - b.index)
          .map(item => item.embedding)

        console.log(`✅ Generated ${sortedEmbeddings.length} document embeddings (${data.usage.total_tokens} tokens)`)
        return sortedEmbeddings
      })

    } catch (error) {
      console.error('❌ Failed to generate document embeddings after retries:', error)
      // Return empty embeddings as fallback
      return texts.map(() => [])
    }
  }

  async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!this.apiKey) {
      console.warn('⚠️ Voyage API key missing, returning empty embedding')
      return []
    }

    try {
      return await this.retryRequest(async () => {
        const response = await fetch('https://api.voyageai.com/v1/embeddings', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            input: [query],
            model: this.model,
            input_type: 'query',
            truncation: true
          } as VoyageEmbedRequest)
        })

        if (!response.ok) {
          throw new Error(`Voyage API error: ${response.status} ${response.statusText}`)
        }

        const data: VoyageEmbedResponse = await response.json()

        const embedding = data.data[0]?.embedding || []
        console.log(`✅ Generated query embedding (${data.usage.total_tokens} tokens)`)
        return embedding
      })

    } catch (error) {
      console.error('❌ Failed to generate query embedding after retries:', error)
      return []
    }
  }
}

export function createCombinedText(candidate: Candidate): string {
  // Following expert recommendations: identity & high-signal facets up-front
  const parts = [
    // Identity
    candidate.full_name,
    candidate.headline,

    // Structured highlights
    `Regions: ${candidate.regions?.join(', ') || 'Not specified'}`,
    `Fundraising: ${candidate.fundraising_stage || 'None'}`,
    `Technical: ${candidate.tech_cofounder ? 'Yes' : 'No'}`,
    `Tags: ${candidate.tags?.join(', ') || 'None'}`,

    // Skills
    candidate.skills?.join(', '),

    // Notes and CV (trimmed)
    candidate.notes,
    candidate.cv_text?.substring(0, 8000) // Trim very long CVs
  ]

  return parts
    .filter(Boolean)
    .join(' | ')
}