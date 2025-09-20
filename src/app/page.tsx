'use client'

import { useState, useEffect } from 'react'
import TalentSearchInterface from '@/components/TalentSearchInterface'
import Shortlist from '@/components/Shortlist'
import type { ShortlistItem } from '@/types'

export default function Home() {
  const [shortlist, setShortlist] = useState<ShortlistItem[]>([])

  // Load shortlist from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('aim-shortlist')
    if (saved) {
      try {
        setShortlist(JSON.parse(saved))
      } catch (error) {
        console.error('Failed to load shortlist:', error)
      }
    }
  }, [])

  // Save shortlist to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('aim-shortlist', JSON.stringify(shortlist))
  }, [shortlist])

  const handleAddToShortlist = (item: ShortlistItem) => {
    if (!shortlist.find(s => s.id === item.id)) {
      setShortlist(prev => [...prev, item])
    }
  }

  const handleRemoveFromShortlist = (id: string) => {
    setShortlist(prev => prev.filter(item => item.id !== id))
  }

  const handleClearShortlist = () => {
    setShortlist([])
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">AIM Talent Search</h1>
              <span className="text-sm text-gray-500">AI-powered talent discovery</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TalentSearchInterface
          onAddToShortlist={handleAddToShortlist}
          shortlist={shortlist}
        />
      </main>

      {/* Shortlist */}
      <Shortlist
        shortlist={shortlist}
        onRemoveFromShortlist={handleRemoveFromShortlist}
        onClearShortlist={handleClearShortlist}
      />
    </div>
  )
}