// Crea el primer administrador con ADMIN_NOMBRE, ADMIN_CORREO y ADMIN_CLAVE.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const nombre = process.env.ADMIN_NOMBRE || "Administrador";
const correo = (process.env.ADMIN_CORREO || "").toLowerCase();
const clave = process.env.ADMIN_CLAVE || "";

try {
  if (!correo || clave.length < 10) throw new Error("Define ADMIN_CORREO y ADMIN_CLAVE (mínimo 10 caracteres).");
  if (await db.usuario.findUnique({ where: { correo } })) {
    console.log(`Ya existe un usuario con el correo ${correo}.`);
  } else {
    await db.usuario.create({ data: { nombre, correo, rol: "ADMIN", hashClave: await bcrypt.hash(clave, 12) } });
    console.log(`Administrador ${correo} creado.`);
  }
} finally {
  await db.$disconnect();
}
