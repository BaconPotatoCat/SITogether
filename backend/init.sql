-- SITogether Database Initialization Script
-- This file is automatically executed when the PostgreSQL container starts for the first time

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a basic users table (example)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    age INTEGER,
    course VARCHAR(10),
    bio TEXT,
    interests TEXT[],
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_course ON users(course);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Insert some sample data (optional - remove in production)
INSERT INTO users (email, name, age, course, bio, interests, avatar_url) VALUES
('kira.belle@example.com', 'Kira Belle', 23, 'CSC', 'Computer Science student who loves coding and gaming. Let''s study algorithms together!', ARRAY['Programming', 'Gaming', 'Tech'], 'https://images.unsplash.com/photo-1721440171951-26505bbe23cb?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687'),
('aqua.nova@example.com', 'Aqua Nova', 21, 'EEE', 'Electrical Engineering student passionate about robotics and innovation. Let''s build something amazing!', ARRAY['Electronics', 'Robotics', 'Innovation'], 'https://images.unsplash.com/photo-1663035309414-07fe9174d7d6?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=1936'),
('star.lumi@example.com', 'Star Lumi', 22, 'CDM', 'Communication and Digital Media student. Love creating content and exploring new media trends.', ARRAY['Design', 'Media', 'Creativity'], 'https://images.unsplash.com/photo-1758207575528-6b80f80f4408?ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&q=80&w=687')
ON CONFLICT (email) DO NOTHING;

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
