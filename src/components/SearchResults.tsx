'use client'

import type { Profile, ShortlistItem } from '@/types'

interface SearchResult extends Profile {
  snippets?: Array<{
    field: string
    snippet: string
    matched_tokens: string[]
  }>
}

interface SearchResultsProps {
  results: SearchResult[]
  loading: boolean
  onAddToShortlist: (item: ShortlistItem) => void
  shortlist: ShortlistItem[]
}

export default function SearchResults({ results, loading, onAddToShortlist, shortlist }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Searching...</p>
      </div>
    )
  }

  if (results.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600">
        <p>No results found. Try adjusting your search query or filters.</p>
      </div>
    )
  }

  const isInShortlist = (id: string) => shortlist.some(item => item.id === id)

  const formatScore = (score?: number) => {
    if (score === undefined) return 'N/A'
    return (score * 100).toFixed(0) + '%'
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 mb-4">
        Found {results.length} result{results.length !== 1 ? 's' : ''}
      </p>

      {results.map((profile) => (
        <div key={profile.id} className="bg-white p-6 rounded-lg shadow border">
          {/* Header */}
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold">
                {profile.first_name} {profile.last_name}
              </h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                {profile.email && (
                  <a
                    href={`mailto:${profile.email}`}
                    className="text-blue-600 hover:underline"
                  >
                    {profile.email}
                  </a>
                )}
                {profile.linkedin_url && (
                  <a
                    href={profile.linkedin_url}
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
                  id: profile.id,
                  first_name: profile.first_name,
                  last_name: profile.last_name,
                  email: profile.email,
                  linkedin_url: profile.linkedin_url,
                  cv_url: profile.cv_url
                })}
                disabled={isInShortlist(profile.id)}
                className={`px-3 py-2 text-sm rounded ${
                  isInShortlist(profile.id)
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isInShortlist(profile.id) ? 'In Shortlist' : 'Add to Shortlist'}
              </button>

              {profile.cv_url && (
                <a
                  href={profile.cv_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  Open CV
                </a>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="flex flex-wrap gap-4 text-sm mb-4">
            {profile.regions.length > 0 && (
              <div>
                <span className="text-gray-600">Regions:</span>{' '}
                <span>{profile.regions.join(', ')}</span>
              </div>
            )}
            {profile.fundraising_bucket !== 'none' && (
              <div>
                <span className="text-gray-600">Fundraising:</span>{' '}
                <span>{profile.fundraising_bucket}</span>
              </div>
            )}
            {profile.tech_cofounder && (
              <div>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                  Technical Co-founder
                </span>
              </div>
            )}
          </div>

          {/* Scores */}
          <div className="flex space-x-6 text-sm mb-4">
            {profile.score_start_fit !== undefined && (
              <div className="text-center">
                <div className="text-gray-600">Start Fit</div>
                <div className="font-semibold">{formatScore(profile.score_start_fit)}</div>
              </div>
            )}
            {profile.score_tech_ai !== undefined && (
              <div className="text-center">
                <div className="text-gray-600">Tech-AI</div>
                <div className="font-semibold">{formatScore(profile.score_tech_ai)}</div>
              </div>
            )}
            {profile.flag_llm_screen > 0 && (
              <div className="text-center">
                <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                  Flagged
                </div>
              </div>
            )}
          </div>

          {/* Snippets */}
          {profile.snippets && profile.snippets.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm text-gray-700">Evidence:</h4>
              {profile.snippets.map((snippet, index) => (
                <div key={index} className="bg-yellow-50 p-3 rounded border-l-4 border-yellow-400">
                  <div
                    className="text-sm"
                    dangerouslySetInnerHTML={{
                      __html: snippet.snippet.replace(/<mark>/g, '<mark class="bg-yellow-200 px-1 rounded">')
                    }}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Source: {snippet.field === 'cv_text' ? 'CV' : 'Profile'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}