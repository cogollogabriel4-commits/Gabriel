import { db } from "@/lib/db";
import { requerirAdmin } from "@/lib/sesion";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function Auditoria() {
  await requerirAdmin();
  const filas = await db.auditoria.findMany({ orderBy: { fecha: "desc" }, take: 300, include: { usuario: { select: { nombre: true } } } });
  return (
    <section className="view">
      <div className="vhead"><div><p className="eyebrow">Administración</p><h1>Registro de auditoría</h1><p className="sub">Últimos 300 movimientos. Este registro no se puede editar desde la aplicación.</p></div></div>
      <div className="card tablewrap">
        <table>
          <thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Elemento</th><th>Detalle</th><th>IP</th></tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td className="small num" style={{ whiteSpace: "nowrap" }}>{fmt.format(f.fecha)}</td>
                <td className="small">{f.usuario?.nombre ?? "—"}</td>
                <td className="small">{f.accion}</td>
                <td className="small">{f.entidad}</td>
                <td className="small" style={{ overflowWrap: "anywhere" }}>{f.detalle}</td>
                <td className="small mono">{f.ip}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
