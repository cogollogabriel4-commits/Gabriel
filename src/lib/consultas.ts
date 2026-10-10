import "server-only";
import type { Usuario } from "@prisma/client";
import { casosVisibles } from "./acceso";
import { db } from "./db";

export async function opcionesCasos(u: Usuario) {
  const casos = await db.caso.findMany({
    where: { ...casosVisibles(u), estado: { not: "ARCHIVADO" } },
    select: { id: true, cliente: true, radicado: true },
    orderBy: { cliente: "asc" },
  });
  return casos.map((c) => ({ id: c.id, etiqueta: `${c.cliente} · ${c.radicado}` }));
}

export const conCaso = { caso: { select: { id: true, cliente: true, radicado: true } } } as const;
