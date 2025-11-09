-- AlterTable
ALTER TABLE "user_points" ADD COLUMN     "dailyIntroClaimedDate" TIMESTAMP(3),
ADD COLUMN     "hasSentIntroToday" BOOLEAN NOT NULL DEFAULT false;
