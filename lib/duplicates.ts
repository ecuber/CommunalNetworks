import { Connection, DuplicateSuggestion, User } from './types'
import Fuse from 'fuse.js'

export function findDuplicateSuggestions(
  connections: Connection[], 
  users: User[] = []
): DuplicateSuggestion[] {
  if (connections.length === 0) return []

  const suggestions: DuplicateSuggestion[] = []
  const processed = new Set<string>()

  // Normalize function for name comparison
  const normalize = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ')

  // Create a map of user names for quick lookup
  const userMap = new Map<string, User[]>()
  users.forEach(user => {
    const normalized = normalize(user.name)
    if (!userMap.has(normalized)) {
      userMap.set(normalized, [])
    }
    userMap.get(normalized)!.push(user)
  })

  // Configure Fuse.js for fuzzy name matching
  const fuse = new Fuse(connections, {
    keys: ['name'],
    threshold: 0.4, // Lower threshold = more strict matching
    includeScore: true,
    minMatchCharLength: 3
  })

  // Group connections by normalized name
  const connectionGroups = new Map<string, Connection[]>()
  connections.forEach(connection => {
    const normalized = normalize(connection.name)
    if (!connectionGroups.has(normalized)) {
      connectionGroups.set(normalized, [])
    }
    connectionGroups.get(normalized)!.push(connection)
  })

  // Check for duplicates: same name connections
  connectionGroups.forEach((groupConnections, normalizedName) => {
    if (processed.has(normalizedName) || groupConnections.length < 2) return

    // Multiple connections with the same name
    const uniqueConnections = Array.from(
      new Map(groupConnections.map(c => [c.id, c])).values()
    )

    if (uniqueConnections.length > 1) {
      const matchingUsers = userMap.get(normalizedName) || []
      
      suggestions.push({
        name: uniqueConnections[0].name,
        matches: uniqueConnections,
        matchingUsers: matchingUsers,
        confidence: 'high',
        reason: matchingUsers.length > 0 
          ? `Multiple connections named "${uniqueConnections[0].name}" and ${matchingUsers.length} user(s) with the same name exist.`
          : `Multiple connections named "${uniqueConnections[0].name}" found.`
      })

      processed.add(normalizedName)
    }
  })

  // Check for connections that match user names (even single connections)
  connections.forEach(connection => {
    const normalized = normalize(connection.name)
    if (processed.has(normalized)) return

    const matchingUsers = userMap.get(normalized)
    if (matchingUsers && matchingUsers.length > 0) {
      // Find all connections with the same name (including this one)
      const sameNameConnections = connections.filter(c => 
        normalize(c.name) === normalized
      )

      // Only suggest if we haven't already processed this as a duplicate connection group
      // and if the connection name matches a user (indicating the user might be the same person)
      if (sameNameConnections.length > 1) {
        suggestions.push({
          name: connection.name,
          matches: sameNameConnections,
          matchingUsers: matchingUsers,
          confidence: 'high',
          reason: sameNameConnections.length > 1
            ? `Multiple connections named "${connection.name}" match ${matchingUsers.length} user name(s). This might be the same person.`
            : `Connection "${connection.name}" matches ${matchingUsers.length} user name(s). This might be the same person who added connections.`
        })

        processed.add(normalized)
      }
    }
  })

  // Check for fuzzy matches between connections
  connections.forEach(connection => {
    const normalized = normalize(connection.name)
    if (processed.has(normalized)) return

    const results = fuse.search(connection.name)
    const fuzzyMatches = results
      .filter(result => {
        const matchName = normalize(result.item.name)
        const originalName = normalized
        return matchName !== originalName && 
               result.score! < 0.3 && // Very similar
               !processed.has(matchName)
      })
      .map(result => result.item)

    if (fuzzyMatches.length > 0) {
      const allMatches = [connection, ...fuzzyMatches]
      const uniqueMatches = Array.from(
        new Map(allMatches.map(c => [c.id, c])).values()
      )

      if (uniqueMatches.length > 1) {
        // Check if any match user names
        const allMatchingUsers: User[] = []
        uniqueMatches.forEach(match => {
          const matchNormalized = normalize(match.name)
          const users = userMap.get(matchNormalized) || []
          users.forEach(user => {
            if (!allMatchingUsers.find(u => u.id === user.id)) {
              allMatchingUsers.push(user)
            }
          })
        })

        const highConfidence = uniqueMatches.every(m => {
          const name1 = normalize(m.name)
          const name2 = normalized
          return name1 === name2 || 
                 (name1.replace(/\s+/g, '') === name2.replace(/\s+/g, ''))
        })

        suggestions.push({
          name: connection.name,
          matches: uniqueMatches,
          matchingUsers: allMatchingUsers.length > 0 ? allMatchingUsers : undefined,
          confidence: highConfidence ? 'high' : 
                     uniqueMatches.length === 2 ? 'medium' : 'low',
          reason: allMatchingUsers.length > 0
            ? `Similar names found that match ${allMatchingUsers.length} user(s).`
            : `Similar names found that might be the same person.`
        })

        uniqueMatches.forEach(m => processed.add(normalize(m.name)))
      }
    }
  })

  return suggestions
}

export function normalizeName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ')
}

export function areNamesSimilar(name1: string, name2: string): boolean {
  const norm1 = normalizeName(name1)
  const norm2 = normalizeName(name2)
  
  if (norm1 === norm2) return true
  
  // Check if one contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true
  
  // Check Levenshtein-like similarity for short names
  const shorter = norm1.length < norm2.length ? norm1 : norm2
  const longer = norm1.length >= norm2.length ? norm1 : norm2
  const maxDistance = Math.floor(shorter.length * 0.3)
  
  if (longer.length - shorter.length > maxDistance) return false
  
  return calculateSimilarity(norm1, norm2) > 0.7
}

function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2
  const shorter = str1.length > str2.length ? str2 : str1
  
  if (longer.length === 0) return 1.0
  
  const editDistance = levenshteinDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = []
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i]
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  
  return matrix[str2.length][str1.length]
}

