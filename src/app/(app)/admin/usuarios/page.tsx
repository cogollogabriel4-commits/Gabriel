import { alternarUsuario } from "@/app/acciones";
import { db } from "@/lib/db";
import { ROLES_USUARIO } from "@/lib/constantes";
import { requerirAdmin } from "@/lib/sesion";
import { FormularioUsuario } from "@/components/FormularioUsuario";

export default async function Usuarios() {
  const admin = await requerirAdmin();
  const usuarios = await db.usuario.findMany({ orderBy: { nombre: "asc" }, include: { _count: { select: { asignaciones: true } } } });
  return (
    <section className="view">
      <div className="vhead"><div><p className="eyebrow">Administración</p><h1>Usuarios</h1></div></div>
      <div className="two">
        <div className="card">
          <div className="tablewrap">
            <table>
              <thead><tr><th>Nombre</th><th>Rol</th><th>Expedientes</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {usuarios.map((x) => (
                  <tr key={x.id}>
                    <td><b>{x.nombre}</b><div className="small muted">{x.correo}</div></td>
                    <td className="small">{ROLES_USUARIO[x.rol]}</td>
                    <td className="small num">{x.rol === "ADMIN" ? "Todos" : x._count.asignaciones}</td>
                    <td><span className={`pill ${x.activo ? "ACTIVO" : ""}`}>{x.activo ? "Activo" : "Inactivo"}</span></td>
                    <td>
                      {x.id !== admin.id && (
                        <form action={alternarUsuario}>
                          <input type="hidden" name="id" value={x.id} />
                          <button type="submit" className="ghost sm">{x.activo ? "Desactivar" : "Activar"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card"><div className="card-h"><h2>Nuevo usuario</h2></div><FormularioUsuario /></div>
      </div>
    </section>
  );
}
