"use strict";
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  nombre TEXT NOT NULL,
  rol TEXT NOT NULL CHECK (rol IN ('admin','abogado','asistente')),
  hash TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  intentos_fallidos INTEGER NOT NULL DEFAULT 0,
  bloqueado_hasta TEXT NOT NULL DEFAULT '',
  creado TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS sesiones (
  token_hash TEXT PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  expira TEXT NOT NULL,
  ultimo_uso TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS casos (
  id INTEGER PRIMARY KEY,
  radicado TEXT NOT NULL,
  cliente TEXT NOT NULL,
  contraparte TEXT NOT NULL DEFAULT '',
  despacho TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'Civil',
  clase TEXT NOT NULL DEFAULT '',
  rol TEXT NOT NULL DEFAULT 'demandante',
  estado TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','suspendido','terminado','archivado')),
  responsable TEXT NOT NULL DEFAULT '',
  inicio TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  creado TEXT NOT NULL,
  actualizado TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS asignaciones (
  caso_id INTEGER NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  PRIMARY KEY (caso_id, usuario_id)
);
CREATE TABLE IF NOT EXISTS documentos (
  id INTEGER PRIMARY KEY,
  caso_id INTEGER NOT NULL REFERENCES casos(id),
  grupo INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Otro',
  nota TEXT NOT NULL DEFAULT '',
  content_type TEXT NOT NULL,
  tamano INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  archivo TEXT NOT NULL UNIQUE,
  subido TEXT NOT NULL,
  subido_por INTEGER REFERENCES usuarios(id),
  borrado TEXT NOT NULL DEFAULT '',
  borrado_por INTEGER REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS eventos (
  id INTEGER PRIMARY KEY,
  caso_id INTEGER REFERENCES casos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'otro' CHECK (tipo IN ('audiencia','vencimiento','diligencia','cita','otro')),
  fecha TEXT NOT NULL,
  hora TEXT NOT NULL DEFAULT '',
  lugar TEXT NOT NULL DEFAULT '',
  nota TEXT NOT NULL DEFAULT '',
  hecho INTEGER NOT NULL DEFAULT 0,
  creado TEXT NOT NULL,
  creado_por INTEGER REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS actuaciones (
  id INTEGER PRIMARY KEY,
  caso_id INTEGER NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  fecha TEXT NOT NULL,
  texto TEXT NOT NULL,
  creado TEXT NOT NULL,
  creado_por INTEGER REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY,
  fecha TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  usuario_id INTEGER,
  accion TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id INTEGER,
  detalle TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_documentos_caso ON documentos(caso_id);
CREATE INDEX IF NOT EXISTS idx_asignaciones_usuario ON asignaciones(usuario_id);
-- La auditoría solo admite inserciones.
CREATE TRIGGER IF NOT EXISTS auditoria_sin_update BEFORE UPDATE ON auditoria BEGIN SELECT RAISE(ABORT, 'auditoria es de solo inserción'); END;
CREATE TRIGGER IF NOT EXISTS auditoria_sin_delete BEFORE DELETE ON auditoria BEGIN SELECT RAISE(ABORT, 'auditoria es de solo inserción'); END;
CREATE INDEX IF NOT EXISTS idx_eventos_fecha ON eventos(fecha);
CREATE INDEX IF NOT EXISTS idx_actuaciones_caso ON actuaciones(caso_id);
`;

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "expedientes.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

module.exports = { open };
