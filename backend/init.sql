-- SITogether Database Initialization Script
-- This file is automatically executed when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create a basic users table (example)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,  -- Encrypted email data at rest (not unique - emailHash is used for uniqueness)
    email_hash VARCHAR(255) UNIQUE NOT NULL,  -- Hash for authentication/lookup
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    age TEXT NOT NULL,  -- Encrypted age data at rest (stored as encrypted string)
    gender TEXT NOT NULL,  -- Encrypted gender data at rest
    role VARCHAR(50) DEFAULT 'User' NOT NULL,
    course TEXT,  -- Encrypted course data at rest (nullable)
    bio TEXT,  -- Encrypted bio data at rest (nullable)
    interests TEXT,  -- Encrypted interests data at rest (stored as encrypted JSON string, nullable)
    avatar_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email_hash ON users(email_hash);
CREATE INDEX IF NOT EXISTS idx_users_course ON users(course);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
