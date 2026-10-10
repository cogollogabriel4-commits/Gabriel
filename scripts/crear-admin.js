"use strict";
// Uso: npm run crear-admin -- correo@ejemplo.com "Nombre Apellido"
// Pide la contraseña por la terminal (o la toma de ADMIN_PASSWORD).
const path = require("path");
const readline = require("readline");
const bcrypt = require("bcryptjs");
const { open } = require("../src/db");

async function main() {
  const [email, nombre] = process.argv.slice(2);
  if (!email || !nombre) { console.error('Uso: npm run crear-admin -- correo@ejemplo.com "Nombre Apellido"'); process.exit(1); }
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    password = await new Promise((r) => rl.question("Contraseña (mínimo 10 caracteres): ", (a) => { rl.close(); r(a); }));
  }
  if (!password || password.length < 10) { console.error("La contraseña debe tener al menos 10 caracteres."); process.exit(1); }
  const db = open(process.env.DATA_DIR || path.join(__dirname, "..", "data"));
  const hash = bcrypt.hashSync(password, 12);
  const prev = db.prepare("SELECT id FROM usuarios WHERE email = ?").get(email.toLowerCase());
  if (prev) db.prepare("UPDATE usuarios SET rol = 'admin', activo = 1, hash = ?, nombre = ? WHERE id = ?").run(hash, nombre, prev.id);
  else db.prepare("INSERT INTO usuarios (email, nombre, rol, hash) VALUES (?, ?, 'admin', ?)").run(email.toLowerCase(), nombre, hash);
  console.log((prev ? "Actualizado" : "Creado") + " el administrador " + email);
}
main();
