export const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Fecha local a "AAAA-MM-DD". */
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** "AAAA-MM-DD" a fecha local a medianoche. */
export function parse(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86400000);

export function hoy(): Date {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Las columnas @db.Date llegan como medianoche UTC. */
export const desdeDb = (d: Date) => d.toISOString().slice(0, 10);
export const haciaDb = (s: string) => new Date(s + "T00:00:00Z");

export function esFechaValida(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && iso(parse(s)) === s;
}

export const fmtLarga = (s: string) => {
  const d = parse(s);
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
};

export const fmtCorta = (s: string) => {
  const d = parse(s);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`;
};

export function relativo(s: string): { texto: string; nivel: "hot" | "soon" | "muted" } {
  const n = daysBetween(hoy(), parse(s));
  if (n === 0) return { texto: "Hoy", nivel: "hot" };
  if (n === 1) return { texto: "Mañana", nivel: "hot" };
  if (n < 0) return { texto: `Hace ${-n} d`, nivel: "muted" };
  return { texto: `En ${n} días`, nivel: n <= 3 ? "hot" : n <= 7 ? "soon" : "muted" };
}

export const fmtTamano = (b: number) =>
  b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;
