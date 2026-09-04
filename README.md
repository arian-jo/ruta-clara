# Ruta Clara

Agenda multiparada y seguimiento privado de visitas técnicas. El técnico organiza el recorrido, comparte un enlace por cliente y controla cuándo se publica su ubicación de Traccar.

## Desarrollo

```bash
npm ci
npm run dev
npm test
```

La consola abre en `/` y el enlace del técnico usa un secreto en el fragmento: `/#token=...`. El panel retira ese fragmento de la barra de direcciones después de leerlo. Para probar el modo demo, copiá `.env.example` a `.env` y abrí `/#token=ruta-clara-demo`; se crean tres visitas de muestra.

## Variables de entorno

Copiar `.env.example` a `.env` para conectar servicios reales:

- `TECHNICIAN_ACCESS_TOKEN`: secreto privado de al menos 32 bytes.
- `TOKEN_ENCRYPTION_KEY`: clave para cifrar los enlaces recuperables.
- `TRACCAR_BASE_URL` y `TRACCAR_DEVICE_ID`: servidor y dispositivo de Traccar.
- `TRACCAR_API_TOKEN` o bien `TRACCAR_USERNAME` y `TRACCAR_PASSWORD`: credenciales de una cuenta dedicada de solo lectura. El token tiene prioridad si se configuran ambos métodos.
- `ORS_API_KEY`: rutas y geocodificación de openrouteservice.
- `APP_DEMO_MODE`: `false` en producción.

La base D1 se declara como `DB`; el esquema está en `db/schema.ts` y la migración generada en `drizzle/`.

## Publicación segura

El repositorio puede ser público siempre que los valores reales permanezcan en el entorno de Sites y nunca se escriban en archivos versionados.

- No subas `.env`, `.dev.vars`, bases SQLite, claves ni exportaciones de producción.
- Usá un `TECHNICIAN_ACCESS_TOKEN` aleatorio de al menos 32 bytes y una `TOKEN_ENCRYPTION_KEY` independiente.
- Mantené `APP_DEMO_MODE=false` en producción. Si la variable falta, la aplicación queda cerrada en vez de activar el demo automáticamente.
- No compartas URLs que contengan `#token=...`; cada enlace técnico o de cliente funciona como una credencial.
- La cuenta de Traccar debe ser exclusiva para esta aplicación y de solo lectura.

`.openai/hosting.json` contiene identificadores del proyecto y nombres lógicos de recursos, no credenciales. Los secretos de producción se administran desde Sites.
