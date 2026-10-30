import "dotenv/config";
import app from "./app.js";
import pool from "./config/database.js";
import { assertMigrations } from './research/migrate.js';

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    await assertMigrations(pool);
    console.log("Conexão com o PostgreSQL estabelecida com sucesso.");

    app.listen(port, () => {
      console.log(`Servidor iniciado na porta ${port}.`);
    });
  } catch (error) {
    console.error("Não foi possível conectar ao PostgreSQL:", error.message);
    process.exit(1);
  }
}

startServer();
