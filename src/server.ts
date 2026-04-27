import "dotenv/config";
import app from "./app.js";

const REQUIRED_ENV = ["DIRECT_URL"] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[FATAL] Variável de ambiente obrigatória não definida: ${key}`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor pronto na porta ${PORT}`);
});
