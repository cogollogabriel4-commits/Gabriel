"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { crearActuacion } from "@/app/acciones";
import { BotonEnviar } from "./BotonEnviar";
import { Mensaje } from "./Mensaje";

export function FormularioActuacion({ casoId, hoy }: { casoId: string; hoy: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, accion] = useFormState(async (p: Parameters<typeof crearActuacion>[0], f: FormData) => {
    const r = await crearActuacion(p, f);
    if (r?.ok && ref.current) (ref.current.elements.namedItem("texto") as HTMLTextAreaElement).value = "";
    return r;
  }, undefined);
  return (
    <form ref={ref} action={accion} className="card-b stack">
      <input type="hidden" name="casoId" value={casoId} />
      <label className="f" htmlFor="act-fecha">Fecha<input type="date" id="act-fecha" name="fecha" defaultValue={hoy} required /></label>
      <label className="f" htmlFor="act-texto">Actuación<textarea id="act-texto" name="texto" rows={4} placeholder="Ej.: Auto admite demanda y ordena notificar al demandado" required /></label>
      <BotonEnviar>Guardar actuación</BotonEnviar>
      <Mensaje estado={estado} />
    </form>
  );
}
