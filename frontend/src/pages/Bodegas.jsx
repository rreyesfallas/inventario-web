import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Bodegas.css';

function Bodegas() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [bodegaSeleccionada, setBodegaSeleccionada] = useState('');

  const [bodega, setBodega] = useState({
    codigo: '',
    descripcion: ''
  });

  const cargarBodegas = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/bodegas');
      const datos = await respuesta.json();

      setBodegas(datos);
    } catch (error) {
      console.error('Error cargando bodegas:', error);
      alert('Error al cargar bodegas');
    }
  };

  useEffect(() => {
    cargarBodegas();
  }, []);

  const bodegasFiltradas = bodegas.filter((item) => {
    const texto = busqueda.toLowerCase();

    return (
      item.codigo?.toLowerCase().includes(texto) ||
      item.descripcion?.toLowerCase().includes(texto)
    );
  });

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setBodega({
      ...bodega,
      [name]: value
    });
  };

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setBodegaSeleccionada('');

    setBodega({
      codigo: '',
      descripcion: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setBodegaSeleccionada(item.id_bodega);

    setBodega({
      codigo: item.codigo || '',
      descripcion: item.descripcion || ''
    });

    setModalAbierto(true);
  };

  const guardarBodega = async () => {
    if (!bodega.codigo || !bodega.descripcion) {
      alert('Código y descripción son obligatorios');
      return;
    }

    try {
      const url =
        modoModal === 'agregar'
          ? 'http://localhost:3001/api/bodegas'
          : `http://localhost:3001/api/bodegas/${bodegaSeleccionada}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bodega)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar bodega');
        return;
      }

      alert(datos.mensaje);
      setModalAbierto(false);
      cargarBodegas();
    } catch (error) {
      console.error('Error guardando bodega:', error);
      alert('Error al guardar bodega');
    }
  };

  const desactivarBodega = async (idBodega) => {
    const confirmar = confirm('¿Desea desactivar esta bodega?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/bodegas/${idBodega}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar bodega');
        return;
      }

      alert('Bodega desactivada correctamente');
      cargarBodegas();
    } catch (error) {
      console.error('Error desactivando bodega:', error);
      alert('Error al desactivar bodega');
    }
  };

  return (
    <div className="bodegas-page">
      <header className="bodegas-header">
        <h2>Bodegas</h2>
        <button onClick={() => navigate('/configuracion')}>Volver</button>
      </header>

      <button className="btn-agregar" onClick={abrirModalAgregar}>
        Agregar
      </button>

      <section className="bodegas-card">
        <h3>Vista de bodegas</h3>

        <input
          type="text"
          className="buscar"
          placeholder="Buscar por código o descripción"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {bodegasFiltradas.map((item) => (
                <tr key={item.id_bodega}>
                  <td>{item.codigo}</td>
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
                        onClick={() => desactivarBodega(item.id_bodega)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {bodegasFiltradas.length === 0 && (
                <tr>
                  <td colSpan="4" className="sin-datos">
                    No se encontraron bodegas
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
                ? 'Agregar bodega'
                : 'Modificar bodega'}
            </h3>

            <div className="modal-grid">
              <div>
                <label>Código</label>
                <input
                  type="text"
                  name="codigo"
                  value={bodega.codigo}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={bodega.descripcion}
                  onChange={cambiarDato}
                />
              </div>
            </div>

            <div className="modal-acciones">
              <button className="btn-guardar" onClick={guardarBodega}>
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

export default Bodegas;