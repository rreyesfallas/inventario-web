import { useEffect, useState,useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Efectivo.css';

// Fecha de hoy en hora local (Costa Rica), formato YYYY-MM-DD.
const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

function Efectivo() {
  const navigate = useNavigate();

  const [rollos, setRollos] = useState([]);
  const [empleados, setEmpleados] = useState([]);

  const [cobros, setCobros] = useState([]);
  const [detalleCobro, setDetalleCobro] = useState([]);
  const [cobroSeleccionado, setCobroSeleccionado] = useState(null);

  const [modalCobrosAbierto, setModalCobrosAbierto] = useState(false);
  const [modalDetalleCobroAbierto, setModalDetalleCobroAbierto] = useState(false);

  const [busquedaCobro, setBusquedaCobro] = useState('');

  const [fechaFiltroCobro, setFechaFiltroCobro] = useState('');
  const [rolloFiltroCobro, setRolloFiltroCobro] = useState('');

  const [cobro, setCobro] = useState({
    fecha: fechaLocalHoy(),
    id_rollo: ''
  });

  const [detalleActual, setDetalleActual] = useState({
    id_empleado: '',
    efectivo: '',
    sinpe: ''
  });

  const [detalle, setDetalle] = useState([]);

    // Lo que se digita en pantalla (número de rollo y código de empleado).
  const [numeroRollo, setNumeroRollo] = useState('');
  const [codigoEmpleado, setCodigoEmpleado] = useState('');
  const [guardandoCobro, setGuardandoCobro] = useState(false);

  // Para saltar de un campo a otro con Enter.
  const fechaRef = useRef(null);
  const rolloRef = useRef(null);
  const empleadoRef = useRef(null);
  const efectivoRef = useRef(null);
  const sinpeRef = useRef(null);

  const cargarRollos = async () => {
    try {
      const respuesta = await fetch('/api/rollos');
      const datos = await respuesta.json();
      setRollos(datos);
    } catch (error) {
      console.error('Error cargando rollos:', error);
      alert('Error al cargar rollos');
    }
  };

  const cargarEmpleados = async () => {
    try {
      const respuesta = await fetch('/api/empleados');
      const datos = await respuesta.json();
      setEmpleados(datos);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      alert('Error al cargar empleados');
    }
  };

  const cargarCobros = async () => {
    try {
      const respuesta = await fetch('/api/cobros-efectivo');
      const datos = await respuesta.json();
      setCobros(datos);
    } catch (error) {
      console.error('Error cargando cobros:', error);
      alert('Error al cargar cobros');
    }
  };

  useEffect(() => {
    cargarRollos();
    cargarEmpleados();
    cargarCobros();
  }, []);

  const cambiarCobro = (e) => {
    const { name, value } = e.target;

    setCobro({
      ...cobro,
      [name]: value
    });
  };

  const cambiarDetalleActual = (e) => {
    const { name, value } = e.target;

    setDetalleActual({
      ...detalleActual,
      [name]: value
    });
  };

  const rolloSeleccionado = rollos.find(
    (item) => String(item.id_rollo) === String(cobro.id_rollo)
  );

  const empleadoActual = empleados.find(
    (item) => String(item.id_empleado) === String(detalleActual.id_empleado)
  );

  const manejarEnter = (e, siguienteRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      siguienteRef.current?.focus();
    }
  };

  const buscarRolloPorNumero = () => {
    const numero = numeroRollo.trim();

    if (!numero) {
      alert('Digite el número del rollo');
      return;
    }

    const encontrado = rollos.find(
      (item) =>
        String(item.numero).trim() === numero &&
        (!item.estado || item.estado === 'A')
    );

    if (!encontrado) {
      alert('No se encontró un rollo activo con ese número');
      setCobro((anterior) => ({ ...anterior, id_rollo: '' }));
      return;
    }

    setCobro((anterior) => ({ ...anterior, id_rollo: String(encontrado.id_rollo) }));
    empleadoRef.current?.focus();
  };

  const buscarEmpleadoPorCodigo = () => {
    const codigo = codigoEmpleado.trim().toLowerCase();

    // Código vacío + Enter = guardar el cobro.
    if (!codigo) {
      guardarCobro();
      return;
    }

    const encontrado = empleados.find(
      (item) =>
        String(item.codigo || '').trim().toLowerCase() === codigo &&
        item.estado === 'A'
    );

    if (!encontrado) {
      alert('No se encontró un empleado activo con ese código');
      setDetalleActual((anterior) => ({ ...anterior, id_empleado: '' }));
      return;
    }

    if (detalle.some((item) => item.id_empleado === encontrado.id_empleado)) {
      alert('Ese empleado ya fue agregado a este cobro');
      return;
    }

    setDetalleActual((anterior) => ({
      ...anterior,
      id_empleado: String(encontrado.id_empleado)
    }));

    efectivoRef.current?.focus();
  };

  const agregarDetalle = () => {
    if (!empleadoActual) {
      alert('Digite el código del empleado y presione Enter');
      empleadoRef.current?.focus();
      return;
    }

    const efectivo = Number(detalleActual.efectivo || 0);
    const sinpe = Number(detalleActual.sinpe || 0);

    if (!Number.isFinite(efectivo) || !Number.isFinite(sinpe) || efectivo < 0 || sinpe < 0) {
      alert('Los montos no pueden ser negativos');
      efectivoRef.current?.focus();
      return;
    }

    if (efectivo === 0 && sinpe === 0) {
      alert('Debe ingresar efectivo o SINPE');
      efectivoRef.current?.focus();
      return;
    }

    if (detalle.some((item) => item.id_empleado === empleadoActual.id_empleado)) {
      alert('Ese empleado ya fue agregado a este cobro');
      return;
    }

    setDetalle((anterior) => [
      ...anterior,
      {
        id_empleado: Number(empleadoActual.id_empleado),
        codigo: empleadoActual.codigo,
        empleado: empleadoActual.nombre,
        efectivo,
        sinpe,
        total: Math.round((efectivo + sinpe) * 100) / 100
      }
    ]);

    // Limpiar y volver al código de empleado para el siguiente cobrador.
    setDetalleActual({ id_empleado: '', efectivo: '', sinpe: '' });
    setCodigoEmpleado('');
    empleadoRef.current?.focus();
  };

  const eliminarDetalle = (idEmpleado) => {
    setDetalle(detalle.filter((item) => item.id_empleado !== idEmpleado));
  };

  const guardarCobro = async () => {
    if (guardandoCobro) return;

    if (!cobro.fecha) {
      alert('Seleccione la fecha del cobro');
      fechaRef.current?.focus();
      return;
    }

    if (!cobro.id_rollo) {
      alert('Digite el número del rollo y presione Enter');
      rolloRef.current?.focus();
      return;
    }

    if (detalle.length === 0) {
      alert('Debe agregar al menos un cobrador');
      empleadoRef.current?.focus();
      return;
    }

    const confirmar = window.confirm(
      `¿Guardar el cobro del rollo ${rolloSeleccionado?.numero} - ${rolloSeleccionado?.descripcion}?\n\n` +
      `Total: ${formatoMoneda(totalGeneral)}`
    );

    if (!confirmar) {
      empleadoRef.current?.focus();
      return;
    }

    try {
      setGuardandoCobro(true);

      const respuesta = await fetch('/api/cobros-efectivo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...cobro, detalle })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar cobro');
        return;
      }

      alert(datos.mensaje);

      setCobro({ fecha: fechaLocalHoy(), id_rollo: '' });
      setNumeroRollo('');
      setCodigoEmpleado('');
      setDetalle([]);
      setDetalleActual({ id_empleado: '', efectivo: '', sinpe: '' });

      cargarCobros();
      rolloRef.current?.focus();
    } catch (error) {
      console.error('Error guardando cobro:', error);
      alert('Error al guardar cobro');
    } finally {
      setGuardandoCobro(false);
    }
  };

  const verDetalleCobro = async (item) => {
    try {
      const respuesta = await fetch(
        `/api/cobros-efectivo/${item.id_cobro}/detalle`
      );

      const datos = await respuesta.json();

      setCobroSeleccionado(item);
      setDetalleCobro(datos);
      setModalDetalleCobroAbierto(true);
    } catch (error) {
      console.error('Error cargando detalle del cobro:', error);
      alert('Error al cargar detalle del cobro');
    }
  };

  const totalEfectivo = detalle.reduce((acum, item) => acum + item.efectivo, 0);
  const totalSinpe = detalle.reduce((acum, item) => acum + item.sinpe, 0);
  const totalGeneral = detalle.reduce((acum, item) => acum + item.total, 0);

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

  const cobrosFiltrados = cobros.filter((item) => {
    const texto = busquedaCobro.toLowerCase();

    const coincideBusqueda =
      String(item.numero_rollo || '').toLowerCase().includes(texto) ||
      item.rollo?.toLowerCase().includes(texto) ||
      String(item.fecha || '').toLowerCase().includes(texto);

    const fechaCobro = obtenerFechaFiltro(item.fecha);

    const coincideFecha =
      !fechaFiltroCobro || fechaCobro === fechaFiltroCobro;

    const coincideRollo =
      !rolloFiltroCobro || String(item.id_rollo) === String(rolloFiltroCobro);

    return coincideBusqueda && coincideFecha && coincideRollo;
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

  const imprimirDetalleCobro = () => {
    if (!cobroSeleccionado) {
      alert('Primero debe seleccionar un cobro');
      return;
    }

    window.print();
  };

  const exportarPDFDetalleCobro = () => {
    if (!cobroSeleccionado) {
      alert('Primero debe seleccionar un cobro');
      return;
    }

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Sistema de Inventario', 14, 15);

    doc.setFontSize(14);
    doc.text('Reporte de Cobro de Efectivo', 14, 25);

    doc.setFontSize(10);
    doc.text(`Fecha: ${mostrarFecha(cobroSeleccionado.fecha)}`,
      14,
      35
    );

    doc.text(
      `Rollo: ${cobroSeleccionado.numero_rollo} - ${cobroSeleccionado.rollo}`,
      14,
      42
    );

    doc.text(
      `Total efectivo: ${formatoMonedaReporte(cobroSeleccionado.total_efectivo)}`,
      14,
      49
    );

    doc.text(
      `Total SINPE: ${formatoMonedaReporte(cobroSeleccionado.total_sinpe)}`,
      14,
      56
    );

    doc.text(
      `Total general: ${formatoMonedaReporte(cobroSeleccionado.total_general)}`,
      14,
      63
    );

    autoTable(doc, {
      startY: 73,
      head: [[
        'Código',
        'Empleado',
        'Efectivo',
        'SINPE',
        'Total'
      ]],
      body: detalleCobro.map((item) => [
        item.codigo_empleado,
        item.empleado,
        formatoMonedaReporte(item.efectivo),
        formatoMonedaReporte(item.sinpe),
        formatoMonedaReporte(item.total)
      ])
    });

    doc.save(`cobro-efectivo-${cobroSeleccionado.id_cobro}.pdf`);
  };

  const exportarExcelDetalleCobro = () => {
    if (!cobroSeleccionado) {
      alert('Primero debe seleccionar un cobro');
      return;
    }

    const datosResumen = [
      ['Reporte de Cobro de Efectivo'],
      [],
      ['Fecha', mostrarFecha(cobroSeleccionado.fecha)],
      ['Rollo', `${cobroSeleccionado.numero_rollo} - ${cobroSeleccionado.rollo}`],
      ['Total efectivo', Number(cobroSeleccionado.total_efectivo || 0)],
      ['Total SINPE', Number(cobroSeleccionado.total_sinpe || 0)],
      ['Total general', Number(cobroSeleccionado.total_general || 0)]
    ];

    const datosDetalle = detalleCobro.map((item) => ({
      Código: item.codigo_empleado,
      Empleado: item.empleado,
      Efectivo: Number(item.efectivo || 0),
      SINPE: Number(item.sinpe || 0),
      Total: Number(item.total || 0)
    }));

    const hojaResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    const hojaDetalle = XLSX.utils.json_to_sheet(datosDetalle);

    hojaResumen['!cols'] = [
      { wch: 24 },
      { wch: 30 }
    ];

    hojaDetalle['!cols'] = [
      { wch: 12 },
      { wch: 30 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');
    XLSX.utils.book_append_sheet(libro, hojaDetalle, 'Detalle cobradores');

    XLSX.writeFile(libro, `cobro-efectivo-${cobroSeleccionado.id_cobro}.xlsx`);
  };

  const mostrarFecha = (fecha) => {
    const fechaNormalizada = obtenerFechaFiltro(fecha);

    if (!fechaNormalizada) return '-';

    const [anio, mes, dia] = fechaNormalizada.split('-');

    return `${Number(dia)}/${Number(mes)}/${anio}`;
  };

  return (
    <div className="efectivo-page">
      <header className="efectivo-header">
        <h2>Efectivo</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <div className="barra-acciones">
        <button
          className="btn-vista"
          onClick={() => setModalCobrosAbierto(true)}
        >
          Vista de cobros
        </button>
      </div>

      <section className="efectivo-card">
        <h3>Datos del cobro</h3>

        <div className="form-grid datos-cobro-grid">
          <div>
            <label>Fecha</label>
            <input
              ref={fechaRef}
              type="date"
              name="fecha"
              value={cobro.fecha}
              onChange={cambiarCobro}
              onKeyDown={(e) => manejarEnter(e, rolloRef)}
            />
          </div>

          <div>
            <label>Número de rollo</label>
            <input
              ref={rolloRef}
              autoFocus
              type="text"
              value={numeroRollo}
              placeholder="Digite el número del rollo"
              onChange={(e) => {
                setNumeroRollo(e.target.value);
                setCobro((anterior) => ({ ...anterior, id_rollo: '' }));
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
              readOnly
              tabIndex={-1}
              value={rolloSeleccionado?.descripcion || ''}
              placeholder="Descripción del rollo"
            />
          </div>
        </div>
      </section>

      <section className="efectivo-card">
        <h3>Agregar cobrador</h3>

        <div className="form-grid detalle-grid">
          <div>
            <label>Código de empleado</label>
            <input
              ref={empleadoRef}
              type="text"
              value={codigoEmpleado}
              placeholder="Código del empleado"
              onChange={(e) => {
                setCodigoEmpleado(e.target.value);
                setDetalleActual((anterior) => ({ ...anterior, id_empleado: '' }));
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
              readOnly
              tabIndex={-1}
              value={empleadoActual?.nombre || ''}
              placeholder="Nombre del empleado"
            />
          </div>

          <div>
            <label>Efectivo</label>
            <input
              ref={efectivoRef}
              type="number"
              name="efectivo"
              value={detalleActual.efectivo}
              onChange={cambiarDetalleActual}
              onKeyDown={(e) => manejarEnter(e, sinpeRef)}
              min="0"
              step="0.01"
              placeholder="0"
            />
          </div>

          <div>
            <label>SINPE Móvil</label>
            <input
              ref={sinpeRef}
              type="number"
              name="sinpe"
              value={detalleActual.sinpe}
              onChange={cambiarDetalleActual}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  agregarDetalle();
                }
              }}
              min="0"
              step="0.01"
              placeholder="0"
            />
          </div>

          <div className="detalle-boton">
            <button type="button" onClick={agregarDetalle}>Agregar cobrador</button>
          </div>
        </div>


      </section>

      <section className="efectivo-card">
        <h3>Detalle del cobro</h3>

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Empleado</th>
                <th>Efectivo</th>
                <th>SINPE</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {detalle.map((item) => (
                <tr key={item.id_empleado}>
                  <td>{item.codigo}</td>
                  <td>{item.empleado}</td>
                  <td>{formatoMoneda(item.efectivo)}</td>
                  <td>{formatoMoneda(item.sinpe)}</td>
                  <td>{formatoMoneda(item.total)}</td>
                  <td>
                    <button
                      className="btn-eliminar"
                      onClick={() => eliminarDetalle(item.id_empleado)}
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}

              {detalle.length === 0 && (
                <tr>
                  <td colSpan="6" className="sin-datos">
                    No hay cobradores agregados
                  </td>
                </tr>
              )}
            </tbody>

            <tfoot>
              <tr>
                <td colSpan="2" className="total-label">Totales</td>
                <td className="total-valor">{formatoMoneda(totalEfectivo)}</td>
                <td className="total-valor">{formatoMoneda(totalSinpe)}</td>
                <td className="total-valor">{formatoMoneda(totalGeneral)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="acciones-finales">
          <button
            type="button"
            className="btn-guardar"
            disabled={guardandoCobro}
            onClick={guardarCobro}
          >
            {guardandoCobro ? 'Guardando...' : 'Guardar cobro'}
          </button>
        </div>
      </section>

      {modalCobrosAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalCobrosAbierto(false)}
            >
              X
            </button>

            <h3>Vista de cobros registrados</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por fecha, rollo o zona"
              value={busquedaCobro}
              onChange={(e) => setBusquedaCobro(e.target.value)}
            />

            <div className="cobros-filtros">
              <input
                type="date"
                value={fechaFiltroCobro}
                onChange={(e) => setFechaFiltroCobro(e.target.value)}
              />

              <select
                value={rolloFiltroCobro}
                onChange={(e) => setRolloFiltroCobro(e.target.value)}
              >
                <option value="">Todos los rollos</option>

                {rollos.map((item) => (
                  <option key={item.id_rollo} value={item.id_rollo}>
                    {item.numero} - {item.descripcion}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn-limpiar-filtros"
                onClick={() => {
                  setBusquedaCobro('');
                  setFechaFiltroCobro('');
                  setRolloFiltroCobro('');
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
                    <th>Rollo</th>
                    <th>Total efectivo</th>
                    <th>Total SINPE</th>
                    <th>Total general</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {cobrosFiltrados.map((item) => (
                    <tr key={item.id_cobro}>
                      <td>{mostrarFecha(item.fecha)}</td>
                      <td>{item.numero_rollo} - {item.rollo}</td>
                      <td>{formatoMoneda(item.total_efectivo)}</td>
                      <td>{formatoMoneda(item.total_sinpe)}</td>
                      <td>{formatoMoneda(item.total_general)}</td>
                      <td>
                        <button
                          className="btn-seleccionar"
                          onClick={() => verDetalleCobro(item)}
                        >
                          Ver detalle
                        </button>
                      </td>
                    </tr>
                  ))}

                  {cobrosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="sin-datos">
                        No hay cobros registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalDetalleCobroAbierto && cobroSeleccionado && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalDetalleCobroAbierto(false)}
            >
              X
            </button>

            <h3>Detalle del cobro</h3>

            <div className="detalle-info">
              <p><strong>Fecha:</strong> {new Date(cobroSeleccionado.fecha).toLocaleDateString('es-CR')}</p>
              <p><strong>Rollo:</strong> {cobroSeleccionado.numero_rollo} - {cobroSeleccionado.rollo}</p>
              <p><strong>Total efectivo:</strong> {formatoMoneda(cobroSeleccionado.total_efectivo)}</p>
              <p><strong>Total SINPE:</strong> {formatoMoneda(cobroSeleccionado.total_sinpe)}</p>
              <p><strong>Total general:</strong> {formatoMoneda(cobroSeleccionado.total_general)}</p>
            </div>

            <div className="acciones-reporte">
              <button className="btn-imprimir" onClick={imprimirDetalleCobro}>
                Imprimir
              </button>

              <button className="btn-pdf" onClick={exportarPDFDetalleCobro}>
                Exportar PDF
              </button>

              <button className="btn-excel" onClick={exportarExcelDetalleCobro}>
                Exportar Excel
              </button>
            </div>

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Empleado</th>
                    <th>Efectivo</th>
                    <th>SINPE</th>
                    <th>Total</th>
                  </tr>
                </thead>

                <tbody>
                  {detalleCobro.map((item) => (
                    <tr key={item.id_detalle}>
                      <td>{item.codigo_empleado}</td>
                      <td>{item.empleado}</td>
                      <td>{formatoMoneda(item.efectivo)}</td>
                      <td>{formatoMoneda(item.sinpe)}</td>
                      <td>{formatoMoneda(item.total)}</td>
                    </tr>
                  ))}

                  {detalleCobro.length === 0 && (
                    <tr>
                      <td colSpan="5" className="sin-datos">
                        No hay detalle para este cobro
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

export default Efectivo;