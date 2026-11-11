import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Ventas.css';

const obtenerFechaActual = () => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const dia = String(hoy.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
};

const mostrarFecha = (fecha) => {
  const texto = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
};

const formatoMoneda = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' });

const redondear = (valor) => Math.round(Number(valor) * 100) / 100;

const VENTA_VACIA = {
  numero_boleta: '',
  fecha: obtenerFechaActual(),
  id_cliente: '',
  nombre_cliente: '',
  saldo_actual: 0,
  id_rollo_cliente: '',
  id_bodega: '',
  codigo_bodega: '',
  nombre_bodega: '',
  id_empleado: '',
  codigo_empleado: '',
  nombre_empleado: '',
  observacion: ''
};

const DETALLE_VACIO = {
  id_articulo: '',
  codigo: '',
  descripcion: '',
  costo_unitario: '',
  precio_unitario: '',
  existencia: 0,
  cantidad: ''
};

function Ventas() {
  const navigate = useNavigate();

  const boletaRef = useRef(null);
  const fechaRef = useRef(null);
  const bodegaRef = useRef(null);
  const empleadoRef = useRef(null);
  const clienteRef = useRef(null);
  const observacionRef = useRef(null);
  const articuloRef = useRef(null);
  const precioRef = useRef(null);
  const cantidadRef = useRef(null);

  const [clientes, setClientes] = useState([]);
  const [bodegas, setBodegas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [articulos, setArticulos] = useState([]);
  const [existencias, setExistencias] = useState([]);

  const [textoCliente, setTextoCliente] = useState('');
  const [venta, setVenta] = useState({ ...VENTA_VACIA });
  const [detalleActual, setDetalleActual] = useState({ ...DETALLE_VACIO });
  const [detalleVenta, setDetalleVenta] = useState([]);
  const [guardando, setGuardando] = useState(false);

  // Aviso de éxito (no bloquea ni roba el cursor como el alert).
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(null), 5000);
    return () => clearTimeout(temporizador);
  }, [aviso]);


  // Datos de la boleta cuando ya existe (fecha, bodega y rollo quedan fijos).
  const [boletaInfo, setBoletaInfo] = useState(null);
  const boletaBloqueada = Boolean(boletaInfo?.existe);

  // Consulta de ventas
  const [mostrarConsulta, setMostrarConsulta] = useState(false);
  const [boletaConsulta, setBoletaConsulta] = useState('');
  const [ventasEncontradas, setVentasEncontradas] = useState([]);
  const [buscandoVentas, setBuscandoVentas] = useState(false);
  const [consultaRealizada, setConsultaRealizada] = useState(false);
  const [ventaConsultada, setVentaConsultada] = useState(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [eliminandoVenta, setEliminandoVenta] = useState(false);

  const totalVenta = useMemo(
    () => redondear(detalleVenta.reduce((total, item) => total + Number(item.subtotal || 0), 0)),
    [detalleVenta]
  );

  // Si la boleta ya tiene rollo, el datalist solo sugiere clientes de ese rollo.
  const clientesSugeridos = useMemo(() => {
    if (!boletaInfo?.id_rollo) return clientes;
    return clientes.filter((item) => Number(item.id_rollo) === Number(boletaInfo.id_rollo));
  }, [clientes, boletaInfo]);

  useEffect(() => {
    cargarDatosIniciales();
    setTimeout(() => boletaRef.current?.focus(), 100);
  }, []);

  const cargarDatosIniciales = async () => {
    try {
      const [resClientes, resBodegas, resEmpleados, resArticulos, resExistencias] =
        await Promise.all([
          fetch('/api/clientes'),
          fetch('/api/bodegas'),
          fetch('/api/empleados'),
          fetch('/api/articulos'),
          fetch('/api/movimientos-inventario/existencias')
        ]);

      if (!resClientes.ok || !resBodegas.ok || !resEmpleados.ok || !resArticulos.ok || !resExistencias.ok) {
        throw new Error('Error al consultar los datos iniciales');
      }

      setClientes(await resClientes.json());
      setBodegas(await resBodegas.json());
      setEmpleados(await resEmpleados.json());
      setArticulos(await resArticulos.json());
      setExistencias(await resExistencias.json());
    } catch (error) {
      console.error('Error cargando datos iniciales:', error);
      alert('Error al cargar datos para ventas');
    }
  };

  const manejarEnter = (e, siguienteRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      siguienteRef.current?.focus();
    }
  };

  const cambiarVenta = (e) => {
    const { name, value } = e.target;
    setVenta((anterior) => ({ ...anterior, [name]: value }));
  };

  // ===================== BOLETA =====================

  const consultarBoleta = async (numeroBoleta) => {
    const respuesta = await fetch(`/api/ventas/boleta/${encodeURIComponent(numeroBoleta)}`);
    const datos = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(datos.mensaje || 'Error al validar la boleta');
    }

    return datos;
  };

  const validarBoleta = async () => {
    const numeroBoleta = venta.numero_boleta.trim();

    if (!numeroBoleta) {
      alert('Digite el número de boleta');
      boletaRef.current?.focus();
      return;
    }

    try {
      const datos = await consultarBoleta(numeroBoleta);
      setBoletaInfo(datos);

      if (datos.existe) {
        // Boleta ya abierta: fecha y bodega quedan fijas; se sigue con el empleado.
        setVenta((anterior) => ({
          ...anterior,
          fecha: datos.fecha,
          id_bodega: datos.id_bodega,
          codigo_bodega: datos.codigo_bodega,
          nombre_bodega: datos.bodega
        }));

        empleadoRef.current?.focus();
        return;
      }

      // Boleta nueva: se puede ajustar la fecha y elegir la bodega.
      fechaRef.current?.focus();
    } catch (error) {
      console.error('Error validando boleta:', error);
      alert(error.message || 'Error al validar la boleta');
    }
  };

  // ===================== BODEGA / EMPLEADO / CLIENTE =====================

  const buscarBodegaPorCodigo = () => {
    const codigo = String(venta.codigo_bodega || '').trim().toLowerCase();

    if (!codigo) {
      alert('Digite el código de la bodega');
      bodegaRef.current?.focus();
      return;
    }

    const bodegaEncontrada = bodegas.find(
      (item) =>
        String(item.codigo || '').trim().toLowerCase() === codigo &&
        (!item.estado || item.estado === 'A')
    );

    if (!bodegaEncontrada) {
      alert('No se encontró una bodega activa con ese código');
      bodegaRef.current?.focus();
      return;
    }

    setVenta((anterior) => ({
      ...anterior,
      id_bodega: bodegaEncontrada.id_bodega,
      codigo_bodega: bodegaEncontrada.codigo,
      nombre_bodega: bodegaEncontrada.descripcion
    }));

    empleadoRef.current?.focus();
  };

  const buscarEmpleadoPorCodigo = () => {
    const codigo = String(venta.codigo_empleado || '').trim().toLowerCase();

    if (!codigo) {
      alert('Digite el código del empleado');
      empleadoRef.current?.focus();
      return;
    }

    const empleadoEncontrado = empleados.find(
      (item) =>
        String(item.codigo || '').trim().toLowerCase() === codigo &&
        (!item.estado || item.estado === 'A')
    );

    if (!empleadoEncontrado) {
      alert('No se encontró un empleado activo con ese código');
      empleadoRef.current?.focus();
      return;
    }

    setVenta((anterior) => ({
      ...anterior,
      id_empleado: empleadoEncontrado.id_empleado,
      codigo_empleado: empleadoEncontrado.codigo,
      nombre_empleado: empleadoEncontrado.nombre
    }));

    clienteRef.current?.focus();
  };

  const seleccionarCliente = () => {
    const texto = textoCliente.trim().toLowerCase();

    if (!texto) {
      alert('Digite código, nombre o cédula del cliente');
      clienteRef.current?.focus();
      return;
    }

    const clienteEncontrado =
      clientes.find((item) => `${item.codigo} - ${item.nombre}`.toLowerCase() === texto) ||
      clientes.find((item) => String(item.codigo || '').toLowerCase() === texto) ||
      clientes.find((item) => String(item.cedula || '').toLowerCase() === texto) ||
      clientesSugeridos.find((item) => String(item.nombre || '').toLowerCase().includes(texto));

    if (!clienteEncontrado) {
      alert('No se encontró el cliente');
      clienteRef.current?.focus();
      return;
    }

    if (!clienteEncontrado.id_rollo) {
      alert('Este cliente no tiene rollo asignado. Asígnele un rollo antes de venderle.');
      clienteRef.current?.select();
      return;
    }

    // La boleta solo puede llevar clientes de un mismo rollo.
    if (boletaInfo?.id_rollo && Number(clienteEncontrado.id_rollo) !== Number(boletaInfo.id_rollo)) {
      alert(
        `La boleta ${venta.numero_boleta} es del rollo ${boletaInfo.numero_rollo} ${boletaInfo.rollo}.\n` +
        `${clienteEncontrado.nombre} pertenece al rollo ${clienteEncontrado.numero_rollo || '-'} ${clienteEncontrado.rollo || ''}.`
      );
      clienteRef.current?.select();
      return;
    }

    setVenta((anterior) => ({
      ...anterior,
      id_cliente: clienteEncontrado.id_cliente,
      nombre_cliente: clienteEncontrado.nombre,
      saldo_actual: clienteEncontrado.saldo_actual || 0,
      id_rollo_cliente: clienteEncontrado.id_rollo
    }));

    setTextoCliente(`${clienteEncontrado.codigo} - ${clienteEncontrado.nombre}`);
    observacionRef.current?.focus();
  };

  // ===================== ARTÍCULOS =====================

  const cambiarDetalleActual = (e) => {
    const { name, value } = e.target;
    setDetalleActual((anterior) => ({ ...anterior, [name]: value }));
  };

  const buscarArticuloPorCodigo = () => {
    const codigo = String(detalleActual.codigo || '').trim().toLowerCase();

    if (!venta.id_bodega) {
      alert('Primero debe seleccionar una bodega');
      bodegaRef.current?.focus();
      return;
    }

    if (!codigo) {
      alert('Digite el código del artículo');
      articuloRef.current?.focus();
      return;
    }

    const articuloEncontrado = articulos.find(
      (item) => String(item.codigo || '').trim().toLowerCase() === codigo
    );

    if (!articuloEncontrado) {
      alert('No se encontró el artículo');
      articuloRef.current?.select();
      return;
    }

    const existenciaEncontrada = existencias.find(
      (item) =>
        Number(item.id_bodega) === Number(venta.id_bodega) &&
        Number(item.id_articulo) === Number(articuloEncontrado.id_articulo)
    );

    setDetalleActual({
      id_articulo: articuloEncontrado.id_articulo,
      codigo: articuloEncontrado.codigo,
      descripcion: articuloEncontrado.descripcion,
      costo_unitario: Number(articuloEncontrado.costo || 0),
      // Precio sugerido (costo × 2); se puede corregir si el vendedor vendió a otro precio.
      precio_unitario: articuloEncontrado.precio ?? '',
      existencia: existenciaEncontrada ? Number(existenciaEncontrada.existencia) : 0,
      cantidad: ''
    });

    // Va al precio y lo deja seleccionado: Enter si está bien, o se escribe encima para corregirlo.
    setTimeout(() => {
      precioRef.current?.focus();
      precioRef.current?.select();
    }, 0);
  };

  const agregarLinea = () => {
    if (!detalleActual.id_articulo) {
      alert('Seleccione un artículo válido');
      articuloRef.current?.focus();
      return;
    }

    const cantidad = Number(detalleActual.cantidad || 0);
    const precio = Number(detalleActual.precio_unitario || 0);
    const existencia = Number(detalleActual.existencia || 0);

    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      alert('La cantidad debe ser mayor a cero');
      cantidadRef.current?.focus();
      return;
    }

    if (!Number.isFinite(precio) || precio <= 0) {
      alert('El precio de venta debe ser mayor a cero');
      precioRef.current?.focus();
      return;
    }

    const indiceExistente = detalleVenta.findIndex(
      (item) => Number(item.id_articulo) === Number(detalleActual.id_articulo)
    );

    const lineaExistente = indiceExistente >= 0 ? detalleVenta[indiceExistente] : null;
    const cantidadAnterior = lineaExistente ? Number(lineaExistente.cantidad) : 0;
    const cantidadTotal = cantidadAnterior + cantidad;

    if (cantidadTotal > existencia) {
      alert(
        `Existencia insuficiente para ${detalleActual.descripcion}.\n` +
        `Disponible: ${existencia}\n` +
        `Ya agregado: ${cantidadAnterior}\n` +
        `Total solicitado: ${cantidadTotal}`
      );
      cantidadRef.current?.focus();
      return;
    }

    if (lineaExistente && Math.abs(Number(lineaExistente.precio_unitario) - precio) > 0.001) {
      alert(
        'Este artículo ya está agregado con un precio diferente. ' +
        'Para cambiarlo, elimine primero la línea existente.'
      );
      articuloRef.current?.focus();
      return;
    }

    if (lineaExistente) {
      setDetalleVenta((anterior) =>
        anterior.map((item, index) =>
          index === indiceExistente
            ? { ...item, cantidad: cantidadTotal, subtotal: redondear(cantidadTotal * precio) }
            : item
        )
      );
    } else {
      setDetalleVenta((anterior) => [
        ...anterior,
        {
          id_articulo: detalleActual.id_articulo,
          codigo: detalleActual.codigo,
          descripcion: detalleActual.descripcion,
          costo_unitario: Number(detalleActual.costo_unitario || 0),
          cantidad,
          precio_unitario: precio,
          subtotal: redondear(cantidad * precio)
        }
      ]);
    }

    setDetalleActual({ ...DETALLE_VACIO });
    articuloRef.current?.focus();
  };

  const eliminarLinea = (indice) => {
    setDetalleVenta((anterior) => anterior.filter((_, index) => index !== indice));
    articuloRef.current?.focus();
  };

  // ===================== LIMPIEZA Y GUARDADO =====================

  // Todo en blanco: para empezar otra boleta.
  const nuevaBoleta = () => {
    setVenta({ ...VENTA_VACIA, fecha: obtenerFechaActual() });
    setBoletaInfo(null);
    setTextoCliente('');
    setDetalleActual({ ...DETALLE_VACIO });
    setDetalleVenta([]);
    setTimeout(() => boletaRef.current?.focus(), 100);
  };

  // Mantiene boleta, fecha, bodega y empleado: para el siguiente cliente de la misma hoja.
  // Limpia de inmediato; los datos del servidor se recargan después, sin bloquear.
  const prepararSiguienteCliente = (numeroBoleta) => {
    setVenta((anterior) => ({
      ...anterior,
      id_cliente: '',
      nombre_cliente: '',
      saldo_actual: 0,
      id_rollo_cliente: '',
      observacion: ''
    }));
    setTextoCliente('');
    setDetalleActual({ ...DETALLE_VACIO });
    setDetalleVenta([]);

    // El vendedor puede variar: el cursor va al empleado (Enter si es el mismo).
    setTimeout(() => {
      empleadoRef.current?.focus();
      empleadoRef.current?.select();
    }, 50);

    // En segundo plano: saldos y existencias actualizados, y la boleta con su rollo ya fijo.
    cargarDatosIniciales();
    consultarBoleta(numeroBoleta)
      .then((datos) => setBoletaInfo(datos))
      .catch((error) => console.error('Error actualizando la boleta:', error));
  };

  const guardarVenta = async () => {
    if (guardando) return;

    if (!venta.numero_boleta.trim()) {
      alert('Digite el número de boleta');
      boletaRef.current?.focus();
      return;
    }

    if (!venta.id_bodega) {
      alert('Seleccione una bodega');
      bodegaRef.current?.focus();
      return;
    }

    if (!venta.id_empleado) {
      alert('Seleccione un empleado');
      empleadoRef.current?.focus();
      return;
    }

    if (!venta.id_cliente) {
      alert('Seleccione un cliente');
      clienteRef.current?.focus();
      return;
    }

    if (detalleVenta.length === 0) {
      alert('Debe agregar al menos un artículo');
      articuloRef.current?.focus();
      return;
    }

    try {
      setGuardando(true);

      const respuesta = await fetch('/api/ventas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numero_boleta: venta.numero_boleta.trim(),
          fecha: venta.fecha,
          id_cliente: venta.id_cliente,
          id_bodega: venta.id_bodega,
          id_empleado: venta.id_empleado,
          observacion: venta.observacion,
          detalle: detalleVenta.map((item) => ({
            id_articulo: item.id_articulo,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario
          }))
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al registrar venta');
        return;
      }

      prepararSiguienteCliente(venta.numero_boleta.trim());

      setAviso({
        titulo: 'Venta registrada',
        texto: `${datos.cliente} — ${formatoMoneda(datos.total)} (boleta ${datos.numero_boleta})`
      });

    } catch (error) {
      console.error('Error guardando venta:', error);
      alert('Error al guardar venta');
    } finally {
      setGuardando(false);
    }
  };

  // ===================== CONSULTA =====================

  const buscarVentas = async () => {
    const numeroBoleta = boletaConsulta.trim();

    if (!numeroBoleta) {
      alert('Digite el número de boleta que desea consultar');
      return;
    }

    try {
      setBuscandoVentas(true);
      setConsultaRealizada(false);
      setVentasEncontradas([]);
      setVentaConsultada(null);

      const respuesta = await fetch(`/api/ventas/consultar/boleta/${encodeURIComponent(numeroBoleta)}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al consultar ventas');
      }

      setVentasEncontradas(datos.ventas || []);
      setConsultaRealizada(true);
    } catch (error) {
      console.error('Error buscando ventas:', error);
      alert(error.message || 'Error al buscar ventas');
    } finally {
      setBuscandoVentas(false);
    }
  };

  const verDetalleVenta = async (idVenta) => {
    try {
      setCargandoDetalle(true);
      setVentaConsultada(null);

      const respuesta = await fetch(`/api/ventas/${idVenta}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al consultar la venta');
      }

      setVentaConsultada(datos);
    } catch (error) {
      console.error('Error consultando detalle:', error);
      alert(error.message || 'Error al consultar el detalle');
    } finally {
      setCargandoDetalle(false);
    }
  };

  const eliminarVentaConsultada = async () => {
    if (!ventaConsultada?.venta) return;

    const ventaEliminar = ventaConsultada.venta;

    if (ventaEliminar.estado !== 'ACTIVA') {
      alert('Esta venta ya se encuentra eliminada');
      return;
    }

    const confirmar = window.confirm(
      `¿Está seguro de eliminar la venta de la boleta ${ventaEliminar.numero_boleta}?\n\n` +
      `Cliente: ${ventaEliminar.nombre_cliente}\n` +
      `Total: ${formatoMoneda(ventaEliminar.total)}\n\n` +
      'Esta operación devolverá los artículos al inventario y revertirá el saldo del cliente.'
    );

    if (!confirmar) return;

    try {
      setEliminandoVenta(true);

      const respuesta = await fetch(`/api/ventas/${ventaEliminar.id_venta}/eliminar`, {
        method: 'PATCH'
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(datos.mensaje || 'Error al eliminar la venta');
      }

      alert(datos.mensaje || 'Venta eliminada correctamente');

      const respuestaDetalle = await fetch(`/api/ventas/${ventaEliminar.id_venta}`);
      setVentaConsultada(respuestaDetalle.ok ? await respuestaDetalle.json() : null);

      const respuestaLista = await fetch(
        `/api/ventas/consultar/boleta/${encodeURIComponent(ventaEliminar.numero_boleta)}`
      );

      if (respuestaLista.ok) {
        const listaActualizada = await respuestaLista.json();
        setVentasEncontradas(listaActualizada.ventas || []);
      }

      await cargarDatosIniciales();
    } catch (error) {
      console.error('Error eliminando venta:', error);
      alert(error.message || 'Error al eliminar la venta');
    } finally {
      setEliminandoVenta(false);
    }
  };

  // ===================== PANTALLA =====================

  return (
    <div className="ventas-page">
        {aviso && (
            <div className="ventas-aviso" role="status" onClick={() => setAviso(null)}>
            <strong>✔ {aviso.titulo}</strong>
            <span>{aviso.texto}</span>
            </div>
        )}
      <header className="ventas-header">
        <h2>Ventas</h2>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" onClick={() => setMostrarConsulta(!mostrarConsulta)}>
            {mostrarConsulta ? 'Cerrar consulta' : 'Consultar ventas'}
          </button>

          <button type="button" onClick={() => navigate('/transacciones')}>
            Volver
          </button>
        </div>
      </header>

      {mostrarConsulta && (
        <section className="ventas-card">
          <h3>Consultar ventas</h3>

          <div className="ventas-grid">
            <div>
              <label>Número de boleta</label>
              <input
                type="text"
                value={boletaConsulta}
                onChange={(e) => {
                  setBoletaConsulta(e.target.value);
                  setVentasEncontradas([]);
                  setConsultaRealizada(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    buscarVentas();
                  }
                }}
                placeholder="Digite el número de boleta"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'end' }}>
              <button type="button" onClick={buscarVentas} disabled={buscandoVentas}>
                {buscandoVentas ? 'Buscando...' : 'Buscar venta'}
              </button>
            </div>
          </div>

          {ventasEncontradas.length > 0 && (
            <div className="tabla-contenedor ventas-tabla">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Boleta</th>
                    <th>Cliente</th>
                    <th>Empleado</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {ventasEncontradas.map((item) => (
                    <tr key={item.id_venta}>
                      <td>{item.id_venta}</td>
                      <td>{item.numero_boleta}</td>
                      <td>{item.codigo_cliente ? `${item.codigo_cliente} - ` : ''}{item.nombre_cliente}</td>
                      <td>{item.nombre_empleado || '-'}</td>
                      <td>{mostrarFecha(item.fecha)}</td>
                      <td>{formatoMoneda(item.total)}</td>
                      <td>{item.estado}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-guardar-venta"
                          onClick={() => verDetalleVenta(item.id_venta)}
                          disabled={cargandoDetalle}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {consultaRealizada && ventasEncontradas.length === 0 && (
            <p>No se encontraron ventas con ese número de boleta.</p>
          )}

          {ventaConsultada && (
            <div style={{ marginTop: '30px' }}>
              <h3>Detalle de la venta</h3>

              <div className="ventas-info-grid">
                <div className="ventas-info-item">
                  <label>Boleta</label>
                  <span>{ventaConsultada.venta.numero_boleta}</span>
                </div>

                <div className="ventas-info-item">
                  <label>Cliente</label>
                  <span>{ventaConsultada.venta.nombre_cliente}</span>
                </div>

                <div className="ventas-info-item">
                  <label>Rollo</label>
                  <span>
                    {ventaConsultada.venta.numero_rollo
                      ? `${ventaConsultada.venta.numero_rollo} - ${ventaConsultada.venta.nombre_rollo}`
                      : '-'}
                  </span>
                </div>

                <div className="ventas-info-item">
                  <label>Bodega</label>
                  <span>{ventaConsultada.venta.nombre_bodega}</span>
                </div>

                <div className="ventas-info-item">
                  <label>Empleado</label>
                  <span>{ventaConsultada.venta.nombre_empleado}</span>
                </div>

                <div className="ventas-info-item">
                  <label>Estado</label>
                  <span
                    className={
                      ventaConsultada.venta.estado === 'ACTIVA'
                        ? 'ventas-estado-activa'
                        : 'ventas-estado-eliminada'
                    }
                  >
                    {ventaConsultada.venta.estado}
                  </span>
                </div>
              </div>

              <div className="tabla-contenedor ventas-tabla">
                <table>
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Artículo</th>
                      <th>Cantidad</th>
                      <th>Costo</th>
                      <th>Precio venta</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>

                  <tbody>
                    {ventaConsultada.detalle.map((item) => (
                      <tr key={item.id_venta_detalle}>
                        <td>{item.codigo_articulo}</td>
                        <td>{item.nombre_articulo}</td>
                        <td>{Number(item.cantidad)}</td>
                        <td>{formatoMoneda(item.costo_unitario)}</td>
                        <td>{formatoMoneda(item.precio_unitario)}</td>
                        <td>{formatoMoneda(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ventas-total">
                <strong>Total:</strong> {formatoMoneda(ventaConsultada.venta.total)}
              </div>

              {ventaConsultada.venta.estado === 'ACTIVA' && (
                <div className="ventas-botones">
                  <button
                    type="button"
                    className="btn-eliminar-linea"
                    onClick={eliminarVentaConsultada}
                    disabled={eliminandoVenta}
                  >
                    {eliminandoVenta ? 'Eliminando...' : 'Eliminar venta'}
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="ventas-card">
        <h3>Datos de la venta</h3>

        {boletaInfo && (
          <div className={`ventas-boleta-info ${boletaBloqueada ? 'existente' : 'nueva'}`}>
            {boletaBloqueada ? (
              <>
                <strong>Boleta {venta.numero_boleta}</strong>
                <span>Fecha: {mostrarFecha(boletaInfo.fecha)}</span>
                <span>Bodega: {boletaInfo.codigo_bodega} {boletaInfo.bodega}</span>
                <span>Rollo: {boletaInfo.numero_rollo} {boletaInfo.rollo}</span>
                <span>
                  {boletaInfo.cantidad_ventas} venta(s)
                  {boletaInfo.cantidad_devoluciones > 0
                    ? ` · ${boletaInfo.cantidad_devoluciones} devolución(es)`
                    : ''}
                </span>
              </>
            ) : (
              <>
                <strong>Boleta nueva</strong>
                <span>La primera venta define la fecha, la bodega y el rollo de esta boleta.</span>
              </>
            )}
          </div>
        )}

        <div className="ventas-grid">
          <div>
            <label>Boleta</label>
            <input
              ref={boletaRef}
              type="text"
              name="numero_boleta"
              value={venta.numero_boleta}
              onChange={(e) => {
                cambiarVenta(e);
                // Si cambia la boleta, se liberan fecha, bodega y rollo.
                setBoletaInfo(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  validarBoleta();
                }
              }}
            />
          </div>

          <div>
            <label>Fecha</label>
            <input
              ref={fechaRef}
              type="date"
              name="fecha"
              value={venta.fecha}
              onChange={cambiarVenta}
              onKeyDown={(e) => manejarEnter(e, bodegaRef)}
              readOnly={boletaBloqueada}
              tabIndex={boletaBloqueada ? -1 : 0}
            />
          </div>

          <div>
            <label>Código bodega / camión</label>
            <input
              ref={bodegaRef}
              type="text"
              name="codigo_bodega"
              value={venta.codigo_bodega}
              onChange={cambiarVenta}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarBodegaPorCodigo();
                }
              }}
              readOnly={boletaBloqueada}
              tabIndex={boletaBloqueada ? -1 : 0}
            />
          </div>

          <div>
            <label>Bodega</label>
            <input type="text" value={venta.nombre_bodega} disabled />
          </div>

          <div>
            <label>Código empleado</label>
            <input
              ref={empleadoRef}
              type="text"
              name="codigo_empleado"
              value={venta.codigo_empleado}
              onChange={cambiarVenta}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarEmpleadoPorCodigo();
                }
              }}
            />
          </div>

          <div>
            <label>Empleado</label>
            <input type="text" value={venta.nombre_empleado} disabled />
          </div>

          <div className="full">
            <label>
              Cliente
              {boletaInfo?.id_rollo ? ` (solo del rollo ${boletaInfo.numero_rollo} ${boletaInfo.rollo})` : ''}
            </label>
            <input
              ref={clienteRef}
              type="text"
              list="lista-clientes-venta"
              value={textoCliente}
              onChange={(e) => {
                setTextoCliente(e.target.value);
                setVenta((anterior) => ({ ...anterior, id_cliente: '' }));
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  seleccionarCliente();
                }
              }}
              placeholder="Digite código, nombre o cédula"
            />

            <datalist id="lista-clientes-venta">
              {clientesSugeridos.map((item) => (
                <option key={item.id_cliente} value={`${item.codigo} - ${item.nombre}`} />
              ))}
            </datalist>
          </div>

          <div>
            <label>Saldo actual</label>
            <input type="text" value={formatoMoneda(venta.saldo_actual)} disabled />
          </div>

          <div className="full">
            <label>Observación</label>
            <input
              ref={observacionRef}
              type="text"
              name="observacion"
              value={venta.observacion}
              onChange={cambiarVenta}
              onKeyDown={(e) => manejarEnter(e, articuloRef)}
            />
          </div>
        </div>
      </section>

      <section className="ventas-card">
        <h3>Detalle de artículos</h3>

        <div className="ventas-grid detalle-grid">
          <div>
            <label>Código artículo</label>
            <input
              ref={articuloRef}
              type="text"
              name="codigo"
              value={detalleActual.codigo}
              onChange={cambiarDetalleActual}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();

                  // Código vacío + Enter con artículos agregados = guardar la venta.
                  if (!detalleActual.codigo.trim() && detalleVenta.length > 0) {
                    guardarVenta();
                    return;
                  }

                  buscarArticuloPorCodigo();
                }
              }}
            />
          </div>

          <div className="full">
            <label>Descripción</label>
            <input type="text" value={detalleActual.descripcion} disabled />
          </div>

          <div>
            <label>Costo</label>
            <input
              type="text"
              value={detalleActual.id_articulo ? formatoMoneda(detalleActual.costo_unitario) : ''}
              disabled
            />
          </div>

          <div>
            <label>Precio de venta</label>
            <input
              ref={precioRef}
              type="number"
              name="precio_unitario"
              min="0"
              step="0.01"
              value={detalleActual.precio_unitario}
              onChange={cambiarDetalleActual}
              onKeyDown={(e) => manejarEnter(e, cantidadRef)}
            />
          </div>

          <div>
            <label>Cantidad</label>
            <input
              ref={cantidadRef}
              type="number"
              name="cantidad"
              min="0"
              value={detalleActual.cantidad}
              onChange={cambiarDetalleActual}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarLinea();
                }
              }}
            />
          </div>

          <div>
            <label>Existencia en bodega</label>
            <input type="text" value={detalleActual.existencia} disabled />
          </div>
        </div>

        <div className="tabla-contenedor ventas-tabla">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Artículo</th>
                <th>Costo</th>
                <th>Precio venta</th>
                <th>Cantidad</th>
                <th>Subtotal</th>
                <th>Acción</th>
              </tr>
            </thead>

            <tbody>
              {detalleVenta.map((item, index) => (
                <tr key={`${item.id_articulo}-${index}`}>
                  <td>{item.codigo}</td>
                  <td>{item.descripcion}</td>
                  <td>{formatoMoneda(item.costo_unitario)}</td>
                  <td>{formatoMoneda(item.precio_unitario)}</td>
                  <td>{item.cantidad}</td>
                  <td>{formatoMoneda(item.subtotal)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-eliminar-linea"
                      tabIndex={-1}
                      onClick={() => eliminarLinea(index)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {detalleVenta.length === 0 && (
                <tr>
                  <td colSpan="7" className="sin-datos">
                    No hay artículos agregados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ventas-total">
          <strong>Total venta:</strong> {formatoMoneda(totalVenta)}
        </div>

        <p className="ventas-ayuda">
          Enter con el código de artículo vacío guarda la venta. Después de guardar, la boleta queda
          abierta para el siguiente cliente.
        </p>

        <div className="ventas-botones">
          <button className="btn-guardar-venta" onClick={guardarVenta} disabled={guardando}>
            {guardando ? 'Guardando...' : 'Guardar venta'}
          </button>

          <button className="btn-cancelar-venta" onClick={nuevaBoleta}>
            Nueva boleta
          </button>
        </div>
      </section>
    </div>
  );
}

export default Ventas;
