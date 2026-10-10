import "server-only";
import { notFound } from "next/navigation";
import type { Prisma, Usuario } from "@prisma/client";
import { db } from "./db";

/** Filtro de expedientes que el usuario puede ver: el administrador ve todos, los demás solo los asignados. */
export function casosVisibles(u: Usuario): Prisma.CasoWhereInput {
  return u.rol === "ADMIN" ? {} : { asignaciones: { some: { usuarioId: u.id } } };
}

/** Eventos visibles: los de expedientes visibles y los que no pertenecen a ningún expediente. */
export function eventosVisibles(u: Usuario): Prisma.EventoWhereInput {
  return u.rol === "ADMIN" ? {} : { OR: [{ casoId: null }, { caso: casosVisibles(u) }] };
}

export async function casoVisible(u: Usuario, id: string) {
  const caso = await db.caso.findFirst({ where: { id, ...casosVisibles(u) } });
  if (!caso) notFound();
  return caso;
}

export const puedeEditarCaso = (u: Usuario) => u.rol === "ADMIN" || u.rol === "ABOGADO";
export const puedeBorrar = (u: Usuario) => u.rol === "ADMIN";
