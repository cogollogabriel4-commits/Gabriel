"use client";

import { useState } from "react";

/** Botón de dos pasos para acciones destructivas. */
export function Confirmar({ accion, id, texto, confirmar = "Sí, eliminar" }: { accion: (f: FormData) => Promise<void>; id: string; texto: string; confirmar?: string }) {
  const [pidiendo, setPidiendo] = useState(false);
  if (!pidiendo) {
    return <button type="button" className="ghost sm danger" onClick={() => setPidiendo(true)}>{texto}</button>;
  }
  return (
    <form action={accion} className="row" style={{ gap: 4 }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="ghost sm danger">{confirmar}</button>
      <button type="button" className="ghost sm" onClick={() => setPidiendo(false)}>Cancelar</button>
    </form>
  );
}
