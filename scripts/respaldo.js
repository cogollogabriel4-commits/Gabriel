"use strict";
// Copia de respaldo de la base de datos y los archivos en un .tar.gz.
// Uso: npm run respaldo   (en Docker: docker compose exec -T app npm run respaldo)
// Variables: DATA_DIR (por defecto ./data), RESPALDO_DIR (./respaldos), RESPALDO_DIAS (30).
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const Database = require("better-sqlite3");

const dataDir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
const dest = process.env.RESPALDO_DIR || path.join(__dirname, "..", "respaldos");
const dias = Number(process.env.RESPALDO_DIAS) || 30;

(async () => {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  const tmp = path.join(dest, ".tmp-" + stamp);
  fs.mkdirSync(tmp, { recursive: true });
  // backup() gives a consistent copy even while the app is writing.
  const db = new Database(path.join(dataDir, "expedientes.db"), { readonly: true });
  await db.backup(path.join(tmp, "expedientes.db"));
  db.close();
  const out = path.join(dest, "respaldo-" + stamp + ".tar.gz");
  execFileSync("tar", ["-czf", out, "-C", tmp, "expedientes.db", "-C", dataDir, "archivos"]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const limite = Date.now() - dias * 864e5;
  fs.readdirSync(dest).filter((f) => /^respaldo-.*\.tar\.gz$/.test(f)).forEach((f) => {
    const p = path.join(dest, f);
    if (fs.statSync(p).mtimeMs < limite) fs.rmSync(p);
  });
  console.log("Respaldo creado: " + out);
})().catch((e) => { console.error("Falló el respaldo:", e.message); process.exit(1); });
