"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONOS: Record<string, JSX.Element> = {
  panel: <><rect x="3" y="3" width="7" height="9" rx="1" /><rect x="14" y="3" width="7" height="5" rx="1" /><rect x="14" y="12" width="7" height="9" rx="1" /><rect x="3" y="16" width="7" height="5" rx="1" /></>,
  casos: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />,
  cal: <><rect x="3" y="5" width="18" height="16" rx="1.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  docs: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  term: <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6" /></>,
  log: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
};

const ENLACES = [
  { href: "/", icono: "panel", texto: "Panel" },
  { href: "/expedientes", icono: "casos", texto: "Expedientes" },
  { href: "/calendario", icono: "cal", texto: "Calendario" },
  { href: "/documentos", icono: "docs", texto: "Documentos" },
  { href: "/terminos", icono: "term", texto: "Términos" },
];

const ADMIN = [
  { href: "/admin/usuarios", icono: "users", texto: "Usuarios" },
  { href: "/admin/auditoria", icono: "log", texto: "Auditoría" },
];

export function Navegacion({ admin }: { admin: boolean }) {
  const ruta = usePathname();
  const activo = (href: string) => (href === "/" ? ruta === "/" : ruta.startsWith(href));
  const enlace = (e: (typeof ENLACES)[number]) => (
    <Link key={e.href} href={e.href} aria-current={activo(e.href) ? "page" : undefined}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{ICONOS[e.icono]}</svg>
      <span>{e.texto}</span>
    </Link>
  );
  return (
    <nav className="nav" aria-label="Secciones">
      {ENLACES.map(enlace)}
      {admin && <div className="nav-sep" />}
      {admin && ADMIN.map(enlace)}
    </nav>
  );
}
