'use client'

import { useState } from 'react'
import type { SearchFilters } from '@/types'

interface FiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
}

const REGIONS = [
  'Europe/UK',
  'United States/Canada',
  'Asia Pacific',
  'Africa/Middle East',
  'Latin America'
]

const FUNDRAISING_BUCKETS = [
  'none',
  '<=500k',
  '500k-1M',
  '1M-5M',
  '5M+'
]

export default function Filters({ filters, onFiltersChange }: FiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const updateFilter = (key: keyof SearchFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleRegion = (region: string) => {
    const currentRegions = filters.regions || []
    const newRegions = currentRegions.includes(region)
      ? currentRegions.filter(r => r !== region)
      : [...currentRegions, region]
    updateFilter('regions', newRegions)
  }

  const toggleFundraisingBucket = (bucket: string) => {
    const currentBuckets = filters.fundraising_bucket || []
    const newBuckets = currentBuckets.includes(bucket)
      ? currentBuckets.filter(b => b !== bucket)
      : [...currentBuckets, bucket]
    updateFilter('fundraising_bucket', newBuckets)
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Filters</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      <div className="space-y-6">
        {/* Technical Co-founder */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.tech_cofounder || false}
              onChange={(e) => updateFilter('tech_cofounder', e.target.checked || undefined)}
              className="mr-2"
            />
            Technical Co-founder Only
          </label>
        </div>

        {/* Exclude Flagged */}
        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.exclude_flagged || false}
              onChange={(e) => updateFilter('exclude_flagged', e.target.checked || undefined)}
              className="mr-2"
            />
            Exclude Flagged Profiles
          </label>
        </div>

        {isExpanded && (
          <>
            {/* Regions */}
            <div>
              <h4 className="font-medium mb-2">Regions</h4>
              <div className="space-y-1">
                {REGIONS.map(region => (
                  <label key={region} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={(filters.regions || []).includes(region)}
                      onChange={() => toggleRegion(region)}
                      className="mr-2"
                    />
                    {region}
                  </label>
                ))}
              </div>
            </div>

            {/* Fundraising Experience */}
            <div>
              <h4 className="font-medium mb-2">Fundraising Experience</h4>
              <div className="space-y-1">
                {FUNDRAISING_BUCKETS.map(bucket => (
                  <label key={bucket} className="flex items-center text-sm">
                    <input
                      type="checkbox"
                      checked={(filters.fundraising_bucket || []).includes(bucket)}
                      onChange={() => toggleFundraisingBucket(bucket)}
                      className="mr-2"
                    />
                    {bucket === 'none' ? 'No experience' : bucket}
                  </label>
                ))}
              </div>
            </div>

            {/* Score Filters */}
            <div>
              <h4 className="font-medium mb-2">Minimum Scores</h4>
              <div className="space-y-2">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Start Fit</label>
                  <select
                    value={filters.start_fit_min || ''}
                    onChange={(e) => updateFilter('start_fit_min', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">All</option>
                    <option value="0.5">≥ 0.5</option>
                    <option value="0.7">≥ 0.7</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Tech-AI</label>
                  <select
                    value={filters.tech_ai_min || ''}
                    onChange={(e) => updateFilter('tech_ai_min', e.target.value ? parseFloat(e.target.value) : undefined)}
                    className="w-full p-2 border border-gray-300 rounded text-sm"
                  >
                    <option value="">All</option>
                    <option value="0.5">≥ 0.5</option>
                    <option value="0.7">≥ 0.7</option>
                  </select>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Clear Filters */}
        <button
          onClick={() => onFiltersChange({})}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Clear all filters
        </button>
      </div>
    </div>
  )
}