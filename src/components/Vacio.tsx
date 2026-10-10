export function Vacio({ titulo, texto }: { titulo: string; texto: string }) {
  return <div className="empty"><b>{titulo}</b><p>{texto}</p></div>;
}
