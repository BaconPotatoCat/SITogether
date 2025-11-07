#!/bin/sh
set -e

echo "🔍 Starting backend initialization..."

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
  if npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
    echo "✅ Database is ready!"
    break
  fi
  
  RETRY_COUNT=$((RETRY_COUNT + 1))
  echo "Database is unavailable - attempt $RETRY_COUNT/$MAX_RETRIES"
  
  if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Database failed to become ready after $MAX_RETRIES attempts"
    exit 1
  fi
  
  sleep 2
done

# Handle database migrations/schema
if [ "$NODE_ENV" = "production" ]; then
  echo "🚀 Production mode: Running migrations"
  
  # Try to run migrations
  if npx prisma migrate deploy; then
    echo "✅ Migrations applied successfully"
  else
    echo "❌ Migration failed - exiting"
    exit 1
  fi
  
else
  echo "🔧 Development mode: Applying schema changes"
  
  # Try migrations first, fall back to db push
  if npx prisma migrate deploy 2>&1 | tee /tmp/migrate.log; then
    echo "✅ Migrations applied successfully"
  else
    # Check if it's a "no migrations found" error
    if grep -q "No migration found\|No pending migrations" /tmp/migrate.log; then
      echo "ℹ️  No migrations found, using db push"
      npx prisma db push --accept-data-loss --skip-generate
    elif grep -q "database schema is not empty" /tmp/migrate.log; then
      echo "⚠️  Database not empty, using db push with accept-data-loss"
      npx prisma db push --accept-data-loss --skip-generate
    else
      echo "❌ Migration error - using db push as fallback"
      npx prisma db push --accept-data-loss --skip-generate
    fi
  fi
fi

echo "🚀 Starting application..."

# Execute the main command
exec "$@"
