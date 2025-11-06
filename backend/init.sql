-- SITogether Database Initialization Script
-- This file is automatically executed when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a basic users table (example)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    age INTEGER NOT NULL,
    gender VARCHAR(50) NOT NULL,
    role VARCHAR(50) DEFAULT 'User' NOT NULL,
    course VARCHAR(10),
    bio TEXT,
    interests TEXT[],
    avatar_url TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
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

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "userAId" UUID,
    "userBId" UUID,
    "isLocked" BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT conversations_userAId_fkey FOREIGN KEY ("userAId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT conversations_userBId_fkey FOREIGN KEY ("userBId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT conversations_userAId_userBId_key UNIQUE ("userAId", "userBId")
);

-- Create trigger to automatically update updated_at for conversations
CREATE TRIGGER update_conversations_updated_at 
    BEFORE UPDATE ON conversations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    "conversationId" UUID NOT NULL,
    "senderId" UUID,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT messages_conversationId_fkey FOREIGN KEY ("conversationId") REFERENCES conversations(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT messages_senderId_fkey FOREIGN KEY ("senderId") REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Create index on conversationId for faster message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversationId ON messages("conversationId");
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);