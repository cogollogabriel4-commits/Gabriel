"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EstadoCaso, Rol, TipoEvento } from "@prisma/client";
import { db } from "@/lib/db";
import { casoVisible, puedeBorrar, puedeEditarCaso } from "@/lib/acceso";
import { registrar } from "@/lib/auditoria";
import { guardarArchivo } from "@/lib/almacen";
import { AREAS, CATEGORIAS, ESTADOS, MAX_ARCHIVO, ROLES_CLIENTE, ROLES_USUARIO, TIPOS_ARCHIVO, TIPOS_EVENTO } from "@/lib/constantes";
import { esFechaValida, haciaDb } from "@/lib/fechas";
import { cerrarSesion, iniciarSesion, requerirAdmin, requerirUsuario } from "@/lib/sesion";

export type Estado = { error?: string; ok?: string } | undefined;

const txt = (f: FormData, k: string, max = 2000) => String(f.get(k) ?? "").trim().slice(0, max);
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;

/* ---------- Sesión ---------- */

export async function entrar(_: Estado, f: FormData): Promise<Estado> {
  const correo = txt(f, "correo", 200).toLowerCase();
  const clave = String(f.get("clave") ?? "");
  const u = await db.usuario.findUnique({ where: { correo } });
  const generico = { error: "Correo o contraseña incorrectos." };
  if (!u || !u.activo) {
    await registrar(null, "login_fallido", "usuario", "", correo);
    return generico;
  }
  if (u.bloqueadoHasta && u.bloqueadoHasta > new Date()) {
    return { error: "La cuenta está bloqueada por intentos fallidos. Intenta de nuevo en unos minutos." };
  }
  if (!(await bcrypt.compare(clave, u.hashClave))) {
    const intentos = u.intentosFallidos + 1;
    await db.usuario.update({
      where: { id: u.id },
      data: intentos >= MAX_INTENTOS
        ? { intentosFallidos: 0, bloqueadoHasta: new Date(Date.now() + BLOQUEO_MIN * 60000) }
        : { intentosFallidos: intentos },
    });
    await registrar(u.id, "login_fallido", "usuario", u.id);
    return generico;
  }
  await db.usuario.update({ where: { id: u.id }, data: { intentosFallidos: 0, bloqueadoHasta: null } });
  await iniciarSesion(u.id);
  await registrar(u.id, "login", "usuario", u.id);
  redirect("/");
}

export async function salir() {
  const u = await requerirUsuario();
  await registrar(u.id, "logout", "usuario", u.id);
  cerrarSesion();
  redirect("/login");
}

/* ---------- Expedientes ---------- */

function datosCaso(f: FormData) {
  const estado = txt(f, "estado") as EstadoCaso;
  const inicio = txt(f, "inicio");
  return {
    radicado: txt(f, "radicado", 60),
    cliente: txt(f, "cliente", 200),
    contraparte: txt(f, "contraparte", 200),
    despacho: txt(f, "despacho", 200),
    area: AREAS.includes(txt(f, "area")) ? txt(f, "area") : "Otro",
    clase: txt(f, "clase", 120),
    rolCliente: txt(f, "rolCliente") in ROLES_CLIENTE ? txt(f, "rolCliente") : "demandante",
    estado: estado in ESTADOS ? estado : "ACTIVO",
    inicio: esFechaValida(inicio) ? haciaDb(inicio) : null,
    notas: txt(f, "notas", 5000),
  };
}

export async function guardarCaso(_: Estado, f: FormData): Promise<Estado> {
  const u = await requerirUsuario();
  if (!puedeEditarCaso(u)) return { error: "Tu rol no permite crear ni editar expedientes." };
  const data = datosCaso(f);
  if (!data.radicado || !data.cliente) return { error: "El radicado y el cliente son obligatorios." };
  const id = txt(f, "id");
  let casoId: string;
  if (id) {
    await casoVisible(u, id);
    await db.caso.update({ where: { id }, data });
    casoId = id;
    await registrar(u.id, "editar", "caso", id);
  } else {
    const caso = await db.caso.create({ data: { ...data, asignaciones: { create: { usuarioId: u.id } } } });
    casoId = caso.id;
    await registrar(u.id, "crear", "caso", caso.id, data.radicado);
  }
  revalidatePath("/", "layout");
  redirect(`/expedientes/${casoId}`);
}

export async function asignarCaso(f: FormData) {
  const u = await requerirAdmin();
  const casoId = txt(f, "casoId");
  const ids = f.getAll("usuarios").map(String);
  await db.$transaction([
    db.asignacion.deleteMany({ where: { casoId } }),
    db.asignacion.createMany({ data: ids.map((usuarioId) => ({ casoId, usuarioId })) }),
  ]);
  await registrar(u.id, "asignar", "caso", casoId, ids.join(","));
  revalidatePath(`/expedientes/${casoId}`);
}

/* ---------- Documentos ---------- */

export async function subirDocumentos(_: Estado, f: FormData): Promise<Estado> {
  const u = await requerirUsuario();
  const casoId = txt(f, "casoId");
  if (!casoId) return { error: "Elige el expediente al que pertenecen los archivos." };
  await casoVisible(u, casoId);
  const categoria = CATEGORIAS.includes(txt(f, "categoria")) ? txt(f, "categoria") : "Otro";
  const nota = txt(f, "nota", 500);
  const archivos = f.getAll("archivos").filter((x): x is File => x instanceof File && x.size > 0);
  if (!archivos.length) return { error: "Elige al menos un archivo." };
  const rechazados: string[] = [];
  let ok = 0;
  for (const a of archivos) {
    const ext = (a.name.split(".").pop() ?? "").toLowerCase();
    const tipo = TIPOS_ARCHIVO[ext];
    if (!tipo) { rechazados.push(`${a.name} (formato no admitido)`); continue; }
    if (a.size > MAX_ARCHIVO) { rechazados.push(`${a.name} (supera 25 MB)`); continue; }
    const { ruta, sha256 } = await guardarArchivo(Buffer.from(await a.arrayBuffer()), ext);
    const doc = await db.documento.create({
      data: { casoId, nombre: a.name.slice(0, 250), categoria, nota, contentType: tipo, tamano: a.size, ruta, sha256, subidoPorId: u.id },
    });
    await registrar(u.id, "subir", "documento", doc.id, a.name);
    ok++;
  }
  revalidatePath("/", "layout");
  if (rechazados.length) return { error: `${ok ? `${ok} guardado(s). ` : ""}No se subieron: ${rechazados.join(", ")}` };
  return { ok: ok === 1 ? "Documento guardado." : `${ok} documentos guardados.` };
}

export async function borrarDocumento(f: FormData) {
  const u = await requerirUsuario();
  if (!puedeBorrar(u)) return;
  const id = txt(f, "id");
  const doc = await db.documento.findUnique({ where: { id } });
  if (!doc) return;
  await casoVisible(u, doc.casoId);
  await db.documento.update({ where: { id }, data: { borrado: new Date() } });
  await registrar(u.id, "borrar", "documento", id, doc.nombre);
  revalidatePath("/", "layout");
}

/* ---------- Actuaciones ---------- */

export async function crearActuacion(_: Estado, f: FormData): Promise<Estado> {
  const u = await requerirUsuario();
  const casoId = txt(f, "casoId");
  await casoVisible(u, casoId);
  const fecha = txt(f, "fecha"), texto = txt(f, "texto", 5000);
  if (!esFechaValida(fecha) || !texto) return { error: "Escribe la fecha y la actuación." };
  const a = await db.actuacion.create({ data: { casoId, fecha: haciaDb(fecha), texto, autorId: u.id } });
  await db.caso.update({ where: { id: casoId }, data: { actualizado: new Date() } });
  await registrar(u.id, "crear", "actuacion", a.id);
  revalidatePath(`/expedientes/${casoId}`);
  return { ok: "Actuación guardada." };
}

/* ---------- Agenda ---------- */

export async function guardarEvento(_: Estado, f: FormData): Promise<Estado> {
  const u = await requerirUsuario();
  const casoId = txt(f, "casoId") || null;
  if (casoId) await casoVisible(u, casoId);
  const tipo = txt(f, "tipo") as TipoEvento;
  const fecha = txt(f, "fecha");
  const hora = txt(f, "hora", 5);
  const data = {
    casoId,
    titulo: txt(f, "titulo", 200),
    tipo: tipo in TIPOS_EVENTO ? tipo : "OTRO",
    fecha: esFechaValida(fecha) ? haciaDb(fecha) : null,
    hora: /^\d{2}:\d{2}$/.test(hora) ? hora : "",
    lugar: txt(f, "lugar", 300),
    nota: txt(f, "nota", 2000),
  };
  if (!data.titulo || !data.fecha) return { error: "El título y la fecha son obligatorios." };
  const id = txt(f, "id");
  if (id) {
    await eventoVisible(u.id, id);
    await db.evento.update({ where: { id }, data: { ...data, fecha: data.fecha } });
    await registrar(u.id, "editar", "evento", id);
  } else {
    const e = await db.evento.create({ data: { ...data, fecha: data.fecha } });
    await registrar(u.id, "crear", "evento", e.id, data.titulo);
  }
  revalidatePath("/", "layout");
  redirect(txt(f, "volver") || `/calendario?dia=${fecha}`);
}

async function eventoVisible(usuarioId: string, id: string) {
  const u = await db.usuario.findUniqueOrThrow({ where: { id: usuarioId } });
  const e = await db.evento.findUniqueOrThrow({ where: { id } });
  if (e.casoId) await casoVisible(u, e.casoId);
  return e;
}

export async function alternarEvento(f: FormData) {
  const u = await requerirUsuario();
  const e = await eventoVisible(u.id, txt(f, "id"));
  await db.evento.update({ where: { id: e.id }, data: { hecho: !e.hecho } });
  await registrar(u.id, e.hecho ? "reabrir" : "cumplir", "evento", e.id);
  revalidatePath("/", "layout");
}

export async function borrarEvento(f: FormData) {
  const u = await requerirUsuario();
  if (!puedeEditarCaso(u)) return;
  const e = await eventoVisible(u.id, txt(f, "id"));
  await db.evento.delete({ where: { id: e.id } });
  await registrar(u.id, "borrar", "evento", e.id, e.titulo);
  revalidatePath("/", "layout");
  redirect("/calendario");
}

/* ---------- Usuarios ---------- */

export async function crearUsuario(_: Estado, f: FormData): Promise<Estado> {
  const admin = await requerirAdmin();
  const nombre = txt(f, "nombre", 120), correo = txt(f, "correo", 200).toLowerCase();
  const clave = String(f.get("clave") ?? "");
  const rol = txt(f, "rol") as Rol;
  if (!nombre || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return { error: "Escribe un nombre y un correo válido." };
  if (clave.length < 10) return { error: "La contraseña debe tener al menos 10 caracteres." };
  if (await db.usuario.findUnique({ where: { correo } })) return { error: "Ya existe un usuario con ese correo." };
  const u = await db.usuario.create({
    data: { nombre, correo, rol: rol in ROLES_USUARIO ? rol : "ABOGADO", hashClave: await bcrypt.hash(clave, 12) },
  });
  await registrar(admin.id, "crear", "usuario", u.id, correo);
  revalidatePath("/admin/usuarios");
  return { ok: `Usuario ${correo} creado.` };
}

export async function alternarUsuario(f: FormData) {
  const admin = await requerirAdmin();
  const id = txt(f, "id");
  if (id === admin.id) return;
  const u = await db.usuario.findUniqueOrThrow({ where: { id } });
  await db.usuario.update({ where: { id }, data: { activo: !u.activo } });
  await registrar(admin.id, u.activo ? "desactivar" : "activar", "usuario", id);
  revalidatePath("/admin/usuarios");
}
