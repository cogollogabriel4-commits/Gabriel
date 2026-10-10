import { describe, expect, it } from "vitest";
import { calcularTermino, festivos, pascua } from "./terminos";
import { iso } from "./fechas";

describe("festivos de Colombia", () => {
  it("calcula la Pascua", () => {
    expect(iso(pascua(2026))).toBe("2026-04-05");
    expect(iso(pascua(2027))).toBe("2027-03-28");
  });

  it("coincide con el calendario oficial de 2026", () => {
    expect([...festivos(2026).keys()]).toEqual([
      "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
      "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
      "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    ]);
  });
});

describe("calcularTermino", () => {
  it("salta fines de semana y festivos", () => {
    // Viernes 9 de octubre de 2026; el lunes 12 es festivo.
    expect(calcularTermino("2026-10-09", 3, "habiles", false).vence).toBe("2026-10-15");
  });

  it("descuenta la vacancia judicial y el festivo de Reyes de 2027", () => {
    const r = calcularTermino("2026-12-15", 10, "habiles", true);
    expect(r.vence).toBe("2027-01-20");
  });

  it("corre al siguiente día hábil un plazo en meses que termina en fin de semana", () => {
    // 31 ene + 1 mes = 28 feb 2026 (sábado) -> lunes 2 de marzo.
    expect(calcularTermino("2026-01-31", 1, "meses", false).vence).toBe("2026-03-02");
  });

  it("cuenta días calendario", () => {
    expect(calcularTermino("2026-10-01", 5, "calendario", false).vence).toBe("2026-10-06");
  });
});
