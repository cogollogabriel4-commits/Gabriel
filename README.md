# Expedientes

Aplicación web para que una oficina de abogados en Colombia lleve sus expedientes, documentos, actuaciones, audiencias y términos en un solo lugar, con usuarios, permisos y registro de auditoría.

Sigue el documento de diseño *Plan: sistema de gestión de expedientes* (fase 1) y conserva la interfaz del prototipo.

## Qué incluye

- **Expedientes**: Radicado, partes, despacho, área, clase de proceso, estado, responsable y notas; búsqueda y filtros.
- **Documentos**: Subida por arrastre (PDF, Word, Excel, imágenes, correos, texto; hasta 50 MB; se verifica que el contenido corresponda a la extensión), categoría, nota, **versiones** (un archivo con el mismo nombre en el mismo expediente queda como versión nueva) y **huella SHA-256** de cada archivo.
- **Actuaciones**: bitácora fechada con autor.
- **Agenda y calendario** con festivos de Colombia, marcar como cumplido y exportar a Google Calendar u Outlook (`.ics`).
- **Calculadora de términos** en días hábiles, calendario o meses, con vacancia judicial y Semana Santa opcionales.
- **Usuarios y roles**, **papelera** de 30 días y **auditoría** de solo inserción.

## Roles

| Rol | Ve | Puede |
|---|---|---|
| Administrador | Todos los expedientes, la papelera y la auditoría | Todo: crear usuarios, asignar expedientes, borrar expedientes, restaurar o borrar definitivamente documentos |
| Abogado | Solo sus expedientes asignados (y los que crea) | Crear y editar expedientes, subir documentos, enviarlos a la papelera, registrar actuaciones, agendar |
| Asistente | Solo sus expedientes asignados | Subir documentos, registrar actuaciones y agendar; no edita expedientes ni borra nada |

Los permisos se revisan en el servidor en cada petición. Los eventos sin expediente son visibles para toda la oficina.

## Seguridad

- Contraseñas con bcrypt; la cuenta se bloquea 15 minutos tras 5 intentos fallidos (un administrador puede desbloquearla).
- La sesión se cierra tras 30 minutos de inactividad (y siempre a los 7 días).
- Sesión en cookie `HttpOnly`, `SameSite=Strict` y, en producción, `Secure` con prefijo `__Host-`. Las escrituras desde otro origen se rechazan.
- Los archivos se guardan fuera de la carpeta pública con nombres aleatorios y solo se descargan por una ruta que comprueba el permiso sobre el expediente. Cada apertura o descarga queda en la auditoría.
- La tabla de auditoría tiene disparadores que impiden modificarla o borrarla.
- Cabeceras de seguridad (CSP, HSTS vía Caddy, `nosniff`) con Helmet.

**Nunca subas a este repositorio datos reales de clientes.** La carpeta `data/` y los respaldos están en `.gitignore`.

## Desarrollo local

Requiere Node.js 20 o superior.

```sh
npm install
npm run crear-admin -- tu@correo.co "Tu Nombre"   # pide la contraseña
npm run dev                                         # http://localhost:3000
npm test
```

Los datos quedan en `./data` (base SQLite `expedientes.db` y carpeta `archivos/`). Puedes cambiar la ruta con `DATA_DIR`.

## Instalación en un servidor (Docker)

En un VPS con Docker y un dominio que apunte a él:

```sh
git clone <este repositorio> expedientes && cd expedientes
cp .env.example .env   # y escribe tu dominio en DOMINIO
mkdir -p respaldos && sudo chown 1000:1000 respaldos
docker compose up -d --build
docker compose exec app npm run crear-admin -- tu@correo.co "Tu Nombre"
```

Caddy obtiene el certificado HTTPS automáticamente. La base de datos y los archivos viven en el volumen `datos`.

### Respaldo diario

```sh
crontab -e
# Cada noche a las 2:00
0 2 * * * cd /ruta/expedientes && docker compose exec -T app npm run respaldo
```

Cada respaldo es un `.tar.gz` en `./respaldos` con la base de datos y los archivos; se guardan 30 días (`RESPALDO_DIAS`). Copia esa carpeta a otro proveedor (por ejemplo con `rclone`) para tenerla fuera del servidor.

Para restaurar: detén la app, extrae el `.tar.gz` dentro del volumen `datos` (`expedientes.db` y `archivos/`) y vuelve a iniciarla.

## Variables de entorno

| Variable | Por defecto | Uso |
|---|---|---|
| `PORT` | `3000` | Puerto HTTP |
| `DATA_DIR` | `./data` | Base de datos y archivos |
| `NODE_ENV` | | `production` activa cookies `Secure` (requiere HTTPS) |
| `TRUST_PROXY` | | `1` detrás de Caddy u otro proxy, para registrar la IP real |

## Diferencias con el plan

- **SQLite en lugar de PostgreSQL** y **Express en lugar de Next.js**: para una oficina pequeña o mediana, un solo archivo de base de datos simplifica la instalación y el respaldo, y no requiere un servidor de base de datos aparte. El acceso a datos está concentrado en `src/app.js`, así que migrar a PostgreSQL más adelante es acotado.
- Quedan para la fase 2: segundo factor (TOTP), alertas por correo, almacenamiento S3, vista previa de Word/Excel en el navegador (hoy se descargan) y el plazo de retención configurable.

## Estructura

```
src/app.js        API, permisos, auditoría
src/db.js         esquema SQLite
src/server.js     arranque y vaciado automático de la papelera
public/           interfaz (HTML, CSS, JS sin compilación)
public/terminos.js  festivos de Colombia y cálculo de términos
scripts/          crear administrador, respaldo
test/             pruebas (node --test)
```
