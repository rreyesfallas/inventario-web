import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Efectivo.css';

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

  const [cobro, setCobro] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    id_rollo: ''
  });

  const [detalleActual, setDetalleActual] = useState({
    id_empleado: '',
    efectivo: '',
    sinpe: ''
  });

  const [detalle, setDetalle] = useState([]);

  const cargarRollos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/rollos');
      const datos = await respuesta.json();
      setRollos(datos);
    } catch (error) {
      console.error('Error cargando rollos:', error);
      alert('Error al cargar rollos');
    }
  };

  const cargarEmpleados = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/empleados');
      const datos = await respuesta.json();
      setEmpleados(datos);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      alert('Error al cargar empleados');
    }
  };

  const cargarCobros = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/cobros-efectivo');
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

  const agregarDetalle = () => {
    if (!detalleActual.id_empleado) {
      alert('Seleccione un empleado');
      return;
    }

    const efectivo = Number(detalleActual.efectivo || 0);
    const sinpe = Number(detalleActual.sinpe || 0);

    if (efectivo < 0 || sinpe < 0) {
      alert('Los montos no pueden ser negativos');
      return;
    }

    if (efectivo === 0 && sinpe === 0) {
      alert('Debe ingresar efectivo o SINPE');
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (item) => String(item.id_empleado) === String(detalleActual.id_empleado)
    );

    if (!empleadoSeleccionado) {
      alert('Empleado no válido');
      return;
    }

    const yaExiste = detalle.some(
      (item) => String(item.id_empleado) === String(detalleActual.id_empleado)
    );

    if (yaExiste) {
      alert('Ese empleado ya fue agregado');
      return;
    }

    const nuevoDetalle = {
      id_empleado: Number(detalleActual.id_empleado),
      codigo: empleadoSeleccionado.codigo,
      empleado: empleadoSeleccionado.nombre,
      efectivo,
      sinpe,
      total: efectivo + sinpe
    };

    setDetalle([...detalle, nuevoDetalle]);

    setDetalleActual({
      id_empleado: '',
      efectivo: '',
      sinpe: ''
    });
  };

  const eliminarDetalle = (idEmpleado) => {
    setDetalle(detalle.filter((item) => item.id_empleado !== idEmpleado));
  };

  const guardarCobro = async () => {
    if (!cobro.fecha || !cobro.id_rollo) {
      alert('Fecha y rollo son obligatorios');
      return;
    }

    if (detalle.length === 0) {
      alert('Debe agregar al menos un cobrador');
      return;
    }

    try {
      const respuesta = await fetch('http://localhost:3001/api/cobros-efectivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...cobro,
          detalle
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar cobro');
        return;
      }

      alert(datos.mensaje);

      setCobro({
        fecha: new Date().toISOString().slice(0, 10),
        id_rollo: ''
      });

      setDetalle([]);
      setDetalleActual({
        id_empleado: '',
        efectivo: '',
        sinpe: ''
      });

      cargarCobros();
    } catch (error) {
      console.error('Error guardando cobro:', error);
      alert('Error al guardar cobro');
    }
  };

  const verDetalleCobro = async (item) => {
    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/cobros-efectivo/${item.id_cobro}/detalle`
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

  const cobrosFiltrados = cobros.filter((item) => {
    const texto = busquedaCobro.toLowerCase();

    return (
      String(item.numero_rollo || '').toLowerCase().includes(texto) ||
      item.rollo?.toLowerCase().includes(texto) ||
      String(item.fecha || '').toLowerCase().includes(texto)
    );
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
    doc.text(
      `Fecha: ${new Date(cobroSeleccionado.fecha).toLocaleDateString('es-CR')}`,
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
      ['Fecha', new Date(cobroSeleccionado.fecha).toLocaleDateString('es-CR')],
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

        <div className="form-grid">
          <div>
            <label>Fecha</label>
            <input
              type="date"
              name="fecha"
              value={cobro.fecha}
              onChange={cambiarCobro}
            />
          </div>

          <div>
            <label>Rollo</label>
            <select
              name="id_rollo"
              value={cobro.id_rollo}
              onChange={cambiarCobro}
            >
              <option value="">Seleccione</option>
              {rollos.map((item) => (
                <option key={item.id_rollo} value={item.id_rollo}>
                  {item.numero} - {item.descripcion}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="efectivo-card">
        <h3>Agregar cobrador</h3>

        <div className="form-grid detalle-grid">
          <div>
            <label>Empleado</label>
            <select
              name="id_empleado"
              value={detalleActual.id_empleado}
              onChange={cambiarDetalleActual}
            >
              <option value="">Seleccione</option>
              {empleados.map((item) => (
                <option key={item.id_empleado} value={item.id_empleado}>
                  {item.codigo} - {item.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Efectivo</label>
            <input
              type="number"
              name="efectivo"
              value={detalleActual.efectivo}
              onChange={cambiarDetalleActual}
              min="0"
            />
          </div>

          <div>
            <label>SINPE Móvil</label>
            <input
              type="number"
              name="sinpe"
              value={detalleActual.sinpe}
              onChange={cambiarDetalleActual}
              min="0"
            />
          </div>

          <div className="detalle-boton">
            <button onClick={agregarDetalle}>Agregar cobrador</button>
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
          <button className="btn-guardar" onClick={guardarCobro}>
            Guardar cobro
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
                      <td>{new Date(item.fecha).toLocaleDateString('es-CR')}</td>
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