import type { Estado } from "@/app/acciones";

export function Mensaje({ estado }: { estado: Estado }) {
  return (
    <p className={`msg ${estado?.error ? "err" : estado?.ok ? "ok" : ""}`} role="status">
      {estado?.error ?? estado?.ok ?? ""}
    </p>
  );
}
