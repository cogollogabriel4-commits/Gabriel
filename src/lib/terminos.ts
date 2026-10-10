import { addDays, daysBetween, iso, parse } from "./fechas";

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher). */
export function pascua(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mes - 1, dia);
}

const lunesSiguiente = (d: Date) => addDays(d, (8 - d.getDay()) % 7);

const cache = new Map<number, Map<string, string>>();

/** Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani"). */
export function festivos(y: number): Map<string, string> {
  const hit = cache.get(y);
  if (hit) return hit;
  const m = new Map<string, string>();
  const put = (d: Date, n: string) => m.set(iso(d), n);
  const p = pascua(y);
  put(new Date(y, 0, 1), "Año Nuevo");
  put(lunesSiguiente(new Date(y, 0, 6)), "Reyes Magos");
  put(lunesSiguiente(new Date(y, 2, 19)), "San José");
  put(addDays(p, -3), "Jueves Santo");
  put(addDays(p, -2), "Viernes Santo");
  put(new Date(y, 4, 1), "Día del Trabajo");
  put(addDays(p, 43), "Ascensión del Señor");
  put(addDays(p, 64), "Corpus Christi");
  put(addDays(p, 71), "Sagrado Corazón");
  put(lunesSiguiente(new Date(y, 5, 29)), "San Pedro y San Pablo");
  put(new Date(y, 6, 20), "Día de la Independencia");
  put(new Date(y, 7, 7), "Batalla de Boyacá");
  put(lunesSiguiente(new Date(y, 7, 15)), "Asunción de la Virgen");
  put(lunesSiguiente(new Date(y, 9, 12)), "Día de la Raza");
  put(lunesSiguiente(new Date(y, 10, 1)), "Todos los Santos");
  put(lunesSiguiente(new Date(y, 10, 11)), "Independencia de Cartagena");
  put(new Date(y, 11, 8), "Inmaculada Concepción");
  put(new Date(y, 11, 25), "Navidad");
  cache.set(y, m);
  return m;
}

/** Motivo por el que un día no es hábil, o null si lo es. */
export function diaNoHabil(d: Date, judicial: boolean): string | null {
  const dow = d.getDay();
  if (dow === 0) return "Domingo";
  if (dow === 6) return "Sábado";
  const f = festivos(d.getFullYear()).get(iso(d));
  if (f) return "Festivo: " + f;
  if (judicial) {
    const mes = d.getMonth(), dia = d.getDate();
    if ((mes === 11 && dia >= 20) || (mes === 0 && dia <= 10)) return "Vacancia judicial";
    const diff = daysBetween(pascua(d.getFullYear()), d);
    if (diff >= -6 && diff <= -4) return "Semana Santa (Rama Judicial)";
  }
  return null;
}

export type Unidad = "habiles" | "calendario" | "meses";

export interface ResultadoTermino {
  vence: string;
  descontados: [string, string][];
}

/**
 * Calcula el vencimiento de un término que empieza a correr el día siguiente a `inicio`.
 * En días calendario y meses, si el último día no es hábil se corre al siguiente hábil (CGP art. 118).
 */
export function calcularTermino(inicio: string, n: number, unidad: Unidad, judicial: boolean): ResultadoTermino {
  const start = parse(inicio);
  const descontados: [string, string][] = [];
  let d: Date;
  if (unidad === "habiles") {
    d = start;
    let cuenta = 0;
    while (cuenta < n) {
      d = addDays(d, 1);
      const r = diaNoHabil(d, judicial);
      if (r) descontados.push([iso(d), r]);
      else cuenta++;
    }
  } else {
    if (unidad === "meses") {
      d = new Date(start.getFullYear(), start.getMonth() + n, start.getDate());
      if (d.getDate() !== start.getDate()) d = new Date(d.getFullYear(), d.getMonth(), 0);
    } else {
      d = addDays(start, n);
    }
    let r: string | null;
    while ((r = diaNoHabil(d, judicial))) {
      descontados.push([iso(d), r]);
      d = addDays(d, 1);
    }
  }
  return { vence: iso(d), descontados };
}

export const TERMINOS_FRECUENTES: { nombre: string; norma: string; dias: number }[] = [
  { nombre: "Recurso de reposición", norma: "CGP art. 318", dias: 3 },
  { nombre: "Apelación de autos", norma: "CGP art. 322", dias: 3 },
  { nombre: "Impugnación de fallo de tutela", norma: "Decreto 2591 de 1991, art. 31", dias: 3 },
  { nombre: "Contestar demanda, proceso verbal sumario", norma: "CGP art. 391", dias: 10 },
  { nombre: "Excepciones en proceso ejecutivo", norma: "CGP art. 442", dias: 10 },
  { nombre: "Responder derecho de petición", norma: "Ley 1755 de 2015, art. 14", dias: 15 },
  { nombre: "Contestar demanda, proceso verbal", norma: "CGP art. 369", dias: 20 },
];
