#!/bin/bash

# reset_database.sh
# This script resets the SQLite database for the crypto.me-thirdweb project

# Read the database file path from the .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set the database file path
DB_FILE="${DATABASE_URL#file:}"

# Check if the database file exists
if [ -f "$DB_FILE" ]; then
    echo "Removing existing database file..."
    rm "$DB_FILE"
else
    echo "No existing database file found."
fi

# Run Prisma migrations to recreate the database
echo "Running Prisma migrations to recreate the database..."
npx prisma migrate reset --force

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "Database reset complete. A new database has been created with all migrations applied."
