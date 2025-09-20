'use client'

import { useState } from 'react'
import type { ShortlistItem } from '@/types'

interface ShortlistProps {
  shortlist: ShortlistItem[]
  onRemoveFromShortlist: (id: string) => void
  onClearShortlist: () => void
}

export default function Shortlist({ shortlist, onRemoveFromShortlist, onClearShortlist }: ShortlistProps) {
  const [isOpen, setIsOpen] = useState(false)

  const exportCSV = () => {
    if (shortlist.length === 0) return

    const headers = ['First Name', 'Last Name', 'Email', 'LinkedIn URL', 'CV URL']
    const csvContent = [
      headers.join(','),
      ...shortlist.map(item => [
        item.first_name,
        item.last_name,
        item.email || '',
        item.linkedin_url || '',
        item.cv_url
      ].map(field => `"${field}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `aim-shortlist-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg hover:bg-blue-700 z-50"
      >
        Shortlist ({shortlist.length})
      </button>

      {/* Drawer */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer Panel */}
          <div className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl z-50 overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Shortlist</h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              {shortlist.length === 0 ? (
                <p className="text-gray-500">No candidates in shortlist</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {shortlist.map((item) => (
                      <div key={item.id} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-medium">
                              {item.first_name} {item.last_name}
                            </h3>
                            {item.email && (
                              <div className="text-sm text-gray-600 mt-1">
                                <a
                                  href={`mailto:${item.email}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {item.email}
                                </a>
                              </div>
                            )}
                            {item.linkedin_url && (
                              <div className="text-sm text-gray-600 mt-1">
                                <a
                                  href={item.linkedin_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  LinkedIn
                                </a>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onRemoveFromShortlist(item.id)}
                            className="text-red-500 hover:text-red-700 ml-2"
                            title="Remove from shortlist"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={exportCSV}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={onClearShortlist}
                      className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700"
                    >
                      Clear Shortlist
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}