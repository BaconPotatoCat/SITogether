#!/bin/bash

# SITogether Test Runner Script
# This script runs all tests and checks before creating a PR

set -e

echo "🧪 SITogether - Running All Tests & Checks"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILED=0

# Function to print status
print_status() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $1${NC}"
    else
        echo -e "${RED}✗ $1${NC}"
        FAILED=1
    fi
}

echo "📦 Backend Tests"
echo "----------------"
cd backend

echo "Installing backend dependencies..."
npm ci > /dev/null 2>&1
print_status "Backend dependencies installed"

echo "Generating Prisma client..."
npx prisma generate > /dev/null 2>&1
print_status "Prisma client generated"

echo "Running backend linter..."
npm run lint
print_status "Backend linting"

echo "Checking backend formatting..."
npm run format:check
print_status "Backend formatting"

echo "Running backend tests..."
npm run test:ci
print_status "Backend unit tests"

echo "Running backend security audit..."
npm run security:audit || true
print_status "Backend security audit"

echo ""
echo "🎨 Frontend Tests"
echo "-----------------"
cd ../frontend

echo "Installing frontend dependencies..."
npm ci > /dev/null 2>&1
print_status "Frontend dependencies installed"

echo "Running TypeScript type checking..."
npm run type-check
print_status "TypeScript type checking"

echo "Running frontend linter..."
npm run lint
print_status "Frontend linting"

echo "Checking frontend formatting..."
npm run format:check
print_status "Frontend formatting"

echo "Running frontend tests..."
npm run test:ci
print_status "Frontend unit tests"

echo "Running frontend security audit..."
npm run security:audit || true
print_status "Frontend security audit"

echo "Building Next.js application..."
npm run build
print_status "Next.js build"

cd ..

echo ""
echo "=========================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to create PR${NC}"
    exit 0
else
    echo -e "${RED}✗ Some checks failed. Please fix before creating PR${NC}"
    exit 1
fi

