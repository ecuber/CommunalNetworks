'use client'

import { useEffect, useState } from 'react'
import { DuplicateSuggestion } from '../lib/types'
import styles from './DuplicateSuggestions.module.css'

interface DuplicateSuggestionsProps {
  suggestions: DuplicateSuggestion[]
  onMerge?: (suggestion: DuplicateSuggestion, primaryConnectionId: string) => void
  onDismiss?: (suggestion: DuplicateSuggestion) => void
}

export default function DuplicateSuggestions({ 
  suggestions, 
  onMerge, 
  onDismiss 
}: DuplicateSuggestionsProps) {
  if (suggestions.length === 0) return null

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high':
        return '#E76127'
      case 'medium':
        return '#FFC60B'
      default:
        return '#95C93D'
    }
  }

  const [selectedPrimary, setSelectedPrimary] = useState<Record<number, string>>({})

  useEffect(() => {
    setSelectedPrimary({})
  }, [suggestions])

  const getPrimaryId = (suggestion: DuplicateSuggestion, index: number) => {
    if (selectedPrimary[index]) return selectedPrimary[index]
    return suggestion.matches[0]?.id ?? ''
  }

  const handleMergeClick = (suggestion: DuplicateSuggestion, index: number) => {
    if (!onMerge) return
    const primaryId = getPrimaryId(suggestion, index)
    if (!primaryId) return
    onMerge(suggestion, primaryId)
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>
        Possible Duplicates ({suggestions.length})
      </h3>
      <p className={styles.description}>
        These names might be duplicates. Select the entry to keep and merge the rest.
      </p>
      {suggestions.map((suggestion, index) => (
        <div key={index} className={styles.suggestion}>
          <div className={styles.header}>
            <span 
              className={styles.confidence}
              style={{ backgroundColor: getConfidenceColor(suggestion.confidence) }}
            >
              {suggestion.confidence.toUpperCase()} CONFIDENCE
            </span>
            {onDismiss && (
              <button
                onClick={() => onDismiss(suggestion)}
                className={styles.dismissButton}
              >
                Dismiss
              </button>
            )}
          </div>
          <div className={styles.matches}>
            {suggestion.matchingUsers && suggestion.matchingUsers.length > 0 && (
              <div className={styles.userMatches}>
                <strong>Matching Users:</strong>
                {suggestion.matchingUsers.map((user, userIndex) => (
                  <span key={userIndex} className={styles.userTag}>
                    {user.name}
                  </span>
                ))}
              </div>
            )}
            <div className={styles.connectionMatches}>
              <strong>Select the connection to keep:</strong>
              {suggestion.matches.map((match, matchIndex) => {
                const isSelected = getPrimaryId(suggestion, index) === match.id
                return (
                  <label key={matchIndex} className={styles.matchOption}>
                    <input
                      type="radio"
                      name={`primary-${index}`}
                      value={match.id}
                      checked={isSelected}
                      onChange={() => setSelectedPrimary(prev => ({ ...prev, [index]: match.id }))}
                      className={styles.radioInput}
                    />
                    <div className={styles.match}>
                      <strong>{match.name}</strong>
                      <span className={styles.matchDetails}>
                        {match.category} • Added by {match.userName}
                        {match.mutualConnections && match.mutualConnections.length > 0 && (
                          <> • Mutual: {match.mutualConnections.join(', ')}</>
                        )}
                      </span>
                    </div>
                  </label>
                )
              })}
            </div>
            {suggestion.reason && (
              <div className={styles.reason}>
                {suggestion.reason}
              </div>
            )}
          </div>
          {onMerge && (
            <button
              onClick={() => handleMergeClick(suggestion, index)}
              className={styles.mergeButton}
              disabled={suggestion.matches.length <= 1}
              title={suggestion.matches.length <= 1 ? 'Merging is only available when there are multiple connections to combine.' : undefined}
            >
              Merge Selected Connections
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

