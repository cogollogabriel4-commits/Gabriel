import Link from "next/link";
import type { Caso, Documento } from "@prisma/client";
import { borrarDocumento } from "@/app/acciones";
import { fmtCorta, fmtTamano, iso } from "@/lib/fechas";
import { Confirmar } from "./Confirmar";

type Doc = Documento & { caso?: Pick<Caso, "id" | "cliente" | "radicado">; subidoPor: { nombre: string } };

export function Archivos({ docs, mostrarCaso, puedeBorrar }: { docs: Doc[]; mostrarCaso?: boolean; puedeBorrar: boolean }) {
  return (
    <ul className="files">
      {docs.map((d) => (
        <li key={d.id} className="file">
          <span className="chip">{d.nombre.split(".").pop()}</span>
          <div className="fname">
            <a href={`/api/documentos/${d.id}`} target="_blank" rel="noopener">{d.nombre}</a>
            <span className="fsub">{d.categoria} · {fmtCorta(iso(d.subido))} · {fmtTamano(d.tamano)} · {d.subidoPor.nombre}</span>
            {mostrarCaso && d.caso && <Link className="small" href={`/expedientes/${d.caso.id}`}>{d.caso.cliente} · {d.caso.radicado}</Link>}
            {d.nota && <span className="fsub">{d.nota}</span>}
          </div>
          <div className="actions">
            <a className="btn ghost sm" href={`/api/documentos/${d.id}?descargar=1`}>Descargar</a>
            {puedeBorrar && <Confirmar accion={borrarDocumento} id={d.id} texto="Eliminar" />}
          </div>
        </li>
      ))}
    </ul>
  );
}
