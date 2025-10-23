# SITogether

A modern frontend web application built with Next.js and TypeScript, containerized with Docker Compose, built for helping SIT students find study buddies.

## 🚀 Features

- **Frontend**: Next.js 14 with TypeScript
- **Backend**: Express.js REST API with Prisma ORM
- **Database**: PostgreSQL 15 for data persistence
- **Authentication**: User registration and login with bcrypt password hashing
- **Account Confirmation**: Email verification system for user accounts
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

### Database Seeding

The application includes a seed script that populates the database with sample user data for development and testing purposes.

**What the seed script does:**
- Creates 6 sample user profiles with realistic data
- Generates profiles with names, ages, genders, courses, bios, and interests
- Sets default password `wasd12` for all seeded users (hashed with bcrypt)
- Creates a mix of confirmed and unconfirmed accounts for testing
- Provides sample data including profile images from Unsplash

**To manually run the seed script:**

```bash
# Run the seed command inside the backend container
docker-compose exec backend npm run db:seed
```

**Note:** 
- The seed script will skip if users already exist in the database
- To re-seed, you'll need to clear existing data first
- Only confirmed users will appear in the swipe interface
- Unconfirmed users can register but won't appear until they confirm their accounts

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
- **Authentication**: bcrypt for password hashing
- **Containerization**: Docker, Docker Compose
- **Styling**: CSS3 with modern features
- **Dev Tools**: Prisma Studio for database management
