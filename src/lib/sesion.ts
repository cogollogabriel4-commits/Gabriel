import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import type { Usuario } from "@prisma/client";
import { db } from "./db";

const COOKIE = "sesion";
const DURACION_HORAS = 12;

function clave(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  return new TextEncoder().encode(s);
}

export async function iniciarSesion(usuarioId: string) {
  const token = await new SignJWT({ uid: usuarioId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_HORAS}h`)
    .sign(clave());
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACION_HORAS * 3600,
  });
}

export function cerrarSesion() {
  cookies().delete(COOKIE);
}

export async function usuarioActual(): Promise<Usuario | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, clave());
    if (typeof payload.uid !== "string") return null;
    const u = await db.usuario.findUnique({ where: { id: payload.uid } });
    return u && u.activo ? u : null;
  } catch {
    return null;
  }
}

/** Usuario con sesión o redirección al inicio de sesión. */
export async function requerirUsuario(): Promise<Usuario> {
  const u = await usuarioActual();
  if (!u) redirect("/login");
  return u;
}

export async function requerirAdmin(): Promise<Usuario> {
  const u = await requerirUsuario();
  if (u.rol !== "ADMIN") redirect("/");
  return u;
}
