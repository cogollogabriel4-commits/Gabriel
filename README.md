# Expedientes

Sistema de gestión de expedientes jurídicos para una oficina de abogados en Colombia: expedientes, documentos, bitácora de actuaciones, agenda de audiencias y vencimientos, calculadora de términos en días hábiles, usuarios con roles y registro de auditoría.

El plan de diseño completo (alcance, roles, modelo de datos, seguridad y fases) está en el documento *Plan: sistema de gestión de expedientes* del proyecto.

## Qué incluye

| Sección | Qué hace |
| --- | --- |
| Panel | Expedientes activos, audiencias y vencimientos de los próximos 7 y 30 días, vencimientos pasados sin cumplir |
| Expedientes | Ficha con radicado, partes, despacho, área, estado y responsables; pestañas de documentos, agenda, actuaciones y equipo |
| Calendario | Vista mensual con festivos de Colombia |
| Documentos | Subida de PDF, Word, Excel, imágenes y correos (hasta 25 MB); huella SHA-256 de cada archivo |
| Términos | Cálculo en días hábiles, calendario o meses, con vacancia judicial y Semana Santa opcionales |
| Usuarios | Roles Administrador, Abogado y Asistente; bloqueo tras 5 intentos fallidos |
| Auditoría | Registro de ingresos, descargas, cambios y borrados |

**Permisos.** El administrador ve todos los expedientes. Abogados y asistentes solo ven los expedientes a los que están asignados (pestaña *Equipo*). Quien crea un expediente queda asignado. Solo el administrador elimina documentos, y el borrado es lógico: el archivo se conserva en el servidor.

## Instalación en un servidor (Docker)

Requisitos: un servidor Linux con Docker y un dominio que apunte a su IP.

```sh
git clone https://github.com/cogollogabriel4-commits/Gabriel.git expedientes
cd expedientes
cp .env.example .env
# Edita .env: DOMINIO, POSTGRES_PASSWORD, SESSION_SECRET (openssl rand -base64 48) y los datos del administrador
docker compose up -d --build
docker compose exec app node scripts/crear-admin.mjs
```

Caddy obtiene el certificado HTTPS automáticamente. Entra a `https://TU-DOMINIO` con el correo y la contraseña del administrador y crea los demás usuarios en *Usuarios*.

**Respaldos.** `scripts/respaldo.sh` guarda la base de datos y los archivos en `respaldos/` y borra copias de más de 30 días. Prográmalo cada noche con cron y sincroniza esa carpeta con otro proveedor.

## Desarrollo local

Requisitos: Node 20 o superior y PostgreSQL 16.

```sh
cp .env.example .env          # ajusta DATABASE_URL y SESSION_SECRET
npm install
npx prisma migrate deploy
npm run db:seed               # crea el administrador definido en .env
npm run dev                   # http://localhost:3000
```

Pruebas: `npm test` (cálculo de términos y festivos), `npm run lint`, `npm run typecheck`.

## Tecnología

Next.js 14 con TypeScript, PostgreSQL con Prisma, sesiones en cookie firmada, archivos en disco fuera de la carpeta pública y Caddy para HTTPS.

## Pendiente (fase 2)

Segundo factor de autenticación, almacenamiento S3, alertas por correo, exportar la agenda a Google Calendar u Outlook, vista previa de Word y papelera con restauración.
