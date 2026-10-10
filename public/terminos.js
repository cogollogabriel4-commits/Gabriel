/* Festivos de Colombia (Ley 51 de 1983 y Semana Santa) y cálculo de términos.
   Se usa en el navegador (window.Terminos) y en las pruebas de Node (require). */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Terminos = factory();
})(this, function () {
  "use strict";
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const daysBetween = (a, b) => Math.round((b - a) / 86400000);

  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }
  function nextMonday(d) { return addDays(d, (8 - d.getDay()) % 7); }
  const holCache = {};
  function holidays(y) {
    if (holCache[y]) return holCache[y];
    const m = new Map(), put = (d, n) => m.set(iso(d), n), e = easter(y);
    put(new Date(y, 0, 1), "Año Nuevo");
    put(nextMonday(new Date(y, 0, 6)), "Reyes Magos");
    put(nextMonday(new Date(y, 2, 19)), "San José");
    put(addDays(e, -3), "Jueves Santo");
    put(addDays(e, -2), "Viernes Santo");
    put(new Date(y, 4, 1), "Día del Trabajo");
    put(addDays(e, 43), "Ascensión del Señor");
    put(addDays(e, 64), "Corpus Christi");
    put(addDays(e, 71), "Sagrado Corazón");
    put(nextMonday(new Date(y, 5, 29)), "San Pedro y San Pablo");
    put(new Date(y, 6, 20), "Día de la Independencia");
    put(new Date(y, 7, 7), "Batalla de Boyacá");
    put(nextMonday(new Date(y, 7, 15)), "Asunción de la Virgen");
    put(nextMonday(new Date(y, 9, 12)), "Día de la Raza");
    put(nextMonday(new Date(y, 10, 1)), "Todos los Santos");
    put(nextMonday(new Date(y, 10, 11)), "Independencia de Cartagena");
    put(new Date(y, 11, 8), "Inmaculada Concepción");
    put(new Date(y, 11, 25), "Navidad");
    holCache[y] = m;
    return m;
  }
  function nonWorking(d, judicial) {
    const dow = d.getDay();
    if (dow === 0) return "Domingo";
    if (dow === 6) return "Sábado";
    const h = holidays(d.getFullYear()).get(iso(d));
    if (h) return "Festivo: " + h;
    if (judicial) {
      const mo = d.getMonth(), da = d.getDate();
      if ((mo === 11 && da >= 20) || (mo === 0 && da <= 10)) return "Vacancia judicial";
      const diff = daysBetween(easter(d.getFullYear()), d);
      if (diff >= -6 && diff <= -4) return "Semana Santa (Rama Judicial)";
    }
    return null;
  }
  // The term starts counting the day after `startIso`. Calendar-day and month terms ending on a non-working day move to the next working day.
  function computeTerm(startIso, n, unit, judicial) {
    const start = parse(startIso), skipped = [];
    let d;
    if (unit === "habiles") {
      d = start; let count = 0;
      while (count < n) { d = addDays(d, 1); const r = nonWorking(d, judicial); if (r) skipped.push([iso(d), r]); else count++; }
    } else {
      d = unit === "meses" ? new Date(start.getFullYear(), start.getMonth() + n, start.getDate()) : addDays(start, n);
      if (unit === "meses" && d.getDate() !== start.getDate()) d = new Date(d.getFullYear(), d.getMonth(), 0);
      let r;
      while ((r = nonWorking(d, judicial))) { skipped.push([iso(d), r]); d = addDays(d, 1); }
    }
    return { fin: d, skipped };
  }
  return { pad, iso, parse, addDays, daysBetween, easter, holidays, nonWorking, computeTerm };
});
