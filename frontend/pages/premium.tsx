import { useState, useEffect } from 'react'
import Head from 'next/head'
import { useSession } from '../contexts/AuthContext'
import DailyTasksPopup from '../components/DailyTasksPopup'

export default function Premium() {
  const [showPopup, setShowPopup] = useState(false)
  const { status, session } = useSession()

  useEffect(() => {
    // Show popup when component mounts (page loads) and user is authenticated
    if (status === 'authenticated' && session) {
      setShowPopup(true)
    }
  }, [status, session])

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
          <p className="work-in-progress">Still a work in progress</p>
        </div>
      </main>

      {showPopup && (
        <DailyTasksPopup onClose={() => setShowPopup(false)} />
      )}
    </>
  )
}

