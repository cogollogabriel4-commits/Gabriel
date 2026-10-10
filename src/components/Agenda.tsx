import Link from "next/link";
import type { Caso, Evento } from "@prisma/client";
import { alternarEvento } from "@/app/acciones";
import { TIPOS_EVENTO } from "@/lib/constantes";
import { MESES, desdeDb, parse, relativo } from "@/lib/fechas";
import { Vacio } from "./Vacio";

type EventoConCaso = Evento & { caso: Pick<Caso, "id" | "cliente" | "radicado"> | null };

export function Agenda({ eventos, ocultarCaso, vacio }: { eventos: EventoConCaso[]; ocultarCaso?: boolean; vacio: [string, string] }) {
  if (!eventos.length) return <Vacio titulo={vacio[0]} texto={vacio[1]} />;
  return (
    <ul className="agenda">
      {eventos.map((e) => {
        const f = desdeDb(e.fecha), d = parse(f), rel = relativo(f);
        return (
          <li key={e.id} className={e.hecho ? "done" : ""}>
            <div className="date"><b>{d.getDate()}</b><span>{MESES[d.getMonth()].slice(0, 3)}</span></div>
            <div className="t">
              <div className="row" style={{ gap: 6 }}>
                <span className={`pill ${e.tipo}`}>{TIPOS_EVENTO[e.tipo]}</span>
                {e.hora && <span className="small muted num">{e.hora}</span>}
              </div>
              <b>{e.titulo}</b>
              {e.caso && !ocultarCaso && <Link className="small" href={`/expedientes/${e.caso.id}`}>{e.caso.cliente} · {e.caso.radicado}</Link>}
              {e.lugar && <span className="small muted">{e.lugar}</span>}
              {e.nota && <span className="small">{e.nota}</span>}
            </div>
            <div className="right">
              <span className={`when ${e.hecho ? "muted" : rel.nivel}`}>{e.hecho ? "Cumplido" : rel.texto}</span>
              <div className="row" style={{ gap: 4 }}>
                <form action={alternarEvento}>
                  <input type="hidden" name="id" value={e.id} />
                  <button type="submit" className="ghost sm">{e.hecho ? "Reabrir" : "Cumplido"}</button>
                </form>
                <Link className="btn ghost sm" href={`/calendario/${e.id}`}>Editar</Link>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
