import pg from "pg";

const { Pool } = pg;

function getSslConfig() {
  if (process.env.DB_SSL === "true") {
    return { rejectUnauthorized: true };
  }

  if (process.env.DB_SSL === "false") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(process.env.DB_HOST)
    ? false
    : { rejectUnauthorized: true };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: getSslConfig(),
  connectionTimeoutMillis: 10000,
  max: 10,
});

export default pool;
