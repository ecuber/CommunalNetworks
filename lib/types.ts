export interface Connection {
  id: string
  name: string
  category: string
  categories?: string[]
  mutualConnections: string[]
  userId: string
  userName: string
  createdAt: number
}

export interface User {
  id: string
  name: string
  createdAt: number
}

export interface DuplicateSuggestion {
  name: string
  matches: Connection[]
  matchingUsers?: User[] // Users whose names match this connection
  confidence: 'high' | 'medium' | 'low'
  reason?: string // Explanation of why this is a duplicate
}

export interface NetworkNode {
  id: string
  name: string
  category: string
  categories?: string[]
  userId?: string
  userName?: string
  group: number // for color coding
  nodeType?: 'person' | 'category' | 'user' | 'root'
  isCurrentUser?: boolean // backwards compatibility flag
  memberCount?: number // number of people in this category (for category nodes)
}

export interface NetworkLink {
  source: string
  target: string
  value: number
}

