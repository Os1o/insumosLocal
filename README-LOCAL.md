# Sistema de Insumos - Versión Servidor Local

Sistema de gestión de solicitudes de insumos migrado de Supabase a PostgreSQL + PHP local.

## Requisitos del Servidor

- Windows 10/11
- XAMPP (Apache + PHP 8.0+)
- PostgreSQL 15+
- Extensiones PHP: `pdo_pgsql`, `pgsql`

## Instalación

### 1. Verificar extensiones PHP

Abrir `C:\xampp\php\php.ini` y descomentar:

```ini
extension=pdo_pgsql
extension=pgsql
```

Reiniciar Apache desde XAMPP Control Panel.

### 2. Configurar base de datos

```bash
# Conectar a PostgreSQL
psql -U postgres

# Crear base de datos y usuario (si no existen)
CREATE DATABASE sistema_insumos;
CREATE USER insumos_user WITH PASSWORD 'InsumosSistema2025!';
GRANT ALL PRIVILEGES ON DATABASE sistema_insumos TO insumos_user;
```

### 3. Configurar credenciales

Copiar archivo de ejemplo:

```bash
cd C:\xampp\htdocs\insumos\api\config
copy database.example.php database.php
```

Editar `database.php` con tus credenciales reales.

### 4. Probar conexión

Abrir en navegador:
```
http://localhost:8080/insumos/api/test-connection.php
```

Deberías ver:
```json
{
  "success": true,
  "data": {
    "message": "Conexión exitosa a PostgreSQL",
    "usuarios_count": 3,
    "tables_count": 13
  }
}
```

## Estructura del Proyecto

```
C:\xampp\htdocs\insumos\
├── api/
│   ├── config/
│   │   ├── database.php (NO SUBIR A GIT)
│   │   └── database.example.php
│   ├── auth/
│   │   └── session.php
│   ├── endpoints/
│   │   ├── auth.php
│   │   ├── solicitudes.php
│   │   └── inventario.php
│   └── utils/
│       └── helpers.php
├── js/
│   ├── api-adapter.js (NUEVO)
│   └── ...existentes
├── css/
├── includes/
├── index.html
├── .gitignore
└── README-LOCAL.md
```

## Configuración de Red

### Acceso desde la red local (11.254.27.18)

1. **Configurar Apache** (`C:\xampp\apache\conf\httpd.conf`):

```apache
ServerName 11.254.27.18

<Directory "C:/xampp/htdocs/insumos">
    Options Indexes FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
```

2. **Configurar Firewall** (CMD como Administrador):

```bash
netsh advfirewall firewall add rule name="Apache Insumos" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="PostgreSQL" dir=in action=allow protocol=TCP localport=5432
```

3. **Reiniciar Apache** desde XAMPP Control Panel

## URLs de Acceso

- **Local**: http://localhost:8080/insumos/
- **Red**: http://11.254.27.18/insumos/
- **API Test**: http://11.254.27.18/insumos/api/test-connection.php

## Usuarios de Prueba

| Username | Password | Rol |
|----------|----------|-----|
| SUPR01 | temp123 | Super Admin |
| INSM01 | temp123 | Admin |
| JURD01 | temp123 | Usuario |

## Seguridad

### NUNCA subir a Git:
- `api/config/database.php`
- `.env`
- Archivos con credenciales

### El archivo `.gitignore` ya está configurado para proteger estos archivos.

## Troubleshooting

### Error: "Could not find driver"
- Verificar que extensiones `pdo_pgsql` y `pgsql` estén habilitadas en `php.ini`
- Reiniciar Apache

### Error: "Connection refused"
- Verificar que PostgreSQL esté corriendo
- Verificar credenciales en `database.php`
- Verificar puerto 5432 abierto

### Error 404 en API
- Verificar que la carpeta esté en `C:\xampp\htdocs\insumos\`
- Verificar que Apache esté corriendo en puerto 8080

### No se puede acceder desde la red
- Verificar firewall de Windows
- Verificar que Apache escuche en todas las interfaces (0.0.0.0:8080)

## Logs

Los errores se guardan en:
- `C:\xampp\apache\logs\error.log`
- `C:\xampp\htdocs\insumos\logs\error.log` (errores de la aplicación)

## Mantenimiento

### Backup de base de datos

```bash
pg_dump -U insumos_user sistema_insumos > backup_$(date +%Y%m%d).sql
```

### Restaurar backup

```bash
psql -U insumos_user sistema_insumos < backup_20250101.sql
```

## Próximos pasos de migración

1. ✅ Infraestructura base (PostgreSQL + Apache)
2. ✅ Estructura API PHP
3. ⏳ Sistema de autenticación
4. ⏳ Endpoints de solicitudes
5. ⏳ Endpoints de inventario
6. ⏳ Adapter JavaScript
7. ⏳ Migración frontend

## Soporte

Para problemas o dudas:
- Revisar logs en `logs/error.log`
- Verificar `api/test-connection.php`
- Consultar documentación de PostgreSQL