#!/bin/bash

# Test script for SITogether project
# Runs all tests for both backend and frontend

set -e  # Exit on error

echo "=========================================="
echo "Running SITogether Test Suite"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Run backend tests
echo "----------------------------------------"
echo "Running Backend Tests"
echo "----------------------------------------"
print_info "Testing backend security validation and chat features..."

cd backend

if [ -f "package.json" ]; then
    if npm test; then
        print_status "Backend tests passed"
    else
        print_error "Backend tests failed"
        exit 1
    fi
else
    print_error "Backend package.json not found"
    exit 1
fi

cd ..

echo ""
echo "----------------------------------------"
echo "Running Frontend Tests"
echo "----------------------------------------"
print_info "Testing frontend components and utilities..."

cd frontend

if [ -f "package.json" ]; then
    if npm test; then
        print_status "Frontend tests passed"
    else
        print_error "Frontend tests failed"
        exit 1
    fi
else
    print_error "Frontend package.json not found"
    exit 1
fi

cd ..

echo ""
echo "=========================================="
echo -e "${GREEN}All tests passed!${NC}"
echo "=========================================="

