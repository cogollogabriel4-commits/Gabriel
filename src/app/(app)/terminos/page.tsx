import { hoy, iso } from "@/lib/fechas";
import { requerirUsuario } from "@/lib/sesion";
import { Calculadora } from "@/components/Calculadora";

export default async function Terminos() {
  await requerirUsuario();
  return (
    <section className="view">
      <div className="vhead">
        <div>
          <p className="eyebrow">Herramientas</p>
          <h1>Calculadora de términos</h1>
          <p className="sub">Cuenta días hábiles descontando fines de semana y festivos de Colombia.</p>
        </div>
      </div>
      <Calculadora hoy={iso(hoy())} puedeAgendar />
    </section>
  );
}
