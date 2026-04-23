import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CalendarDays,
  Camera,
  ChartColumn,
  Clock3,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCog,
  Users,
} from "lucide-react";
import { api } from "./api";

const EMPTY_REGISTER = { full_name: "", email: "", password: "", role: "client" };
const EMPTY_LOGIN = { email: "", password: "" };
const EMPTY_PASSWORD = { current_password: "", new_password: "" };
const DAY_OPTIONS = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miercoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sabado" },
  { value: 6, label: "Domingo" },
];

const EMPTY_SERVICE_FORM = {
  id: null,
  name: "",
  description: "",
  duration_min: 30,
  price: 0,
  start_time: "09:00",
  end_time: "17:00",
  days_of_week: [0, 1, 2, 3, 4],
};

const EMPTY_USER_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "client",
  phone: "",
  avatar_url: "",
};

const EMPTY_ADMIN_EDIT = {
  full_name: "",
  phone: "",
  avatar_url: "",
  role: "client",
  is_active: true,
};

const EMPTY_APPOINTMENT = {
  provider_id: "",
  service_id: "",
  date: "",
  start_time: "09:00",
  notes: "",
};

function statusLabel(status) {
  return status === "pendiente" ? "Pendiente" : status === "confirmada" ? "Confirmada" : status === "completada" ? "Completada" : "Cancelada";
}

function getAvatarLabel(name, email = "") {
  return (name || email || "Usuario").trim();
}

function getAvatarInitials(value) {
  const parts = String(value || "Usuario")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) return "U";
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

function createDefaultAvatar(label) {
  const initials = getAvatarInitials(label);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="${label}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0f766e" />
          <stop offset="100%" stop-color="#115e59" />
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="28" fill="url(#g)" />
      <circle cx="60" cy="44" r="18" fill="#d7f3ef" />
      <path d="M31 95c4-16 17-24 29-24s25 8 29 24" fill="#d7f3ef" />
      <text x="60" y="108" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="700" fill="#ffffff">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function Avatar({ src, name, email, alt, className = "" }) {
  const [hasError, setHasError] = useState(false);
  const label = getAvatarLabel(name, email);

  useEffect(() => {
    setHasError(false);
  }, [src]);

  const resolvedSrc = src && !hasError ? src : createDefaultAvatar(label);

  return (
    <img
      className={className}
      src={resolvedSrc}
      alt={alt}
      onError={() => setHasError(true)}
    />
  );
}

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token") || "");
  const [authUser, setAuthUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [message, setMessage] = useState("");
  const [activeView, setActiveView] = useState("dashboard");

  const [registerData, setRegisterData] = useState(EMPTY_REGISTER);
  const [loginData, setLoginData] = useState(EMPTY_LOGIN);
  const [passwordForm, setPasswordForm] = useState(EMPTY_PASSWORD);

  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [users, setUsers] = useState([]);
  const [availability, setAvailability] = useState([]);

  const [adminQuery, setAdminQuery] = useState("");
  const [adminSelectedId, setAdminSelectedId] = useState("");
  const [adminForm, setAdminForm] = useState(EMPTY_ADMIN_EDIT);

  const [newAppointment, setNewAppointment] = useState(EMPTY_APPOINTMENT);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [serviceForm, setServiceForm] = useState(EMPTY_SERVICE_FORM);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userCreateForm, setUserCreateForm] = useState(EMPTY_USER_FORM);

  const isAdmin = authUser?.role === "admin";
  const canManageServices = authUser?.role === "provider" || isAdmin;
  const canCreateAppointments = authUser?.role === "client" || isAdmin;

  const selectedService = services.find((service) => service.id === Number(newAppointment.service_id));

  async function bootstrap(currentToken) {
    try {
      const verified = await api.auth.verify(currentToken);
      setAuthUser(verified);
      const [me, servicesRes, appointmentsRes] = await Promise.all([
        api.users.me(currentToken),
        api.appointments.listServices(),
        api.appointments.myAppointments(currentToken),
      ]);

      setProfile(me);
      setServices(servicesRes.items || []);
      setAppointments(appointmentsRes.items || []);

      if (verified.role === "admin") {
        const usersRes = await api.users.listUsers(currentToken);
        setUsers(usersRes.items || []);
      } else {
        setUsers([]);
      }

      if (verified.role === "provider" || verified.role === "admin") {
        const availabilityRes = await api.appointments.getAvailability(verified.user_id);
        setAvailability(availabilityRes.items || []);
      } else {
        setAvailability([]);
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
    setServices([]);
    setUsers([]);
    setAvailability([]);
    setActiveView("dashboard");
  }

  function openCreateServiceModal() {
    setServiceForm(EMPTY_SERVICE_FORM);
    setServiceModalOpen(true);
  }

  function openEditServiceModal(service) {
    setServiceForm({
      id: service.id,
      name: service.name || "",
      description: service.description || "",
      duration_min: service.duration_min || 30,
      price: service.price || 0,
      start_time: "09:00",
      end_time: "17:00",
      days_of_week: [],
    });
    setServiceModalOpen(true);
  }

  function toggleDay(day) {
    setServiceForm((current) => {
      const exists = current.days_of_week.includes(day);
      const nextDays = exists ? current.days_of_week.filter((item) => item !== day) : [...current.days_of_week, day];
      return { ...current, days_of_week: nextDays.sort((a, b) => a - b) };
    });
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

  async function refreshAdminUsers() {
    if (!token || !isAdmin) return;
    const usersRes = await api.users.listUsers(token);
    setUsers(usersRes.items || []);
  }

  async function refreshServices() {
    const servicesRes = await api.appointments.listServices();
    setServices(servicesRes.items || []);
  }

  async function refreshAppointments() {
    if (!token) return;
    const appointmentsRes = await api.appointments.myAppointments(token);
    setAppointments(appointmentsRes.items || []);
  }

  async function refreshAvailability() {
    if (!token || !authUser || !canManageServices) return;
    const availabilityRes = await api.appointments.getAvailability(authUser.user_id);
    setAvailability(availabilityRes.items || []);
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

  async function saveSettings(event) {
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
      setMessage("Configuracion actualizada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    try {
      await api.auth.changePassword(passwordForm, token);
      setPasswordForm(EMPTY_PASSWORD);
      setMessage("Contrasena actualizada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function submitService(event) {
    event.preventDefault();
    try {
      const payload = {
        name: serviceForm.name,
        description: serviceForm.description,
        duration_min: Number(serviceForm.duration_min),
        price: Number(serviceForm.price),
      };

      if (serviceForm.id) {
        await api.appointments.updateService(serviceForm.id, payload, token);
        setMessage("Servicio actualizado.");
      } else {
        await api.appointments.createService(payload, token);
        if (serviceForm.days_of_week.length > 0) {
          await api.appointments.createAvailability(
            {
              days_of_week: serviceForm.days_of_week,
              start_time: serviceForm.start_time,
              end_time: serviceForm.end_time,
            },
            token
          );
        }
        setMessage("Servicio creado.");
      }

      setServiceModalOpen(false);
      setServiceForm(EMPTY_SERVICE_FORM);
      await Promise.all([refreshServices(), refreshAvailability()]);
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function removeService(id) {
    try {
      await api.appointments.deleteService(id, token);
      await refreshServices();
      setMessage("Servicio eliminado.");
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
      setNewAppointment(EMPTY_APPOINTMENT);
      await refreshAppointments();
      setMessage("Cita creada.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function updateAppointmentStatus(id, status) {
    try {
      await api.appointments.updateStatus(id, { status }, token);
      await refreshAppointments();
      setMessage("Estado actualizado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function cancelAppointment(id) {
    try {
      await api.appointments.cancel(id, token);
      await refreshAppointments();
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
      await refreshAdminUsers();
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

  async function createAdminUser(event) {
    event.preventDefault();
    try {
      await api.users.createAdminUser(userCreateForm, token);
      setUserCreateForm(EMPTY_USER_FORM);
      setUserModalOpen(false);
      await refreshAdminUsers();
      setMessage("Usuario creado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function deleteAdminUser(id) {
    try {
      await api.users.deleteAdminUser(id, token);
      if (String(id) === adminSelectedId) {
        setAdminSelectedId("");
        setAdminForm(EMPTY_ADMIN_EDIT);
      }
      await refreshAdminUsers();
      setMessage("Usuario eliminado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  async function quickToggleUser(user) {
    try {
      await api.users.updateAdminUser(
        user.auth_user_id,
        { is_active: !user.is_active },
        token
      );
      await refreshAdminUsers();
      if (String(user.auth_user_id) === adminSelectedId) {
        setAdminForm((current) => ({ ...current, is_active: !user.is_active }));
      }
      setMessage("Estado del usuario actualizado.");
    } catch (error) {
      setMessage(error.message);
    }
  }

  const filteredUsers = useMemo(() => {
    if (!adminQuery) return users;
    const query = adminQuery.toLowerCase();
    return users.filter((user) =>
      [user.full_name, user.email, user.role, String(user.auth_user_id)].some((field) =>
        String(field || "").toLowerCase().includes(query)
      )
    );
  }, [adminQuery, users]);

  const serviceStats = useMemo(() => {
    const activeServices = services.filter((service) => service.is_active).length;
    return {
      total: services.length,
      active: activeServices,
      availabilityBlocks: availability.length,
    };
  }, [services, availability]);

  const appointmentStats = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter((item) => item.status === "pendiente").length,
      confirmed: appointments.filter((item) => item.status === "confirmada").length,
      completed: appointments.filter((item) => item.status === "completada").length,
    };
  }, [appointments]);

  const dashboardStats = useMemo(
    () => [
      {
        label: "Usuarios",
        value: isAdmin ? users.length : "-",
        helper: isAdmin ? "Activos en la plataforma" : "Solo visible para admin",
        icon: Users,
      },
      {
        label: "Citas",
        value: appointments.length,
        helper: "Movimientos registrados",
        icon: CalendarDays,
      },
      {
        label: "Servicios",
        value: services.length,
        helper: "Catalogo disponible",
        icon: Stethoscope,
      },
      {
        label: "Pendientes",
        value: appointmentStats.pending,
        helper: "Esperando respuesta",
        icon: Clock3,
      },
    ],
    [isAdmin, users.length, appointments.length, services.length, appointmentStats.pending]
  );

  const sidebarItems = useMemo(() => {
    const items = [
      { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
      { id: "appointments", label: "Citas", icon: CalendarDays },
    ];
    if (canManageServices) items.push({ id: "services", label: "Servicios", icon: Stethoscope });
    if (isAdmin) items.push({ id: "users", label: "Usuarios", icon: UserCog });
    items.push({ id: "settings", label: "Configuracion", icon: Settings });
    return items;
  }, [canManageServices, isAdmin]);

  const recentAppointments = useMemo(() => appointments.slice(0, 6), [appointments]);
  const quickInsights = useMemo(
    () => [
      {
        label: "Conversion operativa",
        value: `${appointments.length > 0 ? Math.round((appointmentStats.confirmed / appointments.length) * 100) : 0}%`,
        note: "Citas confirmadas frente al total",
        icon: ChartColumn,
      },
      {
        label: "Actividad admin",
        value: isAdmin ? `${users.filter((item) => item.is_active).length}` : `${appointmentStats.completed}`,
        note: isAdmin ? "Usuarios activos en el sistema" : "Citas completadas",
        icon: ShieldCheck,
      },
      {
        label: "Disponibilidad",
        value: `${availability.length}`,
        note: "Bloques disponibles cargados",
        icon: Activity,
      },
    ],
    [appointments.length, appointmentStats.confirmed, appointmentStats.completed, availability.length, isAdmin, users]
  );

  if (!token || !authUser) {
    return (
      <div className="auth-shell">
        <div className="auth-hero">
          <div className="hero-copy">
            <span className="eyebrow">Sistema de citas</span>
            <h1>Administra usuarios, servicios y citas desde un solo panel.</h1>
            <p className="lead">
              Una vista central para clientes, proveedores y administradores con procesos claros y rapidos.
            </p>
          </div>

          <div className="hero-card">
            {message && <div className="alert">{message}</div>}
            <div className="auth-grid">
              <div className="card">
                <h2>Registro</h2>
                <form className="grid" onSubmit={handleRegister}>
                  <input
                    placeholder="Nombre completo"
                    value={registerData.full_name}
                    onChange={(event) => setRegisterData({ ...registerData, full_name: event.target.value })}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={registerData.email}
                    onChange={(event) => setRegisterData({ ...registerData, email: event.target.value })}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Contrasena"
                    value={registerData.password}
                    onChange={(event) => setRegisterData({ ...registerData, password: event.target.value })}
                    required
                  />
                  <select value={registerData.role} onChange={(event) => setRegisterData({ ...registerData, role: event.target.value })}>
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
                  <input
                    type="email"
                    placeholder="Email"
                    value={loginData.email}
                    onChange={(event) => setLoginData({ ...loginData, email: event.target.value })}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Contrasena"
                    value={loginData.password}
                    onChange={(event) => setLoginData({ ...loginData, password: event.target.value })}
                    required
                  />
                  <button className="secondary">Iniciar sesion</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="sidebar-user" onClick={() => setActiveView("settings")}>
          <Avatar
            src={profile?.avatar_url}
            name={profile?.full_name}
            email={authUser.email}
            alt="avatar"
          />
          <div>
            <strong>{profile?.full_name || authUser.email}</strong>
            <span>{authUser.role}</span>
          </div>
        </button>

        <nav className="side-nav">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeView === item.id ? "active" : ""}`}
              onClick={() => setActiveView(item.id)}
            >
              <item.icon size={18} strokeWidth={2.2} />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar-title">CitasPro Admin</p>
            <p className="topbar-subtitle">Panel central de usuarios, citas y servicios</p>
          </div>
          <div className="topbar-actions">
            <button className="secondary small-btn" onClick={() => setActiveView("settings")}>
              Configuracion
            </button>
            <button className="danger small-btn" onClick={logout}>
              Cerrar sesion
            </button>
          </div>
        </header>

        <main className="main-content">
          {message && <div className="alert">{message}</div>}

          {activeView === "dashboard" && (
            <section className="screen">
              <div className="screen-header">
                <div>
                  <h1>Dashboard general</h1>
                  <p className="muted">Resumen global del sistema y actividad reciente.</p>
                </div>
              </div>

              <div className="hero-strip">
                <div className="hero-strip-copy">
                  <span className="eyebrow">Vista ejecutiva</span>
                  <h2>Monitorea el pulso del sistema con indicadores rapidos.</h2>
                  <p className="muted">
                    Usuarios, agenda, servicios y carga operativa en una sola vista para tomar decisiones mas rapidas.
                  </p>
                </div>
                <div className="hero-strip-badge">
                  <Sparkles size={22} strokeWidth={2.3} />
                  <span>Panel inteligente</span>
                </div>
              </div>

              <div className="stats-grid">
                {dashboardStats.map((stat) => (
                  <article key={stat.label} className="stat-card">
                    <div className="stat-card-top">
                      <div className="stat-icon">
                        <stat.icon size={20} strokeWidth={2.4} />
                      </div>
                      <span>{stat.label}</span>
                    </div>
                    <strong>{stat.value}</strong>
                    <small>{stat.helper}</small>
                  </article>
                ))}
              </div>

              <div className="insights-grid">
                {quickInsights.map((item) => (
                  <article key={item.label} className="insight-card">
                    <div className="insight-icon">
                      <item.icon size={18} strokeWidth={2.4} />
                    </div>
                    <div>
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <p>{item.note}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="panel-grid">
                <article className="card">
                  <div className="section-head">
                    <div className="section-head-title">
                      <CalendarDays size={18} strokeWidth={2.3} />
                      <h3>Citas</h3>
                    </div>
                    <span className="pill-sm">{appointments.length} total</span>
                  </div>
                  <div className="mini-stats">
                    <div>
                      <strong>{appointmentStats.pending}</strong>
                      <span>Pendientes</span>
                    </div>
                    <div>
                      <strong>{appointmentStats.confirmed}</strong>
                      <span>Confirmadas</span>
                    </div>
                    <div>
                      <strong>{appointmentStats.completed}</strong>
                      <span>Completadas</span>
                    </div>
                  </div>
                </article>

                <article className="card">
                  <div className="section-head">
                    <div className="section-head-title">
                      <Stethoscope size={18} strokeWidth={2.3} />
                      <h3>Servicios</h3>
                    </div>
                    <span className="pill-sm">{serviceStats.total} total</span>
                  </div>
                  <div className="mini-stats">
                    <div>
                      <strong>{serviceStats.active}</strong>
                      <span>Activos</span>
                    </div>
                    <div>
                      <strong>{serviceStats.availabilityBlocks}</strong>
                      <span>Bloques</span>
                    </div>
                    <div>
                      <strong>{isAdmin ? users.filter((item) => item.role === "provider").length : "-"}</strong>
                      <span>Proveedores</span>
                    </div>
                  </div>
                </article>
              </div>

              <div className="card">
                <div className="section-head">
                  <div className="section-head-title">
                    <Activity size={18} strokeWidth={2.3} />
                    <h3>Actividad reciente</h3>
                  </div>
                  <button className="ghost-btn" onClick={() => setActiveView("appointments")}>
                    Ver todas las citas
                  </button>
                </div>
                <div className="table-list">
                  {recentAppointments.length > 0 ? (
                    recentAppointments.map((item) => (
                      <div key={item.id} className="table-row">
                        <div>
                          <strong>Cita #{item.id}</strong>
                          <p className="muted">
                            {item.date} {item.start_time} - {item.end_time}
                          </p>
                        </div>
                        <span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="muted">Todavia no hay citas registradas.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeView === "services" && canManageServices && (
            <section className="screen">
              <div className="screen-header">
                <div>
                  <h1>Servicios</h1>
                  <p className="muted">Gestiona tu catalogo y los bloques de disponibilidad.</p>
                </div>
                <button onClick={openCreateServiceModal}>Agregar nuevo servicio</button>
              </div>

              <div className="panel-grid">
                <article className="card">
                  <div className="section-head">
                    <h3>Listado</h3>
                    <span className="pill-sm">{services.length} servicios</span>
                  </div>
                  <div className="table-list">
                    {services.map((service) => (
                      <div key={service.id} className="table-row">
                        <div>
                          <strong>{service.name}</strong>
                          <p className="muted">
                            {service.duration_min} min | RD$ {service.price}
                          </p>
                        </div>
                        <div className="row">
                          <button className="secondary compact-btn" onClick={() => openEditServiceModal(service)}>
                            Editar
                          </button>
                          <button className="danger compact-btn" onClick={() => removeService(service.id)}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))}
                    {services.length === 0 && <p className="muted">Aun no hay servicios creados.</p>}
                  </div>
                </article>

                <article className="card">
                  <div className="section-head">
                    <h3>Disponibilidad</h3>
                    <span className="pill-sm">{availability.length} bloques</span>
                  </div>
                  <div className="table-list">
                    {availability.map((item) => (
                      <div key={item.id} className="table-row">
                        <div>
                          <strong>{DAY_OPTIONS.find((day) => day.value === item.day_of_week)?.label || item.day_of_week}</strong>
                          <p className="muted">
                            {item.start_time} - {item.end_time}
                          </p>
                        </div>
                      </div>
                    ))}
                    {availability.length === 0 && <p className="muted">No hay bloques guardados todavia.</p>}
                  </div>
                </article>
              </div>
            </section>
          )}

          {activeView === "appointments" && (
            <section className="screen">
              <div className="screen-header">
                <div>
                  <h1>Citas</h1>
                  <p className="muted">Controla reservas, estados y detalle de cada turno.</p>
                </div>
              </div>

              {canCreateAppointments && (
                <div className="card booking-card">
                  <div className="section-head">
                    <h3>Nueva cita</h3>
                    <span className="pill-sm">Cliente / Admin</span>
                  </div>
                  <form className="grid two" onSubmit={createAppointment}>
                    <input type="number" placeholder="Provider ID" value={newAppointment.provider_id} readOnly required />
                    <select
                      value={newAppointment.service_id}
                      onChange={(event) => {
                        const nextServiceId = event.target.value;
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
                      <div className="info-card full-span">
                        <p>
                          <strong>{selectedService.name}</strong> | {selectedService.duration_min} min | RD$ {selectedService.price}
                        </p>
                      </div>
                    )}
                    <input
                      type="date"
                      value={newAppointment.date}
                      onChange={(event) => setNewAppointment({ ...newAppointment, date: event.target.value })}
                      required
                    />
                    <input
                      type="time"
                      value={newAppointment.start_time}
                      onChange={(event) => setNewAppointment({ ...newAppointment, start_time: event.target.value })}
                      required
                    />
                    <textarea
                      className="full-span"
                      placeholder="Notas"
                      value={newAppointment.notes}
                      onChange={(event) => setNewAppointment({ ...newAppointment, notes: event.target.value })}
                    />
                    <button className="full-span">Reservar cita</button>
                  </form>
                </div>
              )}

              <div className="card">
                <div className="section-head">
                  <h3>Listado de citas</h3>
                  <span className="pill-sm">{appointments.length} registros</span>
                </div>
                <div className="table-list">
                  {appointments.map((item) => (
                    <div key={item.id} className="appointment-row">
                      <div>
                        <strong>Cita #{item.id}</strong>
                        <p className="muted">
                          Proveedor {item.provider_id} | Cliente {item.client_id}
                        </p>
                        <p className="muted">
                          {item.date} {item.start_time} - {item.end_time}
                        </p>
                      </div>
                      <div className="appointment-actions">
                        <span className={`status-badge status-${item.status}`}>{statusLabel(item.status)}</span>
                        <div className="row">
                          {(authUser.role === "provider" || isAdmin) && item.status === "pendiente" && (
                            <button className="compact-btn" onClick={() => updateAppointmentStatus(item.id, "confirmada")}>
                              Aprobar
                            </button>
                          )}
                          {(authUser.role === "provider" || isAdmin) && item.status === "confirmada" && (
                            <button className="secondary compact-btn" onClick={() => updateAppointmentStatus(item.id, "completada")}>
                              Completar
                            </button>
                          )}
                          {item.status !== "completada" && (
                            <button className="danger compact-btn" onClick={() => cancelAppointment(item.id)}>
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {appointments.length === 0 && <p className="muted">Aun no hay citas.</p>}
                </div>
              </div>
            </section>
          )}

          {activeView === "users" && isAdmin && (
            <section className="screen">
              <div className="screen-header">
                <div>
                  <h1>Usuarios</h1>
                  <p className="muted">CRUD completo con acciones rapidas para administracion.</p>
                </div>
                <button onClick={() => setUserModalOpen(true)}>Agregar usuario</button>
              </div>

              <div className="panel-grid users-grid">
                <article className="card">
                  <div className="section-head">
                    <h3>Directorio</h3>
                    <input
                      className="input-compact"
                      placeholder="Buscar"
                      value={adminQuery}
                      onChange={(event) => setAdminQuery(event.target.value)}
                    />
                  </div>
                  <div className="table-list">
                    {filteredUsers.map((user) => (
                      <div
                        key={user.auth_user_id}
                        className={`user-row ${String(user.auth_user_id) === adminSelectedId ? "selected" : ""}`}
                      >
                        <button className="user-main" onClick={() => selectAdminUser(user)}>
                          <div>
                            <strong>{user.full_name}</strong>
                            <p className="muted">
                              {user.email} | #{user.auth_user_id}
                            </p>
                          </div>
                          <span className={`status-badge ${user.is_active ? "status-confirmada" : "status-cancelada"}`}>
                            {user.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </button>
                        <div className="row quick-row">
                          <button className="secondary compact-btn" onClick={() => quickToggleUser(user)}>
                            {user.is_active ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="card">
                  <div className="section-head">
                    <h3>Editar usuario</h3>
                    <span className="pill-sm">{adminSelectedId ? `ID ${adminSelectedId}` : "Sin seleccion"}</span>
                  </div>
                  <form className="grid" onSubmit={saveAdminUser}>
                    <input
                      placeholder="Nombre completo"
                      value={adminForm.full_name}
                      onChange={(event) => setAdminForm({ ...adminForm, full_name: event.target.value })}
                      required
                    />
                    <input
                      placeholder="Telefono"
                      value={adminForm.phone}
                      onChange={(event) => setAdminForm({ ...adminForm, phone: event.target.value })}
                    />
                    <input
                      placeholder="Avatar URL"
                      value={adminForm.avatar_url}
                      onChange={(event) => setAdminForm({ ...adminForm, avatar_url: event.target.value })}
                    />
                    <select value={adminForm.role} onChange={(event) => setAdminForm({ ...adminForm, role: event.target.value })}>
                      <option value="client">Cliente</option>
                      <option value="provider">Proveedor</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <select
                      value={adminForm.is_active ? "true" : "false"}
                      onChange={(event) => setAdminForm({ ...adminForm, is_active: event.target.value === "true" })}
                    >
                      <option value="true">Activo</option>
                      <option value="false">Inactivo</option>
                    </select>
                    <button type="submit">Guardar cambios</button>
                  </form>
                </article>
              </div>
            </section>
          )}

          {activeView === "settings" && (
            <section className="screen">
              <div className="screen-header">
                <div>
                  <h1>Configuracion</h1>
                  <p className="muted">Tu perfil ahora vive aqui y tambien en el acceso rapido del menu lateral.</p>
                </div>
              </div>

              <div className="settings-layout">
                <article className="card profile-card">
                  <div className="profile-summary">
                    <div className="avatar-wrapper" onClick={() => {
                      const url = prompt("Ingresa la URL de tu foto de perfil:");
                      if (url) setProfile({ ...profile, avatar_url: url });
                    }}>
                      <Avatar
                        src={profile?.avatar_url}
                        name={profile?.full_name}
                        email={authUser.email}
                        alt="avatar"
                      />
                      <div className="avatar-edit-icon">
                        <Camera size={14} />
                      </div>
                    </div>
                    <div>
                      <h3>{profile?.full_name || authUser.email}</h3>
                      <p className="muted">{authUser.email}</p>
                      <span className="pill-sm">{authUser.role}</span>
                    </div>
                  </div>

                  <form className="grid" onSubmit={saveSettings}>
                    <input
                      placeholder="Nombre completo"
                      value={profile?.full_name || ""}
                      onChange={(event) => setProfile({ ...profile, full_name: event.target.value })}
                    />
                    <input
                      placeholder="Telefono"
                      value={profile?.phone || ""}
                      onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
                    />
                    <button>Guardar configuracion</button>
                  </form>
                </article>

                <article className="card">
                  <h3>Seguridad</h3>
                  <form className="grid" onSubmit={changePassword}>
                    <input
                      type="password"
                      placeholder="Contrasena actual"
                      value={passwordForm.current_password}
                      onChange={(event) => setPasswordForm({ ...passwordForm, current_password: event.target.value })}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Nueva contrasena"
                      value={passwordForm.new_password}
                      onChange={(event) => setPasswordForm({ ...passwordForm, new_password: event.target.value })}
                      required
                    />
                    <button className="secondary">Actualizar contrasena</button>
                  </form>
                </article>
              </div>
            </section>
          )}
        </main>
      </div>

      {serviceModalOpen && (
        <div className="modal-backdrop" onClick={() => setServiceModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>{serviceForm.id ? "Editar servicio" : "Nuevo servicio"}</h3>
              <button className="ghost-btn" onClick={() => setServiceModalOpen(false)}>
                Cerrar
              </button>
            </div>
            <form className="grid" onSubmit={submitService}>
              <input
                placeholder="Nombre del servicio"
                value={serviceForm.name}
                onChange={(event) => setServiceForm({ ...serviceForm, name: event.target.value })}
                required
              />
              <textarea
                placeholder="Descripcion"
                value={serviceForm.description}
                onChange={(event) => setServiceForm({ ...serviceForm, description: event.target.value })}
              />
              <div className="grid two">
                <input
                  type="number"
                  placeholder="Duracion"
                  value={serviceForm.duration_min}
                  onChange={(event) => setServiceForm({ ...serviceForm, duration_min: event.target.value })}
                  required
                />
                <input
                  type="number"
                  placeholder="Precio"
                  value={serviceForm.price}
                  onChange={(event) => setServiceForm({ ...serviceForm, price: event.target.value })}
                  required
                />
              </div>

              {!serviceForm.id && (
                <>
                  <div>
                    <p className="field-label">Dias disponibles</p>
                    <div className="days-grid">
                      {DAY_OPTIONS.map((day) => (
                        <button
                          type="button"
                          key={day.value}
                          className={`day-chip ${serviceForm.days_of_week.includes(day.value) ? "selected" : ""}`}
                          onClick={() => toggleDay(day.value)}
                        >
                          {day.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid two">
                    <input
                      type="time"
                      value={serviceForm.start_time}
                      onChange={(event) => setServiceForm({ ...serviceForm, start_time: event.target.value })}
                      required
                    />
                    <input
                      type="time"
                      value={serviceForm.end_time}
                      onChange={(event) => setServiceForm({ ...serviceForm, end_time: event.target.value })}
                      required
                    />
                  </div>
                </>
              )}

              <button>{serviceForm.id ? "Guardar cambios" : "Crear servicio"}</button>
            </form>
          </div>
        </div>
      )}

      {userModalOpen && (
        <div className="modal-backdrop" onClick={() => setUserModalOpen(false)}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-head">
              <h3>Agregar usuario</h3>
              <button className="ghost-btn" onClick={() => setUserModalOpen(false)}>
                Cerrar
              </button>
            </div>
            <form className="grid" onSubmit={createAdminUser}>
              <input
                placeholder="Nombre completo"
                value={userCreateForm.full_name}
                onChange={(event) => setUserCreateForm({ ...userCreateForm, full_name: event.target.value })}
                required
              />
              <input
                type="email"
                placeholder="Email"
                value={userCreateForm.email}
                onChange={(event) => setUserCreateForm({ ...userCreateForm, email: event.target.value })}
                required
              />
              <input
                type="password"
                placeholder="Contrasena temporal"
                value={userCreateForm.password}
                onChange={(event) => setUserCreateForm({ ...userCreateForm, password: event.target.value })}
                required
              />
              <select
                value={userCreateForm.role}
                onChange={(event) => setUserCreateForm({ ...userCreateForm, role: event.target.value })}
              >
                <option value="client">Cliente</option>
                <option value="provider">Proveedor</option>
                <option value="admin">Administrador</option>
              </select>
              <input
                placeholder="Telefono"
                value={userCreateForm.phone}
                onChange={(event) => setUserCreateForm({ ...userCreateForm, phone: event.target.value })}
              />
              <input
                placeholder="Avatar URL"
                value={userCreateForm.avatar_url}
                onChange={(event) => setUserCreateForm({ ...userCreateForm, avatar_url: event.target.value })}
              />
              <button>Crear usuario</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
