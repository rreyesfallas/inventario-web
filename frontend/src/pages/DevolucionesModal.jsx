import { useEffect, useRef, useState } from 'react';
import './DevolucionesModal.css';

// Fecha local (evita que después de las 6 p.m. en Costa Rica salga el día siguiente).
const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

const redondear = (valor) => Math.round(Number(valor) * 100) / 100;

const formatoMoneda = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' });

const mostrarFecha = (fecha) => {
  const texto = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${Number(dia)}/${Number(mes)}/${anio}`;
};

function DevolucionesModal({
  cliente,
  rollo,
  empleados,
  empleadoInicial,
  onCerrar,
  onGuardado
}) {
  const [lineasVenta, setLineasVenta] = useState([]);
  const [cargandoLineas, setCargandoLineas] = useState(true);
  const [bodegas, setBodegas] = useState([]);

  const [lineaSeleccionada, setLineaSeleccionada] = useState(null);
  const [cantidad, setCantidad] = useState('');

  const [detalle, setDetalle] = useState([]);
  const [claveDetalleSeleccionada, setClaveDetalleSeleccionada] = useState(null);

  const [boleta, setBoleta] = useState('');
  const [fecha, setFecha] = useState(fechaLocalHoy());
  const [codigoBodega, setCodigoBodega] = useState('');
  const [codigoEmpleado, setCodigoEmpleado] = useState(
    empleadoInicial ? String(empleadoInicial.codigo) : ''
  );
  const [saldoCliente, setSaldoCliente] = useState(Number(cliente.saldo_actual || 0));
  const [guardando, setGuardando] = useState(false);

  const cantidadRef = useRef(null);
  const boletaRef = useRef(null);
  const bodegaRef = useRef(null);
  const empleadoRef = useRef(null);

  const cargarLineasVenta = async (signal) => {
    setCargandoLineas(true);
    try {
      const respuesta = await fetch(
        `/api/transacciones/devolucion/cliente/${cliente.id_cliente}/ventas`,
        { signal }
      );
      if (!respuesta.ok) throw new Error('No se pudieron consultar las ventas');
      const datos = await respuesta.json();
      if (!signal?.aborted) setLineasVenta(Array.isArray(datos) ? datos : []);
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error cargando ventas del cliente:', error);
      setLineasVenta([]);
    } finally {
      if (!signal?.aborted) setCargandoLineas(false);
    }
  };

  const cargarBoletaSugerida = async (signal) => {
    try {
      const respuesta = await fetch('/api/transacciones/devolucion/boleta-sugerida', { signal });
      if (!respuesta.ok) return;
      const datos = await respuesta.json();
      if (!signal?.aborted) setBoleta(String(datos.numero_boleta || ''));
    } catch (error) {
      if (error.name !== 'AbortError') console.error('Error obteniendo boleta:', error);
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    cargarLineasVenta(controller.signal);
    cargarBoletaSugerida(controller.signal);

    fetch('/api/bodegas', { signal: controller.signal })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((datos) => setBodegas(Array.isArray(datos) ? datos : []))
      .catch((error) => {
        if (error.name !== 'AbortError') console.error('Error cargando bodegas:', error);
      });

    return () => controller.abort();
  }, [cliente.id_cliente]);

  // Cantidades ya agregadas a la lista, aún sin guardar.
  const cantidadEnDetalle = (idVentaDetalle) =>
    detalle
      .filter((item) => item.id_venta_detalle === idVentaDetalle)
      .reduce((suma, item) => suma + item.cantidad, 0);

  const disponibleDe = (linea) =>
    redondear(Number(linea.cantidad_disponible) - cantidadEnDetalle(linea.id_venta_detalle));

  const bodega = bodegas.find(
    (item) =>
      String(item.codigo || '').trim().toLowerCase() === codigoBodega.trim().toLowerCase() &&
      (!item.estado || item.estado === 'A')
  );

  const empleado = empleados.find(
    (item) =>
      String(item.codigo || '').trim().toLowerCase() === codigoEmpleado.trim().toLowerCase() &&
      item.estado === 'A'
  );

  const cantidadNumero = Number(cantidad);
  const subtotalSeleccion =
    lineaSeleccionada && Number.isFinite(cantidadNumero) && cantidadNumero > 0
      ? redondear(cantidadNumero * Number(lineaSeleccionada.precio_unitario))
      : 0;

  const totalDevolucion = redondear(detalle.reduce((suma, item) => suma + item.subtotal, 0));

  const seleccionarLinea = (linea) => {
    if (disponibleDe(linea) <= 0) {
      alert('Este artículo ya fue devuelto en su totalidad');
      return;
    }

    setLineaSeleccionada(linea);
    setCantidad('');

    // Sugerir la bodega de la venta si todavía no se ha indicado una.
    if (!codigoBodega && linea.codigo_bodega) {
      setCodigoBodega(String(linea.codigo_bodega));
    }

    setTimeout(() => cantidadRef.current?.focus(), 0);
  };

  const agregarAlDetalle = () => {
    if (!lineaSeleccionada) {
      alert('Seleccione en la tabla superior el artículo que desea devolver');
      return;
    }

    const disponible = disponibleDe(lineaSeleccionada);

    if (
      !Number.isFinite(cantidadNumero) ||
      cantidadNumero <= 0 ||
      Math.abs(cantidadNumero * 100 - Math.round(cantidadNumero * 100)) > 0.000001
    ) {
      alert('Digite una cantidad mayor a cero (máximo dos decimales)');
      cantidadRef.current?.focus();
      return;
    }

    if (cantidadNumero > disponible) {
      alert(`Solo se pueden devolver ${disponible} unidad(es) de este artículo`);
      cantidadRef.current?.focus();
      return;
    }

    setDetalle((anterior) => [
      ...anterior,
      {
        clave: `${lineaSeleccionada.id_venta_detalle}-${Date.now()}`,
        id_venta_detalle: lineaSeleccionada.id_venta_detalle,
        codigo_articulo: lineaSeleccionada.codigo_articulo,
        articulo: lineaSeleccionada.articulo,
        precio_unitario: Number(lineaSeleccionada.precio_unitario),
        cantidad: cantidadNumero,
        subtotal: subtotalSeleccion,
        boleta_venta: lineaSeleccionada.numero_boleta
      }
    ]);

    setLineaSeleccionada(null);
    setCantidad('');
    boletaRef.current?.focus();
  };

const eliminarDelDetalle = () => {
  if (detalle.length === 0) return;

  // Si solo hay un artículo, se quita sin necesidad de seleccionarlo.
  const claveAQuitar =
    claveDetalleSeleccionada || (detalle.length === 1 ? detalle[0].clave : null);

  if (!claveAQuitar) {
    alert('Haga clic en la fila del artículo que desea quitar');
    return;
  }

  setDetalle((anterior) => anterior.filter((item) => item.clave !== claveAQuitar));
  setClaveDetalleSeleccionada(null);
};

  const guardarDevolucion = async () => {
    if (guardando) return;

    if (detalle.length === 0) {
      alert('Agregue al menos un artículo a la devolución');
      return;
    }
    if (!boleta.trim()) {
      alert('Digite el número de boleta');
      boletaRef.current?.focus();
      return;
    }
    if (!fecha) {
      alert('Seleccione la fecha de la devolución');
      return;
    }
    if (!bodega) {
      alert('Digite el código de una bodega activa');
      bodegaRef.current?.focus();
      return;
    }
    if (!empleado) {
      alert('Digite el código de un empleado activo');
      empleadoRef.current?.focus();
      return;
    }
    if (totalDevolucion > saldoCliente) {
      alert('La devolución no puede ser mayor al saldo actual del cliente');
      return;
    }

    try {
      setGuardando(true);

      const respuesta = await fetch('/api/transacciones/devolucion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cliente: cliente.id_cliente,
          id_rollo: rollo.id_rollo,
          id_empleado: empleado.id_empleado,
          id_bodega: bodega.id_bodega,
          numero_boleta: boleta.trim(),
          fecha,
          detalle: detalle.map((item) => ({
            id_venta_detalle: item.id_venta_detalle,
            cantidad: item.cantidad
          }))
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo registrar la devolución');
        return;
      }

      setSaldoCliente(Number(datos.saldo_nuevo));
      setDetalle([]);
      setClaveDetalleSeleccionada(null);
      setLineaSeleccionada(null);
      setCantidad('');

      await Promise.all([cargarLineasVenta(), cargarBoletaSugerida()]);

      onGuardado?.(datos);
      alert(datos.mensaje || 'Devolución registrada correctamente');
    } catch (error) {
      console.error('Error registrando devolución:', error);
      alert('No se pudo registrar la devolución');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="modal-fondo">
      <div
        className="modal-vista modal-devoluciones"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-devoluciones"
      >
        <button type="button" className="btn-cerrar" disabled={guardando} onClick={onCerrar}>
          X
        </button>

        <h3 id="titulo-devoluciones">Devoluciones</h3>

        <div className="cliente-info">
          <p><strong>Código:</strong> {cliente.codigo}</p>
          <p><strong>Cliente:</strong> {cliente.nombre}</p>
          <p><strong>Rollo:</strong> {rollo.numero} - {rollo.descripcion}</p>
          <p><strong>Saldo actual:</strong> {formatoMoneda(saldoCliente)}</p>
        </div>

        {/* VENTAS DEL CLIENTE */}
        <h4>Ventas del cliente</h4>
        <div className="tabla-contenedor devoluciones-tabla-ventas">
          <table>
            <thead>
              <tr>
                <th>Boleta</th>
                <th>Fecha</th>
                <th>Cód. artículo</th>
                <th>Descripción</th>
                <th>P. Venta</th>
                <th>Cant.</th>
                <th>Dev.</th>
              </tr>
            </thead>
            <tbody>
              {cargandoLineas ? (
                <tr><td colSpan="7" className="sin-datos">Cargando ventas...</td></tr>
              ) : lineasVenta.length === 0 ? (
                <tr><td colSpan="7" className="sin-datos">Este cliente no tiene ventas activas.</td></tr>
              ) : (
                lineasVenta.map((linea) => {
                  const devuelto = redondear(
                    Number(linea.cantidad_devuelta) + cantidadEnDetalle(linea.id_venta_detalle)
                  );
                  const agotada = disponibleDe(linea) <= 0;
                  const seleccionada =
                    lineaSeleccionada?.id_venta_detalle === linea.id_venta_detalle;

                  return (
                    <tr
                      key={linea.id_venta_detalle}
                      className={[
                        'fila-clickable',
                        seleccionada ? 'fila-seleccionada' : '',
                        agotada ? 'fila-agotada' : ''
                      ].join(' ')}
                      onClick={() => seleccionarLinea(linea)}
                      title={agotada ? 'Artículo devuelto en su totalidad' : 'Clic para devolver'}
                    >
                      <td>{linea.numero_boleta}</td>
                      <td>{mostrarFecha(linea.fecha)}</td>
                      <td>{linea.codigo_articulo}</td>
                      <td>{linea.articulo}</td>
                      <td>{formatoMoneda(linea.precio_unitario)}</td>
                      <td>{Number(linea.cantidad)}</td>
                      <td>{devuelto}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* DETALLE DE LA DEVOLUCIÓN */}
        <h4>Detalles de la devolución</h4>
        <div className="form-grid devoluciones-grid">
          <div>
            <label>Cód. artículo</label>
            <input type="text" readOnly value={lineaSeleccionada?.codigo_articulo || ''} />
          </div>
          <div className="campo-doble">
            <label>Descripción</label>
            <input type="text" readOnly value={lineaSeleccionada?.articulo || ''} />
          </div>
          <div>
            <label>P. Devol.</label>
            <input
              type="text"
              readOnly
              value={lineaSeleccionada ? formatoMoneda(lineaSeleccionada.precio_unitario) : ''}
            />
          </div>
          <div>
            <label>
              Cantidad {lineaSeleccionada ? `(máx. ${disponibleDe(lineaSeleccionada)})` : ''}
            </label>
            <input
              ref={cantidadRef}
              type="number"
              min="0.01"
              step="0.01"
              value={cantidad}
              disabled={!lineaSeleccionada}
              placeholder="Cantidad a devolver"
              onChange={(e) => setCantidad(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarAlDetalle();
                }
              }}
            />
          </div>
          <div>
            <label>ST. Venta</label>
            <input type="text" readOnly value={subtotalSeleccion ? formatoMoneda(subtotalSeleccion) : ''} />
          </div>
        </div>

        <div className="form-grid devoluciones-grid">
          <div>
            <label>Boleta</label>
            <input
              ref={boletaRef}
              type="text"
              maxLength={20}
              value={boleta}
              placeholder="Número de boleta"
              onChange={(e) => setBoleta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  bodegaRef.current?.focus();
                }
              }}
            />
          </div>
          <div>
            <label>Fecha</label>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          </div>
          <div>
            <label>Cód. bodega</label>
            <input
              ref={bodegaRef}
              type="text"
              value={codigoBodega}
              placeholder="Código de bodega"
              onChange={(e) => setCodigoBodega(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (!bodega) {
                  alert('Digite el código de una bodega activa');
                  return;
                }
                empleadoRef.current?.focus();
              }}
            />
          </div>
          <div>
            <label>Descripción bodega</label>
            <input type="text" readOnly value={bodega?.descripcion || ''} placeholder="Automático" />
          </div>
          <div>
            <label>Cód. empleado</label>
            <input
              ref={empleadoRef}
              type="text"
              value={codigoEmpleado}
              placeholder="Código del empleado"
              onChange={(e) => setCodigoEmpleado(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (!empleado) {
                  alert('Digite el código de un empleado activo');
                  return;
                }
                guardarDevolucion();
              }}
            />
          </div>
          <div>
            <label>Nombre empleado</label>
            <input type="text" readOnly value={empleado?.nombre || ''} placeholder="Automático" />
          </div>
        </div>

        {/* ARTÍCULOS A DEVOLVER */}
        <div className="tabla-contenedor devoluciones-tabla-detalle">
          <table>
            <thead>
              <tr>
                <th>Cód. artículo</th>
                <th>Descripción</th>
                <th>P. Venta</th>
                <th>Cant.</th>
                <th>Subtotal</th>
                <th>Boleta</th>
              </tr>
            </thead>
            <tbody>
              {detalle.length === 0 ? (
                <tr>
                  <td colSpan="6" className="sin-datos">
                    Seleccione un artículo arriba, digite la cantidad y presione Enter.
                  </td>
                </tr>
              ) : (
                detalle.map((item) => (
                  <tr
                    key={item.clave}
                    className={[
                      'fila-clickable',
                      claveDetalleSeleccionada === item.clave ? 'fila-seleccionada' : ''
                    ].join(' ')}
                    onClick={() => setClaveDetalleSeleccionada(item.clave)}
                  >
                    <td>{item.codigo_articulo}</td>
                    <td>{item.articulo}</td>
                    <td>{formatoMoneda(item.precio_unitario)}</td>
                    <td>{item.cantidad}</td>
                    <td>{formatoMoneda(item.subtotal)}</td>
                    <td title={`Venta boleta ${item.boleta_venta}`}>{boleta}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="devoluciones-totales">
          <p><strong>Total a devolver:</strong> {formatoMoneda(totalDevolucion)}</p>
          <p>
            <strong>Saldo después de la devolución:</strong>{' '}
            {formatoMoneda(redondear(saldoCliente - totalDevolucion))}
          </p>
        </div>

        <div className="acciones-finales devoluciones-acciones">
          <button
            type="button"
            className="btn-guardar"
            disabled={guardando || detalle.length === 0}
            onClick={guardarDevolucion}
          >
            {guardando ? 'Guardando...' : 'Aceptar'}
          </button>
          <button
            type="button"
            className="btn-eliminar"
            disabled={guardando || detalle.length === 0}
            onClick={eliminarDelDetalle}
          >
            Quitar artículo
          </button>
          <button type="button" className="btn-vista" disabled={guardando} onClick={onCerrar}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default DevolucionesModal;
