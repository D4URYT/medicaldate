import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const EMPTY_REGISTER = { full_name: "", email: "", password: "", role: "client" };
const EMPTY_LOGIN = { email: "", password: "" };
const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=facearea&w=200&h=200&q=80";

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
  const [adminQuery, setAdminQuery] = useState("");
  const [adminSelectedId, setAdminSelectedId] = useState("");
  const [adminForm, setAdminForm] = useState({
    full_name: "",
    phone: "",
    avatar_url: "",
    role: "client",
    is_active: true,
  });
  const [showProfile, setShowProfile] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current_password: "", new_password: "" });

  const [newService, setNewService] = useState({ name: "", description: "", duration_min: 30, price: 0 });
  const [newAvailability, setNewAvailability] = useState({ day_of_week: 1, start_time: "09:00", end_time: "17:00" });
  const [newAppointment, setNewAppointment] = useState({ provider_id: "", service_id: "", date: "", start_time: "09:00", notes: "" });
  const selectedService = services.find((service) => service.id === Number(newAppointment.service_id));

  const totalAppointments = appointments.length;
  const totalServices = services.length;
  const totalUsers = users.length;

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

  async function changePassword(event) {
    event.preventDefault();
    try {
      await api.auth.changePassword(passwordForm, token);
      setPasswordForm({ current_password: "", new_password: "" });
      setMessage("Contrasena actualizada.");
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

  async function saveAdminUser(event) {
    event.preventDefault();
    if (!adminSelectedId) {
      setMessage("Selecciona un usuario.");
      return;
    }
    try {
      const updated = await api.users.updateAdminUser(Number(adminSelectedId), adminForm, token);
      const usersRes = await api.users.listUsers(token);
      setUsers(usersRes.items || []);
      setAdminForm({
        full_name: updated.full_name || "",
        phone: updated.phone || "",
        avatar_url: updated.avatar_url || "",
        role: updated.role || "client",
        is_active: Boolean(updated.is_active),
      });
      setMessage("Usuario actualizado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  function selectAdminUser(user) {
    setAdminSelectedId(String(user.auth_user_id));
    setAdminForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      avatar_url: user.avatar_url || "",
      role: user.role || "client",
      is_active: Boolean(user.is_active),
    });
  }

  const filteredUsers = useMemo(() => {
    if (!adminQuery) return users;
    const q = adminQuery.toLowerCase();
    return users.filter((u) =>
      [u.full_name, u.email, String(u.auth_user_id), u.role].some((field) =>
        String(field || "").toLowerCase().includes(q)
      )
    );
  }, [adminQuery, users]);

  const heroStats = useMemo(
    () => [
      { label: "Citas activas", value: totalAppointments },
      { label: "Servicios", value: totalServices },
      { label: "Usuarios", value: authUser?.role === "admin" ? totalUsers : "-" },
    ],
    [totalAppointments, totalServices, totalUsers, authUser]
  );

  if (!token || !authUser) {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" />
            <div>
              <p className="brand-title">CitasPro</p>
              <p className="brand-subtitle">Microservicios para salud, belleza y bienestar</p>
            </div>
          </div>
          <nav className="nav">
            <a href="#benefits">Beneficios</a>
            <a href="#security">Seguridad</a>
            <a href="#contact">Contacto</a>
          </nav>
          <div className="nav-actions">
            <span className="pill">Demo en vivo</span>
          </div>
        </header>

        <main className="container">
          <section className="hero">
            <div className="hero-content">
              <p className="eyebrow">Control total de tu agenda</p>
              <h1>Agenda, confirma y cobra con una experiencia premium.</h1>
              <p className="lead">
                Centraliza servicios, disponibilidad y citas en un solo lugar. Disenado para equipos que quieren menos
                friccion y mas conversion.
              </p>
              <div className="hero-highlights">
                <div className="highlight">
                  <h3>Automatiza</h3>
                  <p>Bloques de disponibilidad y recordatorios listos.</p>
                </div>
                <div className="highlight">
                  <h3>Administra</h3>
                  <p>Visibilidad de proveedores, clientes y estados.</p>
                </div>
                <div className="highlight">
                  <h3>Crece</h3>
                  <p>Panel claro para tomar decisiones rapidas.</p>
                </div>
              </div>
            </div>

            <div className="hero-card">
              {message && <div className="alert">{message}</div>}
              <div className="auth-grid">
                <div className="card">
                  <h2>Registro</h2>
                  <p className="muted">Empieza en menos de un minuto.</p>
                  <form className="grid" onSubmit={handleRegister}>
                    <input
                      placeholder="Nombre completo"
                      value={registerData.full_name}
                      onChange={(e) => setRegisterData({ ...registerData, full_name: e.target.value })}
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Contrasena"
                      value={registerData.password}
                      onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                      required
                    />
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
                  <p className="muted">Accede a tu panel seguro.</p>
                  <form className="grid" onSubmit={handleLogin}>
                    <input
                      type="email"
                      placeholder="Email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Contrasena"
                      value={loginData.password}
                      onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                      required
                    />
                    <button className="secondary">Iniciar sesion</button>
                  </form>
                </div>
              </div>
            </div>
          </section>

          <section id="benefits" className="section">
            <div className="section-header">
              <h2>Experiencia profesional para todos los roles</h2>
              <p className="muted">Flujos claros, rapidez y control desde cualquier dispositivo.</p>
            </div>
            <div className="grid three">
              <div className="card soft">
                <h3>Panel inteligente</h3>
                <p>Visualiza estados, volumen de citas y disponibilidad en segundos.</p>
              </div>
              <div className="card soft">
                <h3>Roles definidos</h3>
                <p>Permisos listos para administradores, proveedores y clientes.</p>
              </div>
              <div className="card soft">
                <h3>Listo para escalar</h3>
                <p>Arquitectura de microservicios preparada para crecer.</p>
              </div>
            </div>
          </section>

          <section id="security" className="section">
            <div className="section-header">
              <h2>Seguridad y confianza</h2>
              <p className="muted">JWT, trazabilidad y datos centralizados en PostgreSQL.</p>
            </div>
            <div className="grid two">
              <div className="card soft">
                <h3>Autenticacion robusta</h3>
                <p>Tokens seguros con expiracion configurable.</p>
              </div>
              <div className="card soft">
                <h3>Disponibilidad alta</h3>
                <p>Servicios separados para reducir puntos de falla.</p>
              </div>
            </div>
          </section>
        </main>

        <footer id="contact" className="footer">
          <div className="footer-brand">
            <span className="brand-mark" />
            <div>
              <p className="brand-title">CitasPro</p>
              <p className="muted">Agenda profesional en minutos.</p>
            </div>
          </div>
          <div className="footer-links">
            <div>
              <p className="footer-title">Producto</p>
              <a href="#benefits">Beneficios</a>
              <a href="#security">Seguridad</a>
              <a href="#contact">Contacto</a>
            </div>
            <div>
              <p className="footer-title">Soporte</p>
              <a href="mailto:soporte@citaspro.com">soporte@citaspro.com</a>
              <a href="tel:+18000000000">+1 800 000 0000</a>
            </div>
            <div>
              <p className="footer-title">Ubicaciones</p>
              <p className="muted">Santo Domingo</p>
              <p className="muted">Ciudad de Mexico</p>
            </div>
          </div>
          <p className="footer-note">© 2026 CitasPro. Todos los derechos reservados.</p>
        </footer>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <p className="brand-title">CitasPro</p>
            <p className="brand-subtitle">Panel operativo</p>
          </div>
        </div>
        <nav className="nav">
          <a href="#dashboard">Dashboard</a>
          <a href="#services">Servicios</a>
          <a href="#appointments">Citas</a>
          {authUser.role === "admin" && <a href="#admin">Admin</a>}
        </nav>
        <div className="nav-actions">
          <button className="profile-chip" onClick={() => setShowProfile(true)}>
            <img src={profile?.avatar_url || DEFAULT_AVATAR} alt="avatar" />
            <span>{profile?.full_name || authUser.email}</span>
          </button>
          <button className="danger" onClick={logout}>Cerrar sesion</button>
        </div>
      </header>

      <main className="container">
        {showProfile && (
          <section className="section">
            <div className="section-header">
              <h2>Mi cuenta</h2>
              <button className="secondary" onClick={() => setShowProfile(false)}>Cerrar</button>
            </div>
            <div className="grid two">
              <div className="card">
                <div className="profile-header">
                  <img src={profile?.avatar_url || DEFAULT_AVATAR} alt="avatar" />
                  <div>
                    <h3>{profile?.full_name || "Mi perfil"}</h3>
                    <p className="muted">{authUser.email}</p>
                  </div>
                </div>
                <form className="grid" onSubmit={saveProfile}>
                  <input
                    placeholder="Nombre completo"
                    value={profile?.full_name || ""}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  />
                  <input
                    placeholder="Telefono"
                    value={profile?.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                  <input
                    placeholder="Avatar URL"
                    value={profile?.avatar_url || ""}
                    onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })}
                  />
                  <button>Guardar perfil</button>
                </form>
              </div>
              <div className="card">
                <h3>Seguridad</h3>
                <form className="grid" onSubmit={changePassword}>
                  <input
                    type="password"
                    placeholder="Contrasena actual"
                    value={passwordForm.current_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Nueva contrasena"
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    required
                  />
                  <button className="secondary">Actualizar contrasena</button>
                </form>
              </div>
            </div>
          </section>
        )}

        <section id="dashboard" className="section">
          <div className="section-header">
            <h2>Dashboard</h2>
            <p className="muted">Resumen operativo y acciones rapidas.</p>
          </div>
          <div className="stats">
            {heroStats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <p className="stat-label">{stat.label}</p>
                <p className="stat-value">{stat.value}</p>
              </div>
            ))}
          </div>
          {message && <div className="alert">{message}</div>}
        </section>

        {profile && (
          <section className="section">
            <div className="section-header">
              <h2>Mi perfil</h2>
              <p className="muted">Actualiza tu informacion visible para clientes.</p>
            </div>
            <div className="card">
              <form className="grid two" onSubmit={saveProfile}>
                <input value={profile.full_name || ""} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} />
                <input placeholder="Telefono" value={profile.phone || ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
                <input placeholder="Avatar URL" value={profile.avatar_url || ""} onChange={(e) => setProfile({ ...profile, avatar_url: e.target.value })} />
                <button>Guardar perfil</button>
              </form>
            </div>
          </section>
        )}

        {(authUser.role === "provider" || authUser.role === "admin") && (
          <section id="services" className="section">
            <div className="section-header">
              <h2>Servicios y disponibilidad</h2>
              <p className="muted">Define lo que ofreces y cuando estas disponible.</p>
            </div>
            <div className="grid two">
              <div className="card">
                <h3>Crear servicio</h3>
                <form className="grid" onSubmit={createService}>
                  <input placeholder="Nombre" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} required />
                  <input placeholder="Descripcion" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
                  <div className="grid two">
                    <input type="number" placeholder="Duracion (min)" value={newService.duration_min} onChange={(e) => setNewService({ ...newService, duration_min: e.target.value })} required />
                    <input type="number" placeholder="Precio" value={newService.price} onChange={(e) => setNewService({ ...newService, price: e.target.value })} required />
                  </div>
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
                  <div className="grid two">
                    <input type="time" value={newAvailability.start_time} onChange={(e) => setNewAvailability({ ...newAvailability, start_time: e.target.value })} required />
                    <input type="time" value={newAvailability.end_time} onChange={(e) => setNewAvailability({ ...newAvailability, end_time: e.target.value })} required />
                  </div>
                  <button>Guardar bloque</button>
                </form>
              </div>
            </div>
          </section>
        )}

        {(authUser.role === "client" || authUser.role === "admin") && (
          <section className="section">
            <div className="section-header">
              <h2>Crear cita</h2>
              <p className="muted">Selecciona servicio y horario disponible.</p>
            </div>
            <div className="card">
              <form className="grid two" onSubmit={createAppointment}>
                <input type="number" placeholder="Provider ID" value={newAppointment.provider_id} readOnly required />
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
                  <div className="info-card">
                    <p>
                      Servicio: <strong>{selectedService.name}</strong>
                    </p>
                    <p>
                      Duracion {selectedService.duration_min} min | Precio {selectedService.price}
                    </p>
                  </div>
                )}
                <input type="date" value={newAppointment.date} onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })} required />
                <input type="time" value={newAppointment.start_time} onChange={(e) => setNewAppointment({ ...newAppointment, start_time: e.target.value })} required />
                <textarea placeholder="Notas" value={newAppointment.notes} onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })} />
                <button>Reservar cita</button>
              </form>
            </div>
          </section>
        )}

        <section id="appointments" className="section">
          <div className="section-header">
            <h2>Mis citas</h2>
            <p className="muted">Administra estados y confirmaciones.</p>
          </div>
          <div className="grid">
            {appointments.map((item) => (
              <div key={item.id} className="card">
                <div className="card-head">
                  <div>
                    <p className="muted">Cita #{item.id}</p>
                    <h3>Servicio {item.service_id}</h3>
                  </div>
                  <span className={`status-badge status-${item.status}`}>{item.status}</span>
                </div>
                <p>
                  Proveedor {item.provider_id} | Cliente {item.client_id}
                </p>
                <p>
                  {item.date} {item.start_time} - {item.end_time}
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
            {appointments.length === 0 && <p className="muted">Aun no hay citas.</p>}
          </div>
        </section>

        {authUser.role === "admin" && (
          <section id="admin" className="section">
            <div className="section-header">
              <h2>Usuarios del sistema</h2>
              <p className="muted">Administra perfiles, roles y estado.</p>
            </div>
            <div className="grid two">
              <div className="card">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <h3>Directorio</h3>
                  <input
                    className="input-compact"
                    placeholder="Buscar..."
                    value={adminQuery}
                    onChange={(e) => setAdminQuery(e.target.value)}
                  />
                </div>
                <ul className="list">
                  {filteredUsers.map((u) => (
                    <li key={u.auth_user_id} className={`list-item ${String(u.auth_user_id) === adminSelectedId ? "active" : ""}`}>
                      <button className="link-button" onClick={() => selectAdminUser(u)}>
                        <div>
                          <strong>#{u.auth_user_id}</strong> {u.full_name}
                          <p className="muted">{u.email}</p>
                        </div>
                        <span className={`status-badge ${u.is_active ? "status-confirmada" : "status-cancelada"}`}>
                          {u.is_active ? "activo" : "inactivo"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3>Detalle y acciones</h3>
                <form className="grid" onSubmit={saveAdminUser}>
                  <input
                    placeholder="Nombre completo"
                    value={adminForm.full_name}
                    onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })}
                    required
                  />
                  <input
                    placeholder="Telefono"
                    value={adminForm.phone || ""}
                    onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  />
                  <input
                    placeholder="Avatar URL"
                    value={adminForm.avatar_url || ""}
                    onChange={(e) => setAdminForm({ ...adminForm, avatar_url: e.target.value })}
                  />
                  <select value={adminForm.role} onChange={(e) => setAdminForm({ ...adminForm, role: e.target.value })}>
                    <option value="client">Cliente</option>
                    <option value="provider">Proveedor</option>
                    <option value="admin">Administrador</option>
                  </select>
                  <div className="row">
                    <button type="submit">Guardar cambios</button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setAdminForm({ ...adminForm, is_active: true })}
                    >
                      Activar
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => setAdminForm({ ...adminForm, is_active: false })}
                    >
                      Desactivar
                    </button>
                  </div>
                </form>
                <p className="muted" style={{ marginTop: "12px" }}>
                  Recuerda guardar para aplicar cambios de rol o estado.
                </p>
              </div>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <span className="brand-mark" />
          <div>
            <p className="brand-title">CitasPro</p>
            <p className="muted">Panel operativo y experiencia premium.</p>
          </div>
        </div>
        <div className="footer-links">
          <div>
            <p className="footer-title">Accesos</p>
            <a href="#dashboard">Dashboard</a>
            <a href="#services">Servicios</a>
            <a href="#appointments">Citas</a>
          </div>
          <div>
            <p className="footer-title">Contacto</p>
            <a href="mailto:soporte@citaspro.com">soporte@citaspro.com</a>
            <a href="tel:+18000000000">+1 800 000 0000</a>
          </div>
          <div>
            <p className="footer-title">Estado</p>
            <p className="muted">Microservicios activos</p>
            <p className="muted">PostgreSQL saludable</p>
          </div>
        </div>
        <p className="footer-note">© 2026 CitasPro. Todos los derechos reservados.</p>
      </footer>
    </div>
  );
}
