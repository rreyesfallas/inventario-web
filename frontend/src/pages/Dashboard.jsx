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