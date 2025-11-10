# SITogether

A modern frontend web application built with Next.js and TypeScript, containerized with Docker Compose, built for helping SIT students find study buddies.

## 🚀 Features

### Core Functionality
- **Frontend**: Next.js 14 with TypeScript and React 18
- **Backend**: Express.js REST API with Prisma ORM
- **Database**: PostgreSQL 15 for data persistence
- **Profile Management**: Comprehensive user profiles with detailed information
- **Real-time Chat**: Direct messaging between matched users with conversation management
- **Social Features**: Like users, pass functionality, and connection matching

### Authentication & Security
- **JWT Authentication**: Secure token-based authentication with bcrypt password hashing
- **Two-Factor Authentication (2FA)**: Email-based OTP verification for enhanced security
- **Email Verification**: Automated email verification system with secure tokens
- **Password Reset**: Secure email-based password reset with time-limited tokens
- **Session Management**: Express sessions with secure cookie handling

### Premium & Gamification
- **Points System**: Points-based rewards and premium features
- **Daily Tasks**: Daily check-in, daily like, and daily introduction rewards
- **Premium Unlocks**: Points-based premium feature unlocking
- **Advanced Filtering**: Premium filtering by age, gender, course, and interests

### Admin Features
- **Admin Panel**: Comprehensive user and report management interface
- **User Management**: Ban/unban users, create admin accounts, view all users
- **Report Management**: Review and manage user reports with status tracking

### Developer Experience
- **Centralized Logging**: JSON file logging system with sanitization and volume mounting
- **Unified Token System**: Extensible token architecture for verification, password reset, and future features
- **Containerization**: Docker Compose for easy development and deployment
- **Comprehensive Testing**: Full test coverage with Jest and React Testing Library
- **CI/CD Pipeline**: Automated testing, linting, and security scanning on every PR
- **Type Safety**: Full TypeScript support for frontend with strict type checking
- **Modern UI**: Clean and responsive design with toast notifications and custom confirmation modals

## 📁 Project Structure

```
SITogether/
├── frontend/              # Next.js frontend application
│   ├── pages/             # Next.js pages and API routes
│   │   ├── api/           # Next.js API routes (proxies, auth)
│   │   ├── chat/          # Chat pages
│   │   ├── profile/       # Profile pages
│   │   ├── _app.tsx       # App wrapper with providers
│   │   ├── index.tsx      # Discovery page
│   │   ├── admin.tsx      # Admin panel
│   │   └── ...            # Other pages (auth, liked, premium, etc.)
│   ├── components/        # React components
│   │   ├── ConfirmModal.tsx          # Confirmation dialog
│   │   ├── DailyTasksComponent.tsx   # Daily tasks UI
│   │   ├── DailyTasksPopup.tsx       # Daily tasks popup
│   │   ├── DiscoveryPage.tsx         # Main discovery interface
│   │   ├── FilterModal.tsx           # Filter modal component
│   │   ├── IntroMessageModal.tsx     # Introduction message modal
│   │   ├── LoadingSpinner.tsx        # Loading indicator
│   │   └── ToastContainer.tsx        # Toast notifications
│   ├── contexts/          # React context providers
│   │   ├── AuthContext.tsx    # Authentication state
│   │   └── ThemeContext.tsx   # Theme state
│   ├── hooks/             # Custom React hooks
│   │   ├── useDiscovery.ts    # Discovery logic hook
│   │   └── useToast.ts        # Toast notifications hook
│   ├── lib/               # Library files
│   │   ├── init-logging.ts    # Logging initialization
│   │   ├── logger.ts          # Frontend logger
│   │   └── logging-bridge.ts  # Console to logger bridge
│   ├── utils/             # Utility functions
│   │   ├── api.ts             # API client with auth
│   │   ├── config.ts          # Environment configuration
│   │   ├── filters.ts         # Filter utilities
│   │   ├── messageValidation.ts   # Message validation
│   │   └── passwordValidation.ts  # Password validation
│   ├── styles/            # CSS styles
│   │   └── globals.css    # Global styles
│   ├── __tests__/         # Frontend test suites
│   ├── middleware.ts      # Next.js middleware (auth, admin routing)
│   ├── package.json       # Frontend dependencies
│   └── Dockerfile         # Frontend container config
├── backend/               # Express.js backend API
│   ├── lib/               # Library files
│   │   ├── config.js          # Environment configuration
│   │   ├── email.js           # Email service utilities
│   │   ├── logger.js          # Backend logger
│   │   ├── logging-bridge.js  # Console to logger bridge
│   │   └── prisma.js          # Prisma client setup
│   ├── middleware/        # Express middleware
│   │   ├── admin.js           # Admin authentication & access control
│   │   ├── auth.js            # JWT authentication
│   │   └── rateLimiter.js     # Rate limiting configurations
│   ├── utils/             # Utility functions
│   │   ├── fieldEncryption.js      # Field-level encryption
│   │   ├── messageValidation.js    # Message validation
│   │   └── passwordValidation.js   # Password validation (NIST 2025)
│   ├── prisma/            # Prisma ORM files
│   │   ├── schema.prisma      # Database schema
│   │   ├── seed.js            # Database seeding script
│   │   └── migrations/        # Database migrations
│   ├── __tests__/         # Backend test suites
│   │   ├── api/               # API endpoint tests
│   │   ├── middleware/        # Middleware tests
│   │   └── utils/             # Utility function tests
│   ├── server.js          # Express server and routes
│   ├── package.json       # Backend dependencies
│   └── Dockerfile         # Backend container config
├── scripts/               # Helper scripts for development
│   ├── run-tests.bat      # Windows test runner
│   └── run-tests.sh       # Linux/Mac test runner
├── .github/               # GitHub configuration
│   └── workflows/         # CI/CD pipelines
│       ├── ci.yml         # Main CI pipeline
│       └── vulnerability-scan.yml  # Security scanning
├── docker-compose.yml     # Production Docker Compose config
├── dev.docker-compose.yml # Development Docker Compose config
├── env.example            # Environment variables template
└── README.md              # This file
```

## 🛠️ Prerequisites

- Docker and Docker Compose
- Git

## 🚀 Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/BaconPotatoCat/SITogether
   cd SITogether
   ```

2. **Start the frontend**
   ```bash
   docker-compose up --build
   ```

3. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000
   - Prisma Studio: http://localhost:5555

## 🔧 Development

### Environment Variables

Copy the example environment files and configure them:

```bash
# Root directory
cp env.example .env
```

**Important:** Make sure to set a secure `JWT_SECRET` in your `.env` file for authentication to work properly.

**Important:** Add the encryption key to your `.env` file:

```bash
# Generate a strong key
openssl rand -base64 32

# Add to .env
ENCRYPTION_KEY=your-generated-key-here
```

### Authentication & Security

The application uses JWT (JSON Web Tokens) for authentication with comprehensive security features:

#### Session Management
- **Login**: Users must log in to access protected pages and APIs
- **Two-Factor Authentication**: Email-based OTP verification after login for enhanced security
- **Session Duration**: Tokens are valid for 1 hour
- **Auto-refresh**: Session validity is checked every 5 minutes
- **Logout**: Clears the authentication token and redirects to login
- **Protected Routes**: All pages except `/auth`, `/verify`, `/verify-2fa`, and `/reset-password` require authentication
- **Protected APIs**: All user endpoints require valid JWT tokens
- **Admin Routes**: Admin-only endpoints require authentication and 'Admin' role
- **Banned User Prevention**: Banned users are blocked from accessing protected routes

#### Security Features
- **CSRF Protection**: All state-changing requests (POST/PUT/DELETE) require valid CSRF tokens
- **Rate Limiting**: Protection against brute force attacks on login, registration, and password changes
- **Field Encryption**: Sensitive user data (age, gender, course, bio, interests, email) encrypted at rest
- **Password Security**: NIST 2025 guidelines with breach database checking
- **XSS Prevention**: Lusca middleware and input sanitization
- **Clickjacking Protection**: X-Frame-Options headers via Lusca

#### Using Sessions in Components

The app provides a `useSession` hook similar to NextAuth.js:

```tsx
import { useSession } from '../contexts/AuthContext'

function MyComponent() {
  const { session, status, signOut } = useSession()

  if (status === 'loading') return <div>Loading...</div>
  if (status === 'unauthenticated') return <div>Please log in</div>

  return (
    <div>
      <h1>Welcome {session?.user.name}!</h1>
      <button onClick={() => signOut()}>Logout</button>
    </div>
  )
}
```

**Available status values:**
- `loading` - Initial state, fetching session
- `authenticated` - User is logged in
- `unauthenticated` - No valid session

### Database Seeding

The application includes a seed script that populates the database with sample user data for development and testing purposes.

**What the seed script does:**
- **Creates an initial admin account** using the credentials from your `.env` file:
  - Email: Set via `ADMIN_EMAIL` (e.g., `admin@example.com`)
  - Password: Set via `ADMIN_PASSWORD`
  - The admin account has full administrative privileges
- Creates 6 sample user profiles with realistic data
- Generates profiles with names, ages, genders, courses, bios, and interests
- Sets default password `wasd12` for all seeded users (hashed with bcrypt)
- Creates a mix of verified and unverified accounts for testing
- Provides sample data including profile images from Unsplash

**To manually run the seed script:**

```bash
# Run the seed command inside the backend container
docker-compose exec backend npm run db:seed
```

**Setting up your admin account:**

1. Add admin credentials to your `.env` file:
   ```bash
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=your-secure-admin-password-here
   ```
   
   **Note:** Use a real, accessible email address for `ADMIN_EMAIL` as it's required for 2FA authentication.

2. Run the seed script to create the admin account

3. Login with your admin credentials at the `/auth` page

**Important Notes:** 
- ⚠️ **Change the default admin password in production!**
- The seed script will skip if users already exist in the database
- To re-seed, you'll need to clear existing data first
- Only verified users will appear in the swipe interface
- Unverified users can register but won't appear until they verify their accounts

## 🧪 Testing & Quality Assurance

The project includes comprehensive testing and code quality checks that run automatically on every pull request.

### Running Tests Locally

**Backend Tests:**
```bash
# Run all tests with coverage
cd backend
npm test

# Run tests in watch mode
npm run test:watch

# Run linter
npm run lint

# Check code formatting
npm run format:check

# Fix formatting issues
npm run format

# Security audit
npm run security:audit
```

**Frontend Tests:**
```bash
# Run all tests with coverage
cd frontend
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Run linter
npm run lint

# Check code formatting
npm run format:check

# Fix formatting issues
npm run format

# Security audit
npm run security:audit
```

### Test Coverage

### What Gets Tested

**Backend:**
- ✅ Authentication middleware (JWT validation, token expiry, banned user checks)
- ✅ Admin authentication middleware (role-based access control, admin profile access)
- ✅ Registration API (validation, duplicate users, password hashing)
- ✅ Login API (credentials validation, account verification, 2FA flow)
- ✅ 2FA system (OTP generation, expiration, rate limiting)
- ✅ Email verification (token generation, expiration, cleanup)
- ✅ Password reset (forgot password, token validation, password update)
- ✅ Unified token system (EMAIL_VERIFICATION, PASSWORD_RESET, TWO_FACTOR types)
- ✅ Users API (authorization, filtering verified users, admin profile viewing)
- ✅ Points system (daily rewards, premium unlocks, task completion)
- ✅ Social features (likes, passes, matching, conversation management)
- ✅ Chat system (messages, conversation locking, deleted user handling)
- ✅ User reporting system (report creation, reason validation, admin management)
- ✅ Admin APIs (user management, ban/unban, password reset, report management, admin account creation)
- ✅ Field encryption utilities (AES-256-GCM encryption/decryption)
- ✅ Password validation (NIST 2025 guidelines, breach database checking)
- ✅ Message validation (content filtering, length validation)
- ✅ Security checks (SQL injection, XSS prevention, email enumeration prevention, CSRF protection)

**Frontend:**
- ✅ Custom hooks (useToast, useSession, useDiscovery)
- ✅ Components (LoadingSpinner, ToastContainer, ConfirmModal, DiscoveryPage, FilterModal, IntroMessageModal, DailyTasksComponent)
- ✅ Admin Panel (user management, report management, ban/unban functionality)
- ✅ Report functionality (DiscoveryPage and Chat page reporting)
- ✅ Chat functionality (conversation management, deleted user handling)
- ✅ API utilities (fetchWithAuth, CSRF token handling, error handling)
- ✅ TypeScript type checking
- ✅ Next.js build validation

### CI/CD Pipeline

Every pull request automatically runs:

1. **Code Quality Checks**
   - ESLint for code style
   - Prettier for formatting
   - TypeScript type checking (frontend)
   - Security vulnerability scanning

2. **Unit Tests**
   - Jest test suites for backend and frontend
   - Coverage reports uploaded to Codecov

3. **Build Tests**
   - Docker image builds for both services
   - Next.js production build

4. **Security Scans**
   - npm audit for dependency vulnerabilities
   - Trivy security scanner for container images

### 🚨 Before Committing Code

**IMPORTANT:** Always run the test script before creating a pull request to ensure all checks pass:

**Windows:**
```bash
.\scripts\run-tests.bat
```

**Linux/Mac:**
```bash
./scripts/run-tests.sh
```

This comprehensive script will automatically run:
- ✅ Dependency installation
- ✅ Linting and formatting checks
- ✅ TypeScript type checking
- ✅ All unit tests with coverage
- ✅ Security audits
- ✅ Production build verification

If all checks pass, you'll see: `✓ All checks passed! Ready to create PR`

### Pre-Push Checklist

Before creating a pull request, ensure:
- [ ] **`scripts/run-tests.bat` or `scripts/run-tests.sh` passes with no errors**
- [ ] All tests pass locally (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is properly formatted (`npm run format:check`)
- [ ] TypeScript compiles without errors (frontend: `npm run type-check`)
- [ ] Docker containers build successfully
- [ ] New features include unit tests
- [ ] Security audit shows no critical issues

### Branch Protection

Pull requests to `main` require:
- ✅ All CI checks passing
- ✅ Code review approval
- ✅ No merge conflicts
- ✅ Branch is up to date with main

## 🐳 Docker Services

- **frontend**: Next.js application (port 3000)
- **backend**: Express.js API server with Prisma ORM
- **database**: PostgreSQL 15 database (port 5432)
- **prisma-studio**: Database management interface (port 5555)

## 🛑 Stopping the Application

```bash
docker-compose down
```

## 🧹 Cleaning Up

To remove containers and images created by this project:

```bash
docker-compose down --rmi local
```

## 📚 Technologies Used

- **Frontend**: Next.js 14, React 18, TypeScript
- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL 15, Prisma ORM
- **Authentication**: JWT tokens, bcrypt password hashing, express-session
- **Security**: 
  - Helmet.js (HTTP security headers)
  - Lusca (CSRF protection, XSS prevention, clickjacking protection)
  - AES-256-GCM encryption for sensitive data
  - Rate limiting (express-rate-limit)
  - NIST 2025 password guidelines
- **Testing**: Jest, React Testing Library, Supertest
- **Code Quality**: ESLint, Prettier, TypeScript
- **CI/CD**: GitHub Actions
- **Security Scanning**: npm audit, Trivy container scanner
- **Containerization**: Docker, Docker Compose
- **Styling**: CSS3 with modern features
- **Dev Tools**: Prisma Studio for database management
