'use client'

import { useState } from 'react'
import type { ShortlistItem } from '@/types'

interface AISearchResult {
  id: string
  full_name: string
  first_name?: string
  last_name?: string
  headline?: string
  email?: string
  linkedin_url?: string
  cv_url?: string
  regions?: string[]
  fundraising_stage?: string
  tech_cofounder?: boolean
  score: number
  explanation: string
  score_breakdown?: {
    bm25_score: number
    vector_score: number
    rerank_score: number
    regional_match: number
    fundraising_match: number
    technical_match: number
    final_score: number
  }
}

interface AISearchResponse {
  query: string
  search_method: string
  results: AISearchResult[]
  metadata: {
    total_results: number
    search_time_ms: number
    pipeline_stages?: string[]
    api_status?: {
      google_ai: boolean
      voyage_ai: boolean
      cohere: boolean
      typesense: boolean
    }
  }
}

interface Props {
  onAddToShortlist: (item: ShortlistItem) => void
  shortlist: ShortlistItem[]
}

export default function AISearchInterface({ onAddToShortlist, shortlist }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AISearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const exampleQueries = [
    "Technical founder with B2B SaaS and Series A experience; Africa preferred",
    "Healthcare leader, East Africa, NGO background",
    "Mental health experience with startup background",
    "Fintech founder who has raised funding in emerging markets",
    "AI/ML technical co-founder with leadership experience"
  ]

  const handleSearch = async () => {
    if (!query.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        setResults(data)
      } else {
        setError(data.error || 'Search failed')
      }
    } catch (err) {
      setError('Network error - please try again')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const isInShortlist = (id: string) => shortlist.some(item => item.id === id)


  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          🚀 Production AI Search
        </h1>
        <p className="text-lg text-gray-600 mb-6">
          Hybrid search with Intent → Vector+BM25 → RRF → Cohere Rerank
        </p>
      </div>

      {/* Search Interface */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <div className="mb-4">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe who you're looking for... (e.g., 'Technical founder with B2B SaaS experience who can raise Series A')"
            className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            rows={3}
          />
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim()}
            className={`px-6 py-3 rounded-lg font-medium ${
              loading || !query.trim()
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {loading ? 'Searching...' : 'Find Candidates'}
          </button>

          <div className="text-sm text-gray-500">
            Press Enter to search
          </div>
        </div>

        {/* Example Queries */}
        <div className="mt-4">
          <p className="text-sm text-gray-600 mb-2">Try these examples:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                onClick={() => setQuery(example)}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full text-gray-700 transition-colors"
              >
                {example.length > 50 ? example.substring(0, 50) + '...' : example}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {/* Results */}
      {results && (
        <div>
          {/* Search Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-900 mb-2">Hybrid Search Analysis</h3>
            <p className="text-blue-800 text-sm mb-2">
              <strong>Query:</strong> "{results.query}"
            </p>
            <p className="text-blue-800 text-sm mb-2">
              <strong>Search Method:</strong> {results.search_method || 'Production Hybrid Search'}
            </p>
            {results.metadata?.api_status && (
              <div className="text-blue-700 text-xs mb-2">
                <strong>AI Pipeline:</strong>
                {results.metadata.api_status.google_ai && ' ✅ Gemini Intent'}
                {results.metadata.api_status.voyage_ai && ' ✅ Voyage Embeddings'}
                {results.metadata.api_status.cohere && ' ✅ Cohere Rerank'}
                {results.metadata.api_status.typesense && ' ✅ Typesense'}
              </div>
            )}
            {results.metadata?.pipeline_stages && (
              <div className="text-blue-700 text-xs mb-2">
                <strong>Pipeline Stages:</strong> {results.metadata.pipeline_stages.length} steps completed
              </div>
            )}
            <p className="text-blue-700 text-xs mt-2">
              Found {results.results.length} candidates
              {results.metadata.search_time_ms && ` in ${results.metadata.search_time_ms}ms`}
            </p>
          </div>

          {/* Candidate Results */}
          <div className="space-y-4">
            {results.results.map((candidate) => (
              <div key={candidate.id} className="bg-white rounded-lg shadow border p-6">
                {/* Header with Score */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">
                        {candidate.full_name || `${candidate.first_name || ''} ${candidate.last_name || ''}`}
                      </h3>
                      <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                        {candidate.score}% Match
                      </div>
                    </div>
                    {candidate.headline && (
                      <div className="text-sm text-gray-600 mb-2">{candidate.headline}</div>
                    )}

                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      {candidate.email && (
                        <a
                          href={`mailto:${candidate.email}`}
                          className="text-blue-600 hover:underline"
                        >
                          {candidate.email}
                        </a>
                      )}
                      {candidate.linkedin_url && (
                        <a
                          href={candidate.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => onAddToShortlist({
                        id: candidate.id,
                        first_name: candidate.first_name || candidate.full_name.split(' ')[0] || '',
                        last_name: candidate.last_name || candidate.full_name.split(' ').slice(1).join(' ') || '',
                        email: candidate.email,
                        linkedin_url: candidate.linkedin_url,
                        cv_url: candidate.cv_url || ''
                      })}
                      disabled={isInShortlist(candidate.id)}
                      className={`px-4 py-2 text-sm rounded-lg ${
                        isInShortlist(candidate.id)
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isInShortlist(candidate.id) ? 'In Shortlist' : 'Add to Shortlist'}
                    </button>

                    {candidate.cv_url && (
                      <a
                        href={candidate.cv_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                      >
                        View CV
                      </a>
                    )}
                  </div>
                </div>

                {/* AI Reasoning */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm">
                    <strong className="text-yellow-800">Why this candidate matches:</strong>
                    <span className="text-yellow-700 ml-2">{candidate.explanation}</span>
                  </p>
                </div>

                {/* Advanced Search Scores */}
                {candidate.score_breakdown && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <h4 className="text-xs font-medium text-gray-700 mb-2">🔍 Production Hybrid Search Scores</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                      {candidate.score_breakdown.bm25_score !== undefined && (
                        <div>
                          <span className="text-gray-600">BM25:</span>
                          <span className="font-mono ml-1">{candidate.score_breakdown.bm25_score.toFixed(3)}</span>
                        </div>
                      )}
                      {candidate.score_breakdown.vector_score !== undefined && (
                        <div>
                          <span className="text-gray-600">Vector:</span>
                          <span className="font-mono ml-1">{candidate.score_breakdown.vector_score.toFixed(3)}</span>
                        </div>
                      )}
                      {candidate.score_breakdown.rerank_score !== undefined && (
                        <div>
                          <span className="text-gray-600">Rerank:</span>
                          <span className="font-mono ml-1">{candidate.score_breakdown.rerank_score.toFixed(3)}</span>
                        </div>
                      )}
                      {candidate.score_breakdown.final_score !== undefined && (
                        <div>
                          <span className="text-gray-600">Final:</span>
                          <span className="font-mono ml-1 font-medium">{candidate.score_breakdown.final_score.toFixed(3)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Profile Info */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                  {candidate.regions && candidate.regions.length > 0 && (
                    <div>
                      <span className="font-medium">Regions:</span> {candidate.regions.join(', ')}
                    </div>
                  )}
                  {candidate.fundraising_stage && (
                    <div>
                      <span className="font-medium">Fundraising:</span> {candidate.fundraising_stage}
                    </div>
                  )}
                  {candidate.tech_cofounder && (
                    <div className="bg-green-100 text-green-800 px-2 py-1 rounded">
                      Technical Co-founder
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}