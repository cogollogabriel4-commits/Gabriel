"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const T = require("../public/terminos.js");

test("festivos de Colombia 2026", () => {
  const h = T.holidays(2026);
  // Fechas del calendario oficial 2026.
  for (const [d, n] of [["2026-01-12", "Reyes Magos"], ["2026-03-23", "San José"], ["2026-04-02", "Jueves Santo"], ["2026-04-03", "Viernes Santo"],
    ["2026-05-18", "Ascensión del Señor"], ["2026-06-08", "Corpus Christi"], ["2026-06-15", "Sagrado Corazón"], ["2026-06-29", "San Pedro y San Pablo"],
    ["2026-08-17", "Asunción de la Virgen"], ["2026-10-12", "Día de la Raza"], ["2026-11-02", "Todos los Santos"], ["2026-11-16", "Independencia de Cartagena"]]) {
    assert.equal(h.get(d), n, d);
  }
  assert.equal(h.size, 18);
});

test("término en días hábiles salta fines de semana y festivos", () => {
  // Notificado el viernes 9 de octubre de 2026: el lunes 12 es festivo.
  const r = T.computeTerm("2026-10-09", 3, "habiles", false);
  assert.equal(T.iso(r.fin), "2026-10-15");
});

test("vacancia judicial cuando se pide calendario de la Rama", () => {
  const r = T.computeTerm("2026-12-18", 1, "habiles", true);
  assert.equal(T.iso(r.fin), "2027-01-12"); // 11 de enero de 2027 es festivo (Reyes)
});

test("plazo en meses que vence en día no hábil se corre", () => {
  const r = T.computeTerm("2026-01-31", 1, "meses", false);
  assert.equal(T.iso(r.fin), "2026-03-02"); // 28 feb 2026 es sábado
});
