import { Connection, NetworkLink, NetworkNode, User } from './types'

const normalizeCategory = (category: string) => (category?.trim() ? category.trim() : 'Uncategorized')

export function buildNetworkData(
  connections: Connection[],
  currentUser: User | null,
): { nodes: NetworkNode[]; links: NetworkLink[] } {
  const nodesMap = new Map<string, NetworkNode>()
  const links: NetworkLink[] = []
  const categoryMap = new Map<string, number>()
  let categoryIndex = 0

  const categoryCounts = new Map<string, number>()
  connections.forEach(connection => {
    const categories = connection.categories && connection.categories.length > 0
      ? connection.categories
      : [connection.category]

    categories.forEach(categoryValue => {
      const category = normalizeCategory(categoryValue)
      if (!categoryMap.has(category)) {
        categoryMap.set(category, categoryIndex++)
      }
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1)
    })
  })

  const rootNodeId = 'root:umass-intervarsity'
  if (categoryCounts.size > 0) {
    nodesMap.set(rootNodeId, {
      id: rootNodeId,
      name: 'UMass InterVarsity',
      category: 'UMass InterVarsity',
      group: -2,
      nodeType: 'root',
    })
  }

  categoryCounts.forEach((count, category) => {
    const categoryNodeId = `category:${category}`
    nodesMap.set(categoryNodeId, {
      id: categoryNodeId,
      name: category,
      category,
      group: categoryMap.get(category)!,
      nodeType: 'category',
      memberCount: count,
    })

    if (nodesMap.has(rootNodeId)) {
      links.push({
        source: categoryNodeId,
        target: rootNodeId,
        value: 3,
      })
    }
  })

  const mutualLinkKeys = new Set<string>()

  connections.forEach(connection => {
    const categories = connection.categories && connection.categories.length > 0
      ? connection.categories.map(normalizeCategory)
      : [normalizeCategory(connection.category)]
    const primaryCategory = categories[0]

    const personNode: NetworkNode = {
      id: connection.id,
      name: connection.name,
      category: primaryCategory,
      categories,
      userId: connection.userId,
      userName: connection.userName,
      group: categoryMap.get(primaryCategory) ?? 0,
      nodeType: 'person',
    }

    nodesMap.set(connection.id, personNode)

    categories.forEach(category => {
      const categoryNodeId = `category:${category}`
      if (nodesMap.has(categoryNodeId)) {
        links.push({
          source: connection.id,
          target: categoryNodeId,
          value: 2,
        })
      }
    })

    connection.mutualConnections.forEach(mutualName => {
      const matchingConnections = connections.filter(
        c => c.name === mutualName && c.id !== connection.id,
      )

      matchingConnections.forEach(mutualConnection => {
        const linkKey = [connection.id, mutualConnection.id].sort().join('|')
        if (!mutualLinkKeys.has(linkKey)) {
          mutualLinkKeys.add(linkKey)
          links.push({
            source: connection.id,
            target: mutualConnection.id,
            value: 1,
          })
        }
      })
    })
  })

  if (currentUser) {
    const userNodeId = `user:${currentUser.id}`
    const userCategories = new Set(
      connections
        .filter(connection => connection.userId === currentUser.id)
        .flatMap(connection =>
          connection.categories && connection.categories.length > 0
            ? connection.categories.map(normalizeCategory)
            : [normalizeCategory(connection.category)]
        ),
    )

    if (userCategories.size > 0) {
      nodesMap.set(userNodeId, {
        id: userNodeId,
        name: currentUser.name,
        category: 'Current User',
        userId: currentUser.id,
        userName: currentUser.name,
        group: -1,
        nodeType: 'user',
        isCurrentUser: true,
      })

      userCategories.forEach(category => {
        const categoryNodeId = `category:${category}`
        if (nodesMap.has(categoryNodeId)) {
          links.push({
            source: userNodeId,
            target: categoryNodeId,
            value: 2.5,
          })
        }
      })

      if (nodesMap.has(rootNodeId)) {
        links.push({
          source: userNodeId,
          target: rootNodeId,
          value: 2,
        })
      }
    }
  }

  return {
    nodes: Array.from(nodesMap.values()),
    links,
  }
}

export function getCategoryColor(categoryIndex: number, totalCategories: number): string {
  const hue = (categoryIndex * 360) / Math.max(totalCategories, 1)
  return `hsl(${hue}, 70%, 50%)`
}

