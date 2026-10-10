#!/bin/sh
# Copia de respaldo de la base de datos y los archivos. Programar cada noche con cron:
#   0 2 * * * cd /ruta/al/proyecto && ./scripts/respaldo.sh
# Luego sincroniza la carpeta respaldos/ con otro proveedor (por ejemplo con rclone).
set -eu
FECHA=$(date +%Y-%m-%d)
mkdir -p respaldos
docker compose exec -T db pg_dump -U expedientes -Fc expedientes > "respaldos/db-$FECHA.dump"
docker compose cp app:/datos/archivos "respaldos/archivos-$FECHA"
tar czf "respaldos/archivos-$FECHA.tgz" -C respaldos "archivos-$FECHA" && rm -rf "respaldos/archivos-$FECHA"
find respaldos -type f -mtime +30 -delete
echo "Respaldo $FECHA listo."
