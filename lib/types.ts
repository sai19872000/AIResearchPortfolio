// Domain types for the saiteja.ai site, mirroring the Firestore schema
// produced by scripts/migrate_to_firestore.py.

export interface BlogPost {
  id: string
  title: string
  slug: string
  summary: string | null
  content: string // markdown
  tags: string[]
  readTime: number | null
  published: boolean
  publishedAt: string | null
  createdAt: string | null
  updatedAt: string | null
  linkedinPost: string | null
  twitterPost: string | null
  referenceIds: string[]
  imageIds: string[]
  heroImage: string | null // Phase 2: nano-banana art, public path
  diagrams: Diagram[] // Phase 2
}

export interface Diagram {
  concept: string
  src: string // public path to rendered PNG
  caption: string | null
}

export type GenStatus = 'queued' | 'generating' | 'ready' | 'failed'

export interface BlogGenRequest {
  id: string
  topic: string
  angle: string | null
  referenceUrls: string[]
  references: { title: string | null; url: string | null; text: string }[] // from PDFs / fetched
  options: { tone?: string; length?: string }
  status: GenStatus
  error: string | null
  resultSlug: string | null
  createdAt: string
  updatedAt: string | null
}

export interface Reference {
  id: string
  type: string | null
  title: string | null
  originalFileName: string | null
  filePath: string | null
  url: string | null
  contentSummary: string | null
  fileSize: number | null
  mimeType: string | null
  uploadedAt: string | null
}

// portfolio/main — verbatim shape of data/portfolio-content.json
export interface Portfolio {
  personal: {
    name: string
    title: string
    subtitle: string
    bio: string
    email: string
    phone: string
    location: string
    overview: string
    resumeUrl: string
    LinkedInUrl: string
    GitHubUrl: string
  }
  education: { degree: string; institution: string; period: string; gpa: string }
  hero: Record<string, string>
  about: Record<string, string>
  skills: Record<string, string[]>
  experience: Array<{ title: string; company: string; period: string; achievements: string[] }>
  projects: Array<{
    title: string
    description: string
    technologies: string[]
    period: string
    type: string
    codeUrl?: string
    liveUrl?: string
    paperUrl?: string
  }>
  publications: Array<{ title: string; authors: string; journal: string; status: string }>
  sections: Record<string, Record<string, string>>
  contactForm: Record<string, string>
}
