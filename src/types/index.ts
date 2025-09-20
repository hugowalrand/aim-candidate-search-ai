export interface Profile {
  id: string
  first_name: string
  last_name: string
  email?: string
  linkedin_url?: string
  cv_url: string
  submission_date: string

  tech_cofounder: boolean
  regions: string[]
  fundraising_bucket: string

  score_iq?: number
  score_value_fit?: number
  score_start_fit?: number
  score_tech_dev?: number
  score_tech_ai?: number
  flag_llm_screen: number

  checkbox_tags: string[]

  cv_text: string
  nl_blob: string
  created_at: number
}

export interface SearchFilters {
  regions?: string[]
  tech_cofounder?: boolean
  fundraising_bucket?: string[]
  start_fit_min?: number
  tech_ai_min?: number
  exclude_flagged?: boolean
}

export interface ShortlistItem {
  id: string
  first_name: string
  last_name: string
  email?: string
  linkedin_url?: string
  cv_url: string
}

export interface ParsedCV {
  text: string
  structured_data?: {
    name?: string
    email?: string
    skills?: string[]
    experience?: string[]
  }
}