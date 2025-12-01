# Crypto.me Thirdweb

Crypto.me Thirdweb is a central profile page for web3 identities. It allows users to view and manage their Ethereum Name Service (ENS) profiles, displaying the last error or the last successful sync time.

## Tech Stack

- [Next.js](https://nextjs.org): A React framework for building web applications.
- [Prisma](https://www.prisma.io): An open-source database toolkit for TypeScript and Node.js.
- [PostgreSQL](https://www.postgresql.org): The primary database for production.
- [SQLite](https://www.sqlite.org): Can be used for local development if configured.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for details on the `fast-profile` system, `service_cache`, and `sync_queue`.

## Getting Started

To set up a local version of the app, follow these steps:

1. Clone the repository:

```bash
git clone https://github.com/pierce403/crypto.me-thirdweb.git
cd crypto.me-thirdweb
```

2. Install the dependencies:

```bash
npm install
# or
yarn install
```

3. Set up the database:

The project uses SQLite for local testing. The database file `data.db` is automatically created in the project root directory. No additional setup is required.

4. Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Database Setup and Maintenance

The project uses SQLite as the default database for local testing. The database file `data.db` is automatically created in the project root directory. To manage the database schema, Prisma is used. Here are some useful commands:

- To apply database migrations:
  ```bash
  npx prisma migrate dev
  ```

- To generate Prisma client:
  ```bash
  npx prisma generate
  ```

- To open the Prisma Studio for database management:
  ```bash
  npx prisma studio
  ```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
