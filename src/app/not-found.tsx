import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main style={{ padding: 32 }}>
      <div className="card empty" style={{ maxWidth: 520 }}>
        <b>No encontrado</b>
        <p>La página no existe o no tienes acceso a ese expediente.</p>
        <Link href="/">Volver al panel</Link>
      </div>
    </main>
  );
}
