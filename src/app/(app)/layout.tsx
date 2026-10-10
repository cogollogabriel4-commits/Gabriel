import { salir } from "@/app/acciones";
import { Navegacion } from "@/components/Navegacion";
import { ROLES_USUARIO } from "@/lib/constantes";
import { requerirUsuario } from "@/lib/sesion";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requerirUsuario();
  return (
    <div className="app">
      <aside className="side">
        <div className="brand"><b>Expedientes</b><span>Gestión jurídica</span></div>
        <Navegacion admin={u.rol === "ADMIN"} />
        <div className="side-foot">
          <span><b>{u.nombre}</b><br />{ROLES_USUARIO[u.rol]}</span>
          <form action={salir}><button type="submit">Cerrar sesión</button></form>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
