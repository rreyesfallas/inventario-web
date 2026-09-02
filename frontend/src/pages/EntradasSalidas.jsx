import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './EntradasSalidas.css';

function EntradasSalidas() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [existencias, setExistencias] = useState([]);
  const [busquedaExistencia, setBusquedaExistencia] = useState('');
  const [modalExistenciasAbierto, setModalExistenciasAbierto] = useState(false);
  const [modalArticulosAbierto, setModalArticulosAbierto] = useState(false);
  const [busquedaArticuloVista, setBusquedaArticuloVista] = useState('');

  const [lineaFiltroVista, setLineaFiltroVista] = useState('');
  
  const [modalMovimientosAbierto, setModalMovimientosAbierto] = useState(false);
  const [modalDetalleMovimientoAbierto, setModalDetalleMovimientoAbierto] = useState(false);

  const [movimientos, setMovimientos] = useState([]);
  const [detalleMovimiento, setDetalleMovimiento] = useState([]); 
  const [busquedaMovimiento, setBusquedaMovimiento] = useState('');
  const [movimientoSeleccionado, setMovimientoSeleccionado] = useState(null);


  const [movimiento, setMovimiento] = useState({
    numero_boleta: '',
    id_bodega: '',
    fecha: new Date().toISOString().slice(0, 10),
    tipo_movimiento: 'E'
  });

  const [detalleActual, setDetalleActual] = useState({
    id_articulo: '',
    cantidad: '',
    precio: ''
  });

  const [detalle, setDetalle] = useState([]);

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

  const cargarArticulos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/articulos');
      const datos = await respuesta.json();
      setArticulos(datos);
    } catch (error) {
      console.error('Error cargando artículos:', error);
      alert('Error al cargar artículos');
    }
  };

  const cargarExistencias = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/movimientos-inventario/existencias');
      const datos = await respuesta.json();

      setExistencias(datos);
    } catch (error) {
      console.error('Error cargando existencias:', error);
      alert('Error al cargar existencias');
    }
  };

  const cargarMovimientos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/movimientos-inventario');
      const datos = await respuesta.json();

      setMovimientos(datos);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      alert('Error al cargar movimientos');
    }
  };

  const verDetalleMovimiento = async (item) => {
    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/movimientos-inventario/${item.id_movimiento}/detalle`
      );

      const datos = await respuesta.json();

      setMovimientoSeleccionado(item);
      setDetalleMovimiento(datos);
      setModalDetalleMovimientoAbierto(true);
    } catch (error) {
      console.error('Error cargando detalle del movimiento:', error);
      alert('Error al cargar detalle del movimiento');
    }
  };

  useEffect(() => {
    cargarBodegas();
    cargarArticulos();
    cargarExistencias();
    cargarMovimientos();
  }, []);

  const cambiarMovimiento = (e) => {
    const { name, value } = e.target;

    setMovimiento({
      ...movimiento,
      [name]: value
    });
  };

  const cambiarDetalleActual = (e) => {
    const { name, value } = e.target;

    if (name === 'id_articulo') {
      const articuloSeleccionado = articulos.find(
        (item) => String(item.id_articulo) === String(value)
      );

      setDetalleActual({
        ...detalleActual,
        id_articulo: value,
        precio: articuloSeleccionado ? articuloSeleccionado.precio : ''
      });

      return;
    }

    setDetalleActual({
      ...detalleActual,
      [name]: value
    });
  };

  const seleccionarArticuloVista = (item) => {
    setDetalleActual({
      ...detalleActual,
      id_articulo: item.id_articulo,
      precio: item.precio
    });

    setModalArticulosAbierto(false);
    setBusquedaArticuloVista('');
    setLineaFiltroVista('');
  };

  const agregarDetalle = () => {
    if (!detalleActual.id_articulo || !detalleActual.cantidad || !detalleActual.precio) {
      alert('Seleccione artículo, cantidad y precio');
      return;
    }

    const articuloSeleccionado = articulos.find(
      (item) => String(item.id_articulo) === String(detalleActual.id_articulo)
    );

    if (!articuloSeleccionado) {
      alert('Artículo no válido');
      return;
    }

    const cantidad = Number(detalleActual.cantidad);
    const precio = Number(detalleActual.precio);

    if (cantidad <= 0 || precio < 0) {
      alert('Cantidad o precio inválido');
      return;
    }

    const yaExiste = detalle.some(
      (item) => String(item.id_articulo) === String(detalleActual.id_articulo)
    );

    if (yaExiste) {
      alert('Ese artículo ya fue agregado al detalle');
      return;
    }

    const nuevoDetalle = {
      id_articulo: Number(detalleActual.id_articulo),
      codigo: articuloSeleccionado.codigo,
      descripcion: articuloSeleccionado.descripcion,
      cantidad,
      precio,
      subtotal: cantidad * precio
    };

    setDetalle([...detalle, nuevoDetalle]);

    setDetalleActual({
      id_articulo: '',
      cantidad: '',
      precio: ''
    });
  };

  const eliminarDetalle = (idArticulo) => {
    const nuevoDetalle = detalle.filter(
      (item) => item.id_articulo !== idArticulo
    );

    setDetalle(nuevoDetalle);
  };

  const total = detalle.reduce((acum, item) => acum + item.subtotal, 0);  

  const lineasVista = [
    ...new Set(
      articulos
        .map((item) => item.linea)
        .filter((linea) => linea && linea.trim() !== '')
    )
  ];

  const existenciasFiltradas = existencias.filter((item) => {
    const texto = busquedaExistencia.toLowerCase();

    return (
      item.codigo_bodega?.toLowerCase().includes(texto) ||
      item.bodega?.toLowerCase().includes(texto) ||
      item.codigo_articulo?.toLowerCase().includes(texto) ||
      item.articulo?.toLowerCase().includes(texto)
    );
 });

 const movimientosFiltrados = movimientos.filter((item) => {
    const texto = busquedaMovimiento.toLowerCase();

    return (
      item.numero_boleta?.toLowerCase().includes(texto) ||
      item.bodega?.toLowerCase().includes(texto) ||
      item.codigo_bodega?.toLowerCase().includes(texto) ||
      item.tipo_movimiento_descripcion?.toLowerCase().includes(texto)
    );
  });

  const articulosFiltradosVista = articulos.filter((item) => {
    const texto = busquedaArticuloVista.toLowerCase();

    const coincideBusqueda =
      item.codigo?.toLowerCase().includes(texto) ||
      item.descripcion?.toLowerCase().includes(texto) ||
      item.linea?.toLowerCase().includes(texto);

    const coincideLinea =
      lineaFiltroVista === '' || item.linea === lineaFiltroVista;

    return coincideBusqueda && coincideLinea;
  }); 

  

  const guardarMovimiento = async () => {
    if (!movimiento.numero_boleta || !movimiento.id_bodega || !movimiento.fecha || !movimiento.tipo_movimiento) {
      alert('Complete los datos de la boleta');
      return;
    }

    if (detalle.length === 0) {
      alert('Debe agregar al menos un artículo');
      return;
    }

    try {
      const respuesta = await fetch('http://localhost:3001/api/movimientos-inventario', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...movimiento,
          detalle
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar movimiento');
        return;
      }

      alert(datos.mensaje);

      setMovimiento({
        numero_boleta: '',
        id_bodega: '',
        fecha: new Date().toISOString().slice(0, 10),
        tipo_movimiento: 'E'
      });

      setDetalle([]);

      setDetalleActual({
        id_articulo: '',
        cantidad: '',
        precio: ''
      });

      cargarExistencias();
      
    } catch (error) {
      console.error('Error guardando movimiento:', error);
      alert('Error al guardar movimiento');
    }
  };

  const formatoMoneda = (valor) => {
    return Number(valor || 0).toLocaleString('es-CR', {
      style: 'currency',
      currency: 'CRC'
    });
  };

  return (
    <div className="entradas-page">
      <header className="entradas-header">
        <h2>Entradas / Salidas</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>



    <div className="barra-acciones">
      <button
        className="btn-vista"
        onClick={() => setModalExistenciasAbierto(true)}
      >
        Vista de existencias
      </button>

      <button
        className="btn-vista"
        onClick={() => setModalMovimientosAbierto(true)}
      >
        Vista de movimientos
      </button>
    </div>

      <section className="entradas-card">
        <h3>Datos de la boleta</h3>

        <div className="form-grid">
          <div>
            <label>Número de boleta</label>
            <input
              type="text"
              name="numero_boleta"
              value={movimiento.numero_boleta}
              onChange={cambiarMovimiento}
            />
          </div>

          <div>
            <label>Bodega</label>
            <select
              name="id_bodega"
              value={movimiento.id_bodega}
              onChange={cambiarMovimiento}
            >
              <option value="">Seleccione</option>
              {bodegas.map((item) => (
                <option key={item.id_bodega} value={item.id_bodega}>
                  {item.codigo} - {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Fecha</label>
            <input
              type="date"
              name="fecha"
              value={movimiento.fecha}
              onChange={cambiarMovimiento}
            />
          </div>

          <div>
            <label>Tipo de movimiento</label>
            <select
              name="tipo_movimiento"
              value={movimiento.tipo_movimiento}
              onChange={cambiarMovimiento}
            >
              <option value="E">Entrada</option>
              <option value="S">Salida</option>
            </select>
          </div>
        </div>
      </section>

      <section className="entradas-card">
        <h3>Agregar artículo</h3>

        <div className="form-grid detalle-grid">
          <div>
            <label>Artículo</label>

            <div className="campo-con-boton">
              <select
                name="id_articulo"
                value={detalleActual.id_articulo}
                onChange={cambiarDetalleActual}
              >
                <option value="">Seleccione</option>
                {articulos.map((item) => (
                  <option key={item.id_articulo} value={item.id_articulo}>
                    {item.codigo} - {item.descripcion}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-vista-articulos"
                onClick={() => setModalArticulosAbierto(true)}
              >
                Vista
              </button>
            </div>
          </div>

          <div>
            <label>Cantidad</label>
            <input
              type="number"
              name="cantidad"
              value={detalleActual.cantidad}
              onChange={cambiarDetalleActual}
              min="0"
            />
          </div>

          <div>
            <label>Precio</label>
            <input
              type="number"
              name="precio"
              value={detalleActual.precio}
              onChange={cambiarDetalleActual}
              min="0"
            />
          </div>

          <div className="detalle-boton">
            <button onClick={agregarDetalle}>Agregar artículo</button>
          </div>
        </div>
      </section>

      <section className="entradas-card">
        <h3>Detalle de la boleta</h3>

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Artículo</th>
                <th>Cantidad</th>
                <th>Precio</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {detalle.map((item) => (
                <tr key={item.id_articulo}>
                  <td>{item.codigo}</td>
                  <td>{item.descripcion}</td>
                  <td>{item.cantidad}</td>
                  <td>{formatoMoneda(item.precio)}</td>
                  <td>{formatoMoneda(item.subtotal)}</td>
                  <td>
                    <button
                      className="btn-eliminar"
                      onClick={() => eliminarDetalle(item.id_articulo)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {detalle.length === 0 && (
                <tr>
                  <td colSpan="6" className="sin-datos">
                    No hay artículos agregados
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan="4" className="total-label">
                  Total
                </td>
                <td className="total-valor">{formatoMoneda(total)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="acciones-finales">
          <button className="btn-guardar" onClick={guardarMovimiento}>
            Guardar movimiento
          </button>
        </div>
      </section>

      {modalExistenciasAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalExistenciasAbierto(false)}
            >
              X
            </button>

            <h3>Vista de existencias actuales</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por bodega, código o artículo"
              value={busquedaExistencia}
              onChange={(e) => setBusquedaExistencia(e.target.value)}
            />

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Bodega</th>
                    <th>Código artículo</th>
                    <th>Artículo</th>
                    <th>Existencia</th>
                    <th>Última actualización</th>
                  </tr>
                </thead>

                <tbody>
                  {existenciasFiltradas.map((item) => (
                    <tr key={item.id_existencia}>
                      <td>{item.codigo_bodega} - {item.bodega}</td>
                      <td>{item.codigo_articulo}</td>
                      <td>{item.articulo}</td>
                      <td>{Number(item.existencia).toFixed(2)}</td>
                      <td>
                        {item.fecha_actualizacion
                          ? new Date(item.fecha_actualizacion).toLocaleString('es-CR')
                          : '-'}
                      </td>
                    </tr>
                  ))}

                  {existenciasFiltradas.length === 0 && (
                    <tr>
                      <td colSpan="5" className="sin-datos">
                        No hay existencias registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalArticulosAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => {
                setModalArticulosAbierto(false);
                setBusquedaArticuloVista('');
                setLineaFiltroVista('');
              }}
            >
              X
            </button>

            <h3>Vista de artículos</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por código, descripción o línea"
              value={busquedaArticuloVista}
              onChange={(e) => setBusquedaArticuloVista(e.target.value)}
            />

            <select
              className="buscar"
              value={lineaFiltroVista}
              onChange={(e) => setLineaFiltroVista(e.target.value)}
            >
              <option value="">Todas las líneas</option>

              {lineasVista.map((linea) => (
                <option key={linea} value={linea}>
                  {linea}
                </option>
              ))}
            </select>

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Línea</th>
                    <th>Precio</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {articulosFiltradosVista.map((item) => (
                    <tr key={item.id_articulo}>
                      <td>{item.codigo}</td>
                      <td>{item.descripcion}</td>
                      <td>{item.linea || '-'}</td>
                      <td>{formatoMoneda(item.precio)}</td>
                      <td>
                        <button
                          className="btn-seleccionar"
                          onClick={() => seleccionarArticuloVista(item)}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {articulosFiltradosVista.length === 0 && (
                    <tr>
                      <td colSpan="5" className="sin-datos">
                        No se encontraron artículos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalMovimientosAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalMovimientosAbierto(false)}
            >
              X
            </button>

            <h3>Vista de movimientos</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por boleta, bodega o tipo"
              value={busquedaMovimiento}
              onChange={(e) => setBusquedaMovimiento(e.target.value)}
            />

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Boleta</th>
                    <th>Fecha</th>
                    <th>Bodega</th>
                    <th>Tipo</th>
                    <th>Total</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {movimientosFiltrados.map((item) => (
                    <tr key={item.id_movimiento}>
                      <td>{item.numero_boleta}</td>
                      <td>{new Date(item.fecha).toLocaleDateString('es-CR')}</td>
                      <td>{item.codigo_bodega} - {item.bodega}</td>
                      <td>{item.tipo_movimiento_descripcion}</td>
                      <td>{formatoMoneda(item.total)}</td>
                      <td>
                        <button
                          className="btn-seleccionar"
                          onClick={() => verDetalleMovimiento(item)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}

                  {movimientosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="sin-datos">
                        No hay movimientos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalDetalleMovimientoAbierto && movimientoSeleccionado && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalDetalleMovimientoAbierto(false)}
            >
              X
            </button>

            <h3>Detalle del movimiento</h3>

            <div className="detalle-info">
              <p><strong>Boleta:</strong> {movimientoSeleccionado.numero_boleta}</p>
              <p><strong>Bodega:</strong> {movimientoSeleccionado.codigo_bodega} - {movimientoSeleccionado.bodega}</p>
              <p><strong>Tipo:</strong> {movimientoSeleccionado.tipo_movimiento_descripcion}</p>
              <p><strong>Total:</strong> {formatoMoneda(movimientoSeleccionado.total)}</p>
            </div>

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Artículo</th>
                    <th>Cantidad</th>
                    <th>Precio</th>
                    <th>Subtotal</th>
                  </tr>
                </thead>

                <tbody>
                  {detalleMovimiento.map((item) => (
                    <tr key={item.id_detalle}>
                      <td>{item.codigo_articulo}</td>
                      <td>{item.articulo}</td>
                      <td>{Number(item.cantidad).toFixed(2)}</td>
                      <td>{formatoMoneda(item.precio)}</td>
                      <td>{formatoMoneda(item.subtotal)}</td>
                    </tr>
                  ))}

                  {detalleMovimiento.length === 0 && (
                    <tr>
                      <td colSpan="5" className="sin-datos">
                        No hay detalle para este movimiento
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EntradasSalidas;