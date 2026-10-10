import Link from "next/link";
import { db } from "@/lib/db";
import { eventosVisibles } from "@/lib/acceso";
import { MESES, addDays, desdeDb, esFechaValida, fmtLarga, haciaDb, hoy, iso, parse } from "@/lib/fechas";
import { festivos } from "@/lib/terminos";
import { conCaso } from "@/lib/consultas";
import { requerirUsuario } from "@/lib/sesion";
import { Agenda } from "@/components/Agenda";

export default async function Calendario({ searchParams }: { searchParams: { mes?: string; dia?: string } }) {
  const u = await requerirUsuario();
  const tIso = iso(hoy());
  const dia = searchParams.dia && esFechaValida(searchParams.dia) ? searchParams.dia : tIso;
  const mesParam = searchParams.mes && /^\d{4}-\d{2}$/.test(searchParams.mes) ? searchParams.mes : dia.slice(0, 7);
  const mes = parse(mesParam + "-01");
  const inicio = addDays(mes, -((mes.getDay() + 6) % 7));
  const fin = addDays(inicio, 41);
  const eventos = await db.evento.findMany({
    where: { ...eventosVisibles(u), fecha: { gte: haciaDb(iso(inicio)), lte: haciaDb(iso(fin)) } },
    include: conCaso,
    orderBy: [{ fecha: "asc" }, { hora: "asc" }],
  });
  const porDia = new Map<string, typeof eventos>();
  for (const e of eventos) {
    const k = desdeDb(e.fecha);
    porDia.set(k, [...(porDia.get(k) ?? []), e]);
  }
  const mesStr = (d: Date) => iso(d).slice(0, 7);
  const anterior = mesStr(new Date(mes.getFullYear(), mes.getMonth() - 1, 1));
  const siguiente = mesStr(new Date(mes.getFullYear(), mes.getMonth() + 1, 1));
  const diasSel = dia.slice(0, 7) === mesParam ? porDia.get(dia) ?? [] : await db.evento.findMany({ where: { ...eventosVisibles(u), fecha: haciaDb(dia) }, include: conCaso, orderBy: { hora: "asc" } });
  const festivoSel = festivos(parse(dia).getFullYear()).get(dia);

  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(inicio, i), k = iso(d);
    if (i >= 35 && d.getMonth() !== mes.getMonth()) break;
    const fest = festivos(d.getFullYear()).get(k);
    const evs = porDia.get(k) ?? [];
    const cls = ["day", d.getMonth() !== mes.getMonth() && "out", (fest || d.getDay() === 0) && "nw", k === tIso && "today", k === dia && "sel"].filter(Boolean).join(" ");
    celdas.push(
      <Link key={k} className={cls} href={`/calendario?mes=${mesParam}&dia=${k}`} aria-label={`${fmtLarga(k)}${fest ? `, festivo ${fest}` : ""}${evs.length ? `, ${evs.length} evento(s)` : ""}`}>
        <span className="n">{d.getDate()}</span>
        {fest && <span className="hol">{fest}</span>}
        {evs.slice(0, 3).map((e) => <span key={e.id} className={`ev ${e.tipo}${e.hecho ? " done" : ""}`}>{e.hora ? `${e.hora} ` : ""}{e.titulo}</span>)}
        {evs.length > 3 && <span className="more">+{evs.length - 3} más</span>}
      </Link>
    );
  }

  return (
    <section className="view">
      <div className="vhead">
        <div><p className="eyebrow">Agenda</p><h1>{MESES[mes.getMonth()].replace(/^./, (c) => c.toUpperCase())} {mes.getFullYear()}</h1></div>
        <div className="row">
          <Link className="btn ghost" href={`/calendario?mes=${anterior}`} aria-label="Mes anterior">←</Link>
          <Link className="btn ghost" href="/calendario">Hoy</Link>
          <Link className="btn ghost" href={`/calendario?mes=${siguiente}`} aria-label="Mes siguiente">→</Link>
          <Link className="btn primary" href={`/calendario/nuevo?fecha=${dia}`}>Agendar</Link>
        </div>
      </div>
      <div className="legend">
        <span><i className="dot AUDIENCIA" />Audiencia</span>
        <span><i className="dot VENCIMIENTO" />Vencimiento de término</span>
        <span><i className="dot" />Cita, diligencia u otro</span>
        <span style={{ color: "var(--danger)" }}>Número en rojo: domingo o festivo en Colombia</span>
      </div>
      <div className="cal-wrap">
        <div className="card">
          <div className="cal">
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d} className="dow">{d}</div>)}
            {celdas}
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h2>{fmtLarga(dia).replace(/^./, (c) => c.toUpperCase())}</h2><Link className="btn ghost sm" href={`/calendario/nuevo?fecha=${dia}`}>Agendar este día</Link></div>
          {festivoSel && <p className="small" style={{ margin: 0, padding: "10px 18px", color: "var(--danger)", borderBottom: "1px solid var(--line)" }}>Festivo: {festivoSel}</p>}
          <Agenda eventos={diasSel} vacio={["Día libre", "No hay nada agendado para este día."]} />
        </div>
      </div>
    </section>
  );
}
