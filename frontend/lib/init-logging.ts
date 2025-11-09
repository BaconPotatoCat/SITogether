/**
 * Server-side logging initialization for Next.js
 * This file initializes the logging bridge for API routes and SSR.
 * Import this at the top of API routes or use in middleware.
 */

// Initialize logging bridge (patches console.* on server-side)
import './logging-bridge'

export {}
