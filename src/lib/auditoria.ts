import "server-only";
import { headers } from "next/headers";
import { db } from "./db";

export async function registrar(usuarioId: string | null, accion: string, entidad: string, entidadId = "", detalle = "") {
  const h = headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  await db.auditoria.create({ data: { usuarioId, accion, entidad, entidadId, detalle: detalle.slice(0, 500), ip } });
}
