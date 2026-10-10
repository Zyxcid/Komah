-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "nim" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "avatarUrl" TEXT,
    "appMode" TEXT NOT NULL DEFAULT 'PENUMPANG',
    "vehiclePlate" TEXT,
    "vehicleType" TEXT,
    "ktmUrl" TEXT,
    "verifyStatus" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "rating" REAL NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "totalTrips" INTEGER NOT NULL DEFAULT 0,
    "totalEarnings" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "fare" INTEGER NOT NULL,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "lat" REAL,
    "lng" REAL
);

-- CreateTable
CREATE TABLE "SavedAddress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedAddress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SavedAddress_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "driverId" TEXT,
    "type" TEXT NOT NULL,
    "pickupLocationId" TEXT NOT NULL,
    "destLocationId" TEXT NOT NULL,
    "pickupDetail" TEXT,
    "destDetail" TEXT,
    "itemNote" TEXT,
    "passengerNote" TEXT,
    "pickupLat" REAL,
    "pickupLng" REAL,
    "destLat" REAL,
    "destLng" REAL,
    "driverLat" REAL,
    "driverLng" REAL,
    "driverPosAt" DATETIME,
    "fare" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'TUNAI',
    "status" TEXT NOT NULL DEFAULT 'MENCARI',
    "rating" INTEGER,
    "review" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" DATETIME,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_pickupLocationId_fkey" FOREIGN KEY ("pickupLocationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_destLocationId_fkey" FOREIGN KEY ("destLocationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_nim_key" ON "User"("nim");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");
