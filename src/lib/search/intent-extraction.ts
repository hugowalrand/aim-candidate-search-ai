// Intent extraction using Gemini 2.5 Flash with structured outputs
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { QueryIntent } from '@/types/candidate'
import { z } from 'zod'

// Zod schema for query intent
const QueryIntentSchema = z.object({
  must_have_keywords: z.array(z.string()).describe("Essential keywords that must be present"),
  nice_to_have_keywords: z.array(z.string()).describe("Preferred keywords that boost relevance"),
  regions: z.array(z.string()).describe("Geographic regions of interest"),
  exclude_regions: z.array(z.string()).describe("Regions to exclude"),
  fundraising_required: z.boolean().describe("Whether fundraising experience is required"),
  tech_required: z.boolean().describe("Whether technical co-founder capability is required"),
  weights: z.object({
    lexical: z.number().min(0).max(1).describe("Weight for keyword matching"),
    semantic: z.number().min(0).max(1).describe("Weight for semantic similarity"),
    regional: z.number().min(0).max(1).describe("Weight for regional preferences"),
    fundraising: z.number().min(0).max(1).describe("Weight for fundraising experience"),
    technical: z.number().min(0).max(1).describe("Weight for technical capabilities")
  })
})

// Convert Zod to Gemini schema format
const geminiSchema = {
  type: SchemaType.OBJECT,
  properties: {
    must_have_keywords: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Essential keywords that must be present"
    },
    nice_to_have_keywords: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Preferred keywords that boost relevance"
    },
    regions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Geographic regions of interest"
    },
    exclude_regions: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Regions to exclude"
    },
    fundraising_required: {
      type: SchemaType.BOOLEAN,
      description: "Whether fundraising experience is required"
    },
    tech_required: {
      type: SchemaType.BOOLEAN,
      description: "Whether technical co-founder capability is required"
    },
    weights: {
      type: SchemaType.OBJECT,
      properties: {
        lexical: { type: SchemaType.NUMBER, description: "Weight for keyword matching" },
        semantic: { type: SchemaType.NUMBER, description: "Weight for semantic similarity" },
        regional: { type: SchemaType.NUMBER, description: "Weight for regional preferences" },
        fundraising: { type: SchemaType.NUMBER, description: "Weight for fundraising experience" },
        technical: { type: SchemaType.NUMBER, description: "Weight for technical capabilities" }
      },
      required: ["lexical", "semantic", "regional", "fundraising", "technical"]
    }
  },
  required: [
    "must_have_keywords", "nice_to_have_keywords", "regions", "exclude_regions",
    "fundraising_required", "tech_required", "weights"
  ]
}

export class IntentExtractionService {
  private readonly genAI: GoogleGenerativeAI
  private readonly model

  constructor() {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      throw new Error('GOOGLE_API_KEY is required for intent extraction')
    }

    this.genAI = new GoogleGenerativeAI(apiKey)
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        topP: 0.8,
        topK: 10,
        responseMimeType: "application/json",
        responseSchema: geminiSchema
      }
    })
  }

  async extractIntent(query: string): Promise<QueryIntent> {
    try {
      const prompt = `
Analyze this candidate search query and extract structured intent information.

Query: "${query}"

Extract the following information:

1. MUST_HAVE_KEYWORDS: Essential terms that candidates must match (e.g., "technical", "B2B", "healthcare")
2. NICE_TO_HAVE_KEYWORDS: Preferred terms that boost relevance
3. REGIONS: Geographic preferences (use standard region names like "Africa", "Europe", "North America", "Asia Pacific", etc.)
4. EXCLUDE_REGIONS: Regions to avoid
5. FUNDRAISING_REQUIRED: true if fundraising experience is explicitly required
6. TECH_REQUIRED: true if technical co-founder capability is explicitly required
7. WEIGHTS: Relative importance of each scoring dimension (0.0-1.0)

Guidelines for weights:
- If query mentions specific keywords/skills: higher lexical weight
- If query is conceptual/thematic: higher semantic weight
- If regions specified: higher regional weight
- If fundraising mentioned: higher fundraising weight
- If "technical" mentioned: higher technical weight
- Default: balanced weights around 0.6-0.8 for relevant dimensions

Examples:
- "Technical founder in Africa" → tech_required=true, regions=["Africa"], weights favor technical+regional
- "B2B SaaS with Series A experience" → must_have=["B2B", "SaaS", "Series A"], weights favor lexical+fundraising
- "Healthcare leader" → must_have=["healthcare"], semantic weight higher for leadership concepts
`

      console.log('🧠 Extracting intent from query:', query)
      const result = await this.model.generateContent(prompt)
      const response = result.response
      const text = response.text()

      // Parse the JSON response
      const intentData = JSON.parse(text)

      // Validate with Zod
      const validatedIntent = QueryIntentSchema.parse(intentData)

      console.log('✅ Intent extracted:', {
        keywords: validatedIntent.must_have_keywords.length + validatedIntent.nice_to_have_keywords.length,
        regions: validatedIntent.regions.length,
        weights: validatedIntent.weights
      })

      return validatedIntent

    } catch (error) {
      console.error('❌ Intent extraction failed:', error)

      // Fallback to heuristic parsing
      return this.heuristicParse(query)
    }
  }

  private heuristicParse(query: string): QueryIntent {
    console.log('🔧 Using heuristic intent parsing')

    const lowerQuery = query.toLowerCase()

    // Simple keyword extraction
    const keywords = []
    const techKeywords = ['technical', 'tech', 'cofounder', 'co-founder', 'engineering', 'developer']
    const fundingKeywords = ['funding', 'raised', 'series a', 'series b', 'seed', 'fundraising', 'investment']
    const regionKeywords = ['africa', 'europe', 'asia', 'america', 'remote']

    // Extract tech requirement
    const tech_required = techKeywords.some(kw => lowerQuery.includes(kw))
    if (tech_required) keywords.push('technical')

    // Extract funding requirement
    const fundraising_required = fundingKeywords.some(kw => lowerQuery.includes(kw))
    if (fundraising_required) keywords.push('fundraising')

    // Extract regions
    const regions = regionKeywords.filter(region =>
      lowerQuery.includes(region)
    ).map(region => region.charAt(0).toUpperCase() + region.slice(1))

    return {
      must_have_keywords: keywords,
      nice_to_have_keywords: [],
      regions,
      exclude_regions: [],
      fundraising_required,
      tech_required,
      weights: {
        lexical: 0.7,
        semantic: 0.8,
        regional: regions.length > 0 ? 0.9 : 0.3,
        fundraising: fundraising_required ? 0.9 : 0.3,
        technical: tech_required ? 0.9 : 0.3
      }
    }
  }
}