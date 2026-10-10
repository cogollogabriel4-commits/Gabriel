import { redirect } from "next/navigation";
import { FormularioLogin } from "@/components/FormularioLogin";
import { usuarioActual } from "@/lib/sesion";

export default async function Login() {
  if (await usuarioActual()) redirect("/");
  return (
    <div className="login">
      <div className="card">
        <div>
          <p className="eyebrow">Gestión jurídica</p>
          <h1>Expedientes</h1>
        </div>
        <FormularioLogin />
        <p className="notice">Acceso solo para personal autorizado. Cada ingreso queda registrado.</p>
      </div>
    </div>
  );
}
