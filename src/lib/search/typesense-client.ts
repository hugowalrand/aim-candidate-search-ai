// Production Typesense client for hybrid search
import Typesense from 'typesense'

export const typesenseClient = new Typesense.Client({
  nodes: [{
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '8108'),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http'
  }],
  apiKey: process.env.TYPESENSE_API_KEY || 'development-key',
  connectionTimeoutSeconds: 10
})

// Collection schema for candidates following expert recommendations
export const CANDIDATES_COLLECTION_SCHEMA = {
  name: 'candidates',
  fields: [
    { name: 'id', type: 'string' },
    { name: 'full_name', type: 'string', sort: true },
    { name: 'headline', type: 'string', optional: true },
    { name: 'locations', type: 'string[]', optional: true },
    { name: 'regions', type: 'string[]', optional: true },
    { name: 'email', type: 'string', optional: true },
    { name: 'linkedin_url', type: 'string', optional: true },
    { name: 'skills', type: 'string[]', optional: true },
    { name: 'fundraising_stage', type: 'string', optional: true, facet: true },
    { name: 'tech_cofounder', type: 'bool', optional: true, facet: true },
    { name: 'tags', type: 'string[]', optional: true, facet: true },
    { name: 'years_experience', type: 'int32', optional: true },
    { name: 'combined_text', type: 'string' },           // For BM25 search
    { name: 'embedding', type: 'float[]', num_dim: 1536 } // For vector search
  ],
  default_sorting_field: 'full_name'
} as const

export async function initializeTypesense() {
  try {
    // Check if collection exists, delete if it does (for development)
    try {
      await typesenseClient.collections('candidates').delete()
      console.log('🗑️ Deleted existing candidates collection')
    } catch (error) {
      // Collection doesn't exist, which is fine
    }

    // Create collection
    await typesenseClient.collections().create(CANDIDATES_COLLECTION_SCHEMA)
    console.log('✅ Created candidates collection with hybrid search schema')

    return true
  } catch (error) {
    console.error('❌ Failed to initialize Typesense:', error)
    throw error
  }
}

export async function healthCheck() {
  try {
    const health = await typesenseClient.health.retrieve()
    console.log('✅ Typesense health check passed:', health)
    return true
  } catch (error) {
    console.error('❌ Typesense health check failed:', error)
    return false
  }
}