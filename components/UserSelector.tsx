'use client'

import { useState } from 'react'
import { User } from '../lib/types'
import styles from './UserSelector.module.css'

interface UserSelectorProps {
  currentUser: User | null
  users: User[]
  onUserChange: (user: User | null) => void
  onCreateUser: (name: string) => Promise<void>
}

export default function UserSelector({ currentUser, users, onUserChange, onCreateUser }: UserSelectorProps) {
  const [showInput, setShowInput] = useState(false)
  const [newUserName, setNewUserName] = useState('')

  const handleUserSelect = (userId: string) => {
    const user = users.find(u => u.id === userId)
    if (user) {
      onUserChange(user)
      setShowInput(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedName = newUserName.trim()
    if (!trimmedName) return

    await onCreateUser(trimmedName)
    setNewUserName('')
    setShowInput(false)
  }

  const handleClearUser = () => {
    onUserChange(null)
  }

  return (
    <div className={styles.userSelector}>
      {currentUser ? (
        <div className={styles.currentUser}>
          <span className={styles.userLabel}>Current User:</span>
          <span className={styles.userName}>{currentUser.name}</span>
          <button onClick={handleClearUser} className={styles.changeButton}>
            Change User
          </button>
        </div>
      ) : (
        <div className={styles.userPrompt}>
          <p>Please select or create a user to start adding connections</p>
          {!showInput && (
            <div className={styles.userActions}>
              {users.length > 0 && (
                <select
                  onChange={event => handleUserSelect(event.target.value)}
                  className={styles.userSelect}
                  defaultValue=""
                >
                  <option value="">Select existing user...</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              )}
              <button onClick={() => setShowInput(true)} className={styles.createButton}>
                + Create New User
              </button>
            </div>
          )}
          {showInput && (
            <form onSubmit={handleCreateUser} className={styles.createForm}>
              <input
                type="text"
                value={newUserName}
                onChange={event => setNewUserName(event.target.value)}
                placeholder="Enter your name"
                className={styles.userInput}
                autoFocus
              />
              <button type="submit" className={styles.submitButton}>
                Create
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowInput(false)
                  setNewUserName('')
                }}
                className={styles.cancelButton}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

