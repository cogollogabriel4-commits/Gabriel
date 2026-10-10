"use strict";
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const bcrypt = require("bcryptjs");
const { createApp } = require("../src/app");

let server, base, dir, db;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "expedientes-test-"));
  const app = createApp({ dataDir: dir });
  db = app.locals.db;
  const add = db.prepare("INSERT INTO usuarios (email, nombre, rol, hash) VALUES (?, ?, ?, ?)");
  const h = bcrypt.hashSync("clave-segura-1", 4);
  add.run("admin@ofi.co", "Ana Admin", "admin", h);
  add.run("abo@ofi.co", "Beto Abogado", "abogado", h);
  add.run("otro@ofi.co", "Olga Otra", "abogado", h);
  add.run("asis@ofi.co", "Iris Asistente", "asistente", h);
  await new Promise((r) => { server = app.listen(0, r); });
  base = "http://127.0.0.1:" + server.address().port;
});
after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

async function login(email, password) {
  const r = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password: password || "clave-segura-1" }) });
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  return { status: r.status, cookie, body: await r.json() };
}
function client(cookie) {
  return async (method, url, body) => {
    const headers = { Cookie: cookie };
    let payload = body;
    if (body && !(body instanceof FormData)) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    const r = await fetch(base + url, { method, headers, body: payload });
    const type = r.headers.get("content-type") || "";
    return { status: r.status, headers: r.headers, body: type.includes("json") ? await r.json() : await r.text() };
  };
}

test("rechaza peticiones sin sesión", async () => {
  const r = await fetch(base + "/api/datos");
  assert.equal(r.status, 401);
});

test("bloquea la cuenta tras 5 intentos fallidos", async () => {
  db.prepare("INSERT INTO usuarios (email, nombre, rol, hash) VALUES (?, ?, ?, ?)").run("lock@ofi.co", "L", "abogado", bcrypt.hashSync("clave-segura-1", 4));
  for (let i = 0; i < 5; i++) assert.equal((await login("lock@ofi.co", "mala")).status, 401);
  assert.equal((await login("lock@ofi.co")).status, 429, "la contraseña correcta no entra mientras está bloqueada");
  const admin = client((await login("admin@ofi.co")).cookie);
  const u = (await admin("GET", "/api/usuarios")).body.find((x) => x.email === "lock@ofi.co");
  assert.equal(u.bloqueado, true);
  await admin("PUT", "/api/usuarios/" + u.id, { desbloquear: true });
  assert.equal((await login("lock@ofi.co")).status, 200);
});

test("los abogados solo ven sus expedientes asignados", async () => {
  const abo = client((await login("abo@ofi.co")).cookie);
  const otro = client((await login("otro@ofi.co")).cookie);
  const admin = client((await login("admin@ofi.co")).cookie);

  const c = await abo("POST", "/api/casos", { radicado: "11001-31-03-001-2026-00001-00", cliente: "Cliente A" });
  assert.equal(c.status, 201);
  assert.deepEqual(c.body.asignados.map((u) => u.nombre), ["Beto Abogado"], "quien crea queda asignado");

  assert.equal((await otro("GET", "/api/datos")).body.casos.length, 0);
  assert.equal((await otro("PUT", "/api/casos/" + c.body.id, { radicado: "x", cliente: "y" })).status, 404);
  assert.equal((await otro("POST", "/api/eventos", { titulo: "t", fecha: "2026-10-20", casoId: c.body.id })).status, 404);
  assert.equal((await admin("GET", "/api/datos")).body.casos.length >= 1, true);

  const otroId = (await admin("GET", "/api/usuarios")).body.find((u) => u.email === "otro@ofi.co").id;
  const aboId = (await admin("GET", "/api/usuarios")).body.find((u) => u.email === "abo@ofi.co").id;
  await admin("PUT", "/api/casos/" + c.body.id + "/asignados", { usuarios: [aboId, otroId] });
  assert.equal((await otro("GET", "/api/datos")).body.casos.length, 1);
});

test("el asistente sube y agenda pero no edita ni borra", async () => {
  const admin = client((await login("admin@ofi.co")).cookie);
  const asis = client((await login("asis@ofi.co")).cookie);
  const asisId = (await admin("GET", "/api/usuarios")).body.find((u) => u.email === "asis@ofi.co").id;
  const c = (await admin("POST", "/api/casos", { radicado: "R-2", cliente: "Cliente B", asignados: [asisId] })).body;

  assert.equal((await asis("POST", "/api/casos", { radicado: "R", cliente: "C" })).status, 403);
  assert.equal((await asis("PUT", "/api/casos/" + c.id, { radicado: "R", cliente: "C", estado: "terminado" })).status, 403);
  const ev = await asis("POST", "/api/eventos", { titulo: "Audiencia inicial", tipo: "audiencia", fecha: "2026-10-20", hora: "09:00", casoId: c.id });
  assert.equal(ev.status, 201);
  assert.equal((await asis("PUT", "/api/eventos/" + ev.body.id, { hecho: true })).body.hecho, true);
  assert.equal((await asis("DELETE", "/api/eventos/" + ev.body.id)).status, 403);

  const fd = new FormData();
  fd.append("categoria", "Poder");
  fd.append("archivos", new Blob(["%PDF-1.4 poder"], { type: "application/pdf" }), "poder.pdf");
  const up = await asis("POST", "/api/casos/" + c.id + "/documentos", fd);
  assert.equal(up.status, 201);
  assert.equal((await asis("DELETE", "/api/documentos/" + up.body[0].id)).status, 403);
});

test("documentos: versiones, huella, descarga protegida y papelera", async () => {
  const admin = client((await login("admin@ofi.co")).cookie);
  const abo = client((await login("abo@ofi.co")).cookie);
  const otro = client((await login("otro@ofi.co")).cookie);
  const c = (await abo("POST", "/api/casos", { radicado: "R-3", cliente: "Cliente C" })).body;

  const send = async (text, name) => {
    const fd = new FormData();
    fd.append("categoria", "Demanda");
    fd.append("archivos", new Blob([text], { type: "application/pdf" }), name);
    return abo("POST", "/api/casos/" + c.id + "/documentos", fd);
  };
  const v1 = (await send("%PDF-1.4 v1", "demanda.pdf")).body[0];
  const v2 = (await send("%PDF-1.4 v2", "demanda.pdf")).body[0];
  assert.equal(v2.version, 2);
  assert.equal(v2.grupo, v1.grupo);
  assert.match(v2.sha256, /^[0-9a-f]{64}$/);

  const datos = (await abo("GET", "/api/datos")).body;
  const live = datos.documentos.filter((d) => d.casoId === c.id);
  assert.equal(live.length, 1, "solo se lista la última versión");
  assert.equal((await abo("GET", "/api/documentos/" + v2.id + "/versiones")).body.length, 2);

  const file = await abo("GET", "/api/documentos/" + v1.id + "/archivo");
  assert.equal(file.status, 200);
  assert.equal(file.body, "%PDF-1.4 v1");
  assert.equal((await otro("GET", "/api/documentos/" + v1.id + "/archivo")).status, 404, "otro abogado no puede descargarlo");

  const bad = new FormData();
  bad.append("archivos", new Blob(["<script>"], { type: "text/html" }), "x.html");
  assert.equal((await abo("POST", "/api/casos/" + c.id + "/documentos", bad)).status, 400);

  assert.equal((await abo("DELETE", "/api/documentos/" + v2.id)).status, 200);
  assert.equal((await abo("GET", "/api/datos")).body.documentos.filter((d) => d.casoId === c.id).length, 0);
  assert.equal((await abo("GET", "/api/papelera")).status, 403);
  const trash = (await admin("GET", "/api/papelera")).body.filter((d) => d.casoId === c.id);
  assert.equal(trash.length, 2, "se van todas las versiones");
  await admin("POST", "/api/papelera/" + v2.id + "/restaurar");
  assert.equal((await abo("GET", "/api/datos")).body.documentos.filter((d) => d.casoId === c.id).length, 1);

  assert.equal((await admin("DELETE", "/api/casos/" + c.id)).status, 409, "no se borra un expediente con documentos");
});

test("la papelera se vacía sola a los 30 días", async () => {
  const abo = client((await login("abo@ofi.co")).cookie);
  const c = (await abo("POST", "/api/casos", { radicado: "R-4", cliente: "Cliente D" })).body;
  const fd = new FormData();
  fd.append("archivos", new Blob(["hola"], { type: "text/plain" }), "nota.txt");
  const d = (await abo("POST", "/api/casos/" + c.id + "/documentos", fd)).body[0];
  await abo("DELETE", "/api/documentos/" + d.id);
  const archivo = db.prepare("SELECT archivo FROM documentos WHERE id = ?").get(d.id).archivo;
  db.prepare("UPDATE documentos SET borrado = ? WHERE id = ?").run(new Date(Date.now() - 31 * 864e5).toISOString(), d.id);
  const appLocals = server.listeners("request")[0].locals;
  assert.equal(appLocals.purgarPapelera(), 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM documentos WHERE id = ?").get(d.id).n, 0);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(fs.existsSync(path.join(dir, "archivos", archivo)), false);
});

test("la auditoría registra y no se puede alterar", async () => {
  const admin = client((await login("admin@ofi.co")).cookie);
  const rows = (await admin("GET", "/api/auditoria")).body;
  for (const accion of ["login", "crear", "subir", "ver", "papelera", "restaurar", "bloqueo"]) {
    assert.ok(rows.some((r) => r.accion === accion), "falta " + accion);
  }
  assert.throws(() => db.prepare("DELETE FROM auditoria").run(), /solo inserción/);
  assert.throws(() => db.prepare("UPDATE auditoria SET detalle = 'x'").run(), /solo inserción/);
});

test("exporta la agenda en formato .ics", async () => {
  const abo = client((await login("abo@ofi.co")).cookie);
  await abo("POST", "/api/eventos", { titulo: "Reunión, con coma", fecha: "2026-11-03", hora: "14:30", tipo: "cita" });
  const r = await abo("GET", "/api/agenda.ics");
  assert.equal(r.status, 200);
  assert.match(r.body, /BEGIN:VCALENDAR/);
  assert.match(r.body, /DTSTART;TZID=America\/Bogota:20261103T143000/);
  assert.match(r.body, /SUMMARY:Reunión\\, con coma/);
});

test("rechaza escrituras desde otro origen", async () => {
  const { cookie } = await login("abo@ofi.co");
  const r = await fetch(base + "/api/casos", { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json", Origin: "https://malo.example" }, body: JSON.stringify({ radicado: "x", cliente: "y" }) });
  assert.equal(r.status, 403);
});

test("siempre queda un administrador activo", async () => {
  const admin = client((await login("admin@ofi.co")).cookie);
  const me = (await admin("GET", "/api/usuarios")).body.find((u) => u.email === "admin@ofi.co");
  const r = await admin("PUT", "/api/usuarios/" + me.id, { rol: "abogado" });
  assert.equal(r.status, 400);
});

test("rechaza archivos cuyo contenido no corresponde a la extensión", async () => {
  const abo = client((await login("abo@ofi.co")).cookie);
  const c = (await abo("POST", "/api/casos", { radicado: "R-5", cliente: "Cliente E" })).body;
  const fd = new FormData();
  fd.append("archivos", new Blob(["MZ\x90\x00 ejecutable"], { type: "application/pdf" }), "factura.pdf");
  const r = await abo("POST", "/api/casos/" + c.id + "/documentos", fd);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /no corresponde/);
  const html = new FormData();
  html.append("archivos", new Blob(["<html><script>alert(1)</script>"], { type: "text/plain" }), "nota.txt");
  assert.equal((await abo("POST", "/api/casos/" + c.id + "/documentos", html)).status, 400);
  assert.equal(fs.readdirSync(path.join(dir, "archivos")).length, db.prepare("SELECT COUNT(*) AS n FROM documentos").get().n, "no quedan archivos huérfanos");
});

test("la sesión se cierra tras 30 minutos sin actividad", async () => {
  const { cookie } = await login("abo@ofi.co");
  const abo = client(cookie);
  assert.equal((await abo("GET", "/api/datos")).status, 200);
  db.prepare("UPDATE sesiones SET ultimo_uso = ?").run(new Date(Date.now() - 31 * 60000).toISOString());
  assert.equal((await abo("GET", "/api/datos")).status, 401);
});
