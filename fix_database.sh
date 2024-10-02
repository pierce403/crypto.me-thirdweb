#!/bin/bash

# fix_database.sh
# This script checks the integrity of the SQLite database and attempts to repair any issues.

# Read the database file path from the .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Set the database file path
DB_FILE="${DATABASE_URL#file:}"

# Check if the database file exists
if [ ! -f "$DB_FILE" ]; then
    echo "Error: Database file $DB_FILE not found."
    exit 1
fi

echo "Checking database integrity..."

# Run SQLite integrity check
sqlite3 "$DB_FILE" "PRAGMA integrity_check;" > integrity_check_result.txt

# Check the result of the integrity check
if grep -q "ok" integrity_check_result.txt; then
    echo "Database integrity check passed. No repairs needed."
else
    echo "Database integrity check failed. Attempting to repair..."

    # Dump the database to a SQL file
    echo "Dumping database to SQL file..."
    sqlite3 "$DB_FILE" .dump > dump.sql

    # Rename the corrupted database
    mv "$DB_FILE" "${DB_FILE}.corrupted"

    # Create a new database from the dump
    echo "Creating new database from dump..."
    sqlite3 "$DB_FILE" < dump.sql

    # Run integrity check on the new database
    sqlite3 "$DB_FILE" "PRAGMA integrity_check;" > new_integrity_check_result.txt

    if grep -q "ok" new_integrity_check_result.txt; then
        echo "Database successfully repaired."
        rm "${DB_FILE}.corrupted" dump.sql
    else
        echo "Failed to repair the database. Please use reset_database.sh to reset the database."
        mv "${DB_FILE}.corrupted" "$DB_FILE"
        rm dump.sql
    fi
fi

# Clean up temporary files
rm integrity_check_result.txt new_integrity_check_result.txt 2>/dev/null

echo "Database fix process completed."

# Run Prisma migrations
echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Database fix and migration process completed."
