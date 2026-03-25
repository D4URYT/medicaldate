# Python + React Microservices - Sistema de Citas

## Stack
- Backend: Python 3.12 + FastAPI (3 microservicios)
- Frontend: React + Vite
- Base de datos: PostgreSQL
- Contenedores: Docker + docker-compose

## Estructura
- `services/auth-service`: registro, login, JWT, cambio de password
- `services/users-service`: perfil de usuario, listado para admin
- `services/appointments-service`: servicios, disponibilidad, citas
- `frontend`: UI React

## Puertos
- Auth: `http://localhost:8001`
- Users: `http://localhost:8002`
- Appointments: `http://localhost:8003`
- Frontend: `http://localhost:5173`
- Postgres: `localhost:5432`

## Ejecutar en Docker
```bash
docker compose up --build
```

## Ejecutar local (sin Docker)
Requiere un PostgreSQL local y las variables DSN.

### 1) auth-service
```bash
cd services/auth-service
pip install -r requirements.txt
$env:AUTH_DB_DSN='postgresql://citas_user:citas_pass@localhost:5432/citas_db'
uvicorn app.main:app --reload --port 8001
```

### 2) users-service
```bash
cd services/users-service
pip install -r requirements.txt
$env:USERS_DB_DSN='postgresql://citas_user:citas_pass@localhost:5432/citas_db'
$env:AUTH_SERVICE_URL='http://localhost:8001'
uvicorn app.main:app --reload --port 8002
```

### 3) appointments-service
```bash
cd services/appointments-service
pip install -r requirements.txt
$env:APPOINTMENTS_DB_DSN='postgresql://citas_user:citas_pass@localhost:5432/citas_db'
$env:AUTH_SERVICE_URL='http://localhost:8001'
$env:USERS_SERVICE_URL='http://localhost:8002'
uvicorn app.main:app --reload --port 8003
```

### 4) frontend
```bash
cd frontend
npm install
npm run dev
```

## Flujo minimo de prueba
1. Registrar un usuario `provider`.
2. Registrar un usuario `client`.
3. Login como `provider`, completar perfil, crear servicio y disponibilidad.
4. Login como `client`, crear cita usando `provider_id` y `service_id`.
5. Login como `provider`, confirmar/completar cita.

## Endpoints principales
### auth-service
- `POST /register`
- `POST /login`
- `GET /verify`
- `PATCH /change-password`
- `PATCH /users/{user_id}/deactivate` (admin)

### users-service
- `GET /me`
- `PUT /me`
- `GET /users` (admin)
- `GET /internal/users/{auth_user_id}`

### appointments-service
- `POST /services`
- `GET /services`
- `POST /availability`
- `GET /availability/{provider_id}`
- `POST /appointments`
- `GET /appointments`
- `PATCH /appointments/{id}/status`
- `PATCH /appointments/{id}/cancel`

## Nota
Para despliegue publico (Render/Railway), publica cada microservicio como servicio independiente y apunta variables `AUTH_SERVICE_URL` y `USERS_SERVICE_URL` a URLs reales.