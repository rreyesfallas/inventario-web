import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './HistorialClientes.css';

// Las fechas vienen como 'YYYY-MM-DD': se toman tal cual para no correr un día.
const mostrarFecha = (fecha) => {
  const texto = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
};

const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

const formatoMoneda = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' });

const formatoMonedaReporte = (valor) => {
  const numero = Number(valor || 0);
  const signo = numero < 0 ? '-' : '';
  return `${signo}¢${Math.abs(numero).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const nombreUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario'))?.nombre || '';
  } catch {
    return '';
  }
};

// Color de la etiqueta de cada tipo de movimiento.
const claseMovimiento = (tipo) => {
  if (tipo === 'ABONO' || tipo === 'TRANSFERENCIA_SALIDA') return 'mov-abono';
  if (tipo === 'VENTA' || tipo === 'TRANSFERENCIA_ENTRADA') return 'mov-venta';
  if (tipo === 'DEVOLUCION' || tipo === 'DESCUENTO') return 'mov-devolucion';
  if (tipo === 'ELIMINACION_VENTA') return 'mov-eliminada';
  return 'mov-sin-monto';
};

function HistorialClientes() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [codigoCliente, setCodigoCliente] = useState('');
  const [cliente, setCliente] = useState(null);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);

  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  const [ordenDescendente, setOrdenDescendente] = useState(false);

  const [modalClientesAbierto, setModalClientesAbierto] = useState(false);
  const [busquedaCliente, setBusquedaCliente] = useState('');

  const codigoRef = useRef(null);

  useEffect(() => {
    fetch('/api/clientes')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((lista) => setClientes(Array.isArray(lista) ? lista : []))
      .catch((error) => {
        console.error('Error cargando clientes:', error);
        alert('Error al cargar clientes');
      });
  }, []);

  const cargarHistorial = async (idCliente) => {
    try {
      setCargando(true);

      const respuesta = await fetch(`/api/historial-clientes/${idCliente}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al cargar el historial');
        return;
      }

      setCliente(datos.cliente);
      setFilas(Array.isArray(datos.filas) ? datos.filas : []);
      setCodigoCliente(String(datos.cliente.codigo));
      setBusquedaHistorial('');
    } catch (error) {
      console.error('Error cargando historial del cliente:', error);
      alert('Error al cargar el historial del cliente');
    } finally {
      setCargando(false);
    }
  };

  const buscarClientePorCodigo = () => {
    const codigo = codigoCliente.trim().toLowerCase();

    if (!codigo) {
      alert('Digite el código del cliente');
      return;
    }

    const encontrado = clientes.find(
      (item) => String(item.codigo || '').trim().toLowerCase() === codigo
    );

    if (!encontrado) {
      alert('No se encontró un cliente con ese código');
      codigoRef.current?.select();
      return;
    }

    cargarHistorial(encontrado.id_cliente);
  };

  const seleccionarDesdeVista = (item) => {
    setModalClientesAbierto(false);
    setBusquedaCliente('');
    cargarHistorial(item.id_cliente);
  };

  const clientesFiltrados = clientes.filter((item) => {
    const texto = busquedaCliente.toLowerCase();

    return (
      String(item.codigo || '').toLowerCase().includes(texto) ||
      String(item.cedula || '').toLowerCase().includes(texto) ||
      String(item.nombre || '').toLowerCase().includes(texto) ||
      String(item.numero_rollo || '').toLowerCase().includes(texto) ||
      String(item.rollo || '').toLowerCase().includes(texto)
    );
  });

  const filasFiltradas = filas.filter((fila) => {
    const texto = busquedaHistorial.trim().toLowerCase();
    if (!texto) return true;

    return (
      String(fila.movimiento || '').toLowerCase().includes(texto) ||
      String(fila.descripcion || '').toLowerCase().includes(texto) ||
      String(fila.codigo_articulo || '').toLowerCase().includes(texto) ||
      mostrarFecha(fila.fecha).includes(texto) ||
      String(fila.empleado || '').toLowerCase().includes(texto)
    );
  });

  const filasVisibles = ordenDescendente ? [...filasFiltradas].reverse() : filasFiltradas;

  // ===================== REPORTES =====================

  const validarCliente = () => {
    if (!cliente) {
      alert('Primero debe seleccionar un cliente');
      return false;
    }
    return true;
  };

  const exportarPDF = () => {
    if (!validarCliente()) return;

    const doc = new jsPDF('landscape');
    const ancho = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Fecha del reporte:', 14, 14);
    doc.text(mostrarFecha(fechaLocalHoy()), 14, 19);
    doc.text(`Usuario: ${nombreUsuario()}`, ancho - 14, 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('HISTORIAL DE CLIENTES', ancho / 2, 16, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.line(14, 24, ancho - 14, 24);

    const datosCliente = [
      ['Cliente:', `${cliente.codigo}  ${cliente.nombre}`],
      ['Dirección:', `${cliente.direccion || '-'}${cliente.lado_calle ? `  (${cliente.lado_calle})` : ''}`],
      ['Rollo:', cliente.numero_rollo ? `${cliente.numero_rollo}  ${cliente.rollo}` : '-']
    ];

    datosCliente.forEach(([etiqueta, valor], indice) => {
      const y = 31 + indice * 6;
      doc.setFont('helvetica', 'bold');
      doc.text(etiqueta, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(valor, 38, y);
    });

    doc.setFont('helvetica', 'bold');
    doc.text('Saldo actual:', ancho - 60, 31, { align: 'right' });
    doc.text(formatoMonedaReporte(cliente.saldo_actual), ancho - 14, 31, { align: 'right' });

    autoTable(doc, {
      theme: 'grid',
      startY: 49,
      head: [['Fecha', 'Movimiento', 'Cód. art.', 'Descripción', 'Cant.', 'Monto', 'Saldo', 'Rollo', 'Carro', 'Empleado']],
      body: filasVisibles.map((fila) => [
        mostrarFecha(fila.fecha),
        fila.movimiento,
        fila.codigo_articulo || '',
        fila.descripcion || '',
        fila.cantidad ?? '',
        fila.tipo === 'SIN_MONTO' ? '' : formatoMonedaReporte(fila.monto),
        fila.saldo === null ? '' : formatoMonedaReporte(fila.saldo),
        fila.numero_rollo || '',
        fila.codigo_carro || '',
        fila.codigo_empleado ? `${fila.codigo_empleado} ${fila.empleado}` : ''
      ]),
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2.5, right: 3 },
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [15, 23, 42]
      },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 30 },
        2: { cellWidth: 18 },
        4: { cellWidth: 13 },
        5: { cellWidth: 26 },
        6: { cellWidth: 26 },
        7: { cellWidth: 13 },
        8: { cellWidth: 13 },
        9: { cellWidth: 34 }
      },
      didParseCell: (data) => {
        if ([0, 1, 2, 4, 7, 8].includes(data.column.index)) data.cell.styles.halign = 'center';
        if ([5, 6].includes(data.column.index)) data.cell.styles.halign = 'right';

        const fila = data.section === 'body' ? filasVisibles[data.row.index] : null;

        if (fila?.tipo === 'SIN_MONTO') data.cell.styles.textColor = [148, 163, 184];
        if (fila?.tipo === 'ELIMINACION_VENTA') data.cell.styles.textColor = [185, 28, 28];
      }
    });

    doc.setProperties({ title: `Historial de cliente - ${cliente.codigo} ${cliente.nombre}` });
    doc.viewerPreferences({ DisplayDocTitle: true });

    window.open(doc.output('bloburl'), '_blank') || doc.save(`historial-cliente-${cliente.codigo}.pdf`);
  };

  const exportarExcel = () => {
    if (!validarCliente()) return;

    const datos = [
      ['HISTORIAL DE CLIENTES'],
      [`Cliente: ${cliente.codigo} ${cliente.nombre}`],
      [`Dirección: ${cliente.direccion || '-'}`],
      [`Rollo: ${cliente.numero_rollo || '-'} ${cliente.rollo || ''}`],
      [`Saldo actual: ${Number(cliente.saldo_actual || 0)}`],
      [],
      ['Fecha', 'Movimiento', 'Cód. art.', 'Descripción', 'Cant.', 'Monto', 'Saldo', 'Rollo', 'Carro', 'Empleado'],
      ...filasVisibles.map((fila) => [
        mostrarFecha(fila.fecha),
        fila.movimiento,
        fila.codigo_articulo || '',
        fila.descripcion || '',
        fila.cantidad ?? '',
        fila.tipo === 'SIN_MONTO' ? '' : Number(fila.monto),
        fila.saldo === null ? '' : Number(fila.saldo),
        fila.numero_rollo || '',
        fila.codigo_carro || '',
        fila.codigo_empleado ? `${fila.codigo_empleado} ${fila.empleado}` : ''
      ])
    ];

    const hoja = XLSX.utils.aoa_to_sheet(datos);
    hoja['!cols'] = [
      { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 34 }, { wch: 7 },
      { wch: 14 }, { wch: 14 }, { wch: 7 }, { wch: 7 }, { wch: 22 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Historial');
    XLSX.writeFile(libro, `historial-cliente-${cliente.codigo}.xlsx`);
  };

  // ===================== PANTALLA =====================

  return (
    <div className="historial-page">
      <header className="historial-header no-imprimir">
        <h2>Historial de clientes</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="historial-card">
        <div className="historial-cliente-grid">
          <div>
            <label>Cód. cliente</label>
            <div className="historial-codigo-fila">
              <input
                ref={codigoRef}
                autoFocus
                type="text"
                className="historial-input-codigo"
                value={codigoCliente}
                placeholder="Código"
                onChange={(e) => {
                  setCodigoCliente(e.target.value);
                  setCliente(null);
                  setFilas([]);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    buscarClientePorCodigo();
                  }
                }}
              />
              <button
                type="button"
                className="btn-vista no-imprimir"
                onClick={() => setModalClientesAbierto(true)}
              >
                Vista
              </button>
            </div>
          </div>

          <div>
            <label>Nombre</label>
            <input type="text" readOnly tabIndex={-1} value={cliente?.nombre || ''} />
          </div>

          <div className="historial-campo-ancho">
            <label>Dirección</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={
                cliente
                  ? `${cliente.direccion || '-'}${cliente.lado_calle ? `  (${cliente.lado_calle})` : ''}`
                  : ''
              }
            />
          </div>

          <div>
            <label>Rollo</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={cliente?.numero_rollo ? `${cliente.numero_rollo} - ${cliente.rollo}` : ''}
            />
          </div>

          <div>
            <label>Saldo</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              className="historial-saldo"
              value={cliente ? formatoMoneda(cliente.saldo_actual) : ''}
            />
          </div>
        </div>
      </section>

      <section className="historial-card">
        <div className="historial-barra no-imprimir">
          <input
            type="text"
            className="buscar"
            placeholder="Buscar por movimiento, artículo, fecha o empleado"
            value={busquedaHistorial}
            onChange={(e) => setBusquedaHistorial(e.target.value)}
            disabled={!cliente}
          />

          <label className="historial-check">
            <input
              type="checkbox"
              checked={ordenDescendente}
              onChange={(e) => setOrdenDescendente(e.target.checked)}
            />
            Más recientes primero
          </label>

          {cliente && (
            <div className="acciones-reporte">
              <button className="btn-imprimir" onClick={() => window.print()}>Imprimir</button>
              <button className="btn-pdf" onClick={exportarPDF}>Exportar PDF</button>
              <button className="btn-excel" onClick={exportarExcel}>Exportar Excel</button>
            </div>
          )}
        </div>

        <div className="tabla-contenedor">
          <table className="historial-tabla">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Cód. art.</th>
                <th>Descripción</th>
                <th>Cant.</th>
                <th>Monto</th>
                <th>Saldo</th>
                <th>Rollo</th>
                <th>Carro</th>
                <th>Empleado</th>
              </tr>
            </thead>

            <tbody>
              {cargando ? (
                <tr>
                  <td colSpan="10" className="sin-datos">Cargando historial...</td>
                </tr>
              ) : filasVisibles.length === 0 ? (
                <tr>
                  <td colSpan="10" className="sin-datos">
                    {cliente
                      ? 'No hay movimientos para este cliente'
                      : 'Digite el código del cliente y presione Enter'}
                  </td>
                </tr>
              ) : (
                filasVisibles.map((fila) => (
                  <tr key={fila.clave} className={fila.tipo === 'SIN_MONTO' ? 'historial-fila-sin-monto' : ''}>
                    <td>{mostrarFecha(fila.fecha)}</td>
                    <td>
                      <span className={`historial-mov ${claseMovimiento(fila.tipo)}`}>
                        {fila.movimiento}
                      </span>
                    </td>
                    <td>{fila.codigo_articulo || ''}</td>
                    <td className="historial-celda-texto">{fila.descripcion || ''}</td>
                    <td>{fila.cantidad ?? ''}</td>
                    <td className="historial-celda-monto">
                      {fila.tipo === 'SIN_MONTO' ? '' : formatoMoneda(fila.monto)}
                    </td>
                    <td className="historial-celda-monto historial-celda-saldo">
                      {fila.saldo === null ? '' : formatoMoneda(fila.saldo)}
                    </td>
                    <td>{fila.numero_rollo || ''}</td>
                    <td>{fila.codigo_carro || ''}</td>
                    <td className="historial-celda-texto">
                      {fila.codigo_empleado ? `${fila.codigo_empleado} ${fila.empleado}` : ''}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalClientesAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button className="btn-cerrar" onClick={() => setModalClientesAbierto(false)}>
              X
            </button>

            <h3>Vista de clientes</h3>

            <input
              type="text"
              className="buscar"
              autoFocus
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
                        <button className="btn-seleccionar" onClick={() => seleccionarDesdeVista(item)}>
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {clientesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="sin-datos">No se encontraron clientes</td>
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

export default HistorialClientes;