import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const raiz = () => path.resolve(process.env.UPLOAD_DIR || "./almacen");

/** Guarda el archivo fuera de la carpeta pública y devuelve su ruta relativa y su huella SHA-256. */
export async function guardarArchivo(datos: Buffer, extension: string) {
  const ahora = new Date();
  const carpeta = path.join(String(ahora.getFullYear()), String(ahora.getMonth() + 1).padStart(2, "0"));
  const ruta = path.join(carpeta, `${randomUUID()}.${extension}`);
  await mkdir(path.join(raiz(), carpeta), { recursive: true });
  await writeFile(path.join(raiz(), ruta), datos, { mode: 0o600 });
  const sha256 = createHash("sha256").update(datos).digest("hex");
  return { ruta, sha256 };
}

export async function leerArchivo(ruta: string): Promise<Buffer> {
  const completa = path.resolve(raiz(), ruta);
  if (!completa.startsWith(raiz() + path.sep)) throw new Error("Ruta fuera del almacén");
  return readFile(completa);
}
