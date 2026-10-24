CREATE TYPE "SettingsDensity" AS ENUM ('COZY', 'COMPACT');
CREATE TYPE "WorkerAvailability" AS ENUM ('AVAILABLE', 'IN_SHOOT', 'FOCUS_MODE', 'OFF_SHIFT');

CREATE TABLE "UserPreference" (
  "userId" TEXT NOT NULL,
  "location" TEXT,
  "notificationChannels" JSONB NOT NULL DEFAULT '{}',
  "density" "SettingsDensity" NOT NULL DEFAULT 'COZY',
  "soundAlerts" BOOLEAN NOT NULL DEFAULT true,
  "defaultLanding" TEXT,
  "workerAvailability" "WorkerAvailability" NOT NULL DEFAULT 'AVAILABLE',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "Notification"
  ADD COLUMN "inAppVisible" BOOLEAN NOT NULL DEFAULT true;
