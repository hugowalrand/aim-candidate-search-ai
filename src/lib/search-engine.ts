import Fuse from 'fuse.js'
import type { Profile, SearchFilters } from '../types'

interface SearchResult extends Profile {
  snippets?: Array<{
    field: string
    snippet: string
    matched_tokens: string[]
  }>
  score?: number
}

export class InMemorySearchEngine {
  private fuse: Fuse<Profile>
  private profiles: Profile[]

  constructor(profiles: Profile[]) {
    this.profiles = profiles

    // Configure Fuse.js for fuzzy search
    const options: Fuse.IFuseOptions<Profile> = {
      keys: [
        { name: 'cv_text', weight: 0.6 },
        { name: 'nl_blob', weight: 0.3 },
        { name: 'first_name', weight: 0.05 },
        { name: 'last_name', weight: 0.05 }
      ],
      includeScore: true,
      includeMatches: true,
      threshold: 0.4, // Lower = more strict matching
      ignoreLocation: true,
      minMatchCharLength: 3,
    }

    this.fuse = new Fuse(profiles, options)
  }

  search(query: string, filters: SearchFilters = {}, limit = 20): {
    results: SearchResult[]
    total: number
  } {
    // Start with all profiles
    let filteredProfiles = this.profiles

    // Apply filters first
    if (filters.regions && filters.regions.length > 0) {
      filteredProfiles = filteredProfiles.filter(profile =>
        filters.regions!.some(region =>
          profile.regions.some(r => r.toLowerCase().includes(region.toLowerCase()))
        )
      )
    }

    if (filters.tech_cofounder) {
      filteredProfiles = filteredProfiles.filter(profile => profile.tech_cofounder)
    }

    if (filters.fundraising_bucket && filters.fundraising_bucket.length > 0) {
      filteredProfiles = filteredProfiles.filter(profile =>
        filters.fundraising_bucket!.includes(profile.fundraising_bucket)
      )
    }

    if (filters.start_fit_min !== undefined) {
      filteredProfiles = filteredProfiles.filter(profile =>
        (profile.score_start_fit || 0) >= filters.start_fit_min!
      )
    }

    if (filters.tech_ai_min !== undefined) {
      filteredProfiles = filteredProfiles.filter(profile =>
        (profile.score_tech_ai || 0) >= filters.tech_ai_min!
      )
    }

    if (filters.exclude_flagged) {
      filteredProfiles = filteredProfiles.filter(profile => profile.flag_llm_screen <= 0)
    }

    // If no query, return filtered results
    if (!query.trim()) {
      return {
        results: filteredProfiles.slice(0, limit),
        total: filteredProfiles.length
      }
    }

    // Create a temporary Fuse instance with filtered data
    const filteredFuse = new Fuse(filteredProfiles, this.fuse.options)
    const searchResults = filteredFuse.search(query, { limit })

    const results = searchResults.map(result => {
      const profile = result.item
      const snippets = this.extractSnippets(result, query)

      return {
        ...profile,
        snippets,
        score: result.score
      }
    })

    return {
      results,
      total: searchResults.length
    }
  }

  private extractSnippets(result: Fuse.FuseResult<Profile>, query: string): Array<{
    field: string
    snippet: string
    matched_tokens: string[]
  }> {
    const snippets: Array<{
      field: string
      snippet: string
      matched_tokens: string[]
    }> = []

    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)

    // Extract from matches
    if (result.matches) {
      for (const match of result.matches) {
        if (match.key === 'cv_text' || match.key === 'nl_blob') {
          const text = match.value || ''
          const snippet = this.createSnippet(text, queryWords)

          if (snippet) {
            snippets.push({
              field: match.key,
              snippet,
              matched_tokens: queryWords
            })
          }
        }
      }
    }

    // If no snippets from matches, create them manually
    if (snippets.length === 0 && queryWords.length > 0) {
      const cvSnippet = this.createSnippet(result.item.cv_text, queryWords)
      if (cvSnippet) {
        snippets.push({
          field: 'cv_text',
          snippet: cvSnippet,
          matched_tokens: queryWords
        })
      }
    }

    return snippets.slice(0, 2) // Max 2 snippets
  }

  private createSnippet(text: string, queryWords: string[]): string | null {
    if (!text) return null

    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)

    // Find sentences containing query words
    const matchingSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase()
      return queryWords.some(word => lowerSentence.includes(word))
    })

    if (matchingSentences.length === 0) return null

    // Take the first matching sentence and highlight words
    let snippet = matchingSentences[0].trim()

    // Highlight matching words
    queryWords.forEach(word => {
      const regex = new RegExp(`(${word})`, 'gi')
      snippet = snippet.replace(regex, '<mark>$1</mark>')
    })

    // Truncate if too long
    if (snippet.length > 200) {
      snippet = snippet.substring(0, 200) + '...'
    }

    return snippet
  }

  getAllProfiles(): Profile[] {
    return this.profiles
  }

  getProfileById(id: string): Profile | undefined {
    return this.profiles.find(p => p.id === id)
  }
}