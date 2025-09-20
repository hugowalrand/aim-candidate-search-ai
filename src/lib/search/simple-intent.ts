// Simplified intent extraction - just extract keywords, no complex filtering
export interface SimpleQueryIntent {
  keywords: string[]
  original_query: string
}

export class SimpleIntentService {
  extractIntent(query: string): SimpleQueryIntent {
    // Just extract meaningful keywords from the query
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2) // Skip short words
      .filter(word => !['the', 'and', 'with', 'for', 'who', 'has', 'are', 'is'].includes(word)) // Skip stopwords

    return {
      keywords,
      original_query: query
    }
  }
}