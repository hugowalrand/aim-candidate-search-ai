'use client'

import { useState, useEffect } from 'react'

export default function AdminPanel() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/ingest')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-6">Production Search System</h2>
        <div className="animate-pulse">Loading system status...</div>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-6">Production Search System</h2>
        <div className="text-red-600">Failed to load system status</div>
      </div>
    )
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-semibold mb-6">Production Search System</h2>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{stats.collection_stats?.num_documents || 0}</div>
          <div className="text-sm text-gray-600">Total Candidates</div>
        </div>
        <div className="bg-green-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-green-600">32</div>
          <div className="text-sm text-gray-600">Search Fields</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">
            {stats.status === 'ready' ? '✓' : '⚠'}
          </div>
          <div className="text-sm text-gray-600">System Status</div>
        </div>
      </div>

      {/* Health Status */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">System Health</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-medium">Typesense Search Backend</span>
            <span className={`px-2 py-1 rounded text-sm ${
              stats.health?.typesense === 'healthy'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}>
              {stats.health?.typesense || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-medium">Collection Status</span>
            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
              {stats.health?.collection || 'Unknown'}
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <span className="font-medium">Embedding Service</span>
            <span className={`px-2 py-1 rounded text-sm ${
              stats.health?.embedding_service === 'ready'
                ? 'bg-green-100 text-green-700'
                : 'bg-yellow-100 text-yellow-700'
            }`}>
              {stats.health?.embedding_service || 'Unknown'}
            </span>
          </div>
        </div>
      </div>

      {/* API Endpoints */}
      <div className="mb-6">
        <h3 className="text-lg font-medium mb-3">API Endpoints</h3>
        <div className="space-y-2">
          <div className="p-3 bg-gray-50 rounded font-mono text-sm">
            <div className="font-bold">Search:</div>
            <div>POST {stats.endpoints?.search || '/api/search'}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded font-mono text-sm">
            <div className="font-bold">Ingest:</div>
            <div>{stats.endpoints?.ingest || 'POST /api/ingest'}</div>
          </div>
        </div>
      </div>

      {/* Search Architecture */}
      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
        <h4 className="font-medium mb-2">🏗️ Production Architecture</h4>
        <div className="text-sm text-gray-700 space-y-1">
          <div>🔍 <strong>Hybrid Search:</strong> Vector + BM25 + RRF Fusion</div>
          <div>🧠 <strong>Models:</strong> Gemini 2.5 Flash + Voyage 3.5-Large + Cohere Rerank-3.5</div>
          <div>⚡ <strong>Backend:</strong> Typesense 29.x with vector support</div>
          <div>📊 <strong>Features:</strong> Intent extraction, explainable scoring, fallbacks</div>
        </div>
      </div>
    </div>
  )
}