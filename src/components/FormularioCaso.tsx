"use client";

import { useFormState } from "react-dom";
import { guardarCaso } from "@/app/acciones";
import { AREAS, ESTADOS, ROLES_CLIENTE } from "@/lib/constantes";
import { BotonEnviar } from "./BotonEnviar";
import { Mensaje } from "./Mensaje";

export interface CasoForm {
  id?: string; radicado?: string; cliente?: string; contraparte?: string; despacho?: string; area?: string;
  clase?: string; rolCliente?: string; estado?: string; inicio?: string; notas?: string;
}

export function FormularioCaso({ caso }: { caso: CasoForm }) {
  const [estado, accion] = useFormState(guardarCaso, undefined);
  return (
    <form action={accion} className="card card-b stack">
      {caso.id && <input type="hidden" name="id" value={caso.id} />}
      <div className="fgrid">
        <label className="f full" htmlFor="radicado">Radicado o número de proceso
          <input className="mono" type="text" id="radicado" name="radicado" defaultValue={caso.radicado} placeholder="11001-31-03-001-2024-00123-00" required />
          <span className="hint">23 dígitos en la Rama Judicial. Puedes usar un número interno si aún no hay radicado.</span>
        </label>
        <label className="f" htmlFor="cliente">Cliente<input type="text" id="cliente" name="cliente" defaultValue={caso.cliente} required /></label>
        <label className="f" htmlFor="contraparte">Contraparte<input type="text" id="contraparte" name="contraparte" defaultValue={caso.contraparte} /></label>
        <label className="f full" htmlFor="despacho">Despacho o autoridad<input type="text" id="despacho" name="despacho" defaultValue={caso.despacho} placeholder="Juzgado 1 Civil del Circuito de Bogotá" /></label>
        <label className="f" htmlFor="area">Área
          <select id="area" name="area" defaultValue={caso.area ?? "Civil"}>{AREAS.map((a) => <option key={a}>{a}</option>)}</select>
        </label>
        <label className="f" htmlFor="clase">Clase de proceso<input type="text" id="clase" name="clase" defaultValue={caso.clase} placeholder="Verbal, ejecutivo, tutela…" /></label>
        <label className="f" htmlFor="rolCliente">Representamos a
          <select id="rolCliente" name="rolCliente" defaultValue={caso.rolCliente ?? "demandante"}>
            {Object.entries(ROLES_CLIENTE).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="f" htmlFor="estado">Estado
          <select id="estado" name="estado" defaultValue={caso.estado ?? "ACTIVO"}>
            {Object.entries(ESTADOS).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="f" htmlFor="inicio">Fecha de inicio<input type="date" id="inicio" name="inicio" defaultValue={caso.inicio} /></label>
        <label className="f full" htmlFor="notas">Notas<textarea id="notas" name="notas" rows={4} defaultValue={caso.notas} placeholder="Pretensiones, cuantía, estrategia…" /></label>
      </div>
      <Mensaje estado={estado} />
      <div className="row"><BotonEnviar>Guardar expediente</BotonEnviar></div>
    </form>
  );
}
