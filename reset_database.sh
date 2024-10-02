#!/bin/bash

# reset_database.sh
# This script resets the PostgreSQL database for the crypto.me-thirdweb project

# Read the database URL from the .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Run Prisma migrations to recreate the database
echo "Running Prisma migrations to recreate the database..."
npx prisma migrate reset --force

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "Database reset complete. The database has been recreated with all migrations applied."
