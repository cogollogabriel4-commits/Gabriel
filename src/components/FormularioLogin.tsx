"use client";

import { useFormState } from "react-dom";
import { entrar } from "@/app/acciones";
import { BotonEnviar } from "./BotonEnviar";
import { Mensaje } from "./Mensaje";

export function FormularioLogin() {
  const [estado, accion] = useFormState(entrar, undefined);
  return (
    <form action={accion} className="stack">
      <label className="f" htmlFor="correo">Correo<input type="email" id="correo" name="correo" autoComplete="username" required /></label>
      <label className="f" htmlFor="clave">Contraseña<input type="password" id="clave" name="clave" autoComplete="current-password" required /></label>
      <BotonEnviar pendiente="Entrando…">Entrar</BotonEnviar>
      <Mensaje estado={estado} />
    </form>
  );
}
