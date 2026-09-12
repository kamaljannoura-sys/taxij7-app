-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('STANDARD', 'VAN', 'PREMIUM');

-- AlterTable
ALTER TABLE "Ride" ADD COLUMN     "vehicleType" "VehicleType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "estimatedPrice" DOUBLE PRECISION;
