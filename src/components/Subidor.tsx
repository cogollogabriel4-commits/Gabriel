"use client";

import { useRef, useState } from "react";
import { useFormState } from "react-dom";
import { subirDocumentos } from "@/app/acciones";
import { CATEGORIAS, MAX_ARCHIVO, TIPOS_ARCHIVO } from "@/lib/constantes";
import { fmtTamano } from "@/lib/fechas";
import { BotonEnviar } from "./BotonEnviar";
import { Mensaje } from "./Mensaje";

const ACEPTA = Object.keys(TIPOS_ARCHIVO).map((e) => "." + e).join(",");

export function Subidor({ casoId, casos }: { casoId?: string; casos?: { id: string; etiqueta: string }[] }) {
  const [estado, accion] = useFormState(async (prev: Parameters<typeof subirDocumentos>[0], f: FormData) => {
    const r = await subirDocumentos(prev, f);
    if (r?.ok) { formRef.current?.reset(); setElegidos([]); }
    return r;
  }, undefined);
  const [elegidos, setElegidos] = useState<File[]>([]);
  const [sobre, setSobre] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const tomar = (lista: FileList | null) => setElegidos(lista ? Array.from(lista) : []);
  const grandes = elegidos.filter((f) => f.size > MAX_ARCHIVO);

  return (
    <form ref={formRef} action={accion} className="stack">
      {casoId ? <input type="hidden" name="casoId" value={casoId} /> : (
        <label className="f" htmlFor="sub-caso">Expediente
          <select id="sub-caso" name="casoId" defaultValue="" required>
            <option value="">{casos?.length ? "Elige un expediente" : "Primero crea un expediente"}</option>
            {casos?.map((c) => <option key={c.id} value={c.id}>{c.etiqueta}</option>)}
          </select>
        </label>
      )}
      <label className="f" htmlFor="sub-cat">Tipo de documento
        <select id="sub-cat" name="categoria">{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</select>
      </label>
      <label className="f" htmlFor="sub-nota">Nota <span className="hint">(opcional)</span>
        <input type="text" id="sub-nota" name="nota" placeholder="Ej.: Radicado el 3 de octubre" />
      </label>
      <label
        className={`drop${sobre ? " over" : ""}`}
        htmlFor="sub-archivos"
        onDragOver={(e) => { e.preventDefault(); setSobre(true); }}
        onDragLeave={() => setSobre(false)}
        onDrop={(e) => {
          e.preventDefault(); setSobre(false);
          if (inputRef.current && e.dataTransfer.files.length) { inputRef.current.files = e.dataTransfer.files; tomar(e.dataTransfer.files); }
        }}
      >
        <input ref={inputRef} type="file" id="sub-archivos" name="archivos" multiple accept={ACEPTA} onChange={(e) => tomar(e.target.files)} />
        <strong>Arrastra archivos o haz clic</strong>
        <span className="hint">PDF, Word, Excel, imágenes, correos (.msg, .eml), TXT o CSV. Hasta 25 MB cada uno.</span>
      </label>
      {elegidos.length > 0 && (
        <ul className="picked">
          {elegidos.map((f) => <li key={f.name}><span>{f.name}</span><span className="mono muted">{fmtTamano(f.size)}</span></li>)}
        </ul>
      )}
      {grandes.length > 0 && <p className="msg err">Superan 25 MB: {grandes.map((f) => f.name).join(", ")}</p>}
      <BotonEnviar pendiente="Subiendo…">{elegidos.length > 1 ? `Subir ${elegidos.length} archivos` : "Subir"}</BotonEnviar>
      <Mensaje estado={estado} />
    </form>
  );
}
