import { useEffect, useState } from "react";
import { api } from "./api";

const EMPTY_REGISTER = { full_name: "", email: "", password: "", role: "client" };
const EMPTY_LOGIN = { email: "", password: "" };

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [registerData, setRegisterData] = useState(EMPTY_REGISTER);
  const [loginData, setLoginData] = useState(EMPTY_LOGIN);
  const [message, setMessage] = useState("");
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);

  const [newService, setNewService] = useState({ name: "", description: "", duration_min: 30, price: 0 });
  const [newAvailability, setNewAvailability] = useState({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });
  const [newAppointment, setNewAppointment] = useState({ provider_id: "", service_id: "", date: "", start_time: "09:00", notes: "" });
  const selectedService = services.find((service) => service.id === Number(newAppointment.service_id));

  async function bootstrap(currentToken) {
    try {
      const verified = await api.auth.verify(currentToken);
      setAuthUser(verified);
      const me = await api.users.me(currentToken);
      setProfile(me);
      const servicesRes = await api.appointments.listServices();
      setServices(servicesRes.items || []);
      const appointmentsRes = await api.appointments.myAppointments(currentToken);
      setAppointments(appointmentsRes.items || []);

      if (verified.role === "admin") {
        const usersRes = await api.users.listUsers(currentToken);
        setUsers(usersRes.items || []);
      }
    } catch (error) {
      setMessage(error.message);
      logout();
    }
  }

  useEffect(() => {
    if (token) {
      bootstrap(token);
    }
  }, [token]);

  function logout() {
    localStorage.removeItem("token");
    setToken("");
    setAuthUser(null);
    setProfile(null);
    setAppointments([]);
    setUsers([]);
  }

  async function handleRegister(event) {
    event.preventDefault();
    try {
      const response = await api.auth.register(registerData);
      localStorage.setItem("token", response.access_token);
      setToken(response.access_token);
      setRegisterData(EMPTY_REGISTER);
      setMessage("Registro completado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function handleLogin(event) {
    event.preventDefault();
    try {
      const response = await api.auth.login(loginData);
      localStorage.setItem("token", response.access_token);
      setToken(response.access_token);
      setLoginData(EMPTY_LOGIN);
      setMessage("Sesion iniciada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    try {
      const updated = await api.users.updateMe(
        {
          full_name: profile.full_name,
          phone: profile.phone || "",
          avatar_url: profile.avatar_url || "",
        },
        token
      );
      setProfile(updated);
      setMessage("Perfil actualizado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createService(event) {
    event.preventDefault();
    try {
      await api.appointments.createService(
        {
          ...newService,
          duration_min: Number(newService.duration_min),
          price: Number(newService.price),
        },
        token
      );
      const servicesRes = await api.appointments.listServices();
      setServices(servicesRes.items || []);
      setMessage("Servicio creado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createAvailability(event) {
    event.preventDefault();
    try {
      await api.appointments.createAvailability(
        {
          day_of_week: Number(newAvailability.day_of_week),
          start_time: newAvailability.start_time,
          end_time: newAvailability.end_time,
        },
        token
      );
      setMessage("Disponibilidad guardada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function createAppointment(event) {
    event.preventDefault();
    try {
      await api.appointments.createAppointment(
        {
          provider_id: Number(newAppointment.provider_id),
          service_id: Number(newAppointment.service_id),
          date: newAppointment.date,
          start_time: newAppointment.start_time,
          notes: newAppointment.notes,
        },
        token
      );
      const appointmentsRes = await api.appointments.myAppointments(token);
      setAppointments(appointmentsRes.items || []);
      setMessage("Cita creada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function setStatus(id, status) {
    try {
      await api.appointments.updateStatus(id, { status }, token);
      const appointmentsRes = await api.appointments.myAppointments(token);
      setAppointments(appointmentsRes.items || []);
      setMessage("Estado actualizado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelAppointment(id) {
    try {
      await api.appointments.cancel(id, token);
      const appointmentsRes = await api.appointments.myAppointments(token);
      setAppointments(appointmentsRes.items || []);
      setMessage("Cita cancelada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  if (!token || !authUser) {
    return (
      <div className="container">
        <h1>Sistema de Reservas de Citas</h1>
        {message && <p className="tag">{message}</p>}
        <div className="grid two">
          <div className="card">
            <h2>Registro</h2>
            <form className="grid" onSubmit={handleRegister}>
              <input placeholder="Nombre" value={registerData.full_name} onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })} required />
              <input type="email" placeholder="Email" value={registerData.email} onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })} required />
              <input type="password" placeholder="Contrasena" value={registerData.password} onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })} required />
              <select value={registerData.role} onChange={(e) => setRegisterData({ ...registerData, role: e.target.value })}>
                <option value="client">Cliente</option>
                <option value="provider">Proveedor</option>
                <option value="admin">Administrador</option>
              </select>
              <button>Crear cuenta</button>
            </form>
          </div>
          <div className="card">
            <h2>Login</h2>
            <form className="grid" onSubmit={handleLogin}>
              <input type="email" placeholder="Email" value={loginData.email} onChange={(e) => setLoginData({ ...loginData, email: e.target.value })} required />
              <input type="password" placeholder="Contrasena" value={loginData.password} onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} required />
              <button className="secondary">Iniciar sesion</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2>Dashboard</h2>
          <p className="small">Usuario {authUser.email} | Rol {authUser.role}</p>
        </div>
        <button className="danger" onClick={logout}>Cerrar sesion</button>
      </div>

      {message && <p className="tag">{message}</p>}

      {profile && (
        <div className="card">
          <h3>Mi perfil</h3>
          <form className="grid two" onSubmit={saveProfile}>
            <input value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
            <input placeholder="Telefono" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
            <input placeholder="Avatar URL" value={profile.avatar_url || ""} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })} />
            <button>Guardar perfil</button>
          </form>
        </div>
      )}

      {(authUser.role === "provider" || authUser.role === "admin") && (
        <div className="grid two">
          <div className="card">
            <h3>Crear servicio</h3>
            <form className="grid" onSubmit={createService}>
              <input placeholder="Nombre" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} required />
              <input placeholder="Descripcion" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
              <input type="number" placeholder="Duracion (min)" value={newService.duration_min} onChange={(e) => setNewService({ ...newService, duration_min: e.target.value })} required />
              <input type="number" placeholder="Precio" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} required />
              <button>Guardar servicio</button>
            </form>
          </div>
          <div className="card">
            <h3>Disponibilidad</h3>
            <form className="grid" onSubmit={createAvailability}>
              <select value={newAvailability.day_of_week} onChange={(e) => setNewAvailability({ ...newAvailability, day_of_week: e.target.value })}>
                <option value="0">Lunes</option>
                <option value="1">Martes</option>
                <option value="2">Miercoles</option>
                <option value="3">Jueves</option>
                <option value="4">Viernes</option>
                <option value="5">Sabado</option>
                <option value="6">Domingo</option>
              </select>
              <input type="time" value={newAvailability.start_time} onChange={(e) => setNewAvailability({ ...newAvailability, start_time: e.target.value })} required />
              <input type="time" value={newAvailability.end_time} onChange={(e) => setNewAvailability({ ...newAvailability, end_time: e.target.value })} required />
              <button>Guardar bloque</button>
            </form>
          </div>
        </div>
      )}

      {(authUser.role === "client" || authUser.role === "admin") && (
        <div className="card">
          <h3>Crear cita</h3>
          <form className="grid two" onSubmit={createAppointment}>
            <input type="number" placeholder="Provider ID (auto)" value={newAppointment.provider_id} readOnly required />
            <select
              value={newAppointment.service_id}
              onChange={(e) => {
                const nextServiceId = e.target.value;
                const service = services.find((item) => item.id === Number(nextServiceId));
                setNewAppointment({
                  ...newAppointment,
                  service_id: nextServiceId,
                  provider_id: service ? String(service.provider_id) : "",
                });
              }}
              required
            >
              <option value="">Selecciona servicio</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  #{service.id} {service.name} (Proveedor {service.provider_id})
                </option>
              ))}
            </select>
            {selectedService && (
              <p className="small">
                Servicio seleccionado: {selectedService.name} | Duracion {selectedService.duration_min} min | Precio {selectedService.price}
              </p>
            )}
            <input type="date" value={newAppointment.date} onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })} required />
            <input type="time" value={newAppointment.start_time} onChange={(e) => setNewAppointment({ ...newAppointment, start_time: e.target.value })} required />
            <textarea placeholder="Notas" value={newAppointment.notes} onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })} />
            <button>Reservar cita</button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Mis citas</h3>
        <div className="grid">
          {appointments.map((item) => (
            <div key={item.id} className="card">
              <p>
                Cita #{item.id} | Servicio {item.service_id} | Proveedor {item.provider_id} | Cliente {item.client_id}
              </p>
              <p>
                {item.date} {item.start_time} - {item.end_time} | Estado: <b>{item.status}</b>
              </p>
              <div className="row">
                {(authUser.role === "provider" || authUser.role === "admin") && item.status === "pendiente" && (
                  <button onClick={() => setStatus(item.id, "confirmada")}>Confirmar</button>
                )}
                {(authUser.role === "provider" || authUser.role === "admin") && item.status === "confirmada" && (
                  <button onClick={() => setStatus(item.id, "completada")}>Completar</button>
                )}
                {item.status !== "completada" && <button className="danger" onClick={() => cancelAppointment(item.id)}>Cancelar</button>}
              </div>
            </div>
          ))}
          {appointments.length === 0 && <p className="small">Aun no hay citas.</p>}
        </div>
      </div>

      {authUser.role === "admin" && (
        <div className="card">
          <h3>Usuarios del sistema</h3>
          <ul>
            {users.map((u) => (
              <li key={u.auth_user_id}>{u.auth_user_id} | {u.full_name} | {u.email} | {u.role}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
