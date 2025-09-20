'use client'

import { useState, useEffect } from 'react'
import AISearchInterface from '@/components/AISearchInterface'
import Shortlist from '@/components/Shortlist'
import AdminPanel from '@/components/AdminPanel'
import type { ShortlistItem } from '@/types'

export default function Home() {
  const [activeTab, setActiveTab] = useState<'search' | 'admin'>('search')
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

  const handleLogout = async () => {
    await fetch('/api/auth/login', { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">AIM</h1>
              <nav className="flex space-x-4">
                <button
                  onClick={() => setActiveTab('search')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === 'search'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  AI Search
                </button>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    activeTab === 'admin'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Data Overview
                </button>
              </nav>
            </div>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'search' ? (
          <AISearchInterface
            onAddToShortlist={handleAddToShortlist}
            shortlist={shortlist}
          />
        ) : (
          <AdminPanel />
        )}
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