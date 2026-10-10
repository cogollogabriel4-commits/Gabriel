"use client";

import Link from "next/link";
import { useState } from "react";
import { esFechaValida, fmtCorta, fmtLarga, relativo } from "@/lib/fechas";
import { calcularTermino, TERMINOS_FRECUENTES, type Unidad } from "@/lib/terminos";

const UNIDADES: Record<Unidad, string> = { habiles: "días hábiles", calendario: "días calendario", meses: "meses" };

export function Calculadora({ hoy, puedeAgendar }: { hoy: string; puedeAgendar: boolean }) {
  const [inicio, setInicio] = useState(hoy);
  const [n, setN] = useState(10);
  const [unidad, setUnidad] = useState<Unidad>("habiles");
  const [judicial, setJudicial] = useState(true);
  const [preset, setPreset] = useState<string | null>(null);

  const valido = esFechaValida(inicio) && n > 0 && n <= 3650;
  const r = valido ? calcularTermino(inicio, n, unidad, judicial) : null;
  const nombrados = r ? r.descontados.filter(([, m]) => m !== "Sábado" && m !== "Domingo") : [];
  const finDeSemana = r ? r.descontados.length - nombrados.length : 0;
  const titulo = preset ? `Vence: ${preset.toLowerCase()}` : `Vence término de ${n} ${UNIDADES[unidad]}`;

  return (
    <div className="two">
      <div className="card card-b stack">
        <div className="fgrid">
          <label className="f" htmlFor="t-inicio">Fecha de notificación o ejecutoria
            <input type="date" id="t-inicio" value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </label>
          <label className="f" htmlFor="t-n">Duración
            <input type="number" id="t-n" min={1} max={3650} value={n} onChange={(e) => { setN(parseInt(e.target.value, 10) || 0); setPreset(null); }} />
          </label>
          <label className="f full" htmlFor="t-unidad">Unidad
            <select id="t-unidad" value={unidad} onChange={(e) => { setUnidad(e.target.value as Unidad); setPreset(null); }}>
              {Object.entries(UNIDADES).map(([v, t]) => <option key={v} value={v}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
          </label>
        </div>
        <label className="check" htmlFor="t-judicial">
          <input type="checkbox" id="t-judicial" checked={judicial} onChange={(e) => setJudicial(e.target.checked)} />
          <span>Calendario de la Rama Judicial<br /><span className="hint">También descuenta la vacancia judicial (20 de diciembre al 10 de enero) y lunes a miércoles de Semana Santa.</span></span>
        </label>
        <p className="notice">El término empieza a contar el día siguiente a la fecha indicada. Si un plazo en días calendario o meses termina en día no hábil, se corre al siguiente día hábil.</p>
        <div className="term-out" aria-live="polite">
          {!r ? <span className="small">Escribe una fecha y una duración válidas.</span> : (
            <>
              <span className="eyebrow">El término vence el</span>
              <span className="big">{fmtLarga(r.vence).replace(/^./, (c) => c.toUpperCase())}</span>
              <span className="small">{n} {UNIDADES[unidad]} desde el {fmtCorta(inicio)}. {relativo(r.vence).texto}.</span>
              {r.descontados.length > 0 && (
                <details className="skip">
                  <summary>{r.descontados.length} día(s) no hábiles descontados</summary>
                  <ul>
                    {finDeSemana > 0 && <li>{finDeSemana} sábados y domingos</li>}
                    {nombrados.map(([d, m]) => <li key={d}>{fmtCorta(d)}: {m}</li>)}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
        {r && puedeAgendar && (
          <div className="row">
            <Link className="btn primary" href={`/calendario/nuevo?tipo=VENCIMIENTO&fecha=${r.vence}&titulo=${encodeURIComponent(titulo)}`}>Agendar este vencimiento</Link>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-h"><h2>Términos frecuentes</h2></div>
        <div className="presets">
          {TERMINOS_FRECUENTES.map((t) => (
            <button type="button" key={t.nombre} onClick={() => { setN(t.dias); setUnidad("habiles"); setPreset(t.nombre); }}>
              <span>{t.nombre}<small>{t.norma}</small></span>
              <span className="d">{t.dias} días háb.</span>
            </button>
          ))}
        </div>
        <p className="notice" style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>Referencia rápida. Verifica siempre la norma vigente y el tipo de proceso.</p>
      </div>
    </div>
  );
}
