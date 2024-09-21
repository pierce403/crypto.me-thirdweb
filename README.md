# Crypto.me

Crypto.me is a web3 alternative to platforms like Keybase or LinkedIn. It allows users to search for web3 identities by address or ENS name and view their profile information, including ENS name, profile picture, and Farcaster stats. Users can also connect their wallet to update their information.

## Tech Stack

- **Frontend**: Next.js, TypeScript, React, Tailwind CSS
- **Backend**: FastAPI
- **Database**: PostgreSQL
- **Wallet Integration**: Thirdweb

## Getting Started

### Prerequisites

- Node.js and npm installed
- Python 3.9+ installed
- PostgreSQL database

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/pierce403/crypto.me-thirdweb.git
   cd crypto.me-thirdweb
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Set up the backend**:
   - Navigate to the backend directory:
     ```bash
     cd src/backend
     ```
   - Install Python dependencies using Poetry:
     ```bash
     poetry install
     ```

4. **Configure environment variables**:
   - Create a `.env` file in the `src/backend` directory with the following variables:
     ```
     DATABASE_URL=your_postgres_database_url
     THIRDWEB_CLIENT_ID=your_thirdweb_client_id
     SECRET_KEY=your_secret_key
     ```

### Running the Application

1. **Start the backend server**:
   ```bash
   uvicorn backend.app:app --reload
   ```

2. **Start the frontend development server**:
   ```bash
   npm run dev
   ```

3. **Open your browser**:
   - Visit the frontend application at `http://localhost:3000`.

## Learn More

To learn more about the technologies used in this project, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Thirdweb Documentation](https://portal.thirdweb.com/)

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new) from the creators of Next.js.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
