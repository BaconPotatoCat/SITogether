# SITogether

A modern frontend web application built with Next.js and TypeScript, containerized with Docker Compose, built for helping SIT students find study buddies.

## 🚀 Features

- **Frontend**: Next.js 14 with TypeScript
- **Backend**: Express.js REST API with Prisma ORM
- **Database**: PostgreSQL 15 for data persistence
- **Authentication**: User registration and login with bcrypt password hashing
- **Account Verification**: Email verification system for user accounts
- **Password Reset**: Secure token-based password reset functionality
- **Profile Management**: User profiles with detailed information
- **Swipe Interface**: Tinder-style card swipe for finding study buddies
- **Admin Panel**: Comprehensive admin interface for user and report management
- **User Reporting**: System for reporting inappropriate user behavior
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

### Authentication

The application uses JWT (JSON Web Tokens) for authentication with a NextAuth.js-style session management system:

- **Login**: Users must log in to access protected pages and APIs
- **Session Duration**: Tokens are valid for 1 hour
- **Auto-refresh**: Session validity is checked every 5 minutes
- **Logout**: Clears the authentication token and redirects to login
- **Protected Routes**: All pages except `/auth` require authentication
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

### Password Reset

The application provides secure password reset functionality for both users and administrators:

#### User-Initiated Password Reset

Authenticated users can request a password reset for their own account:

- **Request Reset**: Users can request a password reset link via the authenticated API endpoint
- **Email Delivery**: A secure reset token is generated and sent to the user's email
- **Token Expiration**: Reset tokens expire after 1 hour for security
- **Single-Use Tokens**: Each reset token can only be used once
- **Secure Reset**: Tokens are cryptographically secure (32-byte random hex strings)

**API Endpoint:**
- `POST /api/auth/reset-password-request` (requires authentication)

#### Admin-Initiated Password Reset

Administrators can send password reset links to any user account:

- **Admin Panel**: Accessible from the Admin Panel's user management interface
- **One-Click Reset**: Admins can send reset links with a single click
- **User Notification**: Reset link is sent directly to the user's email
- **Same Security**: Uses the same secure token-based system as user-initiated resets

**API Endpoint:**
- `POST /api/admin/users/:id/reset-password` (admin only)

#### Resetting Password

Users reset their password using the token from the email:

1. Click the reset link in the email (contains the reset token)
2. Navigate to `/reset-password?token=<reset_token>`
3. Enter and confirm new password (minimum 6 characters)
4. Submit to complete the reset
5. Token is automatically invalidated after use

**API Endpoint:**
- `POST /api/auth/reset-password` (public, requires valid token)

### Admin Panel

The application includes a comprehensive admin panel for managing users and handling reports. Accessible at `/admin`, the panel provides:

#### User Management

- **View All Users**: Complete list of all registered users with detailed information
- **User Search**: Search users by name or email address
- **Status Filtering**: Filter users by status (All, Active, Banned)
- **User Information**: View user details including:
  - Name, email, age, gender
  - Role (User/Admin)
  - Verification status
  - Ban status and ban date
  - Number of reports received
  - Account creation date

#### User Actions

- **Ban/Unban Users**: Administrators can ban or unban user accounts
  - Banned users cannot log in or access the application
  - Admin users cannot be banned for security
  - Ban timestamps are tracked
- **Reset User Passwords**: Send password reset links to any user account
- **Real-time Updates**: User list refreshes automatically after actions

#### Report Management

- **View Reports**: Comprehensive list of all user reports
- **Report Filtering**: Filter reports by status:
  - **Pending**: New reports awaiting review
  - **Reviewed**: Reports that have been reviewed
  - **Resolved**: Reports that have been resolved
- **Report Details**: View complete report information including:
  - Reported user information
  - Reporter email
  - Reason and description
  - Report status
  - Creation and update timestamps
- **Status Updates**: Update report status (Pending → Reviewed → Resolved)
- **Quick Actions**: Ban users directly from report view

#### Access Control

- **Admin-Only Access**: Only users with `Admin` role can access the panel
- **Automatic Redirect**: Non-admin users are redirected to the home page
- **Authentication Required**: Users must be logged in to access admin features
- **Protected Routes**: All admin API endpoints are protected by admin middleware

**Admin Panel Features:**
- Responsive design with modern UI
- Real-time loading states and error handling
- Success/error message notifications
- Tabbed interface for easy navigation between Users and Reports

### User Reporting System

The application includes a user reporting system to help maintain a safe community:

#### Reporting Users

- **Report Reasons**: Users can report others for various reasons
- **Report Description**: Optional detailed description of the incident
- **Report Tracking**: All reports are tracked with timestamps
- **Anonymous Reporting**: Reports are tracked with reporter email for accountability

#### Report Status Workflow

Reports go through a defined status workflow:

1. **Pending**: New reports awaiting admin review
2. **Reviewed**: Reports that have been reviewed by an admin
3. **Resolved**: Reports that have been resolved (e.g., user banned, issue addressed)

Admins can update report status through the Admin Panel.

#### Database Seeding

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
