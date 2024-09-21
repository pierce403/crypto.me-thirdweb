import os

# Database configuration
DATABASE_URL = "postgresql://user_ystpokgxwn:0kWHYIRfRnjVbZgd61VA@devinapps-backend-prod.cluster-clussqewa0rh.us-west-2.rds.amazonaws.com/db_dkxnuxaksb?sslmode=require"

# Thirdweb configuration
THIRDWEB_CLIENT_ID = os.environ.get("THIRDWEB_CLIENT_ID", "YOUR_CLIENT_ID_HERE")

# ENS configuration
ENS_PROVIDER_URL = "https://mainnet.infura.io/v3/YOUR_INFURA_PROJECT_ID"

# Farcaster configuration
FARCASTER_API_URL = "https://api.farcaster.xyz"

# Cache configuration
CACHE_EXPIRATION = 3600  # Cache expiration time in seconds

# Security configuration
SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
