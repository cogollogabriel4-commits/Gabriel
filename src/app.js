"use strict";
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const { open } = require("./db");

const SESSION_DAYS = 7;
const MAX_FILE = 50 * 1024 * 1024;
const INACTIVIDAD_MIN = 30;
const MAX_INTENTOS = 5;
const BLOQUEO_MIN = 15;
const PAPELERA_DIAS = 30;
const ROLES = ["admin", "abogado", "asistente"];
const AREAS = ["Civil", "Comercial", "Laboral", "Familia", "Penal", "Administrativo", "Constitucional", "Tributario", "Otro"];
const CATS = ["Demanda", "Contestación", "Poder", "Memorial", "Auto", "Sentencia", "Prueba", "Contrato", "Notificación", "Recurso", "Otro"];
const ESTADOS = ["activo", "suspendido", "terminado", "archivado"];
const ROL_PROCESAL = ["demandante", "demandado", "tercero", "asesoria"];
const TIPOS_EVENTO = ["audiencia", "vencimiento", "diligencia", "cita", "otro"];
const FILE_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif",
  txt: "text/plain", csv: "text/csv", md: "text/markdown",
  msg: "application/vnd.ms-outlook", eml: "message/rfc822"
};
// The file's first bytes must match its extension, so a renamed executable or HTML page is refused.
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], ZIP = [0x50, 0x4b, 0x03, 0x04];
const starts = (buf, sig, at) => sig.every((b, i) => buf[(at || 0) + i] === b);
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
const MAGIC = {
  pdf: (b) => starts(b, ascii("%PDF-")),
  doc: (b) => starts(b, OLE), xls: (b) => starts(b, OLE), msg: (b) => starts(b, OLE),
  docx: (b) => starts(b, ZIP), xlsx: (b) => starts(b, ZIP),
  png: (b) => starts(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: (b) => starts(b, [0xff, 0xd8, 0xff]), jpeg: (b) => starts(b, [0xff, 0xd8, 0xff]),
  gif: (b) => starts(b, ascii("GIF8")),
  webp: (b) => starts(b, ascii("RIFF")) && starts(b, ascii("WEBP"), 8)
};
// Text formats: no NUL bytes and no HTML/script markup at the start.
const looksText = (b) => !b.includes(0) && !/^\s*<(!doctype|html|script|svg)/i.test(b.toString("utf8"));
function contentMatches(file, ext) {
  const fd = fs.openSync(file, "r");
  const buf = Buffer.alloc(4096);
  const n = fs.readSync(fd, buf, 0, 4096, 0);
  fs.closeSync(fd);
  const head = buf.subarray(0, n);
  return MAGIC[ext] ? MAGIC[ext](head) : looksText(head);
}
// Types the browser may show inline; everything else downloads.
const INLINE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "image/gif", "text/plain"]);

const now = () => new Date().toISOString();
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const bad = (m) => new HttpError(400, m);
const notFound = (m) => new HttpError(404, m);
const forbidden = (m) => new HttpError(403, m || "Tu rol no permite esta acción.");

function str(v, max, field, required) {
  const s = v == null ? "" : String(v).trim();
  if (required && !s) throw bad("Falta el campo " + field + ".");
  if (s.length > max) throw bad("El campo " + field + " es demasiado largo.");
  return s;
}
function oneOf(v, list, field, dflt) {
  if (v == null || v === "") return dflt;
  if (!list.includes(v)) throw bad("Valor no válido para " + field + ".");
  return v;
}
function date(v, field, required) {
  const s = v == null ? "" : String(v);
  if (!s) { if (required) throw bad("Falta la fecha (" + field + ")."); return ""; }
  if (!ISO_DATE.test(s) || isNaN(Date.parse(s))) throw bad("Fecha no válida (" + field + ").");
  return s;
}

function createApp(opts) {
  opts = opts || {};
  const dataDir = opts.dataDir || path.join(__dirname, "..", "data");
  const filesDir = path.join(dataDir, "archivos");
  fs.mkdirSync(filesDir, { recursive: true });
  const db = opts.db || open(dataDir);
  const secureCookies = !!opts.secureCookies;
  const app = express();
  app.disable("x-powered-by");
  if (opts.trustProxy) app.set("trust proxy", opts.trustProxy);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "img-src": ["'self'", "data:"],
        "frame-src": ["'self'"],
        "frame-ancestors": ["'self'"],
        "form-action": ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  app.use(express.json({ limit: "200kb" }));

  /* ---------- Audit (insert-only, enforced by triggers) ---------- */
  const auditStmt = db.prepare("INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip) VALUES (?, ?, ?, ?, ?, ?)");
  const audit = (req, accion, entidad, id, detalle, userId) =>
    auditStmt.run(userId != null ? userId : req.user ? req.user.id : null, accion, entidad, id == null ? null : Number(id), detalle || "", req.ip || "");

  /* ---------- Sessions ---------- */
  function parseCookies(h) {
    const out = {};
    (h || "").split(";").forEach((p) => { const i = p.indexOf("="); if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); });
    return out;
  }
  const cookieName = secureCookies ? "__Host-sid" : "sid";
  function setSession(res, token, maxAgeSec) {
    res.setHeader("Set-Cookie", cookieName + "=" + token + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAgeSec + (secureCookies ? "; Secure" : ""));
  }
  // A session ends after 7 days, or after 30 minutes without activity.
  const findSession = db.prepare(`SELECT u.id, u.email, u.nombre, u.rol, s.ultimo_uso FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
    WHERE s.token_hash = ? AND s.expira > ? AND s.ultimo_uso > ? AND u.activo = 1`);
  const touchSession = db.prepare("UPDATE sesiones SET ultimo_uso = ? WHERE token_hash = ?");
  app.use((req, res, next) => {
    const tok = parseCookies(req.headers.cookie)[cookieName];
    req.user = null;
    if (tok) {
      const t = now(), h = sha(tok);
      const s = findSession.get(h, t, new Date(Date.now() - INACTIVIDAD_MIN * 60000).toISOString());
      if (s) {
        if (Date.parse(t) - Date.parse(s.ultimo_uso) > 60000) touchSession.run(t, h);
        delete s.ultimo_uso;
        req.user = s;
      }
    }
    req.token = tok;
    next();
  });

  // CSRF: cookies are SameSite=Strict, and mutating API calls must also come from our own origin.
  app.use("/api", (req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD") return next();
    const origin = req.headers.origin;
    if (origin) {
      let host;
      try { host = new URL(origin).host; } catch (e) { host = null; }
      if (host !== req.headers.host) return res.status(403).json({ error: "Origen no permitido." });
    }
    next();
  });

  const need = (...roles) => (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Inicia sesión para continuar." });
    if (roles.length && !roles.includes(req.user.rol)) return res.status(403).json({ error: "Tu rol no permite esta acción." });
    next();
  };
  const anyUser = need();
  const lawyer = need("admin", "abogado");
  const isAdmin = need("admin");

  /* ---------- Case visibility ---------- */
  // Admins see every case; everyone else only the cases they are assigned to. Always checked here, never in the browser.
  const assignedStmt = db.prepare("SELECT 1 FROM asignaciones WHERE caso_id = ? AND usuario_id = ?");
  const sees = (user, casoId) => user.rol === "admin" || !!assignedStmt.get(Number(casoId), user.id);
  const getCaso = (id) => db.prepare("SELECT * FROM casos WHERE id = ?").get(Number(id));
  function mustCaso(req, id) {
    const c = getCaso(id);
    if (!c || !sees(req.user, c.id)) throw notFound("Expediente no encontrado.");
    return c;
  }
  const visibleWhere = (user, col) => (user.rol === "admin" ? { sql: "1=1", args: [] } :
    { sql: col + " IN (SELECT caso_id FROM asignaciones WHERE usuario_id = ?)", args: [user.id] });
  const touch = (id) => { if (id) db.prepare("UPDATE casos SET actualizado = ? WHERE id = ?").run(now(), Number(id)); };

  /* ---------- Auth ---------- */
  const userByEmail = db.prepare("SELECT * FROM usuarios WHERE email = ?");
  const DUMMY_HASH = bcrypt.hashSync("x", 10);
  app.post("/api/login", (req, res) => {
    const email = str(req.body.email, 200, "correo").toLowerCase();
    const password = String(req.body.password || "");
    const u = userByEmail.get(email);
    if (u && u.bloqueado_hasta && u.bloqueado_hasta > now()) {
      return res.status(429).json({ error: "Cuenta bloqueada por intentos fallidos. Intenta de nuevo en " + BLOQUEO_MIN + " minutos o pide a un administrador que la desbloquee." });
    }
    const passOk = bcrypt.compareSync(password, u ? u.hash : DUMMY_HASH);
    if (!u || !passOk || !u.activo) {
      if (u) {
        const n = u.intentos_fallidos + 1;
        const lock = n >= MAX_INTENTOS ? new Date(Date.now() + BLOQUEO_MIN * 60000).toISOString() : "";
        db.prepare("UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?").run(lock ? 0 : n, lock, u.id);
        audit(req, lock ? "bloqueo" : "login_fallido", "usuario", u.id, "", u.id);
      }
      return res.status(401).json({ error: "Correo o contraseña incorrectos." });
    }
    db.prepare("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?").run(u.id);
    const token = crypto.randomBytes(32).toString("base64url");
    const exp = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
    db.prepare("DELETE FROM sesiones WHERE expira <= ?").run(now());
    db.prepare("INSERT INTO sesiones (token_hash, usuario_id, expira, ultimo_uso) VALUES (?, ?, ?, ?)").run(sha(token), u.id, exp, now());
    setSession(res, token, SESSION_DAYS * 86400);
    audit(req, "login", "usuario", u.id, "", u.id);
    res.json({ user: { id: u.id, email: u.email, nombre: u.nombre, rol: u.rol } });
  });
  app.post("/api/logout", (req, res) => {
    if (req.token) db.prepare("DELETE FROM sesiones WHERE token_hash = ?").run(sha(req.token));
    setSession(res, "", 0);
    res.json({ ok: true });
  });
  app.get("/api/me", (req, res) => res.json({ user: req.user }));
  app.put("/api/me/password", anyUser, (req, res) => {
    const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(req.user.id);
    if (!bcrypt.compareSync(String(req.body.actual || ""), u.hash)) throw bad("La contraseña actual no es correcta.");
    const nueva = String(req.body.nueva || "");
    if (nueva.length < 10) throw bad("La nueva contraseña debe tener al menos 10 caracteres.");
    db.prepare("UPDATE usuarios SET hash = ? WHERE id = ?").run(bcrypt.hashSync(nueva, 12), u.id);
    db.prepare("DELETE FROM sesiones WHERE usuario_id = ? AND token_hash != ?").run(u.id, sha(req.token));
    audit(req, "cambiar_clave", "usuario", u.id);
    res.json({ ok: true });
  });

  /* ---------- Data ---------- */
  const SEL_DOCS = `SELECT d.id, d.caso_id AS casoId, d.grupo, d.version, d.nombre, d.tipo, d.categoria, d.nota, d.content_type AS contentType,
    d.tamano, d.sha256, d.subido, u.nombre AS subidoPor, d.borrado FROM documentos d LEFT JOIN usuarios u ON u.id = d.subido_por`;
  const SEL_EVENTOS = "SELECT id, caso_id AS casoId, titulo, tipo, fecha, hora, lugar, nota, hecho, creado FROM eventos";
  const SEL_ACTS = `SELECT a.id, a.caso_id AS casoId, a.fecha, a.texto, a.creado, u.nombre AS creadoPor
    FROM actuaciones a LEFT JOIN usuarios u ON u.id = a.creado_por`;
  const fixEvent = (e) => (e ? Object.assign(e, { hecho: !!e.hecho }) : e);
  const asignadosDe = (casoId) => db.prepare(`SELECT u.id, u.nombre, u.rol FROM asignaciones a JOIN usuarios u ON u.id = a.usuario_id
    WHERE a.caso_id = ? ORDER BY u.nombre`).all(casoId);

  app.get("/api/datos", anyUser, (req, res) => {
    const vc = visibleWhere(req.user, "id"), vd = visibleWhere(req.user, "d.caso_id");
    const ve = visibleWhere(req.user, "caso_id"), va = visibleWhere(req.user, "a.caso_id");
    const casos = db.prepare("SELECT * FROM casos WHERE " + vc.sql).all(...vc.args);
    casos.forEach((c) => { c.asignados = asignadosDe(c.id); });
    res.json({
      casos,
      // Latest live version of each document; older versions are listed per document.
      documentos: db.prepare(SEL_DOCS + ` WHERE d.borrado = '' AND ${vd.sql}
        AND d.version = (SELECT MAX(x.version) FROM documentos x WHERE x.grupo = d.grupo AND x.borrado = '')`).all(...vd.args),
      // Events with no case are shared office-wide.
      eventos: db.prepare(SEL_EVENTOS + " WHERE caso_id IS NULL OR " + ve.sql).all(...ve.args).map(fixEvent),
      actuaciones: db.prepare(SEL_ACTS + " WHERE " + va.sql).all(...va.args),
      usuarios: db.prepare("SELECT id, nombre, rol FROM usuarios WHERE activo = 1 ORDER BY nombre").all()
    });
  });

  /* Cases */
  function casoFields(b) {
    return {
      radicado: str(b.radicado, 60, "radicado", true),
      cliente: str(b.cliente, 200, "cliente", true),
      contraparte: str(b.contraparte, 200, "contraparte"),
      despacho: str(b.despacho, 200, "despacho"),
      area: oneOf(b.area, AREAS, "área", "Civil"),
      clase: str(b.clase, 120, "clase"),
      rol: oneOf(b.rol, ROL_PROCESAL, "rol", "demandante"),
      estado: oneOf(b.estado, ESTADOS, "estado", "activo"),
      responsable: str(b.responsable, 200, "responsable"),
      inicio: date(b.inicio, "inicio"),
      notas: str(b.notas, 5000, "notas")
    };
  }
  const caseOut = (id) => { const c = getCaso(id); c.asignados = asignadosDe(c.id); return c; };
  function setAsignados(req, casoId, ids) {
    if (!Array.isArray(ids)) throw bad("La lista de asignados no es válida.");
    const valid = new Set(db.prepare("SELECT id FROM usuarios WHERE activo = 1").all().map((u) => u.id));
    const clean = [...new Set(ids.map(Number))].filter((id) => valid.has(id));
    db.transaction(() => {
      db.prepare("DELETE FROM asignaciones WHERE caso_id = ?").run(casoId);
      const ins = db.prepare("INSERT INTO asignaciones (caso_id, usuario_id) VALUES (?, ?)");
      clean.forEach((u) => ins.run(casoId, u));
    })();
    audit(req, "asignar", "caso", casoId, "usuarios=" + clean.join(","));
  }

  app.post("/api/casos", lawyer, (req, res) => {
    const f = casoFields(req.body), t = now();
    const r = db.prepare(`INSERT INTO casos (radicado, cliente, contraparte, despacho, area, clase, rol, estado, responsable, inicio, notas, creado, actualizado)
      VALUES (@radicado, @cliente, @contraparte, @despacho, @area, @clase, @rol, @estado, @responsable, @inicio, @notas, @t, @t)`).run(Object.assign({ t }, f));
    const id = Number(r.lastInsertRowid);
    audit(req, "crear", "caso", id, f.radicado);
    // The creator always keeps access; an admin can assign others at creation.
    const ids = req.user.rol === "admin" && Array.isArray(req.body.asignados) ? req.body.asignados : [];
    setAsignados(req, id, ids.concat(req.user.rol === "admin" ? [] : [req.user.id]));
    res.status(201).json(caseOut(id));
  });
  app.put("/api/casos/:id", lawyer, (req, res) => {
    const c = mustCaso(req, req.params.id);
    const f = casoFields(req.body);
    db.prepare(`UPDATE casos SET radicado=@radicado, cliente=@cliente, contraparte=@contraparte, despacho=@despacho, area=@area, clase=@clase,
      rol=@rol, estado=@estado, responsable=@responsable, inicio=@inicio, notas=@notas, actualizado=@t WHERE id=@id`)
      .run(Object.assign({ t: now(), id: c.id }, f));
    audit(req, "editar", "caso", c.id, f.radicado + (f.estado !== c.estado ? " estado " + c.estado + "→" + f.estado : ""));
    res.json(caseOut(c.id));
  });
  app.put("/api/casos/:id/asignados", isAdmin, (req, res) => {
    const c = mustCaso(req, req.params.id);
    setAsignados(req, c.id, req.body.usuarios);
    res.json(caseOut(c.id));
  });
  app.delete("/api/casos/:id", isAdmin, (req, res) => {
    const c = mustCaso(req, req.params.id);
    const n = db.prepare("SELECT COUNT(*) AS n FROM documentos WHERE caso_id = ?").get(c.id).n;
    if (n) throw new HttpError(409, "Este expediente tiene documentos (también cuentan los de la papelera). Márcalo como Archivado.");
    db.prepare("DELETE FROM casos WHERE id = ?").run(c.id);
    audit(req, "eliminar", "caso", c.id, c.radicado);
    res.json({ ok: true });
  });

  /* Events */
  const getEvento = (id) => fixEvent(db.prepare(SEL_EVENTOS + " WHERE id = ?").get(Number(id)));
  function mustEvento(req, id) {
    const e = getEvento(id);
    if (!e || (e.casoId != null && !sees(req.user, e.casoId))) throw notFound("Evento no encontrado.");
    return e;
  }
  function eventFields(req, v) {
    const casoId = v.casoId === "" || v.casoId == null ? null : Number(v.casoId);
    if (casoId != null) mustCaso(req, casoId);
    if (v.hora && !HORA.test(v.hora)) throw bad("Hora no válida.");
    return {
      caso_id: casoId,
      titulo: str(v.titulo, 300, "título", true),
      tipo: oneOf(v.tipo, TIPOS_EVENTO, "tipo", "otro"),
      fecha: date(v.fecha, "fecha", true),
      hora: v.hora || "",
      lugar: str(v.lugar, 300, "lugar"),
      nota: str(v.nota, 2000, "nota"),
      hecho: v.hecho ? 1 : 0
    };
  }
  app.post("/api/eventos", anyUser, (req, res) => {
    const f = eventFields(req, req.body);
    const r = db.prepare(`INSERT INTO eventos (caso_id, titulo, tipo, fecha, hora, lugar, nota, hecho, creado, creado_por)
      VALUES (@caso_id, @titulo, @tipo, @fecha, @hora, @lugar, @nota, @hecho, @creado, @por)`).run(Object.assign({ creado: now(), por: req.user.id }, f));
    touch(f.caso_id);
    audit(req, "crear", "evento", r.lastInsertRowid, f.titulo);
    res.status(201).json(getEvento(r.lastInsertRowid));
  });
  app.put("/api/eventos/:id", anyUser, (req, res) => {
    const prev = mustEvento(req, req.params.id);
    const f = eventFields(req, Object.assign({}, prev, req.body));
    db.prepare(`UPDATE eventos SET caso_id=@caso_id, titulo=@titulo, tipo=@tipo, fecha=@fecha, hora=@hora, lugar=@lugar, nota=@nota, hecho=@hecho WHERE id=@id`)
      .run(Object.assign({ id: prev.id }, f));
    touch(f.caso_id);
    audit(req, "editar", "evento", prev.id, f.titulo + (f.hecho !== (prev.hecho ? 1 : 0) ? (f.hecho ? " cumplido" : " reabierto") : ""));
    res.json(getEvento(prev.id));
  });
  app.delete("/api/eventos/:id", lawyer, (req, res) => {
    const prev = mustEvento(req, req.params.id);
    db.prepare("DELETE FROM eventos WHERE id = ?").run(prev.id);
    audit(req, "eliminar", "evento", prev.id, prev.titulo);
    res.json({ ok: true });
  });

  // Calendar feed for Google Calendar / Outlook (.ics download).
  const icsEsc = (s) => String(s || "").replace(/[\\;,]/g, (m) => "\\" + m).replace(/\r?\n/g, "\\n");
  app.get("/api/agenda.ics", anyUser, (req, res) => {
    const ve = visibleWhere(req.user, "e.caso_id");
    const rows = db.prepare(`SELECT e.*, c.radicado, c.cliente FROM eventos e LEFT JOIN casos c ON c.id = e.caso_id
      WHERE e.hecho = 0 AND (e.caso_id IS NULL OR ${ve.sql}) ORDER BY e.fecha`).all(...ve.args);
    const stamp = now().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Expedientes//ES", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Expedientes", "X-WR-TIMEZONE:America/Bogota"];
    rows.forEach((e) => {
      const d = e.fecha.replace(/-/g, "");
      lines.push("BEGIN:VEVENT", "UID:evento-" + e.id + "@expedientes", "DTSTAMP:" + stamp);
      if (e.hora) {
        const [h, m] = e.hora.split(":").map(Number);
        const end = new Date(Date.UTC(2000, 0, 1, h + 1, m));
        lines.push("DTSTART;TZID=America/Bogota:" + d + "T" + e.hora.replace(":", "") + "00",
          "DTEND;TZID=America/Bogota:" + d + "T" + String(Math.min(end.getUTCHours(), 23)).padStart(2, "0") + String(end.getUTCMinutes()).padStart(2, "0") + "00");
      } else {
        const nx = new Date(Date.UTC(+e.fecha.slice(0, 4), +e.fecha.slice(5, 7) - 1, +e.fecha.slice(8, 10) + 1)).toISOString().slice(0, 10).replace(/-/g, "");
        lines.push("DTSTART;VALUE=DATE:" + d, "DTEND;VALUE=DATE:" + nx);
      }
      lines.push("SUMMARY:" + icsEsc((e.tipo === "vencimiento" ? "Vence: " : "") + e.titulo + (e.cliente ? " · " + e.cliente : "")));
      const desc = [e.radicado ? "Radicado " + e.radicado : "", e.nota].filter(Boolean).join("\n");
      if (desc) lines.push("DESCRIPTION:" + icsEsc(desc));
      if (e.lugar) lines.push("LOCATION:" + icsEsc(e.lugar));
      lines.push("END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=agenda-expedientes.ics");
    res.send(lines.join("\r\n") + "\r\n");
  });

  /* Actuaciones */
  app.post("/api/casos/:id/actuaciones", anyUser, (req, res) => {
    const c = mustCaso(req, req.params.id);
    const fecha = date(req.body.fecha, "fecha", true), texto = str(req.body.texto, 5000, "actuación", true);
    const r = db.prepare("INSERT INTO actuaciones (caso_id, fecha, texto, creado, creado_por) VALUES (?, ?, ?, ?, ?)").run(c.id, fecha, texto, now(), req.user.id);
    touch(c.id);
    audit(req, "crear", "actuacion", r.lastInsertRowid, texto.slice(0, 80));
    res.status(201).json(db.prepare(SEL_ACTS + " WHERE a.id = ?").get(r.lastInsertRowid));
  });
  app.delete("/api/actuaciones/:id", lawyer, (req, res) => {
    const a = db.prepare("SELECT * FROM actuaciones WHERE id = ?").get(Number(req.params.id));
    if (!a || !sees(req.user, a.caso_id)) throw notFound("Actuación no encontrada.");
    db.prepare("DELETE FROM actuaciones WHERE id = ?").run(a.id);
    audit(req, "eliminar", "actuacion", a.id, a.texto.slice(0, 80));
    res.json({ ok: true });
  });

  /* Documents */
  const upload = multer({
    storage: multer.diskStorage({
      destination: filesDir,
      filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString("hex"))
    }),
    limits: { fileSize: MAX_FILE, files: 20 },
    fileFilter: (req, file, cb) => {
      const ext = path.extname(fixName(file.originalname)).slice(1).toLowerCase();
      if (!FILE_TYPES[ext]) return cb(bad("Formato no admitido: " + fixName(file.originalname)));
      cb(null, true);
    }
  });
  // Browsers send multipart filenames as UTF-8; busboy decodes them as latin1.
  function fixName(n) {
    const u = Buffer.from(n, "latin1").toString("utf8");
    return (u.includes("�") ? n : u).replace(/[\\/\x00-\x1f]/g, "_").slice(0, 200);
  }
  const getDoc = (id) => db.prepare("SELECT * FROM documentos WHERE id = ?").get(Number(id));
  function mustDoc(req, id, allowDeleted) {
    const d = getDoc(id);
    if (!d || !sees(req.user, d.caso_id) || (d.borrado && !allowDeleted)) throw notFound("Documento no encontrado.");
    return d;
  }

  app.post("/api/casos/:id/documentos", anyUser, (req, res, next) => {
    let caso;
    try { caso = mustCaso(req, req.params.id); } catch (e) { return next(e); }
    upload.array("archivos")(req, res, (err) => {
      const cleanup = () => (req.files || []).forEach((f) => fs.rmSync(f.path, { force: true }));
      if (err) {
        cleanup();
        if (err.code === "LIMIT_FILE_SIZE") return next(bad("Un archivo supera el límite de 50 MB."));
        return next(err.status ? err : bad("No se pudo recibir el archivo."));
      }
      try {
        if (!req.files || !req.files.length) throw bad("No llegó ningún archivo.");
        const categoria = oneOf(req.body.categoria, CATS, "tipo de documento", "Otro");
        const nota = str(req.body.nota, 500, "nota");
        const fake = req.files.filter((f) => !contentMatches(f.path, path.extname(fixName(f.originalname)).slice(1).toLowerCase()));
        if (fake.length) throw bad("El contenido no corresponde al tipo de archivo: " + fake.map((f) => fixName(f.originalname)).join(", ") + ".");
        const ins = db.prepare(`INSERT INTO documentos (caso_id, grupo, version, nombre, tipo, categoria, nota, content_type, tamano, sha256, archivo, subido, subido_por)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        // A file with the same name as a live document in this case becomes its next version.
        const prevStmt = db.prepare(`SELECT grupo, MAX(version) AS v FROM documentos WHERE caso_id = ? AND nombre = ? AND borrado = '' GROUP BY grupo`);
        const created = db.transaction(() => req.files.map((f) => {
          const nombre = fixName(f.originalname);
          const ext = path.extname(nombre).slice(1).toLowerCase();
          const hash = crypto.createHash("sha256").update(fs.readFileSync(f.path)).digest("hex");
          const prev = prevStmt.get(caso.id, nombre);
          const r = ins.run(caso.id, prev ? prev.grupo : null, prev ? prev.v + 1 : 1, nombre, ext, categoria, nota, FILE_TYPES[ext], f.size, hash, f.filename, now(), req.user.id);
          const id = Number(r.lastInsertRowid);
          if (!prev) db.prepare("UPDATE documentos SET grupo = ? WHERE id = ?").run(id, id);
          audit(req, "subir", "documento", id, nombre + (prev ? " v" + (prev.v + 1) : "") + " sha256=" + hash);
          return id;
        }))();
        touch(caso.id);
        res.status(201).json(created.map((id) => db.prepare(SEL_DOCS + " WHERE d.id = ?").get(id)));
      } catch (e) { cleanup(); next(e); }
    });
  });
  app.get("/api/documentos/:id/versiones", anyUser, (req, res) => {
    const d = mustDoc(req, req.params.id);
    res.json(db.prepare(SEL_DOCS + " WHERE d.grupo = ? AND d.borrado = '' ORDER BY d.version DESC").all(d.grupo));
  });
  app.get("/api/documentos/:id/archivo", anyUser, (req, res) => {
    const d = mustDoc(req, req.params.id, req.user.rol === "admin");
    const inline = INLINE.has(d.content_type) && req.query.descargar == null;
    res.setHeader("Content-Type", d.content_type + (d.content_type.startsWith("text/") ? "; charset=utf-8" : ""));
    res.setHeader("Content-Disposition", (inline ? "inline" : "attachment") + "; filename*=UTF-8''" + encodeURIComponent(d.nombre));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Security-Policy", "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    audit(req, inline ? "ver" : "descargar", "documento", d.id, d.nombre);
    res.sendFile(path.join(filesDir, d.archivo));
  });
  // Deleting moves the document (all its versions) to the trash; only an admin removes it for good.
  app.delete("/api/documentos/:id", lawyer, (req, res) => {
    const d = mustDoc(req, req.params.id);
    db.prepare("UPDATE documentos SET borrado = ?, borrado_por = ? WHERE grupo = ? AND borrado = ''").run(now(), req.user.id, d.grupo);
    touch(d.caso_id);
    audit(req, "papelera", "documento", d.id, d.nombre);
    res.json({ ok: true });
  });
  app.get("/api/papelera", isAdmin, (req, res) => {
    res.json(db.prepare(`SELECT d.id, d.caso_id AS casoId, d.nombre, d.version, d.tamano, d.borrado, u.nombre AS borradoPor, c.radicado, c.cliente
      FROM documentos d LEFT JOIN usuarios u ON u.id = d.borrado_por JOIN casos c ON c.id = d.caso_id
      WHERE d.borrado != '' ORDER BY d.borrado DESC`).all());
  });
  app.post("/api/papelera/:id/restaurar", isAdmin, (req, res) => {
    const d = mustDoc(req, req.params.id, true);
    if (!d.borrado) throw bad("El documento no está en la papelera.");
    db.prepare("UPDATE documentos SET borrado = '', borrado_por = NULL WHERE grupo = ? AND borrado = ?").run(d.grupo, d.borrado);
    audit(req, "restaurar", "documento", d.id, d.nombre);
    res.json({ ok: true });
  });
  function purge(d) {
    db.prepare("DELETE FROM documentos WHERE id = ?").run(d.id);
    fs.rm(path.join(filesDir, d.archivo), { force: true }, () => {});
  }
  app.delete("/api/papelera/:id", isAdmin, (req, res) => {
    const d = mustDoc(req, req.params.id, true);
    if (!d.borrado) throw bad("Primero envía el documento a la papelera.");
    purge(d);
    audit(req, "eliminar_definitivo", "documento", d.id, d.nombre + " sha256=" + d.sha256);
    res.json({ ok: true });
  });
  app.locals.purgarPapelera = function () {
    const limite = new Date(Date.now() - PAPELERA_DIAS * 864e5).toISOString();
    const viejos = db.prepare("SELECT * FROM documentos WHERE borrado != '' AND borrado < ?").all(limite);
    viejos.forEach((d) => {
      purge(d);
      auditStmt.run(null, "eliminar_definitivo", "documento", d.id, d.nombre + " (papelera vencida) sha256=" + d.sha256, "");
    });
    return viejos.length;
  };

  /* ---------- Users (admin) ---------- */
  const SEL_USERS = "SELECT id, email, nombre, rol, activo, bloqueado_hasta AS bloqueadoHasta, creado FROM usuarios";
  const userOut = (u) => Object.assign(u, { activo: !!u.activo, bloqueado: !!u.bloqueadoHasta && u.bloqueadoHasta > now() });
  const otherActiveAdmins = (exceptId) => db.prepare("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1 AND id != ?").get(exceptId).n;
  app.get("/api/usuarios", isAdmin, (req, res) => res.json(db.prepare(SEL_USERS + " ORDER BY nombre").all().map(userOut)));
  app.post("/api/usuarios", isAdmin, (req, res) => {
    const email = str(req.body.email, 200, "correo", true).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw bad("Correo no válido.");
    const nombre = str(req.body.nombre, 200, "nombre", true);
    const rol = oneOf(req.body.rol, ROLES, "rol", "abogado");
    const password = String(req.body.password || "");
    if (password.length < 10) throw bad("La contraseña debe tener al menos 10 caracteres.");
    if (userByEmail.get(email)) throw new HttpError(409, "Ya existe un usuario con ese correo.");
    const r = db.prepare("INSERT INTO usuarios (email, nombre, rol, hash) VALUES (?, ?, ?, ?)").run(email, nombre, rol, bcrypt.hashSync(password, 12));
    audit(req, "crear", "usuario", r.lastInsertRowid, email + " (" + rol + ")");
    res.status(201).json(userOut(db.prepare(SEL_USERS + " WHERE id = ?").get(r.lastInsertRowid)));
  });
  app.put("/api/usuarios/:id", isAdmin, (req, res) => {
    const u = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(Number(req.params.id));
    if (!u) throw notFound("Usuario no encontrado.");
    const rol = oneOf(req.body.rol, ROLES, "rol", u.rol);
    const activo = req.body.activo == null ? !!u.activo : !!req.body.activo;
    const nombre = req.body.nombre == null ? u.nombre : str(req.body.nombre, 200, "nombre", true);
    const password = req.body.password ? String(req.body.password) : "";
    if (password && password.length < 10) throw bad("La contraseña debe tener al menos 10 caracteres.");
    if (u.rol === "admin" && (rol !== "admin" || !activo) && !otherActiveAdmins(u.id)) throw bad("Debe quedar al menos un administrador activo.");
    db.prepare("UPDATE usuarios SET rol = ?, activo = ?, nombre = ? WHERE id = ?").run(rol, activo ? 1 : 0, nombre, u.id);
    if (password) db.prepare("UPDATE usuarios SET hash = ? WHERE id = ?").run(bcrypt.hashSync(password, 12), u.id);
    if (req.body.desbloquear) db.prepare("UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = '' WHERE id = ?").run(u.id);
    if (!activo || password || rol !== u.rol) db.prepare("DELETE FROM sesiones WHERE usuario_id = ?").run(u.id);
    const cambios = [];
    if (rol !== u.rol) cambios.push("rol " + u.rol + "→" + rol);
    if (activo !== !!u.activo) cambios.push(activo ? "activado" : "desactivado");
    if (nombre !== u.nombre) cambios.push("nombre");
    if (password) cambios.push("clave restablecida");
    if (req.body.desbloquear) cambios.push("desbloqueado");
    audit(req, "editar", "usuario", u.id, u.email + (cambios.length ? ": " + cambios.join(", ") : ""));
    res.json(userOut(db.prepare(SEL_USERS + " WHERE id = ?").get(u.id)));
  });
  app.get("/api/auditoria", isAdmin, (req, res) => {
    const limit = Math.min(Number(req.query.limite) || 300, 2000);
    res.json(db.prepare(`SELECT a.id, a.fecha, a.accion, a.entidad, a.entidad_id AS entidadId, a.detalle, a.ip, u.nombre AS usuario
      FROM auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id ORDER BY a.id DESC LIMIT ?`).all(limit));
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "Ruta no encontrada." }));

  /* ---------- Static front end ---------- */
  app.use(express.static(path.join(__dirname, "..", "public"), { index: "index.html" }));

  app.use((err, req, res, next) => {
    const status = err.status || (err.type === "entity.parse.failed" ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? "Error interno del servidor." : err.message });
  });

  app.locals.db = db;
  return app;
}

module.exports = { createApp };
