import Link from "next/link";
import { esFechaValida, hoy, iso } from "@/lib/fechas";
import { TIPOS_EVENTO } from "@/lib/constantes";
import { opcionesCasos } from "@/lib/consultas";
import { requerirUsuario } from "@/lib/sesion";
import { FormularioEvento } from "@/components/FormularioEvento";

export default async function NuevoEvento({ searchParams }: { searchParams: { fecha?: string; casoId?: string; tipo?: string; titulo?: string } }) {
  const u = await requerirUsuario();
  const casos = await opcionesCasos(u);
  const evento = {
    fecha: searchParams.fecha && esFechaValida(searchParams.fecha) ? searchParams.fecha : iso(hoy()),
    casoId: casos.some((c) => c.id === searchParams.casoId) ? searchParams.casoId : "",
    tipo: searchParams.tipo && searchParams.tipo in TIPOS_EVENTO ? searchParams.tipo : "AUDIENCIA",
    titulo: (searchParams.titulo ?? "").slice(0, 200),
  };
  return (
    <section className="view" style={{ maxWidth: 680 }}>
      <Link className="link" href="/calendario">← Calendario</Link>
      <div className="vhead"><h1>Agendar</h1></div>
      <FormularioEvento evento={evento} casos={casos} volver={evento.casoId ? `/expedientes/${evento.casoId}?tab=agenda` : undefined} />
    </section>
  );
}
