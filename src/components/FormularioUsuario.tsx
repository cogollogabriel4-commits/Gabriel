"use client";

import { useRef } from "react";
import { useFormState } from "react-dom";
import { crearUsuario } from "@/app/acciones";
import { ROLES_USUARIO } from "@/lib/constantes";
import { BotonEnviar } from "./BotonEnviar";
import { Mensaje } from "./Mensaje";

export function FormularioUsuario() {
  const ref = useRef<HTMLFormElement>(null);
  const [estado, accion] = useFormState(async (p: Parameters<typeof crearUsuario>[0], f: FormData) => {
    const r = await crearUsuario(p, f);
    if (r?.ok) ref.current?.reset();
    return r;
  }, undefined);
  return (
    <form ref={ref} action={accion} className="card-b stack">
      <label className="f" htmlFor="u-nombre">Nombre<input type="text" id="u-nombre" name="nombre" required /></label>
      <label className="f" htmlFor="u-correo">Correo<input type="email" id="u-correo" name="correo" required /></label>
      <label className="f" htmlFor="u-rol">Rol
        <select id="u-rol" name="rol" defaultValue="ABOGADO">
          {Object.entries(ROLES_USUARIO).map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </label>
      <label className="f" htmlFor="u-clave">Contraseña inicial <span className="hint">(mínimo 10 caracteres)</span>
        <input type="password" id="u-clave" name="clave" autoComplete="new-password" minLength={10} required />
      </label>
      <BotonEnviar>Crear usuario</BotonEnviar>
      <Mensaje estado={estado} />
    </form>
  );
}
