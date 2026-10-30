import "dotenv/config";
import app from "./app.js";
import pool from "./config/database.js";

const port = process.env.PORT || 3000;

async function startServer() {
  try {
    await pool.query("SELECT 1");
    const schema = await pool.query("SELECT to_regclass('research.runs') AS relation");
    if (!schema.rows[0].relation) throw new Error('Schema de pesquisa ausente. Execute npm run migrate antes de iniciar.');
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
