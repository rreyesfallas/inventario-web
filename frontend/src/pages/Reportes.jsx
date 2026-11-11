import { useNavigate } from 'react-router-dom';
import './Reportes.css';

// Para agregar un reporte nuevo, basta con sumar un elemento a esta lista
// y registrar su ruta en el router.
const REPORTES = [
  {
    ruta: '/reportes/desempeno-empleados',
    icono: '📊',
    titulo: 'Desempeño de empleados',
    descripcion: 'Abonos, ventas y devoluciones por empleado en un rango de fechas.'
  },
  {
    ruta: '/reportes/registrar-tarjetas',
    icono: '🗂️',
    titulo: 'Registrar tarjetas',
    descripcion: 'Digitar las tarjetas de un rollo para detectar tarjetas faltantes.'
  }
];

function Reportes() {
  const navigate = useNavigate();

  return (
    <div className="reportes-page">
      <header className="reportes-header">
        <h2>Reportes</h2>
        <button type="button" onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <div className="reportes-menu">
        {REPORTES.map((reporte) => (
          <button
            key={reporte.ruta}
            type="button"
            className="reportes-menu-btn"
            onClick={() => navigate(reporte.ruta)}
          >
            <span className="reportes-menu-icono">{reporte.icono}</span>
            <span className="reportes-menu-titulo">{reporte.titulo}</span>
            <span className="reportes-menu-descripcion">{reporte.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Reportes;
