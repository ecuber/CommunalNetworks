'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { storage } from '../lib/storage'
import { findDuplicateSuggestions } from '../lib/duplicates'
import { Connection, DuplicateSuggestion, User } from '../lib/types'
import UserSelector from '../components/UserSelector'
import DuplicateSuggestions from '../components/DuplicateSuggestions'
import styles from './page.module.css'
import {
  CATEGORY_PRESET_VALUES,
  assignCategoryColors,
} from '../lib/categoryConfig'

const normalizeCategory = (category: string) => (category?.trim() ? category.trim() : 'Uncategorized')

export default function Home() {
  const router = useRouter()
  const [connections, setConnections] = useState<Connection[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(() => storage.getCurrentUser())
  const [duplicateSuggestions, setDuplicateSuggestions] = useState<DuplicateSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [formData, setFormData] = useState({
    name: '',
    categories: [] as string[],
  })
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  const [bulkAddMode, setBulkAddMode] = useState(true)
  const [bulkFormData, setBulkFormData] = useState({
    names: '',
    categories: [] as string[],
  })
  const [bulkIsAddingCategory, setBulkIsAddingCategory] = useState(false)
  const [bulkNewCategory, setBulkNewCategory] = useState('')

  useEffect(() => {
    let active = true

    const handleConnectionsChange = async () => {
      try {
        const data = await storage.fetchConnections()
        if (active) {
          setConnections(data)
        }
      } catch (error) {
        console.error('Failed to load connections', error)
      }
    }

    const handleUsersChange = async () => {
      try {
        const data = await storage.fetchUsers()
        if (active) {
          setUsers(data)
        }
      } catch (error) {
        console.error('Failed to load users', error)
      }
    }

    const initialise = async () => {
      setIsLoading(true)
      await Promise.all([handleConnectionsChange(), handleUsersChange()])
      if (active) {
        setIsLoading(false)
      }
    }

    initialise()

    const connectionsChannel = supabase
      .channel('public:connections')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'connections' }, handleConnectionsChange)
      .subscribe()

    const usersChannel = supabase
      .channel('public:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, handleUsersChange)
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(connectionsChannel)
      supabase.removeChannel(usersChannel)
    }
  }, [])

  useEffect(() => {
    const suggestions = findDuplicateSuggestions(connections, users)
    setDuplicateSuggestions(suggestions)
  }, [connections, users])

  useEffect(() => {
    const stored = storage.getCurrentUser()
    if (stored && !currentUser) {
      const match = users.find(user => user.id === stored.id)
      if (match) {
        setCurrentUser(match)
        storage.setCurrentUser(match)
      }
    } else if (currentUser) {
      const updated = users.find(user => user.id === currentUser.id)
      if (updated && updated.name !== currentUser.name) {
        setCurrentUser(updated)
        storage.setCurrentUser(updated)
      }
    }
  }, [users, currentUser])

  const categoryOptions = useMemo(() => {
    const presetMap = new Map<string, string>()
    CATEGORY_PRESET_VALUES.forEach(preset => {
      presetMap.set(normalizeCategory(preset), preset)
    })

    const dynamicMap = new Map<string, string>()
    const registerCategory = (category: string) => {
      const normalized = normalizeCategory(category)
      if (!presetMap.has(normalized) && !dynamicMap.has(normalized)) {
        dynamicMap.set(normalized, category)
      }
    }

    connections.forEach(connection => {
      const categories = connection.categories && connection.categories.length > 0
        ? connection.categories
        : [connection.category]
      categories.forEach(registerCategory)
    })

    formData.categories.forEach(registerCategory)
    bulkFormData.categories.forEach(registerCategory)

    return [
      ...CATEGORY_PRESET_VALUES,
      ...Array.from(dynamicMap.values()).sort((a, b) => a.localeCompare(b)),
    ]
  }, [connections, formData.categories, bulkFormData.categories])

  const categoryColorMap = useMemo(() => assignCategoryColors(categoryOptions), [categoryOptions])

  const bulkNamesPreview = useMemo(() => {
    if (!bulkFormData.names.trim()) return []
    return bulkFormData.names
      .split('\n')
      .flatMap(line => line.split(','))
      .map(name => name.trim())
      .filter(Boolean)
  }, [bulkFormData.names])

  const handleUserChange = (user: User | null) => {
    storage.setCurrentUser(user)
    setCurrentUser(user)
  }

  const handleCreateUser = async (name: string) => {
    try {
      const newUser = await storage.insertUser(name)
      if (newUser) {
        storage.setCurrentUser(newUser)
        setCurrentUser(newUser)
      }
    } catch (error) {
      console.error('Failed to create user', error)
      alert('Unable to create user. Please try again.')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) {
      alert('Please select or create a user first')
      return
    }

    if (!formData.name.trim() || formData.categories.length === 0) {
      alert('Please enter a name and select at least one category')
      return
    }

    const categories = formData.categories
    const primaryCategory = categories[0]

    try {
      await storage.insertConnection({
        name: formData.name.trim(),
        category: primaryCategory,
        categories,
        mutualConnections: [],
        userId: currentUser.id,
        userName: currentUser.name,
      })
      const data = await storage.fetchConnections()
      setConnections(data)
      setFormData({ name: '', categories: [] })
      setIsAddingCategory(false)
      setNewCategory('')
    } catch (error) {
      console.error('Failed to add connection', error)
      alert('Unable to add connection. Please try again.')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this connection?')) return

    try {
      await storage.deleteConnection(id)
      const data = await storage.fetchConnections()
      setConnections(data)
    } catch (error) {
      console.error('Failed to delete connection', error)
      alert('Unable to delete connection. Please try again.')
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }))
  }

  const toggleCategorySelection = (category: string) => {
    setFormData(prev => {
      const isSelected = prev.categories.includes(category)
      const categories = isSelected
        ? prev.categories.filter(item => item !== category)
        : [...prev.categories, category]
      return { ...prev, categories }
    })
  }

  const handleNewCategoryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategory(e.target.value)
  }

  const handleAddNewCategory = () => {
    const value = normalizeCategory(newCategory)
    if (!value) return

    setFormData(prev => {
      if (prev.categories.includes(value)) {
        return prev
      }
      return { ...prev, categories: [...prev.categories, value] }
    })
    setIsAddingCategory(false)
    setNewCategory('')
  }

  const handleCancelNewCategory = () => {
    setIsAddingCategory(false)
    setNewCategory('')
  }

  const handleDismissSuggestion = (suggestion: DuplicateSuggestion) => {
    setDuplicateSuggestions(prev => prev.filter(s => s.name !== suggestion.name))
  }

  const handleMergeSuggestion = async (suggestion: DuplicateSuggestion, primaryConnectionId: string) => {
    if (!suggestion.matches || suggestion.matches.length === 0) return

    const primaryConnection =
      suggestion.matches.find(match => match.id === primaryConnectionId) ?? suggestion.matches[0]
    const connectionsToMerge = suggestion.matches
    const otherConnections = connectionsToMerge.filter(match => match.id !== primaryConnection.id)

    const combinedMutuals = Array.from(
      new Set(connectionsToMerge.flatMap(match => match.mutualConnections))
    )
      .filter(name => name && name !== primaryConnection.name)
      .sort((a, b) => a.localeCompare(b))

    const combinedCategories = Array.from(
      new Set(
        connectionsToMerge.flatMap(match =>
          match.categories && match.categories.length > 0 ? match.categories : [match.category]
        )
      )
    )
    const mergedCategories = combinedCategories.length > 0 ? combinedCategories : [primaryConnection.category]
    const mergedPrimaryCategory = mergedCategories[0]

    try {
      await storage.updateConnection(primaryConnection.id, {
        category: mergedPrimaryCategory,
        categories: mergedCategories,
        mutualConnections: combinedMutuals,
      })
      await Promise.all(otherConnections.map(conn => storage.deleteConnection(conn.id)))
      const data = await storage.fetchConnections()
      setConnections(data)
      alert(`Merged duplicates for ${primaryConnection.name}`)
    } catch (error) {
      console.error('Failed to merge duplicates', error)
      alert('Unable to merge duplicates. Please try again.')
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser) {
      alert('Please select or create a user first')
      return
    }

    if (bulkFormData.categories.length === 0) {
      alert('Please select at least one category for all names')
      return
    }

    if (bulkNamesPreview.length === 0) {
      alert('Please enter at least one name')
      return
    }

    try {
      await Promise.all(
        bulkNamesPreview.map(name =>
          storage.insertConnection({
            name,
            category: bulkFormData.categories[0],
            categories: bulkFormData.categories,
            mutualConnections: [],
            userId: currentUser.id,
            userName: currentUser.name,
          })
        )
      )
      const data = await storage.fetchConnections()
      setConnections(data)
      setBulkFormData({ names: '', categories: [] })
      setBulkIsAddingCategory(false)
      setBulkNewCategory('')
      alert(`Successfully added ${bulkNamesPreview.length} connection(s)!`)
    } catch (error) {
      console.error('Failed to add connections in bulk', error)
      alert('Unable to add connections. Please try again.')
    }
  }

  const handleBulkNamesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setBulkFormData(prev => ({ ...prev, names: e.target.value }))
  }

  const toggleBulkCategorySelection = (category: string) => {
    setBulkFormData(prev => {
      const isSelected = prev.categories.includes(category)
      const categories = isSelected
        ? prev.categories.filter(item => item !== category)
        : [...prev.categories, category]
      return { ...prev, categories }
    })
  }

  const handleBulkNewCategoryInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBulkNewCategory(e.target.value)
  }

  const handleBulkAddNewCategory = () => {
    const value = normalizeCategory(bulkNewCategory)
    if (!value) return

    setBulkFormData(prev => {
      if (prev.categories.includes(value)) {
        return prev
      }
      return { ...prev, categories: [...prev.categories, value] }
    })
    setBulkIsAddingCategory(false)
    setBulkNewCategory('')
  }

  const handleBulkCancelNewCategory = () => {
    setBulkIsAddingCategory(false)
    setBulkNewCategory('')
  }

  const getConnectionCategories = (connection: Connection): string[] => {
    if (connection.categories && connection.categories.length > 0) {
      return connection.categories.map(normalizeCategory)
    }
    return [normalizeCategory(connection.category)]
  }

  return (
    <main className={styles.main}>
      <div className={styles.container}>
        <h1 className={styles.title}>Communal Networks</h1>
        <p className={styles.subtitle}>Digital Network Mapping</p>

        <UserSelector
          currentUser={currentUser}
          users={users}
          onUserChange={handleUserChange}
          onCreateUser={handleCreateUser}
        />

        <div className={styles.navigation}>
          <button onClick={() => router.push('/network')} className={styles.networkButton}>
            View Network Map
          </button>
        </div>

        {isLoading ? (
          <div className={styles.emptyState}>Loading network data…</div>
        ) : (
          <>
            <div className={styles.modeToggle}>
              <button
                type="button"
                onClick={() => setBulkAddMode(false)}
                className={bulkAddMode ? styles.toggleButton : styles.toggleButtonActive}
              >
                Single Add
              </button>
              <button
                type="button"
                onClick={() => setBulkAddMode(true)}
                className={bulkAddMode ? styles.toggleButtonActive : styles.toggleButton}
              >
                Bulk Add
              </button>
            </div>

            {!bulkAddMode ? (
              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="name" className={styles.label}>
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={styles.input}
                    placeholder="Enter person's name"
                    disabled={!currentUser}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="category" className={styles.label}>
                    Small Group or Category
                  </label>
                  <div className={styles.categoryChips}>
                    {categoryOptions.map(category => {
                      const isSelected = formData.categories.includes(category)
                      const color = categoryColorMap.get(category) ?? '#006880'
                      return (
                        <button
                          type="button"
                          key={category}
                          className={`${styles.categoryChip} ${isSelected ? styles.categoryChipSelected : ''}`}
                          style={{
                            borderColor: color,
                            backgroundColor: isSelected ? color : 'transparent',
                            color: isSelected ? '#fff' : color,
                          }}
                          onClick={() => toggleCategorySelection(category)}
                          disabled={!currentUser}
                        >
                          {category}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className={styles.categoryChipAdd}
                      onClick={() => {
                        setIsAddingCategory(true)
                        setNewCategory('')
                      }}
                      disabled={!currentUser}
                    >
                      + Other
                    </button>
                  </div>
                  {isAddingCategory && (
                    <div className={styles.newCategoryContainer}>
                      <input
                        type="text"
                        value={newCategory}
                        onChange={handleNewCategoryInput}
                        className={styles.input}
                        placeholder="e.g., Small Group, Prayer Meeting, Large Group"
                        autoFocus
                        disabled={!currentUser}
                      />
                      <div className={styles.newCategoryActions}>
                        <button
                          type="button"
                          onClick={handleAddNewCategory}
                          className={styles.addCategoryButton}
                          disabled={!currentUser}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelNewCategory}
                          className={styles.cancelButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className={styles.button} disabled={!currentUser}>
                  Add Connection
                </button>
              </form>
            ) : (
              <form onSubmit={handleBulkSubmit} className={styles.form}>
                <div className={styles.formGroup}>
                  <label htmlFor="bulkNames" className={styles.label}>
                    Names (one per line or comma-separated)
                  </label>
                  <textarea
                    id="bulkNames"
                    name="bulkNames"
                    value={bulkFormData.names}
                    onChange={handleBulkNamesChange}
                    className={styles.textarea}
                    placeholder={`Enter names, one per line or separated by commas:\nAnthony\nAnna\nAlexza`}
                    rows={8}
                    disabled={!currentUser}
                  />
                  <small className={styles.helpText}>
                    Enter multiple names, one per line or separated by commas
                  </small>
                  {bulkNamesPreview.length > 0 && (
                    <div className={styles.namePreview}>
                      <strong>{bulkNamesPreview.length}</strong> name(s) will be added:{' '}
                      {bulkNamesPreview.slice(0, 5).join(', ')}
                      {bulkNamesPreview.length > 5 &&
                        ` and ${bulkNamesPreview.length - 5} more...`}
                    </div>
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="bulkCategory" className={styles.label}>
                    Small Group or Category (applies to all names)
                  </label>
                  <div className={styles.categoryChips}>
                    {categoryOptions.map(category => {
                      const isSelected = bulkFormData.categories.includes(category)
                      const color = categoryColorMap.get(category) ?? '#006880'
                      return (
                        <button
                          type="button"
                          key={category}
                          className={`${styles.categoryChip} ${isSelected ? styles.categoryChipSelected : ''}`}
                          style={{
                            borderColor: color,
                            backgroundColor: isSelected ? color : 'transparent',
                            color: isSelected ? '#fff' : color,
                          }}
                          onClick={() => toggleBulkCategorySelection(category)}
                          disabled={!currentUser}
                        >
                          {category}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className={styles.categoryChipAdd}
                      onClick={() => {
                        setBulkIsAddingCategory(true)
                        setBulkNewCategory('')
                      }}
                      disabled={!currentUser}
                    >
                      + Other
                    </button>
                  </div>
                  {bulkIsAddingCategory && (
                    <div className={styles.newCategoryContainer}>
                      <input
                        type="text"
                        value={bulkNewCategory}
                        onChange={handleBulkNewCategoryInput}
                        className={styles.input}
                        placeholder="e.g., Small Group, Prayer Meeting, Large Group"
                        autoFocus
                        disabled={!currentUser}
                      />
                      <div className={styles.newCategoryActions}>
                        <button
                          type="button"
                          onClick={handleBulkAddNewCategory}
                          className={styles.addCategoryButton}
                          disabled={!currentUser}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkCancelNewCategory}
                          className={styles.cancelButton}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <button type="submit" className={styles.button} style={{color: "white"}} disabled={!currentUser}>
                  Add All Connections
                </button>
              </form>
            )}

            {duplicateSuggestions.length > 0 && (
              <DuplicateSuggestions
                suggestions={duplicateSuggestions}
                onDismiss={handleDismissSuggestion}
                onMerge={handleMergeSuggestion}
              />
            )}

            <div className={styles.connectionsContainer}>
              <h2 className={styles.sectionTitle}>
                All Connections ({connections.length})
              </h2>

              {connections.length === 0 ? (
                <p className={styles.emptyState}>
                  No connections added yet. Add your first connection above!
                </p>
              ) : (
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Category</th>
                        <th>Mutual Connections</th>
                        <th>Added By</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {connections.map(connection => (
                        <tr key={connection.id}>
                          <td>{connection.name}</td>
                          <td>{getConnectionCategories(connection).join(', ')}</td>
                          <td>
                            {connection.mutualConnections.length > 0
                              ? connection.mutualConnections.join(', ')
                              : 'None'}
                          </td>
                          <td>{connection.userName}</td>
                          <td>
                            <button
                              onClick={() => handleDelete(connection.id)}
                              className={styles.deleteButton}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
