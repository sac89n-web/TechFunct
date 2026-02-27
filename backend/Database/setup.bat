@echo off
REM PostgreSQL Setup Script for Market Analytics (Windows)

echo Setting up PostgreSQL database for Market Analytics...

REM Check if psql is available
where psql >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo PostgreSQL is not installed or not in PATH. Please install PostgreSQL first.
    exit /b 1
)

REM Set default credentials (change if needed)
set PGUSER=postgres
set PGPASSWORD=postgres
set PGHOST=localhost
set PGPORT=5432

REM Create database and tables
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -f PostgreSQL_Schema.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Database setup completed successfully!
    echo.
    echo Connection string: Host=%PGHOST%;Database=marketanalytics;Username=%PGUSER%;Password=%PGPASSWORD%
) else (
    echo.
    echo ❌ Database setup failed!
    exit /b 1
)
