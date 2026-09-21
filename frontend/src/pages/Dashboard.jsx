import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  FaBoxes,
  FaUsers,
  FaUserTie,
  FaMoneyBillWave,
  FaExchangeAlt,
  FaFileInvoiceDollar,
  FaSignInAlt,
  FaHistory,
  FaUserCog
} from 'react-icons/fa';

import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');

    if (!usuarioGuardado) {
      navigate('/login');
      return;
    }

    setUsuario(JSON.parse(usuarioGuardado));
  }, [navigate]);

  const cerrarSesion = () => {
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  const opciones = [
    {
      titulo: 'Artículos',
      descripcion: 'Gestión de productos del inventario',
      icono: <FaBoxes />,
      ruta: '/articulos'
    },
    {
      titulo: 'Clientes',
      descripcion: 'Registro y consulta de clientes',
      icono: <FaUsers />,
      ruta: '/clientes'
    },
    {
      titulo: 'Empleados',
      descripcion: 'Administración de empleados',
      icono: <FaUserTie />,
      ruta: '/empleados'
    },
    {
      titulo: 'Efectivo',
      descripcion: 'Control de movimientos de efectivo',
      icono: <FaMoneyBillWave />,
      ruta: '/efectivo'
    },
    {
      titulo: 'Transacciones',
      descripcion: 'Consulta de operaciones realizadas',
      icono: <FaExchangeAlt />,
      ruta: '/transacciones'
    },
    {
      titulo: 'Informe Cobros',
      descripcion: 'Reportes de cobros y pagos',
      icono: <FaFileInvoiceDollar />,
      ruta: '/informe-cobros'
    },
    {
      titulo: 'Entradas / Salidas',
      descripcion: 'Movimientos de inventario',
      icono: <FaSignInAlt />,
      ruta: '/entradas-salidas'
    },
    {
      titulo: 'Historial Clientes',
      descripcion: 'Historial de compras y movimientos',
      icono: <FaHistory />,
      ruta: '/historial-clientes'
    },
    {
      titulo: 'Usuarios',
      descripcion: 'Accesos y configuración de usuarios',
      icono: <FaUserCog />,
      ruta: '/usuarios'
    },
    {
      titulo: 'Configuración',
      descripcion: 'Catálogos generales del sistema',
      icono: '⚙️',
      ruta: '/configuracion'
    }
  ];

  const abrirOpcion = (ruta) => {
    if (ruta === '#') {
      alert('Módulo pendiente de desarrollar');
      return;
    }

    navigate(ruta);
  };

  const [resumen, setResumen] = useState({
    clientesActivos: 0,
    articulosActivos: 0,
    saldoPendiente: 0,
    cobrosHoy: 0,
    movimientosInventarioHoy: 0,
    transaccionesHoy: 0
  });

  const cargarResumenDashboard = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/dashboard/resumen');
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        console.error(datos.mensaje || 'Error al cargar resumen del dashboard');
        return;
      }

      setResumen(datos);
    } catch (error) {
      console.error('Error cargando resumen del dashboard:', error);
    }
  };

  useEffect(() => {
    cargarResumenDashboard();
  }, []);

  const formatoMoneda = (valor) => {
    const numero = Number(valor || 0);

    return `₡${numero.toLocaleString('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div>
          <h2>Sistema de Inventario</h2>
          <span>Panel administrativo</span>
        </div>

        <div className="dashboard-user">
          <span>Usuario: {usuario?.nombre}</span>
          <button onClick={cerrarSesion}>Salir</button>
        </div>
      </header>

      <main className="dashboard-content">
        <section className="dashboard-title">
          <h1>Menú principal</h1>
          <p>Seleccione una opción para continuar.</p>
        </section>

        <section className="dashboard-resumen">
          <div className="resumen-card">
            <span>Clientes activos</span>
            <strong>{resumen.clientesActivos}</strong>
          </div>

          <div className="resumen-card">
            <span>Artículos activos</span>
            <strong>{resumen.articulosActivos}</strong>
          </div>

          <div className="resumen-card">
            <span>Saldo pendiente</span>
            <strong>{formatoMoneda(resumen.saldoPendiente)}</strong>
          </div>

          <div className="resumen-card">
            <span>Cobros de hoy</span>
            <strong>{formatoMoneda(resumen.cobrosHoy)}</strong>
          </div>

          <div className="resumen-card">
            <span>Movimientos inventario hoy</span>
            <strong>{resumen.movimientosInventarioHoy}</strong>
          </div>

          <div className="resumen-card">
            <span>Transacciones hoy</span>
            <strong>{resumen.transaccionesHoy}</strong>
          </div>
        </section>

        <section className="dashboard-menu">
          {opciones.map((opcion) => (
            <button
              key={opcion.titulo}
              className="dashboard-card"
              onClick={() => abrirOpcion(opcion.ruta)}
            >
              <div className="dashboard-icon">
                {opcion.icono}
              </div>

              <div className="dashboard-card-text">
                <h3>{opcion.titulo}</h3>
                <p>{opcion.descripcion}</p>
              </div>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;