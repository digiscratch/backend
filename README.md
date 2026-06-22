# Digi Scratch Backend

Backend seguro para la promoción tipo "Raspa y Gana" de Digitel. Está construido con Node.js, TypeScript, Express, Prisma ORM y PostgreSQL, preparado para desplegarse en Railway y para ser consumido por un frontend Angular.

## Arquitectura

- `src/app.ts`: bootstrap de Express con Helmet, CORS, logging JSON y rate limiting.
- `src/routes/`: endpoints REST para auth, eventos, premios, participación pública, stand y auditoría.
- `src/services/`: lógica de negocio, cifrado PII, MFA TOTP, JWT, auditoría y participación transaccional.
- `src/middlewares/`: autenticación, autorización por roles, validación Zod, manejo de errores y request context.
- `prisma/schema.prisma`: modelo de datos y enums.
- `prisma/migrations/20260621_init/migration.sql`: migración inicial.

## Variables de Entorno

Usa `.env.example` como base.

- `DATABASE_URL`: conexión PostgreSQL obligatoria. Railway la expone como variable del servicio o del plugin Postgres.
- `JWT_SECRET`: secreto fuerte para access tokens.
- `JWT_REFRESH_SECRET`: secreto fuerte distinto para refresh tokens.
- `PII_ENCRYPTION_KEY`: llave para cifrado AES-256-GCM de PII.
- `DOCUMENT_HASH_SECRET`: secreto HMAC-SHA256 para `document_hash`.
- `ALLOWED_ORIGINS`: lista separada por comas para CORS.
- `REDIS_URL`: opcional. Si existe, el rate limit usa Redis; si no, usa memoria.
- `LOG_WEBHOOK_URL`: opcional. Replica eventos críticos a un proveedor externo.
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD`: variables para crear el primer `SUPER_ADMIN`.

## Modelo de Datos

Tablas incluidas:

- `internal_users`
- `mfa_settings`
- `refresh_tokens`
- `events`
- `prizes`
- `participants`
- `participations`
- `audit_logs`

Reglas clave:

- `participations` tiene índice único `(event_id, document_hash)`.
- No existe tabla `redemptions`; el canje vive dentro de `participations`.
- Los premios usan `stock_total` y `stock_available`.
- La asignación de premio ocurre dentro de una transacción serializable.
- `audit_logs` es append-only y no se expone ningún endpoint de edición o borrado.

## Seguridad Implementada

### Argon2id

Todas las contraseñas internas se hashean exclusivamente con Argon2id. No se almacenan ni se registran en texto plano.

### MFA

El login interno funciona en dos pasos:

1. `POST /auth/login` valida email y password.
2. Si el usuario no tiene MFA activo, devuelve `challengeToken` para enrolamiento.
3. `POST /auth/mfa/setup` genera secreto TOTP y `otpauth_url`.
4. `POST /auth/mfa/enable` valida el primer código y activa MFA.
5. Si MFA ya estaba activo, `POST /auth/mfa/verify` emite sesión.

Ningún endpoint interno permite operación si `mfa_enabled` es `false`.

### Cifrado de PII

Documento, nombre, teléfono y correo se cifran a nivel de aplicación con AES-256-GCM. Para cada campo se guardan:

- `ciphertext`
- `iv`
- `auth_tag`

El documento también se normaliza y se hashea con HMAC-SHA256 para búsquedas sin descifrar la tabla completa.

### Auditoría

Se registran eventos críticos como:

- login exitoso o fallido
- enrolamiento MFA
- cambios de eventos o premios
- cambios de inventario
- participación creada
- premio asignado
- canje
- intento de canje duplicado
- consultas internas de PII

Cada log incluye integridad SHA-256 para detectar manipulación.

### Logging Centralizado

El backend usa logs estructurados en JSON con `request_id`. También puede replicar eventos críticos a `LOG_WEBHOOK_URL`.

## Endpoints

### Auth

- `POST /auth/login`
- `POST /auth/mfa/setup`
- `POST /auth/mfa/enable`
- `POST /auth/mfa/verify`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`

### Eventos

- `GET /events`
- `GET /events/:id`
- `POST /events`
- `PATCH /events/:id`

### Premios

- `GET /admin/prizes`
- `POST /admin/prizes`
- `PATCH /admin/prizes/:id`
- `PATCH /admin/prizes/:id/inventory`

### Participación pública

- `POST /public/events/:eventCode/participate`
- `GET /public/events/:eventCode/result?document=...`

### Stand

- `POST /stand/search-participant`
- `POST /stand/redeem-participation`

### Auditoría

- `GET /audit-logs`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run migrate`
- `npm run seed`
- `npm run prisma:generate`

## Desarrollo Local

```bash
npm install
npm run prisma:generate
npm run build
```

Para aplicar la migración contra tu PostgreSQL:

```bash
npm run migrate
```

Para crear el primer `SUPER_ADMIN`:

```bash
npm run seed
```

## Despliegue en Railway

1. Crea un proyecto nuevo en Railway.
2. Conecta este repositorio `digiscratch/backend`.
3. Agrega un servicio PostgreSQL dentro del mismo proyecto.
4. Define las variables del `.env.example` en Railway.
5. Railway expone variables al runtime y al build del servicio. [Variables](https://docs.railway.com/variables)
6. Si despliegas con Dockerfile, Railway detecta `Dockerfile` en la raíz del repo por defecto. [Dockerfiles](https://docs.railway.com/builds/dockerfiles)
7. Ejecuta `npm run migrate` después de provisionar la base de datos.
8. Ejecuta `npm run seed` una vez para crear el primer usuario nominativo.

## Validación antes de producción

- Verificar rotación y fortaleza real de secretos.
- Confirmar `ALLOWED_ORIGINS` con los dominios finales.
- Validar conectividad a PostgreSQL y, si aplica, Redis.
- Confirmar que el primer `SUPER_ADMIN` active MFA antes de operar.
- Revisar que `LOG_WEBHOOK_URL` no fugue PII.
- Probar canje único y sobreasignación bajo concurrencia.
