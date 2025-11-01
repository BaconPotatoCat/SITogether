-- Add verification_token column to users table
-- This migration adds email verification functionality

ALTER TABLE users 
ADD COLUMN verification_token VARCHAR(255);

-- Create index for faster token lookups
CREATE INDEX idx_users_verification_token ON users(verification_token);

-- Add comment to document the column
COMMENT ON COLUMN users.verification_token IS 'Token used for email verification, set to NULL after verification';

