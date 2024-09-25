-- CreateTable
CREATE TABLE "cached_profiles" (
    "id" SERIAL NOT NULL,
    "ens_name" VARCHAR(255) NOT NULL,
    "profile_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cached_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cached_profiles_ens_name_key" ON "cached_profiles"("ens_name");
