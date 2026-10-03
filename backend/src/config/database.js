import pg from "pg";

const { Pool } = pg;

function getSslConfig() {
  if (process.env.DB_SSL === "true") {
    return { rejectUnauthorized: false };
  }

  if (process.env.DB_SSL === "false") {
    return false;
  }

  return ["localhost", "127.0.0.1"].includes(process.env.DB_HOST)
    ? false
    : { rejectUnauthorized: false };
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: getSslConfig(),
});

export default pool;
