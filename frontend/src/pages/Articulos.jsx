import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Articulos.css';

function Articulos() {
  const navigate = useNavigate();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [codigoSeleccionado, setCodigoSeleccionado] = useState('');

  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState([]);

   const [articulo, setArticulo] = useState({
    codigo: '',
    id_linea: '',
    descripcion: '',
    precio: ''
  });

    const articulosFiltrados = articulos.filter((item) => {
        const textoBusqueda = busqueda.toLowerCase();

      return (
          item.codigo.toLowerCase().includes(textoBusqueda) ||
          item.descripcion.toLowerCase().includes(textoBusqueda)
      );
    }); 
// hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
  const desactivarArticulo = async (idArticulo) => {  
    const confirmar = confirm('¿Desea desactivar este artículo?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/articulos/${idArticulo}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar artículo');
        return;
      }

      alert('Artículo desactivado correctamente');
      cargarArticulos();
    } catch (error) {
      console.error('Error desactivando artículo:', error);
      alert('Error al desactivar artículo');
    }
  };
  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setCodigoSeleccionado('');

    setArticulo({
      codigo: '',
      id_linea: '',
      descripcion: '',
      precio: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setCodigoSeleccionado(item.id_articulo);

    setArticulo({
      codigo: item.codigo,
      id_linea: item.id_linea || '',
      descripcion: item.descripcion,
      precio: item.precio
    });

    setModalAbierto(true);
  };



  const cerrarModal = () => {
    setModalAbierto(false);
  };

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setArticulo({
      ...articulo,
      [name]: value
    });
  };

  const guardarArticulo = async () => {
  if (articulo.codigo.trim() === '') {
      alert('Debe ingresar el código');
      return;
    }

  if (articulo.descripcion.trim() === '') {
    alert('Debe ingresar la descripción');
    return;
  }

  if (articulo.precio === '') {
    alert('Debe ingresar el precio');
    return;
  }

  if (modoModal === 'agregar') {
    const existeCodigo = articulos.some(
      (item) => item.codigo === articulo.codigo
    );

    if (existeCodigo) {
      alert('Ya existe un artículo con ese código');
      return;
    }
//pppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppp

  const respuesta = await fetch('http://localhost:3001/api/articulos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      codigo: articulo.codigo,
      descripcion: articulo.descripcion,
      id_linea: articulo.id_linea,
      precio: articulo.precio
    })
  });

  const datos = await respuesta.json();
  console.log('Respuesta backend:', datos);

  if (!respuesta.ok) {
    alert(datos.mensaje || 'Error al agregar artículo');
    return;
  }

  alert('Artículo agregado correctamente');
  cerrarModal();
  cargarArticulos();


  } else {
      const respuesta = await fetch(
        `http://localhost:3001/api/articulos/${codigoSeleccionado}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            codigo: articulo.codigo,
            descripcion: articulo.descripcion,
            id_linea: articulo.id_linea,
            precio: articulo.precio
          })
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al modificar artículo');
        return;
      }

      alert('Artículo modificado correctamente');
      cerrarModal();
      cargarArticulos();
  }
  }

  const cargarArticulos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/articulos');
      const datos = await respuesta.json();

      setArticulos(datos);
    } catch (error) {
      console.error('Error cargando artículos:', error);
      alert('Error al cargar los artículos');
    }
  };

  useEffect(() => {
    cargarArticulos();
    cargarLineas();
  }, []);

    const cargarLineas = async () => {
      try {
        const respuesta = await fetch('http://localhost:3001/api/lineas-articulo');
        const datos = await respuesta.json();

        setLineas(datos);
      } catch (error) {
        console.error('Error cargando líneas:', error);
        alert('Error al cargar las líneas');
      }
    };

  return (
    <div className="articulos-page">
      <header className="articulos-header">
        <h2>Artículos</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="articulos-actions">
        <button onClick={abrirModalAgregar}>Agregar</button>
      </section>

      <section className="articulos-lista">
        <h3>Vista de artículos</h3>

        <input
            className="buscar"
            type="text"
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
                      <th>Precio</th>
                      <th>Última compra</th>
                      <th>Último movimiento</th>
                      <th>Acciones</th>
                  </tr>
            </thead>

            <tbody>
                  {articulosFiltrados.map((item) => (
                      <tr key={item.codigo}>
                      <td>{item.codigo}</td>
                      <td>{item.descripcion}</td>
                      <td>{item.precio}</td>
                      <td>{item.ultimaCompra || '-'}</td>
                      <td>{item.ultimoMovimiento || '-'}</td>
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
                              onClick={() => desactivarArticulo(item.id_articulo)}
                          >
                              Desactivar
                          </button>
                          </div>
                      </td>
                      </tr>
                  ))}

                  {articulosFiltrados.length === 0 && (
                      <tr>
                      <td colSpan="6" style={{ textAlign: 'center' }}>
                          No se encontraron artículos
                      </td>
                      </tr>
                  )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="modal-fondo">
          <div className="modal-contenido">
            <div className="modal-header">
              <h3>{modoModal === 'agregar' ? 'Agregar artículo' : 'Modificar artículo'}</h3>
              <button onClick={cerrarModal}>X</button>
            </div>

            <div className="modal-form">
              <div>
                <label>Código</label>
                <input
                  type="text"
                  name="codigo"
                  value={articulo.codigo}
                  onChange={cambiarDato}
                  disabled={modoModal === 'modificar'}
                />
              </div>

              <div>
                <label>Línea</label>
               <select
                  name="id_linea"
                  value={articulo.id_linea}
                  onChange={cambiarDato}
                >
                  <option value="">Seleccione</option>

                  {lineas.map((item) => (
                    <option key={item.id_linea} value={item.id_linea}>
                      {item.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="full">
                <label>Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={articulo.descripcion}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Precio</label>
                <input
                  type="number"
                  name="precio"
                  value={articulo.precio}
                  onChange={cambiarDato}
                />
              </div>
            </div>

            <div className="modal-botones">
              <button onClick={guardarArticulo}>Guardar</button>
              <button onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Articulos;