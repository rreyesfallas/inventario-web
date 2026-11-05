import { useEffect, useState, useRef } from 'react';

import { useNavigate } from 'react-router-dom';

import jsPDF from 'jspdf';

import autoTable from 'jspdf-autotable';

import * as XLSX from 'xlsx';

import './Transacciones.css';

import DevolucionesModal from './DevolucionesModal';


// Fecha de hoy en hora local (Costa Rica), formato YYYY-MM-DD.
const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

function Transacciones() {

  const navigate = useNavigate();



  const [moduloPendiente, setModuloPendiente] = useState(null);

  const [modalDevolucionesAbierto, setModalDevolucionesAbierto] = useState(false);



  const [clientes, setClientes] = useState([]);

  const [movimientos, setMovimientos] = useState([]);




  // Ventana independiente de transferencias.
  const [modalTransferenciasAbierto, setModalTransferenciasAbierto] = useState(false);
  const [codigoClienteDestinoTransferencia, setCodigoClienteDestinoTransferencia] = useState('');
  const [montoTransferencia, setMontoTransferencia] = useState('');
  const [fechaTransferencia, setFechaTransferencia] = useState(fechaLocalHoy());
  const [descripcionTransferencia, setDescripcionTransferencia] = useState('');
  const [codigoEmpleadoTransferencia, setCodigoEmpleadoTransferencia] = useState('');
  const [transferenciasCliente, setTransferenciasCliente] = useState([]);
  const [cargandoTransferencias, setCargandoTransferencias] = useState(false);
  const [guardandoTransferencia, setGuardandoTransferencia] = useState(false);
  const codigoClienteDestinoTransferenciaRef = useRef(null);
  const montoTransferenciaRef = useRef(null);
  const fechaTransferenciaRef = useRef(null);
  const codigoEmpleadoTransferenciaRef = useRef(null);
  const descripcionTransferenciaRef = useRef(null);

  // Ventana independiente de descuentos.
  const [modalDescuentosAbierto, setModalDescuentosAbierto] = useState(false);
  const [numeroRolloDescuento, setNumeroRolloDescuento] = useState('');
  const [textoClienteDescuento, setTextoClienteDescuento] = useState('');
  const [clienteDescuento, setClienteDescuento] = useState(null);
  const [codigoEmpleadoDescuento, setCodigoEmpleadoDescuento] = useState('');
  const [fechaDescuento, setFechaDescuento] = useState(fechaLocalHoy());
  const [montoDescuento, setMontoDescuento] = useState('');
  const [descripcionDescuento, setDescripcionDescuento] = useState('');
  const [descuentosCliente, setDescuentosCliente] = useState([]);
  const [cargandoDescuentos, setCargandoDescuentos] = useState(false);
  const [guardandoDescuento, setGuardandoDescuento] = useState(false);
  const [eliminandoDescuentoId, setEliminandoDescuentoId] = useState(null);

  // Navegación con Enter dentro de la ventana de Descuentos.
  const montoDescuentoRef = useRef(null);
  const fechaDescuentoRef = useRef(null);
  const descripcionDescuentoRef = useRef(null);
  const codigoEmpleadoDescuentoRef = useRef(null);
  const guardarDescuentoRef = useRef(null);

  const [abonosCliente, setAbonosCliente] = useState([]);

  const [cargandoAbonos, setCargandoAbonos] = useState(false);



  const [busquedaCliente, setBusquedaCliente] = useState('');

  const [busquedaMovimiento, setBusquedaMovimiento] = useState('');



  const [clienteFiltroMovimiento, setClienteFiltroMovimiento] = useState('');

  const [tipoFiltroMovimiento, setTipoFiltroMovimiento] = useState('');

  const [fechaDesdeMovimiento, setFechaDesdeMovimiento] = useState('');

  const [fechaHastaMovimiento, setFechaHastaMovimiento] = useState('');



  const [ordenFechaMovimiento, setOrdenFechaMovimiento] = useState('DESC');



  const [modalClientesAbierto, setModalClientesAbierto] = useState(false);

  const [modalMovimientosAbierto, setModalMovimientosAbierto] = useState(false);



  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);



  const [textoClienteDirecto, setTextoClienteDirecto] = useState('');



  const [empleados, setEmpleados] = useState([]);

  const [codigoEmpleado, setCodigoEmpleado] = useState('');

  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);



  const [abonoEditarEmpleado, setAbonoEditarEmpleado] = useState(null);

  const [codigoNuevoEmpleado, setCodigoNuevoEmpleado] = useState('');

  const [guardandoEmpleadoAbono, setGuardandoEmpleadoAbono] = useState(false);



  const codigoEmpleadoRef = useRef(null);



  const buscarClienteRef = useRef(null);

  const fechaRef = useRef(null);

  const montoRef = useRef(null);

  const observacionRef = useRef(null);



  const [clienteDestinoSeleccionado, setClienteDestinoSeleccionado] = useState(null);

  const [modalClienteDestinoAbierto, setModalClienteDestinoAbierto] = useState(false);

  const [busquedaClienteDestino, setBusquedaClienteDestino] = useState('');



  const [rollos, setRollos] = useState([]);

  const [numeroRollo, setNumeroRollo] = useState('');

  const [rolloSeleccionado, setRolloSeleccionado] = useState(null);



  const [abonoEditarFecha, setAbonoEditarFecha] = useState(null);

  const [nuevaFechaAbono, setNuevaFechaAbono] = useState('');

  const [guardandoFechaAbono, setGuardandoFechaAbono] = useState(false);



  const numeroRolloRef = useRef(null);

  const [eliminandoTransferenciaId, setEliminandoTransferenciaId] = useState(null);







  const [transaccion, setTransaccion] = useState({

    tipo: 'ABONO',

    fecha: fechaLocalHoy(),

    monto: '',

    observacion: ''

  });



  const cargarClientes = async () => {

    try {

      const respuesta = await fetch('/api/clientes');

      const datos = await respuesta.json();



      setClientes(datos);

    } catch (error) {

      console.error('Error cargando clientes:', error);

      alert('Error al cargar clientes');

    }

  };



  const cargarMovimientos = async () => {

    try {

      const respuesta = await fetch('/api/transacciones');

      const datos = await respuesta.json();



      setMovimientos(datos);

    } catch (error) {

      console.error('Error cargando movimientos:', error);

      alert('Error al cargar movimientos');

    }

  };



  const cargarAbonosCliente = async (idCliente, signal) => {

    if (!idCliente) {

      setAbonosCliente([]);

      return;

    }



    setCargandoAbonos(true);



    try {

      const respuesta = await fetch(

        `/api/transacciones/cliente/${idCliente}`,

        { signal }

      );



      if (!respuesta.ok) {

        throw new Error('Error al consultar los abonos del cliente');

      }



      const datos = await respuesta.json();



      const abonos = datos.filter(

        (item) =>

          item.tipo_movimiento === 'ABONO' &&

          item.estado === 'A'

      );



      if (!signal?.aborted) {

        setAbonosCliente(abonos);

      }

    } catch (error) {

      if (error.name === 'AbortError') return;



      console.error('Error cargando abonos:', error);

      setAbonosCliente([]);

    } finally {

      if (!signal?.aborted) {

        setCargandoAbonos(false);

      }

    }

  };



  const cargarRollos = async () => {

    try {

      const respuesta = await fetch('/api/rollos');



      if (!respuesta.ok) {

        throw new Error('Error al consultar los rollos');

      }



      const datos = await respuesta.json();

      setRollos(datos);



    } catch (error) {

      console.error('Error cargando rollos:', error);

      alert('No se pudieron cargar los rollos');

    }

  };



  const buscarRolloPorNumero = () => {

    const numero = numeroRollo.trim();



    if (!numero) {

      alert('Digite el número del rollo');

      numeroRolloRef.current?.focus();

      return;

    }



    const rolloEncontrado = rollos.find(

      (item) => String(item.numero).trim() === numero

    );



    if (!rolloEncontrado) {

      alert('No se encontró un rollo con ese número');

      setRolloSeleccionado(null);

      numeroRolloRef.current?.focus();

      return;

    }



    setRolloSeleccionado(rolloEncontrado);



    buscarClienteRef.current?.focus();

  };





  const cargarEmpleados = async () => {

    try {

      const respuesta = await fetch('/api/empleados');



      if (!respuesta.ok) {

        throw new Error('Error al consultar empleados');

      }



      const datos = await respuesta.json();

      setEmpleados(datos);



    } catch (error) {

      console.error('Error cargando empleados:', error);

      alert('No se pudieron cargar los empleados');

    }

  };



  const buscarEmpleadoPorCodigo = () => {

    const codigo = codigoEmpleado.trim().toLowerCase();



    if (!codigo) {

      alert('Digite el código del empleado');

      codigoEmpleadoRef.current?.focus();

      return;

    }



    const empleadoEncontrado = empleados.find(

      (item) =>

        String(item.codigo || '').trim().toLowerCase() === codigo &&

        item.estado === 'A'

    );



    if (!empleadoEncontrado) {

      alert('No se encontró un empleado activo con ese código');

      setEmpleadoSeleccionado(null);

      codigoEmpleadoRef.current?.focus();

      return;

    }



    setEmpleadoSeleccionado(empleadoEncontrado);



    // Pasar automáticamente al campo Fecha

    fechaRef.current?.focus();

  };



    useEffect(() => {

      cargarClientes();

      cargarMovimientos();

      cargarRollos();

      cargarEmpleados();

    }, []);



    useEffect(() => {

    const controller = new AbortController();



    if (clienteSeleccionado?.id_cliente) {

      cargarAbonosCliente(

        clienteSeleccionado.id_cliente,

        controller.signal

      );

    } else {

      setAbonosCliente([]);

      setCargandoAbonos(false);

    }



    return () => controller.abort();

  }, [clienteSeleccionado?.id_cliente]);



  const seleccionarCliente = (item) => {

    setClienteSeleccionado(item);

    setModalClientesAbierto(false);

    setBusquedaCliente('');

  };



  const seleccionarClienteDirecto = () => {

    const texto = textoClienteDirecto.trim().toLowerCase();



    if (!rolloSeleccionado) {

      alert('Primero debe seleccionar un rollo válido');

      numeroRolloRef.current?.focus();

      return;

    }



    if (!texto) {

      alert('Digite el código o nombre del cliente');

      buscarClienteRef.current?.focus();

      return;

    }



    const clientesCoincidentes = clientes.filter((item) => {

      const codigo = String(item.codigo || '').toLowerCase();

      const nombre = String(item.nombre || '').toLowerCase();

      const cedula = String(item.cedula || '').toLowerCase();



      const perteneceAlRollo =

        String(item.numero_rollo || '').trim() ===

        String(rolloSeleccionado.numero).trim();



      return (

        perteneceAlRollo &&

        (

          codigo.includes(texto) ||

          nombre.includes(texto) ||

          cedula.includes(texto)

        )

      );

    });



    if (clientesCoincidentes.length === 0) {

      alert('No se encontró ningún cliente con ese código o nombre');

      buscarClienteRef.current?.focus();

      return;

    }



    const clienteExacto =

      clientesCoincidentes.find(

        (item) => String(item.codigo || '').toLowerCase() === texto

      ) || clientesCoincidentes[0];



    setClienteSeleccionado(clienteExacto);

    setTextoClienteDirecto(`${clienteExacto.codigo} - ${clienteExacto.nombre}`);



    setTimeout(() => {

      codigoEmpleadoRef.current?.focus();

    }, 100);

  };



  const seleccionarClienteDestino = (item) => {
    setClienteDestinoSeleccionado(item);
    setCodigoClienteDestinoTransferencia(String(item.codigo));
    setModalClienteDestinoAbierto(false);
    setBusquedaClienteDestino('');
    setTimeout(() => montoTransferenciaRef.current?.focus(), 0);
  };



  const cambiarTransaccion = (e) => {

    const { name, value } = e.target;



    setTransaccion({

      ...transaccion,

      [name]: value

    });



    if (name === 'tipo' && value !== 'TRANSFERENCIA') {

      setClienteDestinoSeleccionado(null);

    }

  };



  const manejarEnter = (e, siguienteRef) => {

    if (e.key === 'Enter') {

      e.preventDefault();

      siguienteRef.current?.focus();

    }

  };





  const guardarTransaccion = async () => {



    if (transaccion.tipo === 'ABONO') {

      if (!rolloSeleccionado) {

        alert('Primero debe seleccionar un rollo válido');

        numeroRolloRef.current?.focus();

        return;

      }



      if (!empleadoSeleccionado) {

        alert('Debe seleccionar un empleado válido');

        codigoEmpleadoRef.current?.focus();

        return;

      }



      if (

        Number(clienteSeleccionado?.id_rollo) !==

        Number(rolloSeleccionado.id_rollo)

      ) {

        alert('El cliente no pertenece al rollo seleccionado');

        return;

      }

    }

    if (!clienteSeleccionado) {

      alert('Seleccione un cliente origen');

      return;

    }



    if (!transaccion.fecha || !transaccion.monto) {

      alert('Fecha y monto son obligatorios');

      return;

    }



    const monto = Number(transaccion.monto);



    if (monto <= 0) {

      alert('El monto debe ser mayor a cero');

      return;

    }



    const saldoActual = Number(clienteSeleccionado.saldo_actual || 0);

      if (

        (transaccion.tipo === 'ABONO' ||

          transaccion.tipo === 'DEVOLUCION' ||


          transaccion.tipo === 'TRANSFERENCIA') &&

        monto > saldoActual

      ) {

      alert('El monto no puede ser mayor al saldo actual del cliente origen');

      return;

    }



    if (transaccion.tipo === 'TRANSFERENCIA' && !clienteDestinoSeleccionado) {

      alert('Seleccione el cliente destino');

      return;

    }



    if (

      transaccion.tipo === 'TRANSFERENCIA' &&

      clienteDestinoSeleccionado &&

      clienteDestinoSeleccionado.id_cliente === clienteSeleccionado.id_cliente

    ) {

      alert('El cliente origen y destino no pueden ser el mismo');

      return;

    }



    try {

      let endpoint = '';

      let body = {};



      if (transaccion.tipo === 'ABONO') {

        endpoint = '/api/transacciones/abono';



        body = {

          id_cliente: clienteSeleccionado.id_cliente,

          id_rollo: rolloSeleccionado.id_rollo,

          id_empleado: empleadoSeleccionado.id_empleado,

          fecha: transaccion.fecha,

          monto: transaccion.monto,

          observacion: transaccion.observacion

        };

      }



      if (transaccion.tipo === 'VENTA') {

        endpoint = '/api/transacciones/venta';



        body = {

          id_cliente: clienteSeleccionado.id_cliente,

          fecha: transaccion.fecha,

          monto: transaccion.monto,

          observacion: transaccion.observacion

        };

      }



      if (transaccion.tipo === 'DEVOLUCION') {

        endpoint = '/api/transacciones/devolucion';



        body = {

          id_cliente: clienteSeleccionado.id_cliente,

          fecha: transaccion.fecha,

          monto: transaccion.monto,

          observacion: transaccion.observacion

        };

      }



      if (transaccion.tipo === 'TRANSFERENCIA') {

        endpoint = '/api/transacciones/transferencia';



        body = {

          id_cliente_origen: clienteSeleccionado.id_cliente,

          id_cliente_destino: clienteDestinoSeleccionado.id_cliente,

          fecha: transaccion.fecha,

          monto: transaccion.monto,

          observacion: transaccion.observacion

        };

      }



      const respuesta = await fetch(endpoint, {

        method: 'POST',

        headers: {

          'Content-Type': 'application/json'

        },

        body: JSON.stringify(body)

      });



      const datos = await respuesta.json();



      if (!respuesta.ok) {

        alert(datos.mensaje || 'Error al guardar transacción');

        return;

      }



      alert(datos.mensaje);



      if (transaccion.tipo === 'TRANSFERENCIA') {

        setClienteSeleccionado({

          ...clienteSeleccionado,

          saldo_actual: datos.saldo_nuevo_origen

        });

      } else {

        setClienteSeleccionado({

          ...clienteSeleccionado,

          saldo_actual: datos.saldo_nuevo

        });

      }



      setClienteDestinoSeleccionado(null);



      setTransaccion({

        tipo: 'ABONO',

        fecha: fechaLocalHoy(),

        monto: '',

        observacion: ''

      });



      cargarClientes();

      cargarMovimientos();



      if (transaccion.tipo === 'ABONO') {

        cargarAbonosCliente(clienteSeleccionado.id_cliente);

      }

    } catch (error) {

      console.error('Error guardando transacción:', error);

      alert('Error al guardar transacción');

    }

  };





  const eliminarAbono = async (item) => {

    const confirmar = window.confirm(

      `¿Está seguro de eliminar este abono de ₡${Number(item.monto).toLocaleString('es-CR')}?`

    );



    if (!confirmar) {

      return;

    }



    try {

      const respuesta = await fetch(

        `/api/transacciones/${item.id_movimiento_cliente}/eliminar-abono`,

        {

          method: 'PATCH'

        }

      );



      const datos = await respuesta.json();



      if (!respuesta.ok) {

        alert(datos.mensaje || 'Error al eliminar el abono');

        return;

      }



      // Quitar el abono eliminado de la tabla.

      setAbonosCliente((anteriores) =>

        anteriores.filter(

          (abono) =>

            abono.id_movimiento_cliente !== item.id_movimiento_cliente

        )

      );



      // Actualizar el saldo mostrado del cliente.

      setClienteSeleccionado((anterior) => {

        if (!anterior || anterior.id_cliente !== item.id_cliente) {

          return anterior;

        }



        return {

          ...anterior,

          saldo_actual: datos.saldo_nuevo

        };

      });



      // Actualizar los datos generales.

      cargarClientes();

      cargarMovimientos();



      alert(datos.mensaje);



    } catch (error) {

      console.error('Error eliminando abono:', error);

      alert('No se pudo eliminar el abono');

    }

  };





  const cambiarFechaAbono = (item) => {

    setAbonoEditarFecha(item);

    setNuevaFechaAbono(obtenerFechaFiltro(item.fecha));

  };



  const guardarCambioFechaAbono = async () => {

    if (!abonoEditarFecha || !nuevaFechaAbono) {

      alert('Debe seleccionar una fecha válida');

      return;

    }



    if (guardandoFechaAbono) return;



    try {

      setGuardandoFechaAbono(true);



      const respuesta = await fetch(

        `/api/transacciones/abono/${abonoEditarFecha.id_movimiento_cliente}/fecha`,

        {

          method: 'PATCH',

          headers: {

            'Content-Type': 'application/json'

          },

          body: JSON.stringify({

            fecha: nuevaFechaAbono

          })

        }

      );



      const datos = await respuesta.json();



      if (!respuesta.ok) {

        alert(datos.mensaje || 'Error al cambiar la fecha');

        return;

      }



      // Actualizar la fecha del abono en la tabla.

      setAbonosCliente((anteriores) =>

        anteriores.map((item) =>

          item.id_movimiento_cliente ===

          abonoEditarFecha.id_movimiento_cliente

            ? { ...item, fecha: nuevaFechaAbono }

            : item

        )

      );



      // Actualizar también la vista general de movimientos.

      cargarMovimientos();



      setAbonoEditarFecha(null);

      setNuevaFechaAbono('');



      alert(datos.mensaje);



    } catch (error) {

      console.error('Error cambiando fecha del abono:', error);

      alert('No se pudo cambiar la fecha del abono');



    } finally {

      setGuardandoFechaAbono(false);

    }

  };





  const cambiarEmpleadoAbono = (item) => {

    setAbonoEditarEmpleado(item);

    setCodigoNuevoEmpleado(item.codigo_empleado || '');

  };



  const guardarCambioEmpleadoAbono = async () => {

    if (!abonoEditarEmpleado || guardandoEmpleadoAbono) return;



    const empleadoEncontrado = empleados.find(

      (item) =>

        String(item.codigo || '').trim().toLowerCase() ===

          codigoNuevoEmpleado.trim().toLowerCase() &&

        item.estado === 'A'

    );



    if (!empleadoEncontrado) {

      alert('Debe indicar un código de empleado válido y activo');

      return;

    }



    try {

      setGuardandoEmpleadoAbono(true);



      const respuesta = await fetch(

        `/api/transacciones/abono/${abonoEditarEmpleado.id_movimiento_cliente}/empleado`,

        {

          method: 'PATCH',

          headers: {

            'Content-Type': 'application/json'

          },

          body: JSON.stringify({

            id_empleado: empleadoEncontrado.id_empleado

          })

        }

      );



      const datos = await respuesta.json();



      if (!respuesta.ok) {

        alert(datos.mensaje || 'Error al cambiar el empleado');

        return;

      }



      // Actualizar el empleado en el historial de abonos.

      setAbonosCliente((anteriores) =>

        anteriores.map((item) =>

          item.id_movimiento_cliente ===

          abonoEditarEmpleado.id_movimiento_cliente

            ? {

                ...item,

                id_empleado: empleadoEncontrado.id_empleado,

                codigo_empleado: empleadoEncontrado.codigo,

                empleado: empleadoEncontrado.nombre

              }

            : item

        )

      );



      // Actualizar los movimientos generales.

      cargarMovimientos();



      // Cerrar la ventana.

      setAbonoEditarEmpleado(null);

      setCodigoNuevoEmpleado('');



      alert(datos.mensaje);



    } catch (error) {

      console.error('Error cambiando empleado del abono:', error);

      alert('No se pudo cambiar el empleado del abono');



    } finally {

      setGuardandoEmpleadoAbono(false);

    }

  };





  const clientesFiltrados = clientes.filter((item) => {

    const texto = busquedaCliente.toLowerCase();



    return (

      item.codigo?.toLowerCase().includes(texto) ||

      item.cedula?.toLowerCase().includes(texto) ||

      item.nombre?.toLowerCase().includes(texto) ||

      String(item.numero_rollo || '').toLowerCase().includes(texto) ||

      item.rollo?.toLowerCase().includes(texto)

    );

  });



  const clientesDestinoFiltrados = clientes.filter((item) => {

    const texto = busquedaClienteDestino.toLowerCase();



    const coincideBusqueda =

      item.codigo?.toLowerCase().includes(texto) ||

      item.cedula?.toLowerCase().includes(texto) ||

      item.nombre?.toLowerCase().includes(texto) ||

      String(item.numero_rollo || '').toLowerCase().includes(texto) ||

      item.rollo?.toLowerCase().includes(texto);



    const noEsClienteOrigen =

      !clienteSeleccionado ||

      item.id_cliente !== clienteSeleccionado.id_cliente;



    return coincideBusqueda && noEsClienteOrigen;

  });



  const obtenerFechaFiltro = (fecha) => {

    if (!fecha) return '';



    const texto = String(fecha);



    if (texto.includes('T')) {

      return texto.slice(0, 10);

    }



    if (texto.includes('-')) {

      return texto.slice(0, 10);

    }



    if (texto.includes('/')) {

      const partes = texto.split('/');



      if (partes.length === 3) {

        const dia = partes[0].padStart(2, '0');

        const mes = partes[1].padStart(2, '0');

        const anio = partes[2];



        return `${anio}-${mes}-${dia}`;

      }

    }



    return '';

  };



  const mostrarFecha = (fecha) => {

    const fechaNormalizada = obtenerFechaFiltro(fecha);



    if (!fechaNormalizada) return '-';



    const [anio, mes, dia] = fechaNormalizada.split('-');



    return `${Number(dia)}/${Number(mes)}/${anio}`;

  };



  const movimientosFiltrados = movimientos.filter((item) => {

    const texto = busquedaMovimiento.toLowerCase();



    const coincideBusqueda =

      item.codigo_cliente?.toLowerCase().includes(texto) ||

      item.cliente?.toLowerCase().includes(texto) ||

      item.tipo_movimiento?.toLowerCase().includes(texto) ||

      String(item.fecha || '').toLowerCase().includes(texto);



    const fechaMovimiento = obtenerFechaFiltro(item.fecha);



    const coincideCliente =

      !clienteFiltroMovimiento ||

      String(item.id_cliente) === String(clienteFiltroMovimiento);



    const coincideTipo =

      !tipoFiltroMovimiento ||

      String(item.tipo_movimiento || '').toUpperCase() === tipoFiltroMovimiento;



    const coincideFechaDesde =

      !fechaDesdeMovimiento || fechaMovimiento >= fechaDesdeMovimiento;



    const coincideFechaHasta =

      !fechaHastaMovimiento || fechaMovimiento <= fechaHastaMovimiento;



    return (

      coincideBusqueda &&

      coincideCliente &&

      coincideTipo &&

      coincideFechaDesde &&

      coincideFechaHasta

    );

  });



  const movimientosOrdenados = [...movimientosFiltrados].sort((a, b) => {

    const fechaA = obtenerFechaFiltro(a.fecha);

    const fechaB = obtenerFechaFiltro(b.fecha);



    if (ordenFechaMovimiento === 'DESC') {

      return fechaB.localeCompare(fechaA);

    }



    return fechaA.localeCompare(fechaB);

  });



  const formatoMoneda = (valor) => {

    return Number(valor || 0).toLocaleString('es-CR', {

      style: 'currency',

      currency: 'CRC'

    });

  };

  const formatoMonedaReporte = (valor) => {

    const numero = Number(valor || 0);



    return `¢${numero.toLocaleString('es-CR', {

      minimumFractionDigits: 2,

      maximumFractionDigits: 2

    })}`;

  };




  // Descuentos: reutiliza los catálogos de rollos, clientes y empleados.
  const rolloParaDescuento = rollos.find(
    (item) => String(item.numero).trim() === numeroRolloDescuento.trim()
  );

  const clientesDelRolloDescuento = rolloParaDescuento
    ? clientes.filter((item) =>
        Number(item.id_rollo) === Number(rolloParaDescuento.id_rollo)
      )
    : [];

  const empleadoParaDescuento = empleados.find(
    (item) =>
      String(item.codigo || '').trim().toLowerCase() ===
        codigoEmpleadoDescuento.trim().toLowerCase() &&
      item.estado === 'A'
  );

  const abrirDescuentos = () => {
    // El cliente y el rollo se seleccionan previamente en Abonos.
    if (!rolloSeleccionado || !clienteSeleccionado ||
        Number(clienteSeleccionado.id_rollo) !== Number(rolloSeleccionado.id_rollo)) {
      alert('Primero seleccione un rollo y un cliente en Abonos para aplicar el descuento.');
      return;
    }
    setNumeroRolloDescuento(String(rolloSeleccionado.numero));
    setClienteDescuento(clienteSeleccionado);
    setTextoClienteDescuento(
      clienteSeleccionado
        ? `${clienteSeleccionado.codigo} - ${clienteSeleccionado.nombre}`
        : ''
    );
    setCodigoEmpleadoDescuento(empleadoSeleccionado ? String(empleadoSeleccionado.codigo) : '');
    setFechaDescuento(fechaLocalHoy());
    setMontoDescuento('');
    setDescripcionDescuento('');
    setModalDescuentosAbierto(true);
  };

  const abrirDevoluciones = () => {
    if (
      !rolloSeleccionado ||
      !clienteSeleccionado ||
      Number(clienteSeleccionado.id_rollo) !== Number(rolloSeleccionado.id_rollo)
    ) {
      alert('Primero seleccione un rollo y un cliente en Abonos para registrar la devolución.');
      return;
    }

    setModalDevolucionesAbierto(true);
  };

  const cargarDescuentosCliente = async (idCliente, signal) => {
    if (!idCliente) {
      setDescuentosCliente([]);
      return;
    }

    setCargandoDescuentos(true);
    try {
      const respuesta = await fetch(`/api/transacciones/cliente/${idCliente}`, { signal });
      if (!respuesta.ok) throw new Error('No se pudo consultar el historial de descuentos');
      const datos = await respuesta.json();
      if (!Array.isArray(datos)) throw new Error('Formato de historial no válido');
      if (!signal?.aborted) {
        setDescuentosCliente(
          datos.filter((item) => item.tipo_movimiento === 'DESCUENTO' && item.estado === 'A')
        );
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error consultando descuentos:', error);
      if (!signal?.aborted) setDescuentosCliente([]);
    } finally {
      if (!signal?.aborted) setCargandoDescuentos(false);
    }
  };

  useEffect(() => {
    if (!modalDescuentosAbierto || !clienteDescuento?.id_cliente) {
      setDescuentosCliente([]);
      setCargandoDescuentos(false);
      return;
    }
    const controller = new AbortController();
    cargarDescuentosCliente(clienteDescuento.id_cliente, controller.signal);
    return () => controller.abort();
  }, [modalDescuentosAbierto, clienteDescuento?.id_cliente]);

  const guardarDescuento = async () => {
    if (guardandoDescuento) return;
    if (!rolloParaDescuento) return alert('Digite un número de rollo válido');
    if (!clienteDescuento || Number(clienteDescuento.id_rollo) !== Number(rolloParaDescuento.id_rollo)) {
      return alert('Seleccione un cliente del rollo indicado');
    }
    if (!empleadoParaDescuento) return alert('Digite el código de un empleado activo');
    if (!fechaDescuento) return alert('Seleccione la fecha del descuento');
    const monto = Number(montoDescuento);
    if (!Number.isFinite(monto) || monto <= 0) return alert('El monto debe ser mayor a cero');
    if (monto > Number(clienteDescuento.saldo_actual || 0)) {
      return alert('El descuento no puede superar el saldo actual del cliente');
    }
    if (!descripcionDescuento.trim()) return alert('Digite la descripción del descuento');

    try {
      setGuardandoDescuento(true);
      const respuesta = await fetch('/api/transacciones/descuento', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cliente: clienteDescuento.id_cliente,
          id_rollo: rolloParaDescuento.id_rollo,
          id_empleado: empleadoParaDescuento.id_empleado,
          fecha: fechaDescuento,
          monto,
          observacion: descripcionDescuento.trim()
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) return alert(datos.mensaje || 'No se pudo registrar el descuento');

      setClienteDescuento((anterior) => ({ ...anterior, saldo_actual: datos.saldo_nuevo }));
      setClienteSeleccionado((anterior) =>
        anterior?.id_cliente === clienteDescuento.id_cliente
          ? { ...anterior, saldo_actual: datos.saldo_nuevo }
          : anterior
      );
      setMontoDescuento('');
      setDescripcionDescuento('');
      await Promise.all([
        cargarClientes(),
        cargarMovimientos(),
        cargarDescuentosCliente(clienteDescuento.id_cliente)
      ]);
      alert(datos.mensaje || 'Descuento registrado correctamente');
    } catch (error) {
      console.error('Error registrando descuento:', error);
      alert('No se pudo registrar el descuento');
    } finally {
      setGuardandoDescuento(false);
    }
  };

  const eliminarDescuento = async (item) => {
    if (eliminandoDescuentoId !== null) return;
    if (!window.confirm(`¿Eliminar el descuento de ${formatoMoneda(item.monto)}? El monto se reintegrará al saldo del cliente.`)) return;

    try {
      setEliminandoDescuentoId(item.id_movimiento_cliente);
      const respuesta = await fetch(
        `/api/transacciones/descuento/${item.id_movimiento_cliente}/eliminar`,
        { method: 'PATCH' }
      );
      const datos = await respuesta.json();
      if (!respuesta.ok) return alert(datos.mensaje || 'No se pudo eliminar el descuento');

      setDescuentosCliente((anteriores) => anteriores.filter(
        (descuento) => descuento.id_movimiento_cliente !== item.id_movimiento_cliente
      ));
      setClienteDescuento((anterior) =>
        anterior?.id_cliente === item.id_cliente
          ? { ...anterior, saldo_actual: datos.saldo_nuevo }
          : anterior
      );
      setClienteSeleccionado((anterior) =>
        anterior?.id_cliente === item.id_cliente
          ? { ...anterior, saldo_actual: datos.saldo_nuevo }
          : anterior
      );
      await Promise.all([cargarClientes(), cargarMovimientos()]);
      alert(datos.mensaje || 'Descuento eliminado correctamente');
    } catch (error) {
      console.error('Error eliminando descuento:', error);
      alert('No se pudo eliminar el descuento');
    } finally {
      setEliminandoDescuentoId(null);
    }
  };

  // Datos específicos de transferencias.
  const empleadoParaTransferencia = empleados.find(
    (item) =>
      String(item.codigo || '').trim().toLowerCase() ===
        codigoEmpleadoTransferencia.trim().toLowerCase() &&
      item.estado === 'A'
  );

  const abrirTransferencias = () => {
    if (!rolloSeleccionado || !clienteSeleccionado ||
        Number(clienteSeleccionado.id_rollo) !== Number(rolloSeleccionado.id_rollo)) {
      alert('Primero seleccione un rollo y un cliente en Abonos para realizar la transferencia.');
      return;
    }
    setClienteDestinoSeleccionado(null);
    setCodigoClienteDestinoTransferencia('');
    setMontoTransferencia('');
    setFechaTransferencia(fechaLocalHoy());
    setDescripcionTransferencia('');
    setCodigoEmpleadoTransferencia(empleadoSeleccionado ? String(empleadoSeleccionado.codigo) : '');
    setModalTransferenciasAbierto(true);
  };

  const buscarClienteDestinoPorCodigo = () => {
    const codigo = codigoClienteDestinoTransferencia.trim().toLowerCase();
    const encontrado = clientes.find(
      (item) => String(item.codigo || '').trim().toLowerCase() === codigo && (!item.estado || item.estado === 'A')
    );
    if (!encontrado) {
      setClienteDestinoSeleccionado(null);
      alert('No existe un cliente activo con ese código');
      codigoClienteDestinoTransferenciaRef.current?.focus();
      return;
    }
    if (Number(encontrado.id_cliente) === Number(clienteSeleccionado?.id_cliente)) {
      setClienteDestinoSeleccionado(null);
      alert('El cliente que recibe debe ser diferente del que envía');
      codigoClienteDestinoTransferenciaRef.current?.focus();
      return;
    }
    setClienteDestinoSeleccionado(encontrado);
    montoTransferenciaRef.current?.focus();
  };

  const cargarTransferenciasCliente = async (idCliente, signal) => {
    if (!idCliente) {
      setTransferenciasCliente([]);
      return;
    }
    setCargandoTransferencias(true);
    try {
      const respuesta = await fetch(`/api/transacciones/cliente/${idCliente}`, { signal });
      if (!respuesta.ok) throw new Error('No se pudo consultar el historial de transferencias');
      const datos = await respuesta.json();
      if (!Array.isArray(datos)) throw new Error('Formato de historial no válido');
      if (!signal?.aborted) {
        setTransferenciasCliente(datos.filter(
          (item) => item.tipo_movimiento === 'TRANSFERENCIA_SALIDA' && item.estado === 'A'
        ));
      }
    } catch (error) {
      if (error.name === 'AbortError') return;
      console.error('Error consultando transferencias:', error);
      if (!signal?.aborted) setTransferenciasCliente([]);
    } finally {
      if (!signal?.aborted) setCargandoTransferencias(false);
    }
  };

  useEffect(() => {
    if (!modalTransferenciasAbierto || !clienteSeleccionado?.id_cliente) {
      setTransferenciasCliente([]);
      setCargandoTransferencias(false);
      return;
    }
    const controller = new AbortController();
    cargarTransferenciasCliente(clienteSeleccionado.id_cliente, controller.signal);
    return () => controller.abort();
  }, [modalTransferenciasAbierto, clienteSeleccionado?.id_cliente]);

  const guardarTransferencia = async () => {
    if (guardandoTransferencia) return;
    if (!clienteSeleccionado || !clienteDestinoSeleccionado) {
      alert('Seleccione un cliente que reciba la transferencia');
      return;
    }
    if (Number(clienteSeleccionado.id_cliente) === Number(clienteDestinoSeleccionado.id_cliente)) {
      alert('El cliente origen y destino deben ser diferentes');
      return;
    }
    if (!empleadoParaTransferencia) {
      alert('Digite el código de un empleado activo');
      codigoEmpleadoTransferenciaRef.current?.focus();
      return;
    }
    if (!fechaTransferencia) {
      alert('Seleccione la fecha de la transferencia');
      return;
    }
    const monto = Number(montoTransferencia);
    if (!montoTransferencia.trim() || !Number.isFinite(monto) || monto <= 0) {
      alert('Digite un monto mayor a cero');
      montoTransferenciaRef.current?.focus();
      return;
    }
    if (monto > Number(clienteSeleccionado.saldo_actual || 0)) {
      alert('La transferencia no puede superar el saldo del cliente origen');
      montoTransferenciaRef.current?.focus();
      return;
    }

    try {
      setGuardandoTransferencia(true);
      const respuesta = await fetch('/api/transacciones/transferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_cliente_origen: clienteSeleccionado.id_cliente,
          id_cliente_destino: clienteDestinoSeleccionado.id_cliente,
          id_empleado: empleadoParaTransferencia.id_empleado,
          fecha: fechaTransferencia,
          monto,
          observacion: descripcionTransferencia.trim()
        })
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo registrar la transferencia');
        return;
      }
      setClienteSeleccionado((anterior) => anterior ? {
        ...anterior,
        saldo_actual: datos.saldo_nuevo_origen
      } : anterior);
      setClienteDestinoSeleccionado(null);
      setCodigoClienteDestinoTransferencia('');
      setMontoTransferencia('');
      setDescripcionTransferencia('');
      await Promise.all([
        cargarClientes(),
        cargarMovimientos(),
        cargarTransferenciasCliente(clienteSeleccionado.id_cliente)
      ]);
      alert(datos.mensaje || 'Transferencia registrada correctamente');
      codigoClienteDestinoTransferenciaRef.current?.focus();
    } catch (error) {
      console.error('Error registrando transferencia:', error);
      alert('No se pudo registrar la transferencia');
    } finally {
      setGuardandoTransferencia(false);
    }
  };

  const imprimirMovimientos = () => {

    if (movimientosFiltrados.length === 0) {

      alert('No hay movimientos para imprimir');

      return;

    }



    window.print();

  };



  const exportarPDFMovimientos = () => {

    if (movimientosFiltrados.length === 0) {

      alert('No hay movimientos para exportar');

      return;

    }



    const doc = new jsPDF('landscape');



    doc.setFontSize(16);

    doc.text('Sistema de Inventario', 14, 15);



    doc.setFontSize(14);

    doc.text('Reporte de Transacciones', 14, 25);



    doc.setFontSize(10);

    doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-CR')}`, 14, 35);



    autoTable(doc, {

      startY: 45,

      head: [[

        'Fecha',

        'Código',

        'Cliente',

        'Tipo',

        'Monto',

        'Saldo anterior',

        'Saldo nuevo',

        'Observación'

      ]],

      body: movimientosOrdenados.map((item) => [

        mostrarFecha(item.fecha),

        item.codigo_cliente || '-',

        item.cliente || '-',

        item.tipo_movimiento || '-',

        formatoMonedaReporte(item.monto),

        formatoMonedaReporte(item.saldo_anterior),

        formatoMonedaReporte(item.saldo_nuevo),

        item.observacion || '-'

      ]),

      styles: {

        fontSize: 8

      },

      headStyles: {

        fontSize: 8

      }

    });



    doc.save('reporte-transacciones.pdf');

  };



  const exportarExcelMovimientos = () => {

    if (movimientosFiltrados.length === 0) {

      alert('No hay movimientos para exportar');

      return;

    }



    const datosMovimientos = movimientosOrdenados.map((item) => ({

      Fecha: mostrarFecha(item.fecha),

      Codigo: item.codigo_cliente || '',

      Cliente: item.cliente || '',

      Tipo: item.tipo_movimiento || '',

      Monto: Number(item.monto || 0),

      SaldoAnterior: Number(item.saldo_anterior || 0),

      SaldoNuevo: Number(item.saldo_nuevo || 0),

      Observacion: item.observacion || ''

    }));



    const hojaMovimientos = XLSX.utils.json_to_sheet(datosMovimientos);



    hojaMovimientos['!cols'] = [

      { wch: 14 },

      { wch: 12 },

      { wch: 30 },

      { wch: 24 },

      { wch: 16 },

      { wch: 18 },

      { wch: 18 },

      { wch: 45 }

    ];



    const libro = XLSX.utils.book_new();



    XLSX.utils.book_append_sheet(libro, hojaMovimientos, 'Transacciones');



    XLSX.writeFile(libro, 'reporte-transacciones.xlsx');

  };



  const eliminarTransferencia = async (item) => {
    const confirmar = window.confirm(
      `¿Desea eliminar la transferencia de ${formatoMoneda(item.monto)}?\n\n` +
      'Se devolverá el saldo al cliente que envió y se descontará del cliente que recibió.'
    );

    if (!confirmar) return;

    try {
      setEliminandoTransferenciaId(item.id_movimiento_cliente);

      const respuesta = await fetch(
        `/api/transacciones/transferencia/${item.id_movimiento_cliente}/eliminar`,
        {
          method: 'PATCH'
        }
      );

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'No se pudo eliminar la transferencia');
        return;
      }

      setTransferenciasCliente((actual) =>
        actual.filter(
          (movimiento) =>
            movimiento.id_movimiento_cliente !== item.id_movimiento_cliente
        )
      );

      setClienteSeleccionado((actual) =>
        actual
          ? {
              ...actual,
              saldo_actual: resultado.saldo_nuevo_origen
            }
          : actual
      );

      await cargarClientes();
      await cargarMovimientos();
      await cargarTransferenciasCliente(clienteSeleccionado.id_cliente);

      alert(resultado.mensaje);

    } catch (error) {
      console.error('Error eliminando transferencia:', error);
      alert('Error al eliminar la transferencia');
    } finally {
      setEliminandoTransferenciaId(null);
    }
  };



  return (

    <div className="transacciones-page">

      <header className="transacciones-header">

        <h2>Transacciones</h2>

        <button onClick={() => navigate('/dashboard')}>Volver</button>

      </header>







      <div className="transacciones-menu">



          <button

              type="button"

              className="transacciones-menu-btn"

              onClick={() => navigate('/transacciones/ventas')}

          >

              <span className="transacciones-menu-icono">🛒</span>

              <span>Ventas</span>

          </button>





          <button

              type="button"

              className="transacciones-menu-btn"

              onClick={abrirDescuentos}

          >

              <span className="transacciones-menu-icono">%</span>

              <span>Descuentos</span>

          </button>



          <button

              type="button"

              className="transacciones-menu-btn"

              onClick={abrirDevoluciones}

          >

              <span className="transacciones-menu-icono">↩</span>

              <span>Devoluciones</span>

          </button>



          <button

              type="button"

              className="transacciones-menu-btn"

              onClick={abrirTransferencias}

          >

              <span className="transacciones-menu-icono">⇄</span>

              <span>Transferencias</span>

          </button>



      </div>





      <div className="barra-acciones">





        <button

          className="btn-vista"

          onClick={() => setModalClientesAbierto(true)}

        >

          Vista de clientes

        </button>



        <button

          className="btn-vista"

          onClick={() => setModalMovimientosAbierto(true)}

        >

          Vista de movimientos

        </button>

      </div>







      <section

        id="formulario-abonos"

        className="transacciones-card"

      >

        <h3>Datos del abono</h3>



        {/* ROLLO Y CLIENTE */}

        <div className="form-grid">



          <div>

            <label>Número de rollo</label>

            <input

              ref={numeroRolloRef}

              type="text"

              value={numeroRollo}

              placeholder="Digite el número del rollo"

              onChange={(e) => {

                setNumeroRollo(e.target.value);

                setRolloSeleccionado(null);

                setClienteSeleccionado(null);

                setTextoClienteDirecto('');

              }}

              onKeyDown={(e) => {

                if (e.key === 'Enter') {

                  e.preventDefault();

                  buscarRolloPorNumero();

                }

              }}

            />

          </div>



          <div>

            <label>Descripción del rollo</label>

            <input

              type="text"

              value={rolloSeleccionado?.descripcion || ''}

              placeholder="Descripción del rollo"

              readOnly

            />

          </div>



          <div className="campo-doble">

            <label>Buscar cliente por código, nombre o cédula</label>



            <input

              ref={buscarClienteRef}

              type="text"

              list="lista-clientes-transaccion"

              value={textoClienteDirecto}

              placeholder="Digite código, nombre o cédula del cliente"

              onChange={(e) => {

                const valor = e.target.value;

                setTextoClienteDirecto(valor);



                const clienteEncontrado = clientes.find(

                  (item) =>

                    `${item.codigo} - ${item.nombre}` === valor

                );



                if (

                  clienteEncontrado &&

                  rolloSeleccionado &&

                  String(clienteEncontrado.numero_rollo || '').trim() ===

                    String(rolloSeleccionado.numero).trim()

                ) {

                  setClienteSeleccionado(clienteEncontrado);

                } else {

                  setClienteSeleccionado(null);

                }

              }}

              onKeyDown={(e) => {

                if (e.key === 'Enter') {

                  e.preventDefault();

                  seleccionarClienteDirecto();

                }

              }}

            />



            <datalist id="lista-clientes-transaccion">

              {clientes

                .filter(

                  (item) =>

                    rolloSeleccionado &&

                    String(item.numero_rollo || '').trim() ===

                      String(rolloSeleccionado.numero).trim()

                )

                .map((item) => (

                  <option

                    key={item.id_cliente}

                    value={`${item.codigo} - ${item.nombre}`}

                  />

                ))}

            </datalist>

          </div>



        </div>



        {/* INFORMACIÓN DEL CLIENTE */}

        <div className="cliente-info">

          <p>

            <strong>Código:</strong>{' '}

            {clienteSeleccionado?.codigo || '-'}

          </p>



          <p>

            <strong>Cliente:</strong>{' '}

            {clienteSeleccionado?.nombre || '-'}

          </p>



          <p>

            <strong>Rollo:</strong>{' '}

            {clienteSeleccionado

              ? `${clienteSeleccionado.numero_rollo || '-'} - ${clienteSeleccionado.rollo || '-'}`

              : '-'}

          </p>



          <p>

            <strong>Saldo actual:</strong>{' '}

            {formatoMoneda(clienteSeleccionado?.saldo_actual || 0)}

          </p>

        </div>



        {/* DATOS DEL MOVIMIENTO */}

        <div className="form-grid abonos-formulario-detalle">



          <div>

            <label>Código de empleado</label>

            <input

              ref={codigoEmpleadoRef}

              type="text"

              value={codigoEmpleado}

              placeholder="Digite el código del empleado"

              onChange={(e) => {

                setCodigoEmpleado(e.target.value);

                setEmpleadoSeleccionado(null);

              }}

              onKeyDown={(e) => {

                if (e.key === 'Enter') {

                  e.preventDefault();

                  buscarEmpleadoPorCodigo();

                }

              }}

            />

          </div>



          <div>

            <label>Nombre del empleado</label>

            <input

              type="text"

              value={empleadoSeleccionado?.nombre || ''}

              placeholder="Nombre del empleado"

              readOnly

            />

          </div>



          <div>

            <label>Fecha</label>

            <input

              ref={fechaRef}

              type="date"

              name="fecha"

              value={transaccion.fecha}

              onChange={cambiarTransaccion}

              onKeyDown={(e) => manejarEnter(e, montoRef)}

            />

          </div>



          <div>

            <label>Monto del abono</label>

            <input

              ref={montoRef}

              type="number"

              name="monto"

              value={transaccion.monto}

              placeholder="Digite el monto"

              onChange={cambiarTransaccion}

              onKeyDown={(e) => manejarEnter(e, observacionRef)}

              min="0"

              step="0.01"

            />

          </div>



          <div className="campo-doble">

            <label>Observación</label>

            <input

              ref={observacionRef}

              type="text"

              name="observacion"

              value={transaccion.observacion}

              placeholder="Observación del abono"

              onChange={cambiarTransaccion}

              onKeyDown={(e) => {

                if (e.key === 'Enter') {

                  e.preventDefault();

                  guardarTransaccion();

                }

              }}

            />

          </div>



        </div>



        {/* GUARDAR */}

        <div className="acciones-finales">

          <button

            type="button"

            className="btn-guardar"

            onClick={guardarTransaccion}

          >

            Guardar abono

          </button>

        </div>



      </section>





      <section className="transacciones-card">

        <h3>Historial de abonos del cliente</h3>



        {!clienteSeleccionado ? (

          <p className="sin-datos">

            Seleccione un cliente para consultar sus abonos.

          </p>

        ) : (

          <>

            <p>

              <strong>Cliente:</strong>{' '}

              {clienteSeleccionado.codigo} - {clienteSeleccionado.nombre}

            </p>



            <div className="tabla-contenedor">

              <table>

                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Abono</th>
                    <th>Rollo</th>
                    <th>Empleado</th>
                    <th>Observación</th>
                    <th>Acciones</th>
                  </tr>
                </thead>


                <tbody>

                  {cargandoAbonos ? (

                    <tr>

                      <td colSpan="6" className="sin-datos">

                        Cargando abonos...

                      </td>

                    </tr>

                  ) : abonosCliente.length === 0 ? (

                    <tr>

                      <td colSpan="6" className="sin-datos">

                        Este cliente no tiene abonos registrados.

                      </td>

                    </tr>

                  ) : (

                    abonosCliente.map((item) => (

                      <tr key={item.id_movimiento_cliente}>

                        <td>{mostrarFecha(item.fecha)}</td>



                        <td>{formatoMoneda(item.monto)}</td>



                        <td>

                          {item.numero_rollo

                            ? `${item.numero_rollo} - ${item.rollo || ''}`

                            : '-'}

                        </td>



                        <td>

                          {item.codigo_empleado

                            ? `${item.codigo_empleado} - ${item.empleado || ''}`

                            : '-'}

                        </td>



                        <td>{item.observacion || '-'}</td>



                        <td>

                          <div className="acciones-abono">

                            <button

                              type="button"

                              className="btn-eliminar-abono"

                              onClick={() => eliminarAbono(item)}

                            >

                              Eliminar

                            </button>



                            <button

                              type="button"

                              className="btn-cambiar-fecha"

                              onClick={() => cambiarFechaAbono(item)}

                            >

                              Cambiar fecha

                            </button>



                            <button

                              type="button"

                              className="btn-cambiar-empleado"

                              onClick={() => cambiarEmpleadoAbono(item)}

                            >

                              Cambiar empleado

                            </button>

                          </div>

                        </td>

                      </tr>

                    ))

                  )}

                </tbody>

              </table>

            </div>

          </>

        )}

      </section>



      {modalClientesAbierto && (

        <div className="modal-fondo">

          <div className="modal-vista">

            <button

              className="btn-cerrar"

              onClick={() => setModalClientesAbierto(false)}

            >

              X

            </button>



            <h3>Vista de clientes</h3>



            <input

              type="text"

              className="buscar"

              placeholder="Buscar por código, cédula, nombre, rollo o zona"

              value={busquedaCliente}

              onChange={(e) => setBusquedaCliente(e.target.value)}

            />



            <div className="tabla-contenedor">

              <table>

                <thead>

                  <tr>

                    <th>Código</th>

                    <th>Cédula</th>

                    <th>Cliente</th>

                    <th>Rollo</th>

                    <th>Saldo actual</th>

                    <th>Acción</th>

                  </tr>

                </thead>



                <tbody>

                  {clientesFiltrados.map((item) => (

                    <tr key={item.id_cliente}>

                      <td>{item.codigo}</td>

                      <td>{item.cedula}</td>

                      <td>{item.nombre}</td>

                      <td>{item.numero_rollo} - {item.rollo}</td>

                      <td>{formatoMoneda(item.saldo_actual)}</td>

                      <td>

                        <button

                          className="btn-seleccionar"

                          onClick={() => seleccionarCliente(item)}

                        >

                          Seleccionar

                        </button>

                      </td>

                    </tr>

                  ))}



                  {clientesFiltrados.length === 0 && (

                    <tr>

                      <td colSpan="6" className="sin-datos">

                        No se encontraron clientes

                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      )}



      {abonoEditarFecha && (

        <div className="modal-fondo">

          <div className="modal-vista modal-cambiar-fecha">



            <button

              type="button"

              className="btn-cerrar"

              disabled={guardandoFechaAbono}

              onClick={() => setAbonoEditarFecha(null)}

            >

              X

            </button>



            <h3>Cambiar fecha del abono</h3>



            <p>

              <strong>Cliente:</strong>{' '}

              {clienteSeleccionado?.nombre || '-'}

            </p>



            <p>

              <strong>Monto del abono:</strong>{' '}

              {formatoMoneda(abonoEditarFecha.monto)}

            </p>



            <div className="campo-cambiar-fecha">

              <label>Nueva fecha</label>



              <input

                type="date"

                value={nuevaFechaAbono}

                disabled={guardandoFechaAbono}

                onChange={(e) => setNuevaFechaAbono(e.target.value)}

              />

            </div>



            <div className="acciones-finales">

              <button

                type="button"

                className="btn-guardar"

                disabled={guardandoFechaAbono}

                onClick={guardarCambioFechaAbono}

              >

                {guardandoFechaAbono ? 'Guardando...' : 'Guardar cambio'}

              </button>

            </div>



          </div>

        </div>

      )}





      {abonoEditarEmpleado && (

        <div className="modal-fondo">

          <div className="modal-vista modal-cambiar-empleado">



            <button

              type="button"

              className="btn-cerrar"

              disabled={guardandoEmpleadoAbono}

              onClick={() => setAbonoEditarEmpleado(null)}

            >

              X

            </button>



            <h3>Cambiar empleado del abono</h3>



            <p>

              <strong>Cliente:</strong>{' '}

              {clienteSeleccionado?.nombre || '-'}

            </p>



            <p>

              <strong>Monto del abono:</strong>{' '}

              {formatoMoneda(abonoEditarEmpleado.monto)}

            </p>



            <p>

              <strong>Empleado actual:</strong>{' '}

              {abonoEditarEmpleado.codigo_empleado || '-'} -{' '}

              {abonoEditarEmpleado.empleado || '-'}

            </p>



            <div className="campo-cambiar-empleado">



              <label>Código del nuevo empleado</label>



              <input

                type="text"

                value={codigoNuevoEmpleado}

                disabled={guardandoEmpleadoAbono}

                placeholder="Digite el código del empleado"

                onChange={(e) => setCodigoNuevoEmpleado(e.target.value)}

              />



              <label>Nombre del empleado</label>



              <input

                type="text"

                readOnly

                value={

                  empleados.find(

                    (item) =>

                      String(item.codigo || '').trim().toLowerCase() ===

                        codigoNuevoEmpleado.trim().toLowerCase() &&

                      item.estado === 'A'

                  )?.nombre || ''

                }

                placeholder="Nombre del empleado"

              />



            </div>



            <div className="acciones-finales">

              <button

                type="button"

                className="btn-guardar"

                disabled={guardandoEmpleadoAbono}

                onClick={guardarCambioEmpleadoAbono}

              >

                {guardandoEmpleadoAbono

                  ? 'Guardando...'

                  : 'Guardar cambio'}

              </button>

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



            <h3>Vista de movimientos de clientes</h3>



            <div className="acciones-reporte">

              <button className="btn-imprimir" onClick={imprimirMovimientos}>

                Imprimir

              </button>



              <button className="btn-pdf" onClick={exportarPDFMovimientos}>

                Exportar PDF

              </button>



              <button className="btn-excel" onClick={exportarExcelMovimientos}>

                Exportar Excel

              </button>

            </div>



            <input

              type="text"

              className="buscar"

              placeholder="Buscar por cliente, código, fecha o tipo"

              value={busquedaMovimiento}

              onChange={(e) => setBusquedaMovimiento(e.target.value)}

            />



            <div className="movimientos-filtros">

              <div>

                <label>Cliente</label>

                <select

                  value={clienteFiltroMovimiento}

                  onChange={(e) => setClienteFiltroMovimiento(e.target.value)}

                >

                  <option value="">Todos los clientes</option>



                  {clientes.map((item) => (

                    <option key={item.id_cliente} value={item.id_cliente}>

                      {item.codigo} - {item.nombre}

                    </option>

                  ))}

                </select>

              </div>



              <div>

                <label>Tipo</label>

                <select

                  value={tipoFiltroMovimiento}

                  onChange={(e) => setTipoFiltroMovimiento(e.target.value)}

                >

                  <option value="">Todos los tipos</option>

                  <option value="ABONO">Abonos</option>
                  <option value="DESCUENTO">Descuentos</option>

                  <option value="VENTA">Ventas</option>

                  <option value="DEVOLUCION">Devoluciones</option>

                  <option value="TRANSFERENCIA_SALIDA">Transferencias enviadas</option>
                  <option value="TRANSFERENCIA_ENTRADA">Transferencias recibidas</option>

                </select>

              </div>



              <div>

                <label>Fecha desde</label>

                <input

                  type="date"

                  value={fechaDesdeMovimiento}

                  onChange={(e) => setFechaDesdeMovimiento(e.target.value)}

                />

              </div>



              <div>

                <label>Fecha hasta</label>

                <input

                  type="date"

                  value={fechaHastaMovimiento}

                  onChange={(e) => setFechaHastaMovimiento(e.target.value)}

                />

              </div>



              <div>

                <label>Orden</label>

                <select

                  value={ordenFechaMovimiento}

                  onChange={(e) => setOrdenFechaMovimiento(e.target.value)}

                >

                  <option value="DESC">Más recientes primero</option>

                  <option value="ASC">Más antiguos primero</option>

                </select>

              </div>



              <button

                type="button"

                className="btn-limpiar-filtros"

                onClick={() => {

                  setBusquedaMovimiento('');

                  setClienteFiltroMovimiento('');

                  setTipoFiltroMovimiento('');

                  setFechaDesdeMovimiento('');

                  setFechaHastaMovimiento('');

                  setOrdenFechaMovimiento('DESC');

                }}

              >

                Limpiar filtros

              </button>

            </div>



            <div className="tabla-contenedor">

              <table>

                <thead>

                  <tr>

                    <th>Fecha</th>

                    <th>Código</th>

                    <th>Cliente</th>

                    <th>Tipo</th>

                    <th>Monto</th>

                    <th>Saldo anterior</th>

                    <th>Saldo nuevo</th>

                    <th>Observación</th>

                  </tr>

                </thead>



                <tbody>

                  {movimientosOrdenados.map((item) => (

                    <tr key={item.id_movimiento_cliente}>

                      <td>{mostrarFecha(item.fecha)}</td>

                      <td>{item.codigo_cliente}</td>

                      <td>{item.cliente}</td>

                      <td>{item.tipo_movimiento}</td>

                      <td>{formatoMoneda(item.monto)}</td>

                      <td>{formatoMoneda(item.saldo_anterior)}</td>

                      <td>{formatoMoneda(item.saldo_nuevo)}</td>

                      <td>{item.observacion || '-'}</td>

                    </tr>

                  ))}



                  {movimientosFiltrados.length === 0 && (

                    <tr>

                      <td colSpan="8" className="sin-datos">

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



      {modalClienteDestinoAbierto && (

        <div className="modal-fondo" style={{ zIndex: 3000 }}>

          <div className="modal-vista">

            <button

              className="btn-cerrar"

              onClick={() => setModalClienteDestinoAbierto(false)}

            >

              X

            </button>



            <h3>Vista de clientes destino</h3>



            <input

              type="text"

              className="buscar"

              placeholder="Buscar por código, cédula, nombre, rollo o zona"

              value={busquedaClienteDestino}

              onChange={(e) => setBusquedaClienteDestino(e.target.value)}

            />



            <div className="tabla-contenedor">

              <table>

                <thead>

                  <tr>

                    <th>Código</th>

                    <th>Cédula</th>

                    <th>Cliente</th>

                    <th>Rollo</th>

                    <th>Saldo actual</th>

                    <th>Acción</th>

                  </tr>

                </thead>



                <tbody>

                  {clientesDestinoFiltrados.map((item) => (

                    <tr key={item.id_cliente}>

                      <td>{item.codigo}</td>

                      <td>{item.cedula}</td>

                      <td>{item.nombre}</td>

                      <td>{item.numero_rollo} - {item.rollo}</td>

                      <td>{formatoMoneda(item.saldo_actual)}</td>

                      <td>

                        <button

                          className="btn-seleccionar"

                          onClick={() => seleccionarClienteDestino(item)}

                        >

                          Seleccionar

                        </button>

                      </td>

                    </tr>

                  ))}



                  {clientesDestinoFiltrados.length === 0 && (

                    <tr>

                      <td colSpan="6" className="sin-datos">

                        No se encontraron clientes destino

                      </td>

                    </tr>

                  )}

                </tbody>

              </table>

            </div>

          </div>

        </div>

      )}










      {/* Ventana de transferencias de saldo. */}
      {modalTransferenciasAbierto && (
        <div className="modal-fondo">
          <div
            className="modal-vista"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-transferencias"
            style={{ width: 'min(1050px, 96vw)', maxWidth: '1050px', maxHeight: '92vh', overflowY: 'auto' }}
          >
            <button
              type="button"
              className="btn-cerrar"
              disabled={guardandoTransferencia}
              onClick={() => setModalTransferenciasAbierto(false)}
            >X</button>
            <h3 id="titulo-transferencias">Transferencias de saldos</h3>

            <h4>Cliente que envía saldo</h4>
            <div className="cliente-info" style={{ marginTop: '14px', marginBottom: '22px' }}>
              <p><strong>Código:</strong> {clienteSeleccionado?.codigo || '-'}</p>
              <p><strong>Cliente:</strong> {clienteSeleccionado?.nombre || '-'}</p>
              <p><strong>Rollo:</strong> {clienteSeleccionado ? `${clienteSeleccionado.numero_rollo || '-'} - ${clienteSeleccionado.rollo || '-'}` : '-'}</p>
              <p><strong>Saldo disponible:</strong> {formatoMoneda(clienteSeleccionado?.saldo_actual || 0)}</p>
            </div>

            <h4>Cliente que recibe saldo</h4>
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <div>
                <label>Código del cliente que recibe</label>
                <div className="campo-con-boton" style={{ display: 'flex', gap: '8px' }}>
                  <input
                    style={{ flex: 1, minWidth: 0 }}
                    ref={codigoClienteDestinoTransferenciaRef}
                    autoFocus
                    type="text"
                    value={codigoClienteDestinoTransferencia}
                    placeholder="Digite el código del cliente"
                    onChange={(e) => {
                      setCodigoClienteDestinoTransferencia(e.target.value);
                      setClienteDestinoSeleccionado(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        buscarClienteDestinoPorCodigo();
                      }
                    }}
                  />
                  <button type="button" className="btn-vista" onClick={() => setModalClienteDestinoAbierto(true)}>Vista</button>
                </div>
              </div>
              <div>
                <label>Nombre del cliente que recibe</label>
                <input type="text" readOnly value={clienteDestinoSeleccionado?.nombre || ''} placeholder="Nombre automático" />
              </div>
              <div>
                <label>Saldo actual del cliente que recibe</label>
                <input type="text" readOnly value={clienteDestinoSeleccionado ? formatoMoneda(clienteDestinoSeleccionado.saldo_actual) : ''} placeholder="Saldo automático" />
              </div>
              <div>
                <label>Saldo después de la transferencia</label>
                <input type="text" readOnly value={clienteDestinoSeleccionado && Number(montoTransferencia) > 0 && Number.isFinite(Number(montoTransferencia)) ? formatoMoneda(Number(clienteDestinoSeleccionado.saldo_actual || 0) + Number(montoTransferencia)) : ''} placeholder="Saldo estimado" />
              </div>
            </div>

            <h4 style={{ marginTop: '22px' }}>Detalles de la transferencia</h4>
            <div className="form-grid" style={{ marginTop: '12px' }}>
              <div>
                <label>Monto de la transferencia</label>
                <input
                  ref={montoTransferenciaRef}
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={montoTransferencia}
                  placeholder="Digite el monto"
                  onChange={(e) => setMontoTransferencia(e.target.value)}
                  onKeyDown={(e) => manejarEnter(e, fechaTransferenciaRef)}
                />
              </div>
              <div>
                <label>Fecha</label>
                <input
                  ref={fechaTransferenciaRef}
                  type="date"
                  value={fechaTransferencia}
                  onChange={(e) => setFechaTransferencia(e.target.value)}
                  onKeyDown={(e) => manejarEnter(e, codigoEmpleadoTransferenciaRef)}
                />
              </div>
              <div>
                <label>Código de empleado</label>
                <input
                  ref={codigoEmpleadoTransferenciaRef}
                  type="text"
                  value={codigoEmpleadoTransferencia}
                  placeholder="Digite el código del empleado"
                  onChange={(e) => setCodigoEmpleadoTransferencia(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    if (!empleadoParaTransferencia) return alert('Digite un código de empleado válido y activo');
                    descripcionTransferenciaRef.current?.focus();
                  }}
                />
              </div>
              <div>
                <label>Nombre del empleado</label>
                <input type="text" readOnly value={empleadoParaTransferencia?.nombre || ''} placeholder="Nombre automático" />
              </div>
              <div className="campo-doble">
                <label>Descripción (opcional)</label>
                <input
                  ref={descripcionTransferenciaRef}
                  type="text"
                  value={descripcionTransferencia}
                  placeholder="Si queda vacía: ENVÍO DE TRANSFERENCIA"
                  onChange={(e) => setDescripcionTransferencia(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      guardarTransferencia();
                    }
                  }}
                />
              </div>
            </div>

            <div className="acciones-finales">
              <button
                type="button"
                className="btn-guardar"
                disabled={guardandoTransferencia}
                onClick={guardarTransferencia}
              >{guardandoTransferencia ? 'Guardando...' : 'Guardar transferencia'}</button>
            </div>

            <h3 style={{ marginTop: '32px', marginBottom: '16px' }}>Transferencias enviadas por el cliente</h3>
            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo transf.</th>
                    <th>Otro Cte.</th>
                    <th>Nombre</th>
                    <th>Monto</th>
                    <th>Empleado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cargandoTransferencias ? (
                    <tr><td colSpan="7" className="sin-datos">Cargando transferencias...</td></tr>
                  ) : transferenciasCliente.length === 0 ? (
                    <tr><td colSpan="7" className="sin-datos">Este cliente no tiene transferencias enviadas.</td></tr>
                  ) : transferenciasCliente.map((item) => {
                    const destino = clientes.find((c) => Number(c.id_cliente) === Number(item.id_cliente_relacionado));
                    return (
                      <tr key={item.id_movimiento_cliente}>
                        <td>{mostrarFecha(item.fecha)}</td>
                        <td>{item.observacion || 'ENVÍO DE TRANSFERENCIA'}</td>
                        <td>{destino?.codigo || '-'}</td>
                        <td>{destino?.nombre || '-'}</td>
                        <td>{formatoMoneda(item.monto)}</td>
                        <td>{item.codigo_empleado ? `${item.codigo_empleado} - ${item.empleado || ''}` : '-'}</td>
                        <td>
                        <button
                          type="button"
                          className="btn-eliminar"
                          onClick={() => eliminarTransferencia(item)}
                          disabled={eliminandoTransferenciaId !== null}
                        >
                          {eliminandoTransferenciaId === item.id_movimiento_cliente
                            ? 'Eliminando...'
                            : 'Eliminar'}
                        </button>
                      </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

        {/* Ventana de descuentos, similar a la del sistema anterior. */}
        {modalDescuentosAbierto && (
          <div className="modal-fondo">
            <div
              className="modal-vista"
              role="dialog"
              aria-modal="true"
              aria-labelledby="titulo-descuentos"
              style={{ width: 'min(1050px, 96vw)', maxWidth: '1050px', maxHeight: '92vh', overflowY: 'auto' }}
            >
              <button
                type="button"
                className="btn-cerrar"
                disabled={guardandoDescuento}
                onClick={() => setModalDescuentosAbierto(false)}
              >
                X
              </button>
              <h3 id="titulo-descuentos">Descuentos</h3>
              <div className="cliente-info" style={{ marginTop: '24px', marginBottom: '28px' }}>
                <p><strong>Código:</strong> {clienteDescuento?.codigo || '-'}</p>
                <p><strong>Cliente:</strong> {clienteDescuento?.nombre || '-'}</p>
                <p><strong>Rollo:</strong> {rolloParaDescuento ? `${rolloParaDescuento.numero} - ${rolloParaDescuento.descripcion}` : '-'}</p>
                <p><strong>Saldo actual:</strong> {formatoMoneda(clienteDescuento?.saldo_actual || 0)}</p>
              </div>

              <div className="form-grid">
                <div>
                  <label>Monto del descuento</label>
                  <input
                    ref={montoDescuentoRef}
                    autoFocus
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={montoDescuento}
                    placeholder="Digite el monto"
                    onChange={(e) => setMontoDescuento(e.target.value)}
                    onKeyDown={(e) => manejarEnter(e, fechaDescuentoRef)}
                  />
                </div>
                <div>
                  <label>Fecha</label>
                  <input
                    ref={fechaDescuentoRef}
                    type="date"
                    value={fechaDescuento}
                    onChange={(e) => setFechaDescuento(e.target.value)}
                    onKeyDown={(e) => manejarEnter(e, descripcionDescuentoRef)}
                  />
                </div>
                <div className="campo-doble">
                  <label>Descripción o motivo del descuento</label>
                  <input
                    ref={descripcionDescuentoRef}
                    type="text"
                    value={descripcionDescuento}
                    placeholder="Ejemplo: Producto roto"
                    onChange={(e) => setDescripcionDescuento(e.target.value)}
                    onKeyDown={(e) => manejarEnter(e, codigoEmpleadoDescuentoRef)}
                  />
                </div>
                <div>
                  <label>Código de empleado</label>
                  <input
                    ref={codigoEmpleadoDescuentoRef}
                    type="text"
                    value={codigoEmpleadoDescuento}
                    placeholder="Digite el código del empleado"
                    onChange={(e) => setCodigoEmpleadoDescuento(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      e.preventDefault();
                      if (!empleadoParaDescuento) {
                        alert('Digite el código de un empleado activo');
                        return;
                      }
                      guardarDescuentoRef.current?.focus();
                    }}
                  />
                </div>
                <div>
                  <label>Nombre del empleado</label>
                  <input
                    type="text"
                    readOnly
                    value={empleadoParaDescuento?.nombre || ''}
                    placeholder="Nombre del empleado"
                  />
                </div>
              </div>

              <div className="acciones-finales">
                <button
                  ref={guardarDescuentoRef}
                  type="button"
                  className="btn-guardar"
                  disabled={guardandoDescuento}
                  onClick={guardarDescuento}
                >
                  {guardandoDescuento ? 'Guardando...' : 'Guardar descuento'}
                </button>
              </div>

              <h3 style={{ marginTop: '32px', marginBottom: '20px' }}>Historial de descuentos del cliente</h3>
              {!clienteDescuento ? (
                <p className="sin-datos">Seleccione un cliente para ver sus descuentos.</p>
              ) : (
                <>
                  <p><strong>Cliente:</strong> {clienteDescuento.codigo} - {clienteDescuento.nombre}</p>
                  <div className="tabla-contenedor">
                    <table>
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Monto</th>
                          <th>Rollo</th>
                          <th>Empleado</th>
                          <th>Descripción</th>
                          <th>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cargandoDescuentos ? (
                          <tr><td colSpan="6" className="sin-datos">Cargando descuentos...</td></tr>
                        ) : descuentosCliente.length === 0 ? (
                          <tr><td colSpan="6" className="sin-datos">Este cliente no tiene descuentos registrados.</td></tr>
                        ) : (
                          descuentosCliente.map((item) => (
                            <tr key={item.id_movimiento_cliente}>
                              <td>{mostrarFecha(item.fecha)}</td>
                              <td>{formatoMoneda(item.monto)}</td>
                              <td>{item.numero_rollo ? `${item.numero_rollo} - ${item.rollo || ''}` : '-'}</td>
                              <td>{item.codigo_empleado ? `${item.codigo_empleado} - ${item.empleado || ''}` : '-'}</td>
                              <td>{item.observacion || '-'}</td>
                              <td>
                                <button
                                  type="button"
                                  className="btn-eliminar-descuento"
                                  disabled={eliminandoDescuentoId !== null}
                                  onClick={() => eliminarDescuento(item)}
                                >
                                  {eliminandoDescuentoId === item.id_movimiento_cliente ? 'Eliminando...' : 'Eliminar'}
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {modalDevolucionesAbierto && (
          <DevolucionesModal
            cliente={clienteSeleccionado}
            rollo={rolloSeleccionado}
            empleados={empleados}
            empleadoInicial={empleadoSeleccionado}
            onCerrar={() => setModalDevolucionesAbierto(false)}
            onGuardado={(datos) => {
              setClienteSeleccionado((anterior) =>
                anterior ? { ...anterior, saldo_actual: datos.saldo_nuevo } : anterior
              );
              cargarClientes();
              cargarMovimientos();
            }}
          />
        )}

      {moduloPendiente && (

          <div className="modal-fondo">

              <div

                  className="modal-vista modal-pendiente"

                  role="dialog"

                  aria-modal="true"

                  aria-labelledby="titulo-modulo-pendiente"

              >

                  <button

                      type="button"

                      className="btn-cerrar"

                      onClick={() => setModuloPendiente(null)}

                  >

                      X

                  </button>



                  <div className="modal-pendiente-icono">

                      ⚙

                  </div>



                  <h3 id="titulo-modulo-pendiente">

                      {moduloPendiente}

                  </h3>



                  <h4>Módulo pendiente de desarrollo</h4>



                  <p>

                      Esta funcionalidad todavía no se encuentra

                      disponible. Será incorporada próximamente

                      al sistema.

                  </p>



                  <button

                      type="button"

                      className="btn-guardar"

                      onClick={() => setModuloPendiente(null)}

                  >

                      Entendido

                  </button>

              </div>

          </div>

      )}



    </div>

  );

}



export default Transacciones;