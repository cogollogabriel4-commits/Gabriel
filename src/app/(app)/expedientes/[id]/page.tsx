import Link from "next/link";
import { asignarCaso } from "@/app/acciones";
import { db } from "@/lib/db";
import { casoVisible, puedeBorrar, puedeEditarCaso } from "@/lib/acceso";
import { ESTADOS, ROLES_CLIENTE } from "@/lib/constantes";
import { desdeDb, fmtCorta, hoy, iso } from "@/lib/fechas";
import { conCaso } from "@/lib/consultas";
import { requerirUsuario } from "@/lib/sesion";
import { Agenda } from "@/components/Agenda";
import { Archivos } from "@/components/Archivos";
import { FormularioActuacion } from "@/components/FormularioActuacion";
import { Subidor } from "@/components/Subidor";
import { Vacio } from "@/components/Vacio";

const PESTANAS = { docs: "Documentos", agenda: "Agenda", act: "Actuaciones", equipo: "Equipo" } as const;
type Pestana = keyof typeof PESTANAS;

export default async function Caso({ params, searchParams }: { params: { id: string }; searchParams: { tab?: string } }) {
  const u = await requerirUsuario();
  const c = await casoVisible(u, params.id);
  const admin = u.rol === "ADMIN";
  const tab: Pestana = searchParams.tab && searchParams.tab in PESTANAS && (searchParams.tab !== "equipo" || admin) ? (searchParams.tab as Pestana) : "docs";

  const [docs, eventos, actuaciones, asignados, usuarios] = await Promise.all([
    tab === "docs" ? db.documento.findMany({ where: { casoId: c.id, borrado: null }, include: { subidoPor: { select: { nombre: true } } }, orderBy: { subido: "desc" } }) : [],
    tab === "agenda" ? db.evento.findMany({ where: { casoId: c.id }, include: conCaso, orderBy: [{ fecha: "asc" }, { hora: "asc" }] }) : [],
    tab === "act" ? db.actuacion.findMany({ where: { casoId: c.id }, include: { autor: { select: { nombre: true } } }, orderBy: [{ fecha: "desc" }, { creado: "desc" }] }) : [],
    db.asignacion.findMany({ where: { casoId: c.id }, include: { usuario: { select: { id: true, nombre: true } } } }),
    tab === "equipo" ? db.usuario.findMany({ where: { activo: true }, orderBy: { nombre: "asc" } }) : [],
  ]);

  const meta: [string, string][] = [
    ["Contraparte", c.contraparte], ["Despacho", c.despacho], ["Representamos a", ROLES_CLIENTE[c.rolCliente] ?? ""],
    ["Responsables", asignados.map((a) => a.usuario.nombre).join(", ")], ["Inicio", c.inicio ? fmtCorta(desdeDb(c.inicio)) : ""],
  ];

  return (
    <section className="view">
      <Link className="link" href="/expedientes">← Expedientes</Link>
      <div className="card case-head">
        <div className="case-title">
          <div style={{ minWidth: 0 }}>
            <p className="eyebrow">{c.area}{c.clase ? ` · ${c.clase}` : ""}</p>
            <h1>{c.cliente}</h1>
            <div className="rad muted">{c.radicado}</div>
          </div>
          <div className="row">
            <span className={`pill ${c.estado}`}>{ESTADOS[c.estado]}</span>
            {puedeEditarCaso(u) && <Link className="btn ghost" href={`/expedientes/${c.id}/editar`}>Editar</Link>}
          </div>
        </div>
        <dl className="meta">
          {meta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "—"}</dd></div>)}
        </dl>
        {c.notas && <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{c.notas}</p>}
      </div>

      <nav className="tabs" aria-label="Secciones del expediente">
        {(Object.keys(PESTANAS) as Pestana[]).filter((k) => k !== "equipo" || admin).map((k) => (
          <Link key={k} href={`/expedientes/${c.id}?tab=${k}`} aria-current={tab === k ? "page" : undefined}>{PESTANAS[k]}</Link>
        ))}
      </nav>

      {tab === "docs" && (
        <div className="two">
          <div className="card">
            {docs.length ? <Archivos docs={docs} puedeBorrar={puedeBorrar(u)} /> : <Vacio titulo="Sin documentos" texto="Sube demandas, poderes, autos o pruebas desde el panel de la derecha." />}
          </div>
          <div className="card"><div className="card-h"><h2>Subir documentos</h2></div><div className="card-b"><Subidor casoId={c.id} /></div></div>
        </div>
      )}

      {tab === "agenda" && (
        <div className="card">
          <div className="card-h"><h2>Audiencias, vencimientos y citas</h2><Link className="btn ghost" href={`/calendario/nuevo?casoId=${c.id}`}>Agendar</Link></div>
          <Agenda eventos={eventos} ocultarCaso vacio={["Sin fechas para este expediente", "Agenda la próxima audiencia o el vencimiento de un término."]} />
        </div>
      )}

      {tab === "act" && (
        <div className="two">
          <div className="card">
            <div className="card-h"><h2>Bitácora del proceso</h2></div>
            {!actuaciones.length ? <Vacio titulo="Sin actuaciones registradas" texto="Lleva aquí la bitácora del proceso: autos, memoriales radicados, notificaciones." /> : (
              <ul className="timeline">
                {actuaciones.map((a) => (
                  <li key={a.id}><div className="d">{fmtCorta(desdeDb(a.fecha))} · {a.autor.nombre}</div><p>{a.texto}</p></li>
                ))}
              </ul>
            )}
          </div>
          <div className="card"><div className="card-h"><h2>Registrar actuación</h2></div><FormularioActuacion casoId={c.id} hoy={iso(hoy())} /></div>
        </div>
      )}

      {tab === "equipo" && admin && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="card-h"><h2>Quién puede ver este expediente</h2></div>
          <form action={asignarCaso} className="card-b stack">
            <input type="hidden" name="casoId" value={c.id} />
            {usuarios.map((x) => (
              <label key={x.id} className="check" htmlFor={`as-${x.id}`}>
                <input type="checkbox" id={`as-${x.id}`} name="usuarios" value={x.id} defaultChecked={asignados.some((a) => a.usuario.id === x.id)} />
                <span>{x.nombre} <span className="hint">{x.correo}</span></span>
              </label>
            ))}
            <p className="notice">Los administradores ven todos los expedientes aunque no estén marcados.</p>
            <div className="row"><button type="submit" className="primary">Guardar equipo</button></div>
          </form>
        </div>
      )}
    </section>
  );
}
