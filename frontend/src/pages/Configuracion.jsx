import { useNavigate } from 'react-router-dom';
import './Configuracion.css';

function Configuracion() {
  const navigate = useNavigate();

  const opciones = [
    {
      titulo: 'Rollos',
      descripcion: 'Zonas, rutas y días de cobro',
      ruta: '/rollos',
      icono: '🗂️'
    },
    {
      titulo: 'Vehículos',
      descripcion: 'Vehículos asignados a empleados',
      ruta: '/vehiculos',
      icono: '🚗'
    },
    {
      titulo: 'Líneas de artículo',
      descripcion: 'Clasificación de productos',
      ruta: '/lineas-articulo',
      icono: '🏷️'
    },
    {
      titulo: 'Bodegas',
      descripcion: 'Ubicaciones de inventario',
      ruta: '/bodegas',
      icono: '🏬'
    }
  ];

  return (
    <div className="config-page">
      <header className="config-header">
        <div>
          <h2>Configuración</h2>
          <p>Catálogos generales del sistema</p>
        </div>

        <button onClick={() => navigate('/dashboard')}>
          Volver
        </button>
      </header>

      <section className="config-grid">
        {opciones.map((item) => (
          <div
            key={item.titulo}
            className="config-card"
            onClick={() => navigate(item.ruta)}
          >
            <div className="config-icon">{item.icono}</div>

            <div>
              <h3>{item.titulo}</h3>
              <p>{item.descripcion}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

export default Configuracion;