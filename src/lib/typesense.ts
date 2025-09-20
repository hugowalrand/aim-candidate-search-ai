import { Client } from 'typesense'

export const typesenseClient = new Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || 'localhost',
      port: Number(process.env.TYPESENSE_PORT) || 8108,
      protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    },
  ],
  apiKey: process.env.TYPESENSE_API_KEY || 'xyz',
  connectionTimeoutSeconds: 2,
})

export const COLLECTION_NAME = 'profiles'

export const SCHEMA = {
  name: COLLECTION_NAME,
  fields: [
    { name: 'id', type: 'string' },
    { name: 'first_name', type: 'string' },
    { name: 'last_name', type: 'string' },
    { name: 'email', type: 'string', optional: true },
    { name: 'linkedin_url', type: 'string', optional: true },
    { name: 'cv_url', type: 'string' },
    { name: 'submission_date', type: 'string', facet: true },

    { name: 'tech_cofounder', type: 'bool', facet: true },
    { name: 'regions', type: 'string[]', facet: true },
    { name: 'fundraising_bucket', type: 'string', facet: true },

    { name: 'score_iq', type: 'float', optional: true },
    { name: 'score_value_fit', type: 'float', optional: true },
    { name: 'score_start_fit', type: 'float', optional: true },
    { name: 'score_tech_dev', type: 'float', optional: true },
    { name: 'score_tech_ai', type: 'float', optional: true },
    { name: 'flag_llm_screen', type: 'float', facet: true },

    { name: 'checkbox_tags', type: 'string[]', facet: true },

    { name: 'cv_text', type: 'string' },
    { name: 'nl_blob', type: 'string' },
    { name: 'created_at', type: 'int64', facet: true },
  ],
  default_sorting_field: 'created_at',
  token_separators: [' ', '-', '_', '/'],
} as const

export async function initializeTypesense() {
  try {
    // Check if collection exists
    await typesenseClient.collections(COLLECTION_NAME).retrieve()
    console.log('Collection already exists')
  } catch (error) {
    // Collection doesn't exist, create it
    console.log('Creating collection...')
    await typesenseClient.collections().create(SCHEMA)
    console.log('Collection created successfully')
  }
}