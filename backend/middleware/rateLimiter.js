const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');

// ============================================================================
// Rate Limiting Configuration
// ============================================================================
// Configure the time windows and max attempts for each rate limiter below.
// Time values are in milliseconds.

// Login endpoint configuration
// Prevents brute force attacks
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const LOGIN_MAX_ATTEMPTS = 5;

// Password reset/forgot password configuration
// Prevents enumeration and email spam
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const PASSWORD_RESET_MAX_ATTEMPTS = 3;

// Registration endpoint configuration
// Prevents fake account creation
const REGISTER_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const REGISTER_MAX_ATTEMPTS = 5;

// OTP/MFA verification configuration
// Prevents OTP brute force
const OTP_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const OTP_MAX_ATTEMPTS = 5;

// Resend OTP/2FA code configuration
// Prevents abuse of email/SMS sending
const RESEND_OTP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RESEND_OTP_MAX_ATTEMPTS = 3;

// Verification email resend configuration
// Prevents abuse and email costs
const RESEND_VERIFICATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RESEND_VERIFICATION_MAX_ATTEMPTS = 3;

// Sensitive data access configuration
// Prevents scraping and data harvesting
const SENSITIVE_DATA_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const SENSITIVE_DATA_MAX_ATTEMPTS = 100;

// Helper function to format time window for error messages
const formatTimeWindow = (windowMs) => {
  const minutes = Math.floor(windowMs / (60 * 1000));
  const hours = Math.floor(windowMs / (60 * 60 * 1000));
  if (hours >= 1) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
};

// Helper function to generate a safe key for rate limiting
// Uses ipKeyGenerator helper to properly handle both IPv4 and IPv6 addresses
// This prevents IPv6 users from bypassing rate limits and applies subnet masking
// The subnet mask (56) groups IPv6 addresses to prevent bypassing limits
// For IPv4 addresses, it returns the IP as-is
// Note: ipKeyGenerator must be used to properly handle IPv6 - accessing req.ip directly
// would trigger a validation error from express-rate-limit
const keyGenerator = (req) => {
  // Get IP from request - Express sets req.ip when trust proxy is configured
  // Fallback to connection info if req.ip is not available
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress;

  if (!ip) {
    // Fallback for test environments or when IP cannot be determined
    return 'unknown';
  }

  // Use ipKeyGenerator to properly handle IPv6 addresses with subnet masking
  // This prevents IPv6 users from bypassing rate limits by cycling through IPs
  // ipKeyGenerator takes an IP string and subnet mask, returns a normalized key
  return ipKeyGenerator(ip, 56);
};

// ============================================================================
// Rate Limiter Definitions
// ============================================================================

/**
 * Rate limiter for login endpoint
 * Prevents brute force attacks
 * Allows bypass with valid reCAPTCHA token when rate limit is exceeded
 */
const loginLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS,
  max: LOGIN_MAX_ATTEMPTS,
  message: {
    success: false,
    error: `Too many login attempts. Please complete the reCAPTCHA verification to continue.`,
    requiresRecaptcha: true,
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count all requests, even successful ones
  keyGenerator: keyGenerator, // Use custom key generator for secure IP handling
  // Skip rate limiting if reCAPTCHA token is provided (will be verified in endpoint)
  skip: (req) => {
    // If reCAPTCHA token is provided, skip rate limiting
    // The endpoint will verify the token
    return !!req.body?.recaptchaToken;
  },
});

/**
 * Rate limiter for password reset/forgot password endpoints
 * Prevents enumeration and email spam
 */
const passwordResetLimiter = rateLimit({
  windowMs: PASSWORD_RESET_WINDOW_MS,
  max: PASSWORD_RESET_MAX_ATTEMPTS,
  message: {
    success: false,
    error: `Too many password reset requests. Please try again after ${formatTimeWindow(PASSWORD_RESET_WINDOW_MS)}.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: keyGenerator,
});

/**
 * Rate limiter for change password endpoint
 * Prevents brute force attacks on password changes
 * Allows bypass with valid reCAPTCHA token when rate limit is exceeded
 */
const changePasswordLimiter = rateLimit({
  windowMs: LOGIN_WINDOW_MS, // Use same window as login (15 minutes)
  max: LOGIN_MAX_ATTEMPTS, // Use same max attempts as login (5)
  message: {
    success: false,
    error: `Too many password change attempts. Please complete the reCAPTCHA verification to continue.`,
    requiresRecaptcha: true,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: keyGenerator,
  // Skip rate limiting if reCAPTCHA token is provided (will be verified in endpoint)
  skip: (req) => {
    // If reCAPTCHA token is provided, skip rate limiting
    // The endpoint will verify the token
    return !!req.body?.recaptchaToken;
  },
});

/**
 * Rate limiter for registration endpoint
 * Prevents fake account creation
 * Uses IP + email combination to avoid blocking legitimate users on shared networks
 */
const registerLimiter = rateLimit({
  windowMs: REGISTER_WINDOW_MS,
  max: REGISTER_MAX_ATTEMPTS,
  message: {
    success: false,
    error: `Too many registration attempts for this email. Please try again after ${formatTimeWindow(REGISTER_WINDOW_MS)}.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  // Use IP + email as key to prevent blocking other users on same network
  keyGenerator: (req) => {
    const ip = keyGenerator(req);
    const email = req.body?.email || 'no-email';
    // Combine IP and email for unique key per user
    // This prevents one user from blocking others on the same network
    return `${ip}:${email.toLowerCase()}`;
  },
});

/**
 * Rate limiter for OTP/MFA verification endpoints
 * Prevents OTP brute force
 */
const otpLimiter = rateLimit({
  windowMs: OTP_WINDOW_MS,
  max: OTP_MAX_ATTEMPTS,
  message: {
    success: false,
    error: `Too many verification attempts. Please try again after ${formatTimeWindow(OTP_WINDOW_MS)}.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: keyGenerator,
});

/**
 * Rate limiter for resend OTP/2FA code endpoints
 * Prevents abuse of email/SMS sending
 */
const resendOtpLimiter = rateLimit({
  windowMs: RESEND_OTP_WINDOW_MS,
  max: RESEND_OTP_MAX_ATTEMPTS,
  message: {
    success: false,
    error: `Too many resend requests. Please try again after ${formatTimeWindow(RESEND_OTP_WINDOW_MS)}.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: keyGenerator,
});

/**
 * Rate limiter for verification email resend
 * Prevents abuse and email costs
 */
const resendVerificationLimiter = rateLimit({
  windowMs: RESEND_VERIFICATION_WINDOW_MS,
  max: RESEND_VERIFICATION_MAX_ATTEMPTS,
  message: {
    success: false,
    error: `Too many verification email requests. Please try again after ${formatTimeWindow(RESEND_VERIFICATION_WINDOW_MS)}.`,
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: keyGenerator,
});

/**
 * Rate limiter for sensitive data access endpoints
 * Prevents scraping and data harvesting
 */
const sensitiveDataLimiter = rateLimit({
  windowMs: SENSITIVE_DATA_WINDOW_MS,
  max: SENSITIVE_DATA_MAX_ATTEMPTS,
  message: {
    success: false,
    error: 'Too many requests. Please slow down.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  keyGenerator: keyGenerator,
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  changePasswordLimiter,
  registerLimiter,
  otpLimiter,
  resendOtpLimiter,
  resendVerificationLimiter,
  sensitiveDataLimiter,
};
