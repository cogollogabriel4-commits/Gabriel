import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { casosVisibles } from "@/lib/acceso";
import { leerArchivo } from "@/lib/almacen";
import { registrar } from "@/lib/auditoria";
import { usuarioActual } from "@/lib/sesion";

const EN_LINEA = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const u = await usuarioActual();
  if (!u) return new NextResponse("No autorizado", { status: 401 });
  const doc = await db.documento.findFirst({ where: { id: params.id, borrado: null, caso: casosVisibles(u) } });
  if (!doc) return new NextResponse("No encontrado", { status: 404 });
  const datos = await leerArchivo(doc.ruta);
  await registrar(u.id, "descargar", "documento", doc.id, doc.nombre);
  const forzar = req.nextUrl.searchParams.has("descargar") || !EN_LINEA.has(doc.contentType);
  const nombre = encodeURIComponent(doc.nombre);
  return new NextResponse(datos, {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Length": String(datos.length),
      "Content-Disposition": `${forzar ? "attachment" : "inline"}; filename*=UTF-8''${nombre}`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
