#!/bin/sh
set -e

echo "🔍 Starting backend initialization..."

# In test mode, rely on docker-compose healthchecks and skip Prisma DB wait
if [ "$NODE_ENV" = "test" ]; then
  echo "🧪 Test mode detected: skipping explicit DB readiness loop (compose healthcheck ensures readiness)"
  echo "🛠️  Applying schema with prisma db push (test mode)"
  # Try up to 3 times to account for slight race conditions
  if ! npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma 2>&1 | tee /tmp/dbpush.log; then
    echo "⚠️  prisma db push failed (attempt 1). Waiting and retrying..."
    sleep 5
    if ! npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma 2>&1 | tee -a /tmp/dbpush.log; then
      echo "⚠️  prisma db push failed (attempt 2). Waiting and retrying..."
      sleep 5
      # Last attempt but don't fail the container in test runs
      npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma 2>&1 | tee -a /tmp/dbpush.log || true
    fi
  fi
else
  # Wait for database to be ready (non-test modes)
  echo "⏳ Waiting for database to be ready..."
  MAX_RETRIES=30
  RETRY_COUNT=0

  while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if echo "SELECT 1;" | npx prisma db execute --stdin --schema=./prisma/schema.prisma 2> /tmp/dbcheck.err 1> /tmp/dbcheck.out; then
      echo "✅ Database is ready!"
      break
    fi

    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "Database is unavailable - attempt $RETRY_COUNT/$MAX_RETRIES"

    if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
      echo "❌ Database failed to become ready after $MAX_RETRIES attempts"
      echo "--- prisma db execute stderr ---"
      cat /tmp/dbcheck.err || true
      echo "--- prisma db execute stdout ---"
      cat /tmp/dbcheck.out || true
      exit 1
    fi

    sleep 2
  done
fi

# Handle database migrations/schema
if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Production mode: Running migrations"
  
  # Try to run migrations
  if npx prisma migrate deploy --schema=./prisma/schema.prisma; then
    echo "✅ Migrations applied successfully"
  else
    echo "❌ Migration failed - exiting"
    exit 1
  fi
  
else
  echo "🔧 Development mode: Applying schema changes"
  
  # Try migrations first, fall back to db push
  echo "📦 Attempting to deploy migrations..."
  if npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 | tee /tmp/migrate.log; then
    echo "✅ Migrations applied successfully"
  else
    echo "⚠️  Migration deploy failed, checking error type..."
    cat /tmp/migrate.log
    
    # Check if it's a "no migrations found" error
    if grep -q "No migration found\|No pending migrations" /tmp/migrate.log; then
      echo "ℹ️  No migrations found, using db push"
      npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma
    elif grep -q "database schema is not empty" /tmp/migrate.log; then
      echo "⚠️  Database not empty, using db push with accept-data-loss"
      npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma
    else
      echo "❌ Migration error - using db push as fallback"
      npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma
    fi
  fi
fi

echo "✅ Database schema is ready!"
echo "🚀 Starting application..."

# Execute the main command
exec "$@"
