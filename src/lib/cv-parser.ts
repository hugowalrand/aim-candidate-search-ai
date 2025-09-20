import type { ParsedCV } from '../types'

export async function fetchAndParseCV(cvUrl: string): Promise<ParsedCV> {
  try {
    // First, validate the URL
    if (!cvUrl || !isValidPdfUrl(cvUrl)) {
      throw new Error('Invalid CV URL')
    }

    // Try to fetch the PDF first to check if it's accessible
    const response = await fetch(cvUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch CV: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()

    // Try Affinda first
    if (process.env.AFFINDA_API_KEY && process.env.AFFINDA_API_KEY !== 'placeholder') {
      try {
        const result = await parseWithAffinda(arrayBuffer)
        return result
      } catch (error) {
        console.warn('Affinda parsing failed, trying LlamaParse:', error)
      }
    }

    // Fallback to LlamaParse
    if (process.env.LLAMAPARSE_API_KEY && process.env.LLAMAPARSE_API_KEY !== 'placeholder') {
      try {
        const result = await parseWithLlamaParse(arrayBuffer)
        return result
      } catch (error) {
        console.warn('LlamaParse failed:', error)
      }
    }

    // If both fail, return a basic result with URL info
    return {
      text: `CV not parsed - URL: ${cvUrl}`,
      structured_data: undefined
    }

  } catch (error) {
    console.error('CV parsing failed:', error)
    throw error
  }
}

async function parseWithAffinda(pdfBuffer: ArrayBuffer): Promise<ParsedCV> {
  const formData = new FormData()
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }))

  const response = await fetch('https://api.affinda.com/v3/resumes', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.AFFINDA_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`Affinda API error: ${response.status}`)
  }

  const data = await response.json()

  // Extract text and structured data from Affinda response
  const text = data.data?.raw_text || ''
  const structured_data = {
    name: data.data?.name?.raw || '',
    email: data.data?.emails?.[0]?.email || '',
    skills: data.data?.skills?.map((skill: any) => skill.name) || [],
    experience: data.data?.work_experience?.map((exp: any) =>
      `${exp.job_title || ''} at ${exp.organization || ''}`
    ) || []
  }

  return { text, structured_data }
}

async function parseWithLlamaParse(pdfBuffer: ArrayBuffer): Promise<ParsedCV> {
  const formData = new FormData()
  formData.append('file', new Blob([pdfBuffer], { type: 'application/pdf' }))

  const response = await fetch('https://api.cloud.llamaindex.ai/api/parsing/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.LLAMAPARSE_API_KEY}`,
    },
    body: formData,
  })

  if (!response.ok) {
    throw new Error(`LlamaParse API error: ${response.status}`)
  }

  const data = await response.json()

  // LlamaParse typically returns markdown text
  const text = data.text || data.content || ''

  return {
    text,
    structured_data: undefined // LlamaParse doesn't provide structured data in the same way
  }
}

function isValidPdfUrl(url: string): boolean {
  try {
    new URL(url)
    return url.toLowerCase().includes('.pdf') || url.includes('jotform.com')
  } catch {
    return false
  }
}

// For development/testing - mock parser that returns sample text
export function createMockCV(firstName: string, lastName: string): ParsedCV {
  return {
    text: `
RESUME
${firstName} ${lastName}

PROFESSIONAL EXPERIENCE
- Software Engineer at Tech Corp (2020-2023)
- Product Manager at StartupXYZ (2018-2020)
- Worked extensively with teams in emerging markets
- Experience in alternative protein industry
- Led fundraising efforts for early-stage startup

EDUCATION
- MBA from Business School
- BS Computer Science

SKILLS
- Project management
- Technical leadership
- Business development
- Market analysis
    `.trim(),
    structured_data: {
      name: `${firstName} ${lastName}`,
      email: '',
      skills: ['Project management', 'Technical leadership', 'Business development'],
      experience: ['Software Engineer at Tech Corp', 'Product Manager at StartupXYZ']
    }
  }
}