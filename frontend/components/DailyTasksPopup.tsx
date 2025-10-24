import { useState, useEffect } from 'react'
import { fetchWithAuth } from '../utils/api'

interface Task {
  id: string
  name: string
  completed: boolean
  canClaim: boolean
  points: number
}

interface UserPoints {
  totalPoints: number
  dailyCheckinCompleted: boolean
  dailyCheckinDate: string | null
}

interface DailyTasksPopupProps {
  onClose: () => void
}

export default function DailyTasksPopup({ onClose }: DailyTasksPopupProps) {
  const [userPoints, setUserPoints] = useState<UserPoints | null>(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fixed tasks (for now - future tasks will be dynamic)
  const baseTasks = [
    { id: 'daily-checkin', name: 'Daily check-in', points: 50 },
    { id: 'like-person', name: 'Like a person', points: 25 },
    { id: 'send-introduction', name: 'Send an introduction', points: 25 }
  ]

  const totalPoints = 1000

  // Fetch user points on component mount
  useEffect(() => {
    fetchUserPoints()
  }, [])

  const fetchUserPoints = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetchWithAuth('/api/points')

      if (!response.ok) {
        throw new Error('Failed to fetch points')
      }

      const result = await response.json()

      if (result.success) {
        setUserPoints(result.points)
      } else {
        throw new Error(result.error || 'Failed to fetch points')
      }
    } catch (err) {
      console.error('Error fetching points:', err)
      setError(err instanceof Error ? err.message : 'Failed to load points')
    } finally {
      setLoading(false)
    }
  }

  // Build tasks array based on user points data
  const tasks: Task[] = baseTasks.map(task => {
    if (task.id === 'daily-checkin') {
      return {
        ...task,
        completed: userPoints?.dailyCheckinCompleted || false,
        canClaim: !userPoints?.dailyCheckinCompleted
      }
    }
    // For now, other tasks are not completed (future implementation)
    return {
      ...task,
      completed: false,
      canClaim: false
    }
  })

  const currentPoints = userPoints?.totalPoints || 0
  const progressPercentage = (currentPoints / totalPoints) * 100

  const handleClaimDaily = async () => {
    if (claiming) return

    try {
      setClaiming(true)
      setError(null)

      const response = await fetchWithAuth('/api/points/claim-daily', {
        method: 'POST'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to claim daily points')
      }

      const result = await response.json()

      if (result.success) {
        // Update local state
        setUserPoints(result.points)
      } else {
        throw new Error(result.error || 'Failed to claim daily points')
      }
    } catch (err) {
      console.error('Error claiming daily points:', err)
      setError(err instanceof Error ? err.message : 'Failed to claim points')
    } finally {
      setClaiming(false)
    }
  }

  if (loading) {
    return (
      <div className="daily-tasks-overlay" onClick={onClose}>
        <div className="daily-tasks-popup" onClick={(e) => e.stopPropagation()}>
          <div className="daily-tasks-header">
            <h2>Daily Tasks</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="loading-content">
            <div className="spinner"></div>
            <p>Loading your points...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="daily-tasks-overlay" onClick={onClose}>
      <div className="daily-tasks-popup" onClick={(e) => e.stopPropagation()}>
        <div className="daily-tasks-header">
          <h2>Daily Tasks</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message" style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            marginBottom: '1rem',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <div className="progress-section">
          <div className="progress-info">
            <span className="points-text">{currentPoints} / {totalPoints} points</span>
            <span className="progress-percentage">{Math.round(progressPercentage)}%</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
        </div>

        <div className="tasks-list">
          {tasks.map(task => (
            <div key={task.id} className={`task-item ${task.completed ? 'completed' : ''}`}>
              <div className="task-info">
                <span className="task-name">{task.name}</span>
                <span className="task-points">+{task.points} pts</span>
              </div>
              <div className="task-action">
                {task.completed ? (
                  <span className="task-completed">✓ Completed</span>
                ) : task.canClaim ? (
                  <button
                    className="claim-button"
                    onClick={handleClaimDaily}
                    disabled={claiming}
                  >
                    {claiming ? 'Claiming...' : 'Claim'}
                  </button>
                ) : (
                  <span className="task-uncompleted">Not completed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

