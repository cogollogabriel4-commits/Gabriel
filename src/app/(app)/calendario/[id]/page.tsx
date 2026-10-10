import Link from "next/link";
import { notFound } from "next/navigation";
import { borrarEvento } from "@/app/acciones";
import { db } from "@/lib/db";
import { eventosVisibles, puedeEditarCaso } from "@/lib/acceso";
import { desdeDb } from "@/lib/fechas";
import { opcionesCasos } from "@/lib/consultas";
import { requerirUsuario } from "@/lib/sesion";
import { Confirmar } from "@/components/Confirmar";
import { FormularioEvento } from "@/components/FormularioEvento";

export default async function EditarEvento({ params }: { params: { id: string } }) {
  const u = await requerirUsuario();
  const e = await db.evento.findFirst({ where: { id: params.id, ...eventosVisibles(u) } });
  if (!e) notFound();
  const casos = await opcionesCasos(u);
  const fecha = desdeDb(e.fecha);
  return (
    <section className="view" style={{ maxWidth: 680 }}>
      <Link className="link" href={`/calendario?dia=${fecha}`}>← Calendario</Link>
      <div className="vhead">
        <h1>Editar evento</h1>
        {puedeEditarCaso(u) && <Confirmar accion={borrarEvento} id={e.id} texto="Eliminar evento" />}
      </div>
      <FormularioEvento evento={{ ...e, casoId: e.casoId ?? "", fecha }} casos={casos} />
    </section>
  );
}
