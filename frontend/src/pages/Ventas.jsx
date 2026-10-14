    import { useEffect, useMemo, useRef, useState } from 'react';
    import { useNavigate } from 'react-router-dom';
    import './Ventas.css';

    function Ventas() {
        const navigate = useNavigate();

        const boletaRef = useRef(null);
        const bodegaRef = useRef(null);
        const empleadoRef = useRef(null);
        const clienteRef = useRef(null);
        const articuloRef = useRef(null);
        const cantidadRef = useRef(null);
        const observacionRef = useRef(null);

        const obtenerFechaActual = () => {
            const hoy = new Date();
            const anio = hoy.getFullYear();
            const mes = String(hoy.getMonth() + 1).padStart(2, '0');
            const dia = String(hoy.getDate()).padStart(2, '0');

            return `${anio}-${mes}-${dia}`;
        };

        const [clientes, setClientes] = useState([]);
        const [bodegas, setBodegas] = useState([]);
        const [empleados, setEmpleados] = useState([]);
        const [articulos, setArticulos] = useState([]);

        const [textoCliente, setTextoCliente] = useState('');

        const [venta, setVenta] = useState({
            numero_boleta: '',
            fecha: obtenerFechaActual(),
            id_cliente: '',
            nombre_cliente: '',
            saldo_actual: 0,
            id_bodega: '',
            codigo_bodega: '',
            nombre_bodega: '',
            id_empleado: '',
            codigo_empleado: '',
            nombre_empleado: '',
            observacion: ''
        });

        const [detalleActual, setDetalleActual] = useState({
            id_articulo: '',
            codigo: '',
            descripcion: '',
            precio_unitario: '',
            existencia: 0,
            cantidad: ''
        });

        const [detalleVenta, setDetalleVenta] = useState([]);

        const [mostrarConsulta, setMostrarConsulta] = useState(false);
        const [boletaConsulta, setBoletaConsulta] = useState('');
        const [ventasEncontradas, setVentasEncontradas] = useState([]);
        const [buscandoVentas, setBuscandoVentas] = useState(false);
        const [consultaRealizada, setConsultaRealizada] = useState(false);

        const [ventaConsultada, setVentaConsultada] = useState(null);
        const [cargandoDetalle, setCargandoDetalle] = useState(false);
        const [eliminandoVenta, setEliminandoVenta] = useState(false);

        const totalVenta = useMemo(() => {
            return detalleVenta.reduce((total, item) => total + Number(item.subtotal || 0), 0);
        }, [detalleVenta]);

        useEffect(() => {
            cargarDatosIniciales();

            setTimeout(() => {
            boletaRef.current?.focus();
            }, 100);
        }, []);

        const cargarDatosIniciales = async () => {
            try {
            const [resClientes, resBodegas, resEmpleados, resArticulos] = await Promise.all([
                fetch('/api/clientes'),
                fetch('/api/bodegas'),
                fetch('/api/empleados'),
                fetch('/api/articulos')
            ]);

            const datosClientes = await resClientes.json();
            const datosBodegas = await resBodegas.json();
            const datosEmpleados = await resEmpleados.json();
            const datosArticulos = await resArticulos.json();

            setClientes(datosClientes);
            setBodegas(datosBodegas);
            setEmpleados(datosEmpleados);
            setArticulos(datosArticulos);
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

            setVenta({
            ...venta,
            [name]: value
            });
        };

        const validarBoleta = async () => {
            const numeroBoleta = venta.numero_boleta.trim();

            if (!numeroBoleta) {
            alert('Digite el número de boleta');
            boletaRef.current?.focus();
            return;
            }

            try {
            const respuesta = await fetch(`/api/ventas/boleta/${numeroBoleta}`);
            const datos = await respuesta.json();

            if (datos.existe) {
                alert('Ya existe una venta activa con ese número de boleta');
                boletaRef.current?.focus();
                return;
            }

            setVenta({
                ...venta,
                fecha: obtenerFechaActual()
            });

            bodegaRef.current?.focus();
            } catch (error) {
            console.error('Error validando boleta:', error);
            alert('Error al validar la boleta');
            }
        };

        const buscarBodegaPorCodigo = () => {
            const codigo = String(venta.codigo_bodega || '').trim().toLowerCase();

            if (!codigo) {
            alert('Digite el código de la bodega');
            bodegaRef.current?.focus();
            return;
            }

            const bodegaEncontrada = bodegas.find(
            (item) => String(item.codigo || '').toLowerCase() === codigo
            );

            if (!bodegaEncontrada) {
            alert('No se encontró la bodega');
            bodegaRef.current?.focus();
            return;
            }

            setVenta({
            ...venta,
            id_bodega: bodegaEncontrada.id_bodega,
            codigo_bodega: bodegaEncontrada.codigo,
            nombre_bodega: bodegaEncontrada.descripcion
            });

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
            (item) => String(item.codigo || '').toLowerCase() === codigo
            );

            if (!empleadoEncontrado) {
            alert('No se encontró el empleado');
            empleadoRef.current?.focus();
            return;
            }

            setVenta({
            ...venta,
            id_empleado: empleadoEncontrado.id_empleado,
            codigo_empleado: empleadoEncontrado.codigo,
            nombre_empleado: empleadoEncontrado.nombre
            });

            clienteRef.current?.focus();
        };

        const seleccionarCliente = () => {
        const textoOriginal = textoCliente.trim();
        const texto = textoOriginal.toLowerCase();

        if (!texto) {
            alert('Digite código, nombre o cédula del cliente');
            clienteRef.current?.focus();
            return;
        }

        // 1. Si viene del datalist: "codigo - nombre"
        const clientePorLista = clientes.find(
            (item) => `${item.codigo} - ${item.nombre}`.toLowerCase() === texto
        );

        // 2. Si el usuario digita solo el código, debe buscar código exacto
        const clientePorCodigo = clientes.find(
            (item) => String(item.codigo || '').toLowerCase() === texto
        );

        // 3. Si digita cédula exacta
        const clientePorCedula = clientes.find(
            (item) => String(item.cedula || '').toLowerCase() === texto
        );

        // 4. Si digita nombre o parte del nombre
        const clientePorNombre = clientes.find(
            (item) => String(item.nombre || '').toLowerCase().includes(texto)
        );

        const clienteEncontrado =
            clientePorLista ||
            clientePorCodigo ||
            clientePorCedula ||
            clientePorNombre;

        if (!clienteEncontrado) {
            alert('No se encontró el cliente');
            clienteRef.current?.focus();
            return;
        }

        setVenta({
            ...venta,
            id_cliente: clienteEncontrado.id_cliente,
            nombre_cliente: clienteEncontrado.nombre,
            saldo_actual: clienteEncontrado.saldo_actual || 0
        });

        setTextoCliente(`${clienteEncontrado.codigo} - ${clienteEncontrado.nombre}`);
        observacionRef.current?.focus();
        };

        const cambiarDetalleActual = (e) => {
            const { name, value } = e.target;

            setDetalleActual({
            ...detalleActual,
            [name]: value
            });
        };

        const buscarArticuloPorCodigo = () => {
            const codigo = String(detalleActual.codigo || '').trim().toLowerCase();

            if (!codigo) {
            alert('Digite el código del artículo');
            articuloRef.current?.focus();
            return;
            }

            const articuloEncontrado = articulos.find(
            (item) => String(item.codigo || '').toLowerCase() === codigo
            );

            if (!articuloEncontrado) {
            alert('No se encontró el artículo');
            articuloRef.current?.focus();
            return;
            }

            const existenciaEncontrada = Number(articuloEncontrado.existencia || 0);

            setDetalleActual({
            id_articulo: articuloEncontrado.id_articulo,
            codigo: articuloEncontrado.codigo,
            descripcion: articuloEncontrado.descripcion,
            precio_unitario: articuloEncontrado.precio || '',
            existencia: existenciaEncontrada,
            cantidad: ''
            });

            cantidadRef.current?.focus();
        };

        const agregarLinea = () => {
            if (!detalleActual.id_articulo) {
            alert('Seleccione un artículo válido');
            articuloRef.current?.focus();
            return;
            }

            const cantidad = Number(detalleActual.cantidad || 0);
            const precio = Number(detalleActual.precio_unitario || 0);

            if (cantidad <= 0) {
            alert('La cantidad debe ser mayor a cero');
            cantidadRef.current?.focus();
            return;
            }

            if (precio <= 0) {
            alert('El precio debe ser mayor a cero');
            return;
            }

            const subtotal = cantidad * precio;

            const linea = {
            id_articulo: detalleActual.id_articulo,
            codigo: detalleActual.codigo,
            descripcion: detalleActual.descripcion,
            cantidad,
            precio_unitario: precio,
            subtotal
            };

            setDetalleVenta([...detalleVenta, linea]);

            setDetalleActual({
            id_articulo: '',
            codigo: '',
            descripcion: '',
            precio_unitario: '',
            existencia: 0,
            cantidad: ''
            });

            articuloRef.current?.focus();
        };

        const eliminarLinea = (indice) => {
            const nuevoDetalle = detalleVenta.filter((_, index) => index !== indice);
            setDetalleVenta(nuevoDetalle);
        };

        const limpiarVenta = () => {
            setVenta({
            numero_boleta: '',
            fecha: obtenerFechaActual(),
            id_cliente: '',
            nombre_cliente: '',
            saldo_actual: 0,
            id_bodega: '',
            codigo_bodega: '',
            nombre_bodega: '',
            id_empleado: '',
            codigo_empleado: '',
            nombre_empleado: '',
            observacion: ''
            });

            setTextoCliente('');

            setDetalleActual({
            id_articulo: '',
            codigo: '',
            descripcion: '',
            precio_unitario: '',
            existencia: 0,
            cantidad: ''
            });

            setDetalleVenta([]);

            setTimeout(() => {
            boletaRef.current?.focus();
            }, 100);
        };

        const guardarVenta = async () => {
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
            const respuesta = await fetch('/api/ventas', {
                method: 'POST',
                headers: {
                'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                numero_boleta: venta.numero_boleta,
                fecha: venta.fecha,
                id_cliente: venta.id_cliente,
                id_bodega: venta.id_bodega,
                id_empleado: venta.id_empleado,
                observacion: venta.observacion,
                detalle: detalleVenta
                })
            });

            const datos = await respuesta.json();

            if (!respuesta.ok) {
                alert(datos.mensaje || 'Error al registrar venta');
                return;
            }

            alert(datos.mensaje);
            limpiarVenta();
            cargarDatosIniciales();
            } catch (error) {
            console.error('Error guardando venta:', error);
            alert('Error al guardar venta');
            }
        };

        
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

                const respuesta = await fetch(
                `/api/ventas/consultar/boleta/${encodeURIComponent(numeroBoleta)}`
                );

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
                `¿Está seguro de eliminar la venta ${ventaEliminar.numero_boleta}?\n\n` +
                `Cliente: ${ventaEliminar.nombre_cliente}\n` +
                `Total: ${formatoMoneda(ventaEliminar.total)}\n\n` +
                'Esta operación devolverá los artículos al inventario y revertirá el saldo del cliente.'
            );

            if (!confirmar) return;

            try {
                setEliminandoVenta(true);

                const respuesta = await fetch(
                `/api/ventas/${ventaEliminar.id_venta}/eliminar`,
                { method: 'PATCH' }
                );

                const datos = await respuesta.json();

                if (!respuesta.ok) {
                throw new Error(datos.mensaje || 'Error al eliminar la venta');
                }

                alert(datos.mensaje || 'Venta eliminada correctamente');

                // Actualizar el detalle de la venta
                const respuestaDetalle = await fetch(
                `/api/ventas/${ventaEliminar.id_venta}`
                );

                if (respuestaDetalle.ok) {
                const detalleActualizado = await respuestaDetalle.json();
                setVentaConsultada(detalleActualizado);
                } else {
                setVentaConsultada(null);
                }

                // Actualizar la lista de ventas encontradas
                const respuestaLista = await fetch(
                `/api/ventas/consultar/boleta/${encodeURIComponent(ventaEliminar.numero_boleta)}`
                );

                if (respuestaLista.ok) {
                const listaActualizada = await respuestaLista.json();
                setVentasEncontradas(listaActualizada.ventas || []);
                }

                // Recargar clientes y artículos
                await cargarDatosIniciales();

            } catch (error) {
                console.error('Error eliminando venta:', error);
                alert(error.message || 'Error al eliminar la venta');
            } finally {
                setEliminandoVenta(false);
            }
        };


        const formatoMoneda = (valor) => {
            return Number(valor || 0).toLocaleString('es-CR', {
            style: 'currency',
            currency: 'CRC'
            });
        };

        return (
            <div className="ventas-page">

            <header className="ventas-header">
                <h2>Ventas</h2>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        type="button"
                        onClick={() => setMostrarConsulta(!mostrarConsulta)}
                    >
                    {mostrarConsulta ? 'Cerrar consulta' : 'Consultar ventas'}
                    </button>

                    <button
                        type="button"
                        onClick={() => navigate('/transacciones')}
                    >
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
                    <button
                    type="button"
                    onClick={buscarVentas}
                    disabled={buscandoVentas}
                    >
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
                            <td>{item.nombre_cliente}</td>
                            <td>
                            {item.fecha
                                ? String(item.fecha).substring(0, 10)
                                : ''}
                            </td>
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

                            <div className="ventas-info-item">
                                <label>Observación</label>
                                <span>
                                {ventaConsultada.venta.observacion || 'Sin observación'}
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
                                <th>Precio</th>
                                <th>Subtotal</th>
                            </tr>
                            </thead>

                            <tbody>
                            {ventaConsultada.detalle.map((item) => (
                                <tr key={item.id_venta_detalle}>
                                <td>{item.codigo_articulo}</td>
                                <td>{item.nombre_articulo}</td>
                                <td>{item.cantidad}</td>
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

                <div className="ventas-grid">
                <div>
                    <label>Boleta</label>
                    <input
                    ref={boletaRef}
                    type="text"
                    name="numero_boleta"
                    value={venta.numero_boleta}
                    onChange={cambiarVenta}
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
                    type="date"
                    name="fecha"
                    value={venta.fecha}
                    onChange={cambiarVenta}
                    onKeyDown={(e) => manejarEnter(e, bodegaRef)}
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
                    />
                </div>

                <div>
                    <label>Bodega</label>
                    <input
                    type="text"
                    value={venta.nombre_bodega}
                    disabled
                    />
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
                    <input
                    type="text"
                    value={venta.nombre_empleado}
                    disabled
                    />
                </div>

                <div className="full">
                    <label>Cliente</label>
                    <input
                    ref={clienteRef}
                    type="text"
                    list="lista-clientes-venta"
                    value={textoCliente}
                    onChange={(e) => setTextoCliente(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                        e.preventDefault();
                        seleccionarCliente();
                        }
                    }}
                    placeholder="Digite código, nombre o cédula"
                    />

                    <datalist id="lista-clientes-venta">
                    {clientes.map((item) => (
                        <option
                        key={item.id_cliente}
                        value={`${item.codigo} - ${item.nombre}`}
                        />
                    ))}
                    </datalist>
                </div>

                <div>
                    <label>Saldo actual</label>
                    <input
                    type="text"
                    value={formatoMoneda(venta.saldo_actual)}
                    disabled
                    />
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
                    <input
                    type="text"
                    value={detalleActual.descripcion}
                    disabled
                    />
                </div>

                <div>
                    <label>Precio</label>
                    <input
                    type="number"
                    name="precio_unitario"
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
                    value={detalleActual.cantidad}
                    onChange={cambiarDetalleActual}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                        e.preventDefault();
                        agregarLinea();
                        }
                    }}
                    min="0"
                    />
                </div>

                <div>
                    <label>Existencia</label>
                    <input
                    type="text"
                    value={detalleActual.existencia}
                    disabled
                    />
                </div>
                </div>

                <div className="tabla-contenedor ventas-tabla">
                <table>
                    <thead>
                    <tr>
                        <th>Código</th>
                        <th>Artículo</th>
                        <th>Precio</th>
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
                        <td>{formatoMoneda(item.precio_unitario)}</td>
                        <td>{item.cantidad}</td>
                        <td>{formatoMoneda(item.subtotal)}</td>
                        <td>
                            <button
                            type="button"
                            className="btn-eliminar-linea"
                            onClick={() => eliminarLinea(index)}
                            >
                            Eliminar
                            </button>
                        </td>
                        </tr>
                    ))}

                    {detalleVenta.length === 0 && (
                        <tr>
                        <td colSpan="6" className="sin-datos">
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

                <div className="ventas-botones">
                <button className="btn-guardar-venta" onClick={guardarVenta}>
                    Guardar venta
                </button>

                <button className="btn-cancelar-venta" onClick={limpiarVenta}>
                    Cancelar
                </button>
                </div>
            </section>
            </div>
        );
    }

    export default Ventas;