import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useSession } from '../contexts/AuthContext'
import DailyTasksComponent from '../components/DailyTasksComponent'
import DiscoveryPage from '../components/DiscoveryPage'

interface PremiumStatus {
  isPremiumActive: boolean
  premiumExpiryDate: string | null
  totalPoints: number
  canUnlockPremium: boolean
}

export default function Premium() {
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null)
  const [loadingPremium, setLoadingPremium] = useState(true)
  const [unlockingPremium, setUnlockingPremium] = useState(false)
  const [tasksCollapsed, setTasksCollapsed] = useState(false)
  const [previousPoints, setPreviousPoints] = useState(0)
  const { status, session } = useSession()

  useEffect(() => {
    // Check premium status when component mounts and user is authenticated
    if (status === 'authenticated' && session) {
      checkPremiumStatus()
    }
  }, [status, session])

  useEffect(() => {
    // Auto-collapse tasks when user reaches 1000 points
    if (premiumStatus && premiumStatus.totalPoints >= 1000 && previousPoints < 1000) {
      setTasksCollapsed(true)
    }
    setPreviousPoints(premiumStatus?.totalPoints || 0)
  }, [premiumStatus, previousPoints])

  const checkPremiumStatus = async () => {
    try {
      const response = await fetch('/api/points/premium-status')
      const data = await response.json()
      if (data.success) {
        setPremiumStatus(data)
      }
    } catch (error) {
      console.error('Failed to check premium status:', error)
    } finally {
      setLoadingPremium(false)
    }
  }

  const unlockPremium = async () => {
    if (!premiumStatus?.canUnlockPremium) return

    setUnlockingPremium(true)
    try {
      const response = await fetch('/api/points/unlock-premium', { method: 'POST' })
      const data = await response.json()
      if (data.success) {
        setPremiumStatus((prev) =>
          prev
            ? {
                ...prev,
                isPremiumActive: true,
                premiumExpiryDate: data.premiumExpiryDate,
                canUnlockPremium: false,
              }
            : null
        )
      } else {
        alert(data.error || 'Failed to unlock premium')
      }
    } catch (error) {
      console.error('Failed to unlock premium:', error)
      alert('Failed to unlock premium')
    } finally {
      setUnlockingPremium(false)
    }
  }

  if (status === 'loading') {
    return (
      <>
        <Head>
          <title>Premium • SITogether</title>
          <meta name="description" content="Premium features" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main className="premium-container">
          <div className="premium-content">
            <div className="loading-inline">
              <div className="spinner"></div>
              <p>Loading...</p>
            </div>
          </div>
        </main>
      </>
    )
  }

  if (status === 'unauthenticated') {
    return (
      <>
        <Head>
          <title>Premium • SITogether</title>
          <meta name="description" content="Premium features" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main className="premium-container">
          <div className="premium-content">
            <h1>Premium Features</h1>
            <p>Please log in to access premium features and track your points.</p>
          </div>
        </main>
      </>
    )
  }

  if (loadingPremium) {
    return (
      <>
        <Head>
          <title>Premium • SITogether</title>
          <meta name="description" content="Premium features" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/favicon.ico" />
        </Head>
        <main className="premium-container">
          <div className="premium-content">
            <div className="loading-inline">
              <div className="spinner"></div>
              <p>Loading premium status...</p>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>Premium • SITogether</title>
        <meta name="description" content="Premium features" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="premium-container">
        <div className="premium-content">
          <h1>Premium Features</h1>

          {premiumStatus?.isPremiumActive ? (
            <div className="premium-active">
              <div className="premium-status">
                <span className="premium-badge">PREMIUM ACTIVE</span>
                {premiumStatus.premiumExpiryDate && (
                  <p className="expiry-info">
                    Expires: {new Date(premiumStatus.premiumExpiryDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <DiscoveryPage isPremium={premiumStatus?.isPremiumActive} />
            </div>
          ) : (
            <div className="premium-locked">
              <div className="unlock-section">
                <h2>Unlock Premium Discovery</h2>
                <p>Earn points to unlock premium features!</p>

                <div className="tasks-section">
                  <div className="tasks-header" onClick={() => setTasksCollapsed(!tasksCollapsed)}>
                    <div className="header-progress">
                      <div className="progress-info">
                        <span className="points-text">
                          {premiumStatus?.totalPoints || 0} / 1000 points
                        </span>
                        <span className="progress-percentage">
                          {Math.round(((premiumStatus?.totalPoints || 0) / 1000) * 100)}%
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(((premiumStatus?.totalPoints || 0) / 1000) * 100, 100)}%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  <div className={`tasks-content ${tasksCollapsed ? 'collapsed' : 'expanded'}`}>
                    <DailyTasksComponent
                      onPointsUpdate={checkPremiumStatus}
                      currentPoints={premiumStatus?.totalPoints}
                    />
                  </div>
                </div>

                <button
                  className="unlock-button"
                  onClick={unlockPremium}
                  disabled={!premiumStatus?.canUnlockPremium || unlockingPremium}
                >
                  {unlockingPremium ? 'Unlocking...' : 'Unlock Premium (5 Days)'}
                </button>
                <p className="premium-info">
                  Premium gives you access to advanced profile filtering and unlimited discovery for
                  5 days.
                  {!premiumStatus || premiumStatus.totalPoints < 1000
                    ? 'Complete the daily tasks to earn points and unlock premium features!'
                    : "You've earned enough points! Unlock premium now to access advanced features."}
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  )
}
