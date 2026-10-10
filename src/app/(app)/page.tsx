import Link from "next/link";
import { db } from "@/lib/db";
import { casosVisibles, eventosVisibles, puedeEditarCaso } from "@/lib/acceso";
import { ESTADOS } from "@/lib/constantes";
import { addDays, fmtLarga, haciaDb, hoy, iso } from "@/lib/fechas";
import { conCaso } from "@/lib/consultas";
import { requerirUsuario } from "@/lib/sesion";
import { Agenda } from "@/components/Agenda";
import { Vacio } from "@/components/Vacio";

export default async function Panel() {
  const u = await requerirUsuario();
  const t = hoy(), tIso = iso(t);
  const desde = haciaDb(tIso), en7 = haciaDb(iso(addDays(t, 7))), en30 = haciaDb(iso(addDays(t, 30)));
  const ev = eventosVisibles(u), cv = casosVisibles(u);
  const [activos, audiencias, vencimientos, documentos, agenda, vencidos, recientes] = await Promise.all([
    db.caso.count({ where: { ...cv, estado: "ACTIVO" } }),
    db.evento.count({ where: { ...ev, hecho: false, tipo: "AUDIENCIA", fecha: { gte: desde, lte: en7 } } }),
    db.evento.count({ where: { ...ev, hecho: false, tipo: "VENCIMIENTO", fecha: { gte: desde, lte: en7 } } }),
    db.documento.count({ where: { borrado: null, caso: cv } }),
    db.evento.findMany({ where: { ...ev, hecho: false, fecha: { gte: desde, lte: en30 } }, include: conCaso, orderBy: [{ fecha: "asc" }, { hora: "asc" }] }),
    db.evento.findMany({ where: { ...ev, hecho: false, tipo: "VENCIMIENTO", fecha: { lt: desde } }, include: conCaso, orderBy: { fecha: "asc" } }),
    db.caso.findMany({ where: cv, orderBy: { actualizado: "desc" }, take: 6 }),
  ]);
  const editor = puedeEditarCaso(u);

  return (
    <section className="view">
      <div className="vhead">
        <div><p className="eyebrow">{fmtLarga(tIso)}</p><h1>Panel de control</h1></div>
        <div className="row">
          <Link className="btn ghost" href="/calendario/nuevo">Agendar</Link>
          {editor && <Link className="btn primary" href="/expedientes/nuevo">Nuevo expediente</Link>}
        </div>
      </div>
      <div className="stats">
        <div className="stat"><b>{activos}</b><span>Expedientes activos</span></div>
        <div className="stat"><b>{audiencias}</b><span>Audiencias en 7 días</span></div>
        <div className={`stat${vencimientos ? " alert" : ""}`}><b>{vencimientos}</b><span>Vencimientos en 7 días</span></div>
        <div className="stat"><b>{documentos}</b><span>Documentos archivados</span></div>
      </div>
      <div className="two">
        <div className="card">
          <div className="card-h"><h2>Próximos 30 días</h2><Link className="link" href="/calendario">Ver calendario</Link></div>
          {vencidos.length > 0 && <p className="small" style={{ margin: 0, padding: "10px 18px", color: "var(--danger)", borderBottom: "1px solid var(--line)" }}>{vencidos.length} vencimiento(s) pasados sin marcar como cumplidos.</p>}
          <Agenda eventos={[...vencidos, ...agenda]} vacio={["Sin pendientes en los próximos 30 días", "Usa “Agendar” para registrar audiencias y vencimientos, o calcula un término en la sección Términos."]} />
        </div>
        <div className="card">
          <div className="card-h"><h2>Expedientes recientes</h2><Link className="link" href="/expedientes">Ver todos</Link></div>
          {!recientes.length ? <Vacio titulo="Aún no hay expedientes" texto={editor ? "Crea el primero con “Nuevo expediente”." : "Cuando te asignen expedientes aparecerán aquí."} /> : (
            <ul className="agenda">
              {recientes.map((c) => (
                <li key={c.id} style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}>
                  <div className="t">
                    <Link href={`/expedientes/${c.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{c.cliente}</Link>
                    <span className="rad muted">{c.radicado}</span>
                    {c.despacho && <span className="small muted">{c.despacho}</span>}
                  </div>
                  <span className={`pill ${c.estado}`}>{ESTADOS[c.estado]}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
