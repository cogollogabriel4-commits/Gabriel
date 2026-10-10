export const AREAS = ["Civil", "Comercial", "Laboral", "Familia", "Penal", "Administrativo", "Constitucional", "Tributario", "Otro"];

export const CATEGORIAS = ["Demanda", "Contestación", "Poder", "Memorial", "Auto", "Sentencia", "Prueba", "Contrato", "Notificación", "Recurso", "Otro"];

export const ESTADOS = {
  ACTIVO: "Activo",
  SUSPENDIDO: "Suspendido",
  TERMINADO: "Terminado",
  ARCHIVADO: "Archivado",
} as const;

export const ROLES_CLIENTE: Record<string, string> = {
  demandante: "Demandante / accionante",
  demandado: "Demandado / accionado",
  tercero: "Tercero / interviniente",
  asesoria: "Asesoría (sin proceso)",
};

export const TIPOS_EVENTO = {
  AUDIENCIA: "Audiencia",
  VENCIMIENTO: "Vencimiento",
  DILIGENCIA: "Diligencia",
  CITA: "Cita",
  OTRO: "Otro",
} as const;

export const ROLES_USUARIO = {
  ADMIN: "Administrador",
  ABOGADO: "Abogado",
  ASISTENTE: "Asistente",
} as const;

/** Formatos aceptados al subir, por extensión. */
export const TIPOS_ARCHIVO: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  txt: "text/plain",
  csv: "text/csv",
  msg: "application/vnd.ms-outlook",
  eml: "message/rfc822",
};

export const MAX_ARCHIVO = 25 * 1024 * 1024;
