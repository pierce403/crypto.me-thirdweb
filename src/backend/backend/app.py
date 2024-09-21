from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
from sqlalchemy import create_engine, Column, Integer, String, JSON, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from backend.config import DATABASE_URL, THIRDWEB_CLIENT_ID
from datetime import datetime, timedelta

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Database setup
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Cache model
class CachedProfile(Base):
    __tablename__ = "cached_profiles"

    id = Column(Integer, primary_key=True, index=True)
    ens_name = Column(String, unique=True, index=True)
    profile_data = Column(JSON)
    last_updated = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Cache functions
def get_cached_profile(db: Session, ens_name: str):
    return db.query(CachedProfile).filter(CachedProfile.ens_name == ens_name).first()

def update_cache(db: Session, ens_name: str, profile_data: dict):
    print(f"Updating cache for {ens_name}")  # Log the start of the function
    try:
        cached_profile = get_cached_profile(db, ens_name)
        if cached_profile:
            print(f"Updating existing profile for {ens_name}")
            cached_profile.profile_data = profile_data
            cached_profile.last_updated = datetime.utcnow()
        else:
            print(f"Creating new profile for {ens_name}")
            new_profile = CachedProfile(ens_name=ens_name, profile_data=profile_data)
            db.add(new_profile)
        db.commit()
        print(f"Cache updated successfully for {ens_name}")
    except Exception as e:
        print(f"Error updating cache for {ens_name}: {str(e)}")
        db.rollback()

@app.get("/")
async def root():
    return {"message": "Welcome to the crypto.me API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/profile/{ens_name}")
async def get_profile(ens_name: str, db: Session = Depends(get_db)):
    cached_profile = get_cached_profile(db, ens_name)

    if cached_profile and cached_profile.last_updated > datetime.utcnow() - timedelta(hours=1):
        return cached_profile.profile_data

    # Fetch profile data from on-chain sources
    profile_data = fetch_profile_data(ens_name)

    # Update cache
    update_cache(db, ens_name, profile_data)

    return profile_data

def fetch_profile_data(ens_name: str) -> dict:
    # This function can be easily extended to include new data sources
    import hashlib

    # Create Gravatar URL
    email = f"{ens_name.lower()}@example.com"  # Use a default email format
    gravatar_url = f"https://www.gravatar.com/avatar/{hashlib.md5(email.encode()).hexdigest()}?d=identicon&s=200"

    profile_data = {
        "ens_name": ens_name,
        "avatar": gravatar_url,
        "farcaster_stats": fetch_farcaster_stats(ens_name),
        # Add more data sources here as needed
    }
    return profile_data

def fetch_farcaster_stats(ens_name: str) -> dict:
    # Placeholder for actual Farcaster API call
    return {
        "followers": 1000,
        "following": 500,
        "posts": 250
    }

@app.put("/profile/{ens_name}")
async def update_profile(ens_name: str, profile_update: dict, db: Session = Depends(get_db)):
    # TODO: Implement proper authentication
    # For now, we'll assume the user is authenticated if they know the ENS name
    cached_profile = get_cached_profile(db, ens_name)
    if not cached_profile:
        # Create a new profile if it doesn't exist
        new_profile_data = {
            "ens_name": ens_name,
            "avatar": f"https://avatars.dicebear.com/api/identicon/{ens_name}.svg",
            "farcaster_stats": {
                "followers": 0,
                "following": 0,
                "posts": 0
            }
        }
        cached_profile = CachedProfile(ens_name=ens_name, profile_data=new_profile_data)
        db.add(cached_profile)
        db.commit()

    # Update only allowed fields
    allowed_fields = ["avatar"]
    for field in allowed_fields:
        if field in profile_update:
            cached_profile.profile_data[field] = profile_update[field]

    cached_profile.last_updated = datetime.utcnow()
    db.commit()

    return {"message": "Profile updated successfully", "profile": cached_profile.profile_data}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
