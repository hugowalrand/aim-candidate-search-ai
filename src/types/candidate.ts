// Production candidate data model following expert recommendations

export interface Candidate {
  id: string
  full_name: string
  headline?: string                    // e.g., "CTO, B2B SaaS, Fintech"
  locations?: string[]                 // ["Kenya","Remote","EU"]
  regions?: string[]                   // normalized macro-regions
  email?: string
  linkedin_url?: string
  skills?: string[]                    // ["Python","LLM","Fundraising"]
  fundraising_stage?: string           // ["None","Preseed","Seed","Series A","Series B+"]
  tech_cofounder?: boolean
  notes?: string                       // unstructured recruiter notes
  cv_text?: string                     // fulltext (parsed)
  tags?: string[]                      // ["AIM_alumni_2024","healthcare"]
  years_experience?: number
  last_active_utc?: string

  // Search optimization fields
  embedding?: number[]                 // Voyage 3.5 doc embedding
  combined_text?: string               // concatenated text used for BM25/vector
}

export interface QueryIntent {
  must_have_keywords: string[]
  nice_to_have_keywords: string[]
  regions: string[]
  exclude_regions: string[]
  fundraising_required: boolean
  tech_required: boolean
  weights: {
    lexical: number        // 0..1
    semantic: number       // 0..1
    regional: number       // 0..1
    fundraising: number    // 0..1
    technical: number      // 0..1
  }
}

export interface SearchResult extends Candidate {
  score: number
  explanation: string
  score_breakdown: {
    bm25_score: number
    vector_score: number
    rerank_score: number
    regional_match: number
    fundraising_match: number
    technical_match: number
    final_score: number
  }
}