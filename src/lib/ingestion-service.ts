// Production ingestion service for Typesense + Voyage embeddings
import { loadProfilesFromCSV } from './data-loader'
import { transformCandidateData } from './data-transformer'
import { EmbeddingService, createCombinedText } from './search/embedding-service'
import { typesenseClient, initializeTypesense } from './search/typesense-client'
import type { Candidate } from '@/types/candidate'

export class IngestionService {
  private embeddingService: EmbeddingService

  constructor() {
    this.embeddingService = new EmbeddingService()
  }

  async ingestCandidates(): Promise<{ success: boolean; count: number; errors: string[] }> {
    console.log('🚀 Starting candidate ingestion pipeline')
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Step 1: Initialize Typesense
      await initializeTypesense()

      // Step 2: Load and transform raw data
      console.log('📂 Loading profiles from CSV...')
      const rawProfiles = loadProfilesFromCSV()
      console.log(`📊 Loaded ${rawProfiles.length} raw profiles`)

      // Transform to candidate format
      const candidates: Candidate[] = []
      for (const rawProfile of rawProfiles) {
        const candidate = transformCandidateData(rawProfile)
        if (candidate) {
          candidates.push(candidate)
        } else {
          errors.push(`Failed to transform profile: ${rawProfile['First name']} ${rawProfile['Last name']}`)
        }
      }

      console.log(`✅ Transformed ${candidates.length} candidates`)

      // Step 3: Prepare candidates (skip embeddings for now due to API limits)
      console.log('⚡ Preparing candidates for BM25-only search (skipping embeddings)')
      const candidatesWithEmbeddings: Candidate[] = []

      // Add all candidates with empty embeddings for BM25-only search
      candidates.forEach(candidate => {
        // Ensure combined_text is set for BM25 search
        if (!candidate.combined_text) {
          candidate.combined_text = createCombinedText(candidate)
        }
        // Set empty embedding for now
        candidate.embedding = []
        candidatesWithEmbeddings.push(candidate)
      })

      console.log(`✅ Prepared ${candidatesWithEmbeddings.length} candidates for BM25 search`)

      // Step 4: Upsert to Typesense in batches
      console.log('📤 Uploading to Typesense...')
      const upsertBatchSize = 100
      let uploadedCount = 0

      for (let i = 0; i < candidatesWithEmbeddings.length; i += upsertBatchSize) {
        const batch = candidatesWithEmbeddings.slice(i, i + upsertBatchSize)

        try {
          // Prepare documents for Typesense
          const documents = batch.map(candidate => ({
            id: candidate.id,
            full_name: candidate.full_name,
            headline: candidate.headline || '',
            locations: candidate.locations || [],
            regions: candidate.regions || [],
            email: candidate.email || '',
            linkedin_url: candidate.linkedin_url || '',
            skills: candidate.skills || [],
            fundraising_stage: candidate.fundraising_stage || 'None',
            tech_cofounder: candidate.tech_cofounder || false,
            tags: candidate.tags || [],
            years_experience: candidate.years_experience || 0,
            combined_text: candidate.combined_text || '',
            embedding: candidate.embedding || []
          }))

          const response = await typesenseClient
            .collections('candidates')
            .documents()
            .import(documents, { action: 'upsert' })

          // Check for errors in the batch
          const batchErrors = response.filter((result: any) => !result.success)
          if (batchErrors.length > 0) {
            console.warn(`⚠️ ${batchErrors.length} documents failed in batch`)
            batchErrors.forEach((error: any, index: number) => {
              errors.push(`Document ${batch[index].full_name}: ${error.error}`)
            })
          }

          uploadedCount += batch.length - batchErrors.length
          console.log(`📤 Uploaded batch ${Math.floor(i / upsertBatchSize) + 1}/${Math.ceil(candidatesWithEmbeddings.length / upsertBatchSize)}`)

        } catch (error) {
          console.error(`❌ Failed to upload batch ${Math.floor(i / upsertBatchSize) + 1}:`, error)
          errors.push(`Upload failed for batch ${Math.floor(i / upsertBatchSize) + 1}: ${error}`)
        }
      }

      const totalTime = Date.now() - startTime
      console.log(`✅ Ingestion completed in ${totalTime}ms`)
      console.log(`📊 Results: ${uploadedCount}/${candidatesWithEmbeddings.length} candidates uploaded`)

      if (errors.length > 0) {
        console.log(`⚠️ ${errors.length} errors occurred during ingestion`)
        errors.forEach(error => console.log(`   - ${error}`))
      }

      return {
        success: uploadedCount > 0,
        count: uploadedCount,
        errors
      }

    } catch (error) {
      console.error('❌ Ingestion pipeline failed:', error)
      return {
        success: false,
        count: 0,
        errors: [`Pipeline failure: ${error}`]
      }
    }
  }

  async getCollectionStats() {
    try {
      const collection = await typesenseClient.collections('candidates').retrieve()
      return {
        name: collection.name,
        num_documents: collection.num_documents,
        fields: collection.fields?.length || 0,
        created_at: collection.created_at
      }
    } catch (error) {
      console.error('❌ Failed to get collection stats:', error)
      return null
    }
  }

  async healthCheck() {
    try {
      const health = await typesenseClient.health.retrieve()
      const stats = await this.getCollectionStats()

      return {
        typesense: health.ok ? 'healthy' : 'unhealthy',
        collection: stats ? `${stats.num_documents} documents` : 'not found',
        embedding_service: this.embeddingService ? 'ready' : 'not configured'
      }
    } catch (error) {
      return {
        typesense: 'error',
        collection: 'unknown',
        embedding_service: 'unknown',
        error: String(error)
      }
    }
  }
}