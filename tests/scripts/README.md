# Test Scripts

Scripts ejecutables para pruebas manuales o smoke tests por servicio.

## Auth

Corre el flujo completo de auth:

- login inicial
- setup MFA
- enable MFA
- `/auth/me`
- login con MFA activo
- verify MFA
- refresh token
- logout
- refresh inválido después del logout

Comando:

```bash
npm run test:auth
```

Variables opcionales:

- `AUTH_TEST_EMAIL`
- `AUTH_TEST_NAME`
- `AUTH_TEST_PASSWORD`

## Health

Valida que `GET /health` responda `200` y devuelva `status=ok`.

Comando:

```bash
npm run test:health
```
