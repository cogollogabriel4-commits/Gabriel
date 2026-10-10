import Link from "next/link";
import { redirect } from "next/navigation";
import { puedeEditarCaso } from "@/lib/acceso";
import { hoy, iso } from "@/lib/fechas";
import { requerirUsuario } from "@/lib/sesion";
import { FormularioCaso } from "@/components/FormularioCaso";

export default async function NuevoCaso() {
  const u = await requerirUsuario();
  if (!puedeEditarCaso(u)) redirect("/expedientes");
  return (
    <section className="view" style={{ maxWidth: 760 }}>
      <Link className="link" href="/expedientes">← Expedientes</Link>
      <div className="vhead"><h1>Nuevo expediente</h1></div>
      <FormularioCaso caso={{ inicio: iso(hoy()) }} />
    </section>
  );
}
