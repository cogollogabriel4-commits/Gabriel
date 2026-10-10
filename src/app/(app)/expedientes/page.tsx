import Link from "next/link";
import type { EstadoCaso, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { casosVisibles, puedeEditarCaso } from "@/lib/acceso";
import { AREAS, ESTADOS, TIPOS_EVENTO } from "@/lib/constantes";
import { desdeDb, fmtCorta, haciaDb, hoy, iso } from "@/lib/fechas";
import { requerirUsuario } from "@/lib/sesion";
import { Vacio } from "@/components/Vacio";

export default async function Expedientes({ searchParams }: { searchParams: { q?: string; estado?: string; area?: string } }) {
  const u = await requerirUsuario();
  const q = (searchParams.q ?? "").trim();
  const estado = searchParams.estado && searchParams.estado in ESTADOS ? (searchParams.estado as EstadoCaso) : undefined;
  const area = AREAS.includes(searchParams.area ?? "") ? searchParams.area : undefined;
  const where: Prisma.CasoWhereInput = {
    AND: [
      casosVisibles(u),
      estado ? { estado } : {},
      area ? { area } : {},
      q ? { OR: ["radicado", "cliente", "contraparte", "despacho", "clase"].map((k) => ({ [k]: { contains: q, mode: "insensitive" } })) } : {},
    ],
  };
  const casos = await db.caso.findMany({
    where,
    orderBy: { actualizado: "desc" },
    take: 300,
    include: { eventos: { where: { hecho: false, fecha: { gte: haciaDb(iso(hoy())) } }, orderBy: { fecha: "asc" }, take: 1 } },
  });
  const filtrando = Boolean(q || estado || area);

  return (
    <section className="view">
      <div className="vhead">
        <div><p className="eyebrow">Archivo</p><h1>Expedientes</h1></div>
        {puedeEditarCaso(u) && <Link className="btn primary" href="/expedientes/nuevo">Nuevo expediente</Link>}
      </div>
      <form className="row">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por radicado, cliente, contraparte o despacho" aria-label="Buscar expedientes" style={{ flex: "1 1 260px", width: "auto" }} />
        <select name="estado" defaultValue={estado ?? ""} aria-label="Filtrar por estado" style={{ width: "auto" }}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        <select name="area" defaultValue={area ?? ""} aria-label="Filtrar por área" style={{ width: "auto" }}>
          <option value="">Todas las áreas</option>
          {AREAS.map((a) => <option key={a}>{a}</option>)}
        </select>
        <button type="submit" className="ghost">Filtrar</button>
      </form>
      <div className="card">
        {!casos.length ? (
          filtrando ? <Vacio titulo="Sin resultados" texto="Ningún expediente coincide con la búsqueda o los filtros." />
            : <Vacio titulo="Aún no hay expedientes" texto="Pulsa “Nuevo expediente” para registrar radicado, cliente, despacho y área." />
        ) : (
          <div className="tablewrap">
            <table>
              <thead><tr><th>Cliente</th><th>Radicado</th><th>Despacho</th><th>Área</th><th>Próxima fecha</th><th>Estado</th></tr></thead>
              <tbody>
                {casos.map((c) => {
                  const p = c.eventos[0];
                  return (
                    <tr key={c.id}>
                      <td><Link className="rowlink" href={`/expedientes/${c.id}`}>{c.cliente}</Link>{c.contraparte && <div className="small muted">vs. {c.contraparte}</div>}</td>
                      <td className="rad">{c.radicado}</td>
                      <td className="small">{c.despacho || "—"}</td>
                      <td className="small">{c.area}</td>
                      <td className="small">{p ? <>{fmtCorta(desdeDb(p.fecha))}<div className="muted">{TIPOS_EVENTO[p.tipo]}</div></> : <span className="muted">—</span>}</td>
                      <td><span className={`pill ${c.estado}`}>{ESTADOS[c.estado]}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
