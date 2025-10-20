# SITogether

A modern frontend web application built with Next.js and TypeScript, containerized with Docker Compose.

## 🚀 Features

- **Frontend**: Next.js 14 with TypeScript
- **Containerization**: Docker Compose for easy development
- **Modern UI**: Clean and responsive design

## 📁 Project Structure

```
SITogether/
├── frontend/          # Next.js frontend application
│   ├── pages/         # Next.js pages
│   ├── styles/        # CSS styles
│   ├── package.json   # Frontend dependencies
│   └── Dockerfile     # Frontend container config
├── docker-compose.yml # Docker Compose configuration (frontend only)
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

## 🔧 Development

### Environment Variables

Copy the example environment files and configure them:

```bash
# Root directory
cp env.example .env

# Frontend
cp frontend/env.example frontend/.env
```

## 🐳 Docker Services

- **frontend**: Next.js application

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
- **Containerization**: Docker, Docker Compose
- **Styling**: CSS3 with modern features
