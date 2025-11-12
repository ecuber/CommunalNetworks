import { supabase } from './supabaseClient'
import { Connection, User } from './types'

const STORAGE_KEYS = {
  CURRENT_USER: 'communal_networks_current_user',
}

type ConnectionInsertInput = {
  name: string
  category: string
  categories?: string[]
  mutualConnections: string[]
  userId: string
  userName: string
}

const mapConnectionRow = (row: any): Connection => {
  const categories: string[] | undefined = row.categories ?? undefined
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    categories: categories && categories.length > 0 ? categories : undefined,
    mutualConnections: row.mutual_connections ?? [],
    userId: row.user_id,
    userName: row.user_name,
    createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
  }
}

const mapUserRow = (row: any): User => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at ? Date.parse(row.created_at) : Date.now(),
})

export const storage = {
  async fetchConnections(): Promise<Connection[]> {
    const { data, error } = await supabase
      .from('connections')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching connections', error)
      throw error
    }

    return (data ?? []).map(mapConnectionRow)
  },

  async insertConnection(input: ConnectionInsertInput): Promise<Connection | null> {
    const categories = input.categories && input.categories.length > 0 ? input.categories : [input.category]

    const { data, error } = await supabase
      .from('connections')
      .insert({
        name: input.name,
        category: input.category,
        categories,
        mutual_connections: input.mutualConnections,
        user_id: input.userId,
        user_name: input.userName,
      })
      .select('*')
      .single()

    if (error) {
      console.error('Error inserting connection', error)
      throw error
    }

    return data ? mapConnectionRow(data) : null
  },

  async updateConnection(id: string, updates: Partial<ConnectionInsertInput>): Promise<void> {
    const payload: Record<string, any> = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.category !== undefined) payload.category = updates.category
    if (updates.categories !== undefined) {
      payload.categories = updates.categories.length > 0 ? updates.categories : null
    }
    if (updates.mutualConnections !== undefined) payload.mutual_connections = updates.mutualConnections
    if (updates.userId !== undefined) payload.user_id = updates.userId
    if (updates.userName !== undefined) payload.user_name = updates.userName

    if (Object.keys(payload).length === 0) return

    const { error } = await supabase.from('connections').update(payload).eq('id', id)

    if (error) {
      console.error('Error updating connection', error)
      throw error
    }
  },

  async deleteConnection(id: string): Promise<void> {
    const { error } = await supabase.from('connections').delete().eq('id', id)

    if (error) {
      console.error('Error deleting connection', error)
      throw error
    }
  },

  async fetchUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error fetching users', error)
      throw error
    }

    return (data ?? []).map(mapUserRow)
  },

  async insertUser(name: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .insert({ name })
      .select('*')
      .single()

    if (error) {
      console.error('Error inserting user', error)
      throw error
    }

    return data ? mapUserRow(data) : null
  },

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null
    const data = localStorage.getItem(STORAGE_KEYS.CURRENT_USER)
    return data ? JSON.parse(data) : null
  },

  setCurrentUser(user: User | null): void {
    if (typeof window === 'undefined') return
    if (user) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user))
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_USER)
    }
  },
}
