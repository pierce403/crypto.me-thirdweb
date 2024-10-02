-- CreateTable
CREATE TABLE "cached_profiles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ens_name" TEXT NOT NULL,
    "profile_data" TEXT NOT NULL,
    "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
    "last_sync_status" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_profiles_ens_name_key" ON "cached_profiles"("ens_name");
