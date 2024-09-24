# Crypto.me Thirdweb Documentation

## Project Structure Overview
- **Backend**: Implemented using Next.js API routes.
- **Frontend**: Built with Next.js, TypeScript, React, and Tailwind CSS.
- **Database**: PostgreSQL for storing profile data.

## Setup Instructions
1. Clone the repository: `git clone https://github.com/pierce403/crypto.me-thirdweb.git`
2. Navigate to the project directory: `cd crypto.me-thirdweb`
3. Install dependencies: `npm install`
4. Set up environment variables in `.env.local`
5. Start the development server: `npm run dev`

## Accessing the Application
- Open your web browser and go to `http://localhost:3000` to access the application.

## API Endpoint Descriptions
- **/api/health**: Returns the health status of the application.
- **/api/profile**: Fetches profile data based on ENS name.

## Testing API Routes
- To test the `/api/health` endpoint, use the following curl command:
  ```
  curl http://localhost:3000/api/health
  ```
- To test the `/api/profile` endpoint, use the following curl command, replacing `ens_name` with the desired ENS name:
  ```
  curl http://localhost:3000/api/profile?ens_name=test.eth
  ```

## Verifying Frontend Functionality
- Ensure the health status is displayed as "healthy" on the frontend.
- Enter an ENS name (e.g., "test.eth") in the input field and click the "Fetch Profile" button.
- Verify that the profile information is displayed correctly, including name, bio, avatar, and social media links.

## Frontend Component Descriptions
- **Health Status**: Displays the current health status of the backend.
- **Fetch Profile**: Allows users to enter an ENS name and fetch corresponding profile data.

## Database Schema and Interaction Details
- **cached_profiles**: Table storing ENS names and associated profile data.
- Interaction via Prisma ORM in Next.js API routes.

## Prisma Setup and Usage
- **Prisma Client**: Used for database operations, replacing direct PostgreSQL queries.
- **Schema Definition**: Located in `prisma/schema.prisma`, reflecting the current database structure.
- **Running Migrations**: Use `npx prisma migrate dev` to apply schema changes to the database.
- **Generating Prisma Client**: Run `npx prisma generate` after making changes to the schema.

Ensure all sections are detailed and clear for users and developers.
