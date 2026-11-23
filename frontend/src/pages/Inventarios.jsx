import { useNavigate } from 'react-router-dom';
import './Reportes.css';

// Para agregar una opción nueva (por ejemplo "Aplicar cierre de inventario"),
// basta con sumar un elemento a esta lista y registrar su ruta en el router.
const OPCIONES = [
  {
    ruta: '/inventarios/toma-fisica',
    icono: '📝',
    titulo: 'Ingresar toma física',
    descripcion: 'Digitar lo que realmente se contó de cada artículo en una bodega.'
  },
  {
    ruta: '/inventarios/resultado',
    icono: '📋',
    titulo: 'Resultado de inventario',
    descripcion: 'Existencia del sistema contra la toma física, por bodega.'
  }
];

function Inventarios() {
  const navigate = useNavigate();

  return (
    <div className="reportes-page">
      <header className="reportes-header">
        <h2>Inventarios</h2>
        <button type="button" onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <div className="reportes-menu">
        {OPCIONES.map((opcion) => (
          <button
            key={opcion.ruta}
            type="button"
            className="reportes-menu-btn"
            onClick={() => navigate(opcion.ruta)}
          >
            <span className="reportes-menu-icono">{opcion.icono}</span>
            <span className="reportes-menu-titulo">{opcion.titulo}</span>
            <span className="reportes-menu-descripcion">{opcion.descripcion}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default Inventarios;