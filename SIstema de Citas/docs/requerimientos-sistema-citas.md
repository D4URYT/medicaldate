# Requerimientos - Sistema de Citas (Mini Proyecto)

## Objetivo
Construir un sistema basico de citas con autenticacion, perfiles y gestion de servicios, disponibilidad y reservas. Debe ejecutarse con Docker o local y permitir un flujo minimo de prueba end-to-end.

## Roles
- admin: puede listar usuarios y cambiar estados de citas
- provider: crea servicios y disponibilidad, confirma/completa citas
- client: crea citas y puede cancelarlas

## Funcionalidades
- Registro y login con JWT
- Perfil de usuario (ver y actualizar)
- Creacion y listado de servicios por provider
- Configuracion de disponibilidad por dia
- Creacion de citas dentro de disponibilidad
- Confirmacion/completado/cancelacion de citas

## Reglas
- Email unico por usuario
- Servicios activos con duracion y precio validos
- Citas dentro del horario disponible del provider
- No permitir traslapes de citas para un provider
- Transiciones de estado validas:
  - pendiente -> confirmada o cancelada
  - confirmada -> completada o cancelada
  - completada/cancelada -> sin cambios

## Criterios de aceptacion
- Se puede registrar y loguear un provider y un client
- Un provider puede crear al menos un servicio y una disponibilidad
- Un client puede crear una cita valida usando un servicio existente
- Un provider puede confirmar y completar la cita
- Se puede cancelar una cita no completada
- Los endpoints devuelven errores claros ante datos invalidos

## Flujo minimo de prueba
1. Registrar usuario provider
2. Registrar usuario client
3. Login provider -> crear servicio y disponibilidad
4. Login client -> crear cita
5. Login provider -> confirmar y completar cita

## Entorno
- Backend: Python 3.12 + FastAPI
- Frontend: React + Vite
- DB: SQLite por servicio

## Puertos
- Auth: 8001
- Users: 8002
- Appointments: 8003
- Frontend: 5173