import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './LineasArticulo.css';

function LineasArticulo() {
  const navigate = useNavigate();

  const [lineas, setLineas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [lineaSeleccionada, setLineaSeleccionada] = useState('');

  const [linea, setLinea] = useState({
    descripcion: ''
  });

  const cargarLineas = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/lineas-articulo');
      const datos = await respuesta.json();

      setLineas(datos);
    } catch (error) {
      console.error('Error cargando líneas:', error);
      alert('Error al cargar líneas de artículo');
    }
  };

  useEffect(() => {
    cargarLineas();
  }, []);

  const lineasFiltradas = lineas.filter((item) => {
    const texto = busqueda.toLowerCase();

    return item.descripcion?.toLowerCase().includes(texto);
  });

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setLinea({
      ...linea,
      [name]: value
    });
  };

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setLineaSeleccionada('');

    setLinea({
      descripcion: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setLineaSeleccionada(item.id_linea);

    setLinea({
      descripcion: item.descripcion || ''
    });

    setModalAbierto(true);
  };

  const guardarLinea = async () => {
    if (!linea.descripcion) {
      alert('La descripción es obligatoria');
      return;
    }

    try {
      const url =
        modoModal === 'agregar'
          ? 'http://localhost:3001/api/lineas-articulo'
          : `http://localhost:3001/api/lineas-articulo/${lineaSeleccionada}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(linea)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar línea');
        return;
      }

      alert(datos.mensaje);
      setModalAbierto(false);
      cargarLineas();
    } catch (error) {
      console.error('Error guardando línea:', error);
      alert('Error al guardar línea');
    }
  };

  const desactivarLinea = async (idLinea) => {
    const confirmar = confirm('¿Desea desactivar esta línea de artículo?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/lineas-articulo/${idLinea}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar línea');
        return;
      }

      alert('Línea de artículo desactivada correctamente');
      cargarLineas();
    } catch (error) {
      console.error('Error desactivando línea:', error);
      alert('Error al desactivar línea');
    }
  };

  return (
    <div className="lineas-page">
      <header className="lineas-header">
        <h2>Líneas de artículo</h2>
        <button onClick={() => navigate('/configuracion')}>Volver</button>
      </header>

      <button className="btn-agregar" onClick={abrirModalAgregar}>
        Agregar
      </button>

      <section className="lineas-card">
        <h3>Vista de líneas de artículo</h3>

        <input
          type="text"
          className="buscar"
          placeholder="Buscar por descripción"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {lineasFiltradas.map((item) => (
                <tr key={item.id_linea}>
                  <td>{item.descripcion}</td>
                  <td>{item.estado}</td>
                  <td>
                    <div className="acciones-tabla">
                      <button
                        className="btn-modificar"
                        onClick={() => abrirModalModificar(item)}
                      >
                        Editar
                      </button>

                      <button
                        className="btn-desactivar"
                        onClick={() => desactivarLinea(item.id_linea)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {lineasFiltradas.length === 0 && (
                <tr>
                  <td colSpan="3" className="sin-datos">
                    No se encontraron líneas de artículo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="modal-fondo">
          <div className="modal">
            <button
              className="btn-cerrar"
              onClick={() => setModalAbierto(false)}
            >
              X
            </button>

            <h3>
              {modoModal === 'agregar'
                ? 'Agregar línea de artículo'
                : 'Modificar línea de artículo'}
            </h3>

            <div className="modal-grid">
              <div className="campo-completo">
                <label>Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={linea.descripcion}
                  onChange={cambiarDato}
                />
              </div>
            </div>

            <div className="modal-acciones">
              <button className="btn-guardar" onClick={guardarLinea}>
                Guardar
              </button>

              <button
                className="btn-cancelar"
                onClick={() => setModalAbierto(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LineasArticulo;