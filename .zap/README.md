# OWASP ZAP Configuration

This directory contains configuration files for OWASP ZAP security scanning.

## Files

- `rules.tsv` - Custom rules configuration for ZAP scans
- `auth.json` - Authentication context for authenticated scans (auto-generated during workflow)

## Authentication for ZAP Scanning

ZAP can perform authenticated scans which are much more comprehensive. They test:
- Protected endpoints that require login
- User-specific features
- Authenticated API calls
- Session management vulnerabilities

### Current Setup

The workflow automatically:
1. Creates a test user (`zap-test@example.com` / `zap-test-password-123`)
2. Configures ZAP to authenticate using this test user
3. Performs both unauthenticated and authenticated scans

### Manual Configuration

The workflow uses a special test authentication endpoint (`/api/auth/test-login`) that bypasses 2FA for test users. This endpoint:
- Only works in test/development mode (blocked in production)
- Only accepts test users (email must contain 'zap-test' or 'test@')
- Directly sets the authentication cookie without requiring 2FA

If you need to customize authentication, edit `.zap/auth.json`:

```json
{
  "type": "form",
  "loginUrl": "http://localhost:3000/api/auth/test-login",
  "loginRequestData": "email=zap-test@example.com&password=zap-test-password-123",
  "loggedInRegex": "\"success\":\\s*true"
}
```

**Note:** The test-login endpoint is only available in test environment (NODE_ENV=test) for security. It bypasses 2FA for test users to enable automated scanning.

### Custom Rules

The `.zap/rules.tsv` file is pre-configured with rules specifically selected for Node.js/Express + Next.js applications. It includes:

**Critical Rules (FAIL on detection):**
- SQL Injection (40018, 40019, 40020)
- Cross-Site Scripting - XSS (10032, 10034, 10036)
- Cookie Security - HttpOnly flag (10010)
- Information Disclosure (10023, 10027, 10045)
- File Upload Security (10046, 10096)
- Command/Code Injection (10048, 10094)

**Important Warnings:**
- Cookie Security - Secure/SameSite flags (10011, 10012)
- CORS Configuration (10202)
- Content Security Policy (10203)
- Session Management (10054, 10055)
- HTTP Security Headers (10020, 10021, 10024)

**Format:**
```
Rule ID	Action	Reason
10021	IGNORE	False positive for X-Frame-Options
```

**Customizing Rules:**
- Change `FAIL` to `WARN` if you want warnings instead of failures
- Change `WARN` to `IGNORE` to skip specific checks
- Add new rules by looking up ZAP rule IDs in the ZAP documentation

