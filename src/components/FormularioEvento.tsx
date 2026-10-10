"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { guardarEvento } from "@/app/acciones";
import { TIPOS_EVENTO } from "@/lib/constantes";
import { esFechaValida, parse } from "@/lib/fechas";
import { diaNoHabil } from "@/lib/terminos";
import { BotonEnviar } from "./BotonEnviar";
import { Mensaje } from "./Mensaje";

export interface EventoForm {
  id?: string; titulo?: string; tipo?: string; casoId?: string; fecha?: string; hora?: string; lugar?: string; nota?: string;
}

export function FormularioEvento({ evento, casos, volver }: { evento: EventoForm; casos: { id: string; etiqueta: string }[]; volver?: string }) {
  const [estado, accion] = useFormState(guardarEvento, undefined);
  const [fecha, setFecha] = useState(evento.fecha ?? "");
  const aviso = esFechaValida(fecha) ? diaNoHabil(parse(fecha), false) : null;
  return (
    <form action={accion} className="card card-b stack">
      {evento.id && <input type="hidden" name="id" value={evento.id} />}
      {volver && <input type="hidden" name="volver" value={volver} />}
      <div className="fgrid">
        <label className="f full" htmlFor="ev-titulo">Título<input type="text" id="ev-titulo" name="titulo" defaultValue={evento.titulo} placeholder="Audiencia inicial (art. 372 CGP)" required /></label>
        <label className="f" htmlFor="ev-tipo">Tipo
          <select id="ev-tipo" name="tipo" defaultValue={evento.tipo ?? "AUDIENCIA"}>
            {Object.entries(TIPOS_EVENTO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="f" htmlFor="ev-caso">Expediente
          <select id="ev-caso" name="casoId" defaultValue={evento.casoId ?? ""}>
            <option value="">Sin expediente</option>
            {casos.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
          </select>
        </label>
        <label className="f" htmlFor="ev-fecha">Fecha<input type="date" id="ev-fecha" name="fecha" value={fecha} onChange={(e) => setFecha(e.target.value)} required /></label>
        <label className="f" htmlFor="ev-hora">Hora <span className="hint">(opcional)</span><input type="time" id="ev-hora" name="hora" defaultValue={evento.hora} /></label>
        <label className="f full" htmlFor="ev-lugar">Lugar o enlace<input type="text" id="ev-lugar" name="lugar" defaultValue={evento.lugar} placeholder="Sala virtual, sede judicial…" /></label>
        <label className="f full" htmlFor="ev-nota">Nota<textarea id="ev-nota" name="nota" rows={2} defaultValue={evento.nota} /></label>
      </div>
      {aviso && <p className="msg err">Atención: esa fecha no es hábil ({aviso.toLowerCase()}).</p>}
      <Mensaje estado={estado} />
      <div className="row"><BotonEnviar>Guardar</BotonEnviar></div>
    </form>
  );
}
