'use client'

import { useState } from 'react'
import type { ShortlistItem } from '@/types'

interface SearchResult {
  id: string
  full_name: string
  headline?: string
  email?: string
  linkedin_url?: string
  regions?: string[]
  fundraising_stage?: string
  tech_cofounder?: boolean
  score: number
  explanation: string
}

interface Props {
  onAddToShortlist: (item: ShortlistItem) => void
  shortlist: ShortlistItem[]
}

export default function TalentSearchInterface({ onAddToShortlist, shortlist }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTime, setSearchTime] = useState<number | null>(null)

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() })
      })

      const data = await response.json()
      if (data.success !== false) {
        setResults(data.results || [])
        setSearchTime(data.metadata?.search_time_ms || null)
      } else {
        console.error('Search failed:', data.error)
        setResults([])
      }
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    }
    setLoading(false)
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const addToShortlist = (result: SearchResult) => {
    const shortlistItem: ShortlistItem = {
      id: result.id,
      name: result.full_name,
      headline: result.headline || '',
      email: result.email || '',
      linkedin: result.linkedin_url || '',
      score: result.score
    }
    onAddToShortlist(shortlistItem)
  }

  return (
    <div className="space-y-8">
      {/* Big Search Prompt */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold text-gray-900">
          Find Your Perfect Co-founder
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Describe exactly who you're looking for using natural language.
          Our AI will understand and find the best matches from our talent database.
        </p>
      </div>

      {/* Search Input */}
      <div className="max-w-4xl mx-auto">
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., 'AI technical co-founder with machine learning experience and Series A fundraising in healthcare space' or 'Experienced founder with B2B SaaS background in Africa with team management skills'"
            className="w-full p-6 text-lg border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-0 resize-none"
            rows={4}
            disabled={loading}
          />
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className="absolute bottom-4 right-4 px-8 py-3 bg-blue-600 text-white text-lg font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>
      </div>

      {/* Search Results */}
      {results.length > 0 && (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              Found {results.length} candidates
            </h2>
            {searchTime && (
              <span className="text-sm text-gray-500">
                Search completed in {searchTime}ms
              </span>
            )}
          </div>

          <div className="space-y-4">
            {results.map((result) => (
              <div
                key={result.id}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {result.full_name}
                    </h3>

                    {result.headline && (
                      <p className="text-gray-600 mb-3">
                        {result.headline}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-2 mb-3">
                      {result.regions?.map((region) => (
                        <span
                          key={region}
                          className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
                        >
                          {region}
                        </span>
                      ))}

                      {result.tech_cofounder && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm">
                          Technical
                        </span>
                      )}

                      {result.fundraising_stage && result.fundraising_stage !== 'None' && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-sm">
                          {result.fundraising_stage}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500 mb-3">
                      {result.explanation}
                    </p>

                    <div className="flex items-center space-x-4">
                      {result.email && (
                        <a
                          href={`mailto:${result.email}`}
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          Email
                        </a>
                      )}

                      {result.linkedin_url && (
                        <a
                          href={result.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="ml-6 text-right">
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {Math.round(result.score)}%
                    </div>

                    <button
                      onClick={() => addToShortlist(result)}
                      disabled={shortlist.some(item => item.id === result.id)}
                      className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {shortlist.some(item => item.id === result.id) ? 'Added' : 'Shortlist'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Example Queries */}
      {results.length === 0 && !loading && (
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Example searches:
          </h3>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              "AI technical co-founder with machine learning experience",
              "Healthcare startup founder with Series A fundraising",
              "Technical founder with B2B SaaS experience in Africa",
              "FinTech founder with blockchain and emerging markets experience"
            ].map((example, index) => (
              <button
                key={index}
                onClick={() => setQuery(example)}
                className="p-4 text-left bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-gray-700">"{example}"</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}