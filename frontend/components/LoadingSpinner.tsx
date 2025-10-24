import React from 'react'

interface LoadingSpinnerProps {
  fullScreen?: boolean
  message?: string
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  fullScreen = false,
  message = 'Loading...',
}) => {
  if (fullScreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-content">
          <div className="spinner"></div>
          <p className="loading-message">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="loading-inline">
      <div className="spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  )
}

export default LoadingSpinner
