import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from 'pg';

// PostgreSQL database connection
const pool = new Pool({
  connectionString: 'postgres://user_uqzfajmnct:M7zMVcRCq06AgZ2fPEe1@devinapps-backend-prod.cluster-clussqewa0rh.us-west-2.rds.amazonaws.com/db_ozfukodqda?sslmode=disable'
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ens_name } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!ens_name || typeof ens_name !== 'string') {
    return res.status(400).json({ error: 'Invalid ENS name' });
  }

  try {
    // Fetch profile data from the database
    const query = 'SELECT * FROM cached_profiles WHERE ens_name = $1';
    const result = await pool.query(query, [ens_name]);

    if (result.rows.length > 0) {
      res.status(200).json(result.rows[0].profile_data);
    } else {
      res.status(404).json({ error: 'Profile not found' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
