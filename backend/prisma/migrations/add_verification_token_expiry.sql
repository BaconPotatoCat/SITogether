-- Add verification token expiration field
-- Tokens will expire 1 hour after creation

ALTER TABLE "users" ADD COLUMN "verification_token_expires" TIMESTAMP(3);

