#!/bin/bash

# PostgreSQL Setup Script for Market Analytics

echo "Setting up PostgreSQL database for Market Analytics..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install PostgreSQL first."
    exit 1
fi

# Set default credentials (change if needed)
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-postgres}"
PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5432}"

export PGPASSWORD

# Create database and tables
psql -h $PGHOST -p $PGPORT -U $PGUSER -f PostgreSQL_Schema.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "Connection string: Host=$PGHOST;Database=marketanalytics;Username=$PGUSER;Password=$PGPASSWORD"
else
    echo "❌ Database setup failed!"
    exit 1
fi
