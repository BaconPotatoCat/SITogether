# SITogether

A modern frontend web application built with Next.js and TypeScript, containerized with Docker Compose, built for helping SIT students find study buddies.

## 🚀 Features

- **Frontend**: Next.js 14 with TypeScript and React 18
- **Backend**: Express.js REST API with Prisma ORM
- **Database**: PostgreSQL 15 for data persistence
- **Authentication**: User registration and login with bcrypt password hashing
- **Password Reset**: Secure email-based password reset with time-limited tokens
- **Email Verification**: Automated email verification system with secure tokens
- **Unified Token System**: Extensible token architecture for verification, password reset, and future features
- **Premium System**: Points-based premium features with daily tasks and unlocks
- **Social Features**: Like/unlike users, pass functionality, and connection matching
- **Advanced Filtering**: Premium filtering by age, gender, course, and interests
- **Profile Management**: User profiles with detailed information
- **Swipe Interface**: Tinder-style card swipe for finding study buddies
- **Containerization**: Docker Compose for easy development
- **Modern UI**: Clean and responsive design with toast notifications

## 📁 Project Structure

```
SITogether/
├── frontend/          # Next.js frontend application
│   ├── pages/         # Next.js pages
│   ├── components/    # React components
│   ├── hooks/         # Custom React hooks
│   ├── styles/        # CSS styles
│   ├── package.json   # Frontend dependencies
│   └── Dockerfile     # Frontend container config
├── backend/           # Express.js backend API
│   ├── prisma/        # Prisma schema and migrations
│   │   ├── schema.prisma  # Database schema
│   │   └── seed.js    # Database seeding script
│   ├── server.js      # Express server
│   ├── package.json   # Backend dependencies
│   └── Dockerfile     # Backend container config
├── scripts/           # Helper scripts for development
│   ├── run-tests.bat  # Windows test runner
│   └── run-tests.sh   # Linux/Mac test runner
├── docker-compose.yml # Docker Compose configuration
└── README.md          # This file
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

# Frontend
cp frontend/env.example frontend/.env
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

The application uses JWT (JSON Web Tokens) for authentication with a NextAuth.js-style session management system:

#### Session Management
- **Login**: Users must log in to access protected pages and APIs
- **Session Duration**: Tokens are valid for 1 hour
- **Auto-refresh**: Session validity is checked every 5 minutes
- **Logout**: Clears the authentication token and redirects to login
- **Protected Routes**: All pages except `/auth`, `/verify`, and `/reset-password` require authentication
- **Protected APIs**: `/api/users` and other endpoints require valid tokens

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

**Session object includes:**
- `session.user` - User data (id, email, name, age, gender, role, etc.)
- `session.expires` - Token expiration timestamp

### Database Seeding

The application includes a seed script that populates the database with sample user data for development and testing purposes.

**What the seed script does:**
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

**Note:** 
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
- ✅ Authentication middleware (JWT validation, token expiry)
- ✅ Registration API (validation, duplicate users, password hashing)
- ✅ Login API (credentials validation, account verification)
- ✅ Email verification (token generation, expiration, cleanup)
- ✅ Password reset (forgot password, token validation, password update)
- ✅ Unified token system (EMAIL_VERIFICATION, PASSWORD_RESET types)
- ✅ Users API (authorization, filtering verified users)
- ✅ Points system (daily rewards, premium unlocks)
- ✅ Social features (likes, passes, matching)
- ✅ Security checks (SQL injection, XSS prevention, email enumeration prevention)

**Frontend:**
- ✅ Custom hooks (useToast, useSession)
- ✅ Components (LoadingSpinner, ToastContainer)
- ✅ API utilities (fetchWithAuth, error handling)
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
- **Authentication**: JWT tokens, bcrypt password hashing
- **Testing**: Jest, React Testing Library, Supertest
- **Code Quality**: ESLint, Prettier, TypeScript
- **CI/CD**: GitHub Actions
- **Security**: Helmet.js, npm audit, Trivy scanner
- **Containerization**: Docker, Docker Compose
- **Styling**: CSS3 with modern features
- **Dev Tools**: Prisma Studio for database management
