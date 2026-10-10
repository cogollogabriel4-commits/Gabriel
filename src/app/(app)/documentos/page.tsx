import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { casosVisibles, puedeBorrar } from "@/lib/acceso";
import { CATEGORIAS } from "@/lib/constantes";
import { opcionesCasos } from "@/lib/consultas";
import { requerirUsuario } from "@/lib/sesion";
import { Archivos } from "@/components/Archivos";
import { Subidor } from "@/components/Subidor";
import { Vacio } from "@/components/Vacio";

export default async function Documentos({ searchParams }: { searchParams: { q?: string; cat?: string } }) {
  const u = await requerirUsuario();
  const q = (searchParams.q ?? "").trim();
  const cat = CATEGORIAS.includes(searchParams.cat ?? "") ? searchParams.cat : undefined;
  const contiene = { contains: q, mode: "insensitive" as const };
  const where: Prisma.DocumentoWhereInput = {
    borrado: null,
    caso: casosVisibles(u),
    ...(cat ? { categoria: cat } : {}),
    ...(q ? { OR: [{ nombre: contiene }, { nota: contiene }, { caso: { cliente: contiene } }, { caso: { radicado: contiene } }] } : {}),
  };
  const [docs, casos] = await Promise.all([
    db.documento.findMany({ where, include: { caso: { select: { id: true, cliente: true, radicado: true } }, subidoPor: { select: { nombre: true } } }, orderBy: { subido: "desc" }, take: 200 }),
    opcionesCasos(u),
  ]);
  return (
    <section className="view">
      <div className="vhead"><div><p className="eyebrow">Archivo</p><h1>Documentos</h1></div></div>
      <form className="row">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por archivo, nota, cliente o radicado" aria-label="Buscar documentos" style={{ flex: "1 1 260px", width: "auto" }} />
        <select name="cat" defaultValue={cat ?? ""} aria-label="Filtrar por tipo de documento" style={{ width: "auto" }}>
          <option value="">Todos los tipos</option>
          {CATEGORIAS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button type="submit" className="ghost">Filtrar</button>
      </form>
      <div className="two">
        <div className="card">
          {docs.length ? <Archivos docs={docs} mostrarCaso puedeBorrar={puedeBorrar(u)} />
            : q || cat ? <Vacio titulo="Sin resultados" texto="Ningún documento coincide con la búsqueda." />
            : <Vacio titulo="Aún no hay documentos" texto="Elige un expediente a la derecha y sube los archivos." />}
        </div>
        <div className="card"><div className="card-h"><h2>Subir documentos</h2></div><div className="card-b"><Subidor casos={casos} /></div></div>
      </div>
    </section>
  );
}
