# Setup — Cuentas Claras Dashboard

## 1. Instalar Node.js
Ir a https://nodejs.org → descargar la versión LTS (la verde).
Instalar normalmente. Cerrar y volver a abrir la terminal.

## 2. Instalar dependencias del proyecto
```bash
cd ~/Downloads/DASHBOARD
npm install
```

## 3. Crear las 3 cuentas y configurar variables

### Clerk (auth)
1. Ir a clerk.com → crear cuenta → "Create application"
2. Nombre: "Cuentas Claras Dashboard" → activar solo "Email"
3. Ir a "API Keys" y copiar:
   - NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
   - CLERK_SECRET_KEY

### Google Cloud (Sheets API)
1. Ir a console.cloud.google.com → nuevo proyecto
2. Buscar "Google Sheets API" → Habilitar
3. Ir a "Credenciales" → "Crear credenciales" → "Cuenta de servicio"
4. Nombre: "dashboard-sheets" → crear
5. En la cuenta creada → pestaña "Claves" → "Agregar clave" → JSON → descargar
6. Del JSON copiá: `client_email` y `private_key`
7. Compartir cada Google Sheet con ese email (client_email) como "Lector"

### IDs de los Google Sheets
El ID está en la URL de cada Sheet:
docs.google.com/spreadsheets/d/**ESTE_ES_EL_ID**/edit

## 4. Crear el archivo .env.local
Copiar .env.local.example → renombrar a .env.local
Completar con todos los valores obtenidos arriba.

## 5. Levantar el proyecto
```bash
npm run dev
```
Abrir http://localhost:3000

## 6. Configurar roles en Clerk
1. Ir a dashboard.clerk.com → Users → seleccionar tu usuario
2. En "Public metadata" pegar:
```json
{ "role": "admin" }
```
Para otros usuarios:
- Setters/Closers: `{ "role": "ventas" }`
- Operaciones: `{ "role": "ops" }`

## 7. Deploy en Vercel
1. Subir el proyecto a GitHub
2. Ir a vercel.com → "New Project" → importar el repo
3. En "Environment Variables" agregar todas las del .env.local
4. Deploy → conectar dominio propio en Settings > Domains
