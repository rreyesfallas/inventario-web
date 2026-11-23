import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  TbPackage,
  TbUsers,
  TbBriefcase,
  TbCash,
  TbArrowsExchange,
  TbReceipt2,
  TbChartBar,
  TbTruckDelivery,
  TbClipboardCheck,
  TbHistory,
  TbUserCog,
  TbSettings,
  TbWallet,
  TbCoins,
  TbBuildingWarehouse
} from 'react-icons/tb';

import{ FaChartBar,
  FaClipboardCheck
} from 'react-icons/fa'

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
      icono: <TbPackage />,
      color: '#2563eb',
      ruta: '/articulos'
    },

    {
      titulo: 'Clientes',
      descripcion: 'Registro y consulta de clientes',
      icono: <TbUsers />,
      color: '#0891b2',
      ruta: '/clientes'
    },

    {
      titulo: 'Empleados',
      descripcion: 'Administración de empleados',
      icono: <TbBriefcase />,
      color: '#7c3aed',
      ruta: '/empleados'
    },
    
    {
      titulo: 'Efectivo',
      descripcion: 'Control de movimientos de efectivo',
      icono: <TbCash />,
      color: '#16a34a',
      ruta: '/efectivo'
    },

    {
      titulo: 'Transacciones',
      descripcion: 'Abonos, ventas, devoluciones y más',
      icono: <TbArrowsExchange />,
      color: '#ea580c',
      ruta: '/transacciones'
    },

    {
      titulo: 'Informe Cobros',
      descripcion: 'Cobros, abonos y tarjetas por rollo',
      icono: <TbReceipt2 />,
      color: '#0d9488',
      ruta: '/informe-cobros'
    },

    {
      titulo: 'Reportes',
      descripcion: 'Desempeño, estadísticas y más',
      icono: <TbChartBar />,
      color: '#db2777',
      ruta: '/reportes'
    },

    {
      titulo: 'Entradas / Salidas',
      descripcion: 'Movimientos de inventario',
      icono: <TbTruckDelivery />,
      color: '#ca8a04',
      ruta: '/entradas-salidas'
    },

    {
      titulo: 'Inventarios',
      descripcion: 'Toma física y resultado de inventario',
      icono: <FaClipboardCheck />,
      ruta: '/inventarios'
    },

    {
      titulo: 'Historial Clientes',
      descripcion: 'Historial de compras y movimientos',
      icono: <TbHistory />,
      color: '#0284c7',
      ruta: '/historial-clientes'
    },

    {
      titulo: 'Usuarios',
      descripcion: 'Accesos y configuración de usuarios',
      icono: <TbUserCog />,
      color: '#475569',
      ruta: '/usuarios'
    },

    {
      titulo: 'Configuración',
      descripcion: 'Rollos, vehículos, líneas y bodegas',
      icono: <TbSettings />,
      color: '#64748b',
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
      const respuesta = await fetch('/api/dashboard/resumen');
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

    const tarjetasResumen = [
    {
      titulo: 'Clientes activos',
      valor: resumen.clientesActivos,
      icono: <TbUsers />,
      color: '#0891b2'
    },
    {
      titulo: 'Artículos activos',
      valor: resumen.articulosActivos,
      icono: <TbPackage />,
      color: '#2563eb'
    },
    {
      titulo: 'Saldo pendiente',
      valor: formatoMoneda(resumen.saldoPendiente),
      icono: <TbWallet />,
      color: '#dc2626'
    },
    {
      titulo: 'Cobros de hoy',
      valor: formatoMoneda(resumen.cobrosHoy),
      icono: <TbCoins />,
      color: '#16a34a'
    },
    {
      titulo: 'Movimientos inventario hoy',
      valor: resumen.movimientosInventarioHoy,
      icono: <TbBuildingWarehouse />,
      color: '#ca8a04'
    },
    {
      titulo: 'Transacciones hoy',
      valor: resumen.transaccionesHoy,
      icono: <TbArrowsExchange />,
      color: '#ea580c'
    }
  ];

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
          {tarjetasResumen.map((tarjeta) => (
            <div
              key={tarjeta.titulo}
              className="resumen-card"
              style={{ '--color-modulo': tarjeta.color }}
            >
              <div className="resumen-card-icono">{tarjeta.icono}</div>
              <span>{tarjeta.titulo}</span>
              <strong>{tarjeta.valor}</strong>
            </div>
          ))}
        </section>

        <section className="dashboard-menu">
          {opciones.map((opcion) => (
            <button
              key={opcion.titulo}
              className="dashboard-card"
              style={{ '--color-modulo': opcion.color }}
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