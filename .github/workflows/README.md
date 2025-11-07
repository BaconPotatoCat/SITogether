# Security Workflows

This directory contains GitHub Actions workflows for automated security scanning and vulnerability detection.

## 🔒 Available Workflows

### 1. `vulnerability-scan.yml`
**Additional vulnerability scanning tools**

Runs on:
- All pushes to all branches
- Manual trigger (workflow_dispatch)

**Note:** npm audit and ESLint security are already covered in `ci.yml`. This workflow focuses on additional tools.

Scans:
- **CodeQL**: Static code analysis for JavaScript/TypeScript
- **OWASP Dependency-Check**: Comprehensive vulnerability database scanning
- **OWASP ZAP**: Dynamic Application Security Testing (DAST) - tests running application

Results:
- Uploads reports as artifacts (retained for 30 days)
- Creates security alerts in GitHub Security tab
- Generates summary in workflow run

### 2. `dependency-review.yml`
**Dependency change review**

Runs on:
- Every pull request targeting main branch

Features:
- Reviews all dependency changes in PRs
- Fails on moderate+ severity vulnerabilities
- Blocks GPL-2.0 and GPL-3.0 licenses
- Comments summary in PR

### 3. `secret-scanning.yml`
**Secret and credential detection**

Runs on:
- All pushes to all branches

Tools:
- **Gitleaks**: Detects secrets, API keys, passwords in code
- **TruffleHog**: Advanced secret detection with verification

Configuration:
- See `.gitleaks.toml` for allowlist patterns
- Scans full git history for better detection

### 4. `container-scanning.yml`
**Docker container security scanning**

Runs on:
- When Dockerfiles change on any branch

Tool:
- **Trivy**: Scans Docker images for vulnerabilities
- Scans both backend and frontend containers
- Reports CRITICAL and HIGH severity issues

**Note:** `ci.yml` also uses Trivy but for filesystem scanning. This workflow scans the actual Docker container images, which is complementary.

### 5. `vulnerability-scan.yml` - OWASP ZAP
**Dynamic Application Security Testing (DAST)**

Runs on:
- All pushes to all branches
- Manual trigger (workflow_dispatch)

Tool:
- **OWASP ZAP**: Scans the running application for vulnerabilities
- Performs both unauthenticated and authenticated scans
- Tests actual running application (not just code)
- Detects runtime security issues like:
  - SQL injection
  - XSS vulnerabilities
  - Authentication bypass
  - Insecure headers
  - API security issues
  - Session management vulnerabilities
  - Protected endpoint security

**Authenticated Scanning:**
- Automatically creates a test user for scanning
- Performs authenticated scans to test protected endpoints
- Much more comprehensive than unauthenticated scans
- Tests user-specific features and authenticated API calls

Configuration:
- See `.zap/rules.tsv` for custom rule configuration
- See `.zap/README.md` for authentication setup details
- Scans both frontend (`http://localhost:3000`) and backend API (`http://localhost:5000`)
- Performs baseline scan (quick) and full scan (comprehensive)
- Results available in HTML, JSON, and XML formats

**Note:** The application uses 2FA. The test user is created with `verified: true`, but you may need to handle 2FA verification in the authentication flow for full coverage.

## 📊 Viewing Results

### GitHub Security Tab
1. Go to your repository
2. Click **Security** tab
3. View:
   - Code scanning alerts (CodeQL)
   - Dependency alerts (npm audit, Snyk)
   - Secret scanning alerts (Gitleaks, TruffleHog)
   - Container scanning alerts (Trivy)

### Workflow Artifacts
1. Go to **Actions** tab
2. Click on a workflow run
3. Scroll to **Artifacts** section
4. Download reports:
   - `npm-audit-backend/frontend` - npm audit JSON reports
   - `owasp-report-backend/frontend` - OWASP HTML reports

### Workflow Summary
Each workflow run includes a summary with:
- Status of each scan
- Number of vulnerabilities found
- Links to detailed reports

## ⚙️ Setup Requirements

### Required (Automatic)
- ✅ CodeQL - Works automatically, no setup needed
- ✅ npm audit - Built into npm
- ✅ Dependency Review - Built into GitHub Actions
- ✅ Gitleaks - Works automatically
- ✅ Trivy - Works automatically

### Optional (Enhanced Features)
- 🔑 **Snyk**: Add `SNYK_TOKEN` to GitHub Secrets
  1. Sign up at [snyk.io](https://snyk.io)
  2. Get API token from dashboard
  3. Add to GitHub: Settings → Secrets → Actions → New secret
  4. Name: `SNYK_TOKEN`

## 🚨 Handling Alerts

### Critical/High Severity
1. Review alert in GitHub Security tab
2. Check if patch available: `npm audit fix`
3. Update dependency or find alternative
4. Test thoroughly after fix

### Medium/Low Severity
1. Review in next sprint
2. Monitor via GitHub Security tab
3. Plan update when convenient

### False Positives
- **Secrets**: Update `.gitleaks.toml` allowlist
- **Dependencies**: Use GitHub Security tab to dismiss with reason
- **Code**: Review and fix or mark as acceptable risk

## 📝 Best Practices

1. **Review PRs carefully**: Dependency review blocks risky changes
2. **Check Security tab weekly**: Stay on top of new vulnerabilities
3. **Fix critical issues immediately**: Don't let them accumulate
4. **Keep dependencies updated**: Regular updates reduce risk
5. **Monitor scheduled scans**: Weekly scans catch new vulnerabilities

## 🔗 Resources

- [GitHub Security Features](https://docs.github.com/en/code-security)
- [CodeQL Documentation](https://codeql.github.com/docs/)
- [Snyk Documentation](https://docs.snyk.io/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

