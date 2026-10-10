import Link from "next/link";
import { redirect } from "next/navigation";
import { casoVisible, puedeEditarCaso } from "@/lib/acceso";
import { desdeDb } from "@/lib/fechas";
import { requerirUsuario } from "@/lib/sesion";
import { FormularioCaso } from "@/components/FormularioCaso";

export default async function EditarCaso({ params }: { params: { id: string } }) {
  const u = await requerirUsuario();
  if (!puedeEditarCaso(u)) redirect(`/expedientes/${params.id}`);
  const c = await casoVisible(u, params.id);
  return (
    <section className="view" style={{ maxWidth: 760 }}>
      <Link className="link" href={`/expedientes/${c.id}`}>← {c.cliente}</Link>
      <div className="vhead"><h1>Editar expediente</h1></div>
      <FormularioCaso caso={{ ...c, inicio: c.inicio ? desdeDb(c.inicio) : "" }} />
    </section>
  );
}
