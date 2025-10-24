@echo off
REM SITogether Test Runner Script for Windows
REM This script runs all tests and checks before creating a PR

echo.
echo 🧪 SITogether - Running All Tests ^& Checks
echo ==========================================
echo.

set FAILED=0

echo 📦 Backend Tests
echo ----------------
cd backend

echo Installing backend dependencies...
call npm ci >nul 2>&1
if errorlevel 1 (
    echo [FAILED] Backend dependencies installation
    set FAILED=1
) else (
    echo [PASS] Backend dependencies installed
)

echo Generating Prisma client...
call npx prisma generate >nul 2>&1
if errorlevel 1 (
    echo [FAILED] Prisma client generation
    set FAILED=1
) else (
    echo [PASS] Prisma client generated
)

echo Running backend linter...
call npm run lint
if errorlevel 1 (
    echo [FAILED] Backend linting
    set FAILED=1
) else (
    echo [PASS] Backend linting
)

echo Checking backend formatting...
call npm run format:check
if errorlevel 1 (
    echo [FAILED] Backend formatting
    set FAILED=1
) else (
    echo [PASS] Backend formatting
)

echo Running backend tests...
call npm run test:ci
if errorlevel 1 (
    echo [FAILED] Backend unit tests
    set FAILED=1
) else (
    echo [PASS] Backend unit tests
)

echo Running backend security audit...
call npm run security:audit
if errorlevel 1 (
    echo [WARNING] Backend security audit found issues
) else (
    echo [PASS] Backend security audit
)

echo.
echo 🎨 Frontend Tests
echo -----------------
cd ..\frontend

echo Installing frontend dependencies...
call npm ci >nul 2>&1
if errorlevel 1 (
    echo [FAILED] Frontend dependencies installation
    set FAILED=1
) else (
    echo [PASS] Frontend dependencies installed
)

echo Running TypeScript type checking...
call npm run type-check
if errorlevel 1 (
    echo [FAILED] TypeScript type checking
    set FAILED=1
) else (
    echo [PASS] TypeScript type checking
)

echo Running frontend linter...
call npm run lint
if errorlevel 1 (
    echo [FAILED] Frontend linting
    set FAILED=1
) else (
    echo [PASS] Frontend linting
)

echo Checking frontend formatting...
call npm run format:check
if errorlevel 1 (
    echo [FAILED] Frontend formatting
    set FAILED=1
) else (
    echo [PASS] Frontend formatting
)

echo Running frontend tests...
call npm run test:ci
if errorlevel 1 (
    echo [FAILED] Frontend unit tests
    set FAILED=1
) else (
    echo [PASS] Frontend unit tests
)

echo Running frontend security audit...
call npm run security:audit
if errorlevel 1 (
    echo [WARNING] Frontend security audit found issues
) else (
    echo [PASS] Frontend security audit
)

echo Building Next.js application...
call npm run build
if errorlevel 1 (
    echo [FAILED] Next.js build
    set FAILED=1
) else (
    echo [PASS] Next.js build
)

cd ..

echo.
echo ==========================================
if %FAILED%==0 (
    echo ✓ All checks passed! Ready to create PR
    exit /b 0
) else (
    echo ✗ Some checks failed. Please fix before creating PR
    exit /b 1
)

