"use client";

import { useFormStatus } from "react-dom";

export function BotonEnviar({ children, className = "primary", pendiente = "Guardando…" }: { children: React.ReactNode; className?: string; pendiente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendiente : children}
    </button>
  );
}
