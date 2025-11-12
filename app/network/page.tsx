'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Connection, User } from '../../lib/types'
import { storage } from '../../lib/storage'
import { buildNetworkData } from '../../lib/network'
import { assignCategoryColors } from '../../lib/categoryConfig'
import { supabase } from '../../lib/supabaseClient'
import D3NetworkGraph from '../../components/D3NetworkGraph'
import styles from './page.module.css'

const normalizeCategory = (category: string) => (category?.trim() ? category.trim() : 'Uncategorized')

export default function NetworkPage() {
  const router = useRouter()
  const [connections, setConnections] = useState<Connection[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser())
  const [networkData, setNetworkData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState<any>(null)

  useEffect(() => {
    let active = true

    const handleConnectionsChange = async () => {
      try {
        const data = await storage.fetchConnections()
        if (active) {
          setConnections(data)
        }
      } catch (error) {
        console.error('Failed to load network connections', error)
      }
    }

    handleConnectionsChange()

    const connectionsChannel = supabase
      .channel('public:connections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, handleConnectionsChange)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(connectionsChannel)
    }
  }, [])

  useEffect(() => {
    const updateCurrentUser = () => {
      setCurrentUser(storage.getCurrentUser())
    }

    updateCurrentUser()

    const handleStorage = (event: StorageEvent) => {
      if (event.key === 'communal_networks_current_user') {
        updateCurrentUser()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage)
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage)
      }
    }
  }, [])

  useEffect(() => {
    setNetworkData(buildNetworkData(connections, currentUser))
  }, [connections, currentUser])

  const categoryColors = useMemo(() => {
    const categoryList = Array.from(
      new Set(
        connections.flatMap(connection =>
          connection.categories && connection.categories.length > 0
            ? connection.categories.map(normalizeCategory)
            : [normalizeCategory(connection.category)]
        )
      )
    )

    const map = assignCategoryColors(categoryList)
    map.set('UMass InterVarsity', '#95C93D')
    if (currentUser) {
      map.set('Current User', '#D41A69')
    }
    return map
  }, [connections, currentUser])

  const handleNodeClick = (node: any) => {
    setSelectedNode(node)
  }

  const clearSelection = () => setSelectedNode(null)

  const getConnectionCategories = (connection: Connection): string[] => {
    if (connection.categories && connection.categories.length > 0) {
      return connection.categories.map(normalizeCategory)
    }
    return [normalizeCategory(connection.category)]
  }

  const getMembersForCategory = (category: string) =>
    connections.filter(connection => getConnectionCategories(connection).includes(category))

  const groupCount = useMemo(() => {
    return new Set(
      connections.flatMap(connection => getConnectionCategories(connection))
    ).size
  }, [connections])

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Network Map</h1>
          <button onClick={() => router.push('/')} className={styles.backButton}>
            ← Back to Data Entry
          </button>
        </div>

        {connections.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No connections to display. Add some connections first!</p>
            <button onClick={() => router.push('/')} className={styles.addButton}>
              Add Connections
            </button>
          </div>
        ) : (
          <>
            <div className={styles.legend}>
              <h3>Categories</h3>
              <div className={styles.legendItems}>
                {Array.from(categoryColors.entries())
                  .sort(([a], [b]) => {
                    if (a === 'UMass InterVarsity') return -1
                    if (b === 'UMass InterVarsity') return 1
                    if (a === 'Current User') return -1
                    if (b === 'Current User') return 1
                    return a.localeCompare(b)
                  })
                  .map(([category, color]) => (
                    <div key={category} className={styles.legendItem}>
                      <span className={styles.legendColor} style={{ backgroundColor: color }} />
                      <span>{category}</span>
                    </div>
                  ))}
              </div>
            </div>

            <div className={styles.graphContainer}>
              {networkData.nodes.length > 0 && (
                <D3NetworkGraph
                  nodes={networkData.nodes}
                  links={networkData.links}
                  nodeColors={categoryColors}
                  onNodeClick={handleNodeClick}
                  connections={connections}
                  currentUser={currentUser}
                />
              )}
            </div>

            {selectedNode && (
              <div className={styles.nodeInfo}>
                <h3>
                  {selectedNode.name}{' '}
                  {selectedNode.nodeType === 'user' && '(You)'}
                </h3>
                {selectedNode.nodeType === 'user' ? (
                  <>
                    <p><strong>Role:</strong> Current User</p>
                    <p>
                      <strong>Connections:</strong>{' '}
                      {connections.filter(connection => connection.userId === currentUser?.id).length} people added
                    </p>
                    <p>
                      <strong>Groups contributed to:</strong>{' '}
                      {new Set(
                        connections
                          .filter(connection => connection.userId === currentUser?.id)
                          .flatMap(connection => getConnectionCategories(connection))
                      ).size}
                    </p>
                  </>
                ) : selectedNode.nodeType === 'root' ? (
                  <>
                    <p>
                      <strong>Total Groups:</strong> {groupCount}
                    </p>
                    <p>
                      <strong>Total People:</strong> {connections.length}
                    </p>
                    <p>
                      <strong>Contributors:</strong> {new Set(connections.map(connection => connection.userId)).size}
                    </p>
                  </>
                ) : selectedNode.nodeType === 'category' ? (
                  (() => {
                    const members = getMembersForCategory(selectedNode.name)
                    return (
                      <>
                        <p>
                          <strong>Group Size:</strong>{' '}
                          {members.length}
                        </p>
                        <div className={styles.memberList}>
                          {members.slice(0, 10).map(connection => (
                            <span key={connection.id} className={styles.memberTag}>
                              {connection.name}
                            </span>
                          ))}
                          {members.length > 10 && (
                            <span className={styles.memberOverflow}>
                              +{members.length - 10} more
                            </span>
                          )}
                        </div>
                      </>
                    )
                  })()
                ) : (
                  <>
                    <p>
                      <strong>Categories:</strong>{' '}
                      {(selectedNode.categories && selectedNode.categories.length > 0
                        ? selectedNode.categories
                        : [selectedNode.category]
                      ).join(', ')}
                    </p>
                    {selectedNode.userName && (
                      <p><strong>Added by:</strong> {selectedNode.userName}</p>
                    )}
                    {(() => {
                      const connection = connections.find(conn => conn.id === selectedNode.id)
                      if (connection && connection.mutualConnections.length > 0) {
                        return (
                          <p>
                            <strong>Mutual Connections:</strong> {connection.mutualConnections.join(', ')}
                          </p>
                        )
                      }
                      return null
                    })()}
                  </>
                )}
                <button onClick={clearSelection} className={styles.closeButton}>
                  Close
                </button>
              </div>
            )}

            <div className={styles.stats}>
              <div className={styles.stat}>
                <strong>{networkData.nodes.filter(node => node.nodeType === 'person').length}</strong> People
              </div>
              <div className={styles.stat}>
                <strong>{networkData.nodes.filter(node => node.nodeType === 'category').length}</strong> Groups
              </div>
              <div className={styles.stat}>
                <strong>{networkData.links.length}</strong> Connections
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

