import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Reportes.css';

// Fecha de hoy en hora local (Costa Rica), formato YYYY-MM-DD.
const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

const primerDiaDelMes = () => `${fechaLocalHoy().slice(0, 8)}01`;

const mostrarFecha = (fecha) => {
  const texto = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
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

// Las devoluciones se muestran en negativo, como en el sistema anterior.
const negativo = (valor) => (Number(valor) > 0 ? -Number(valor) : 0);

const nombreUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario'))?.nombre || '';
  } catch {
    return '';
  }
};

function ReporteVentasCarro() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [codigoBodega, setCodigoBodega] = useState('');
  const [bodega, setBodega] = useState(null);
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(fechaLocalHoy());

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const bodegaRef = useRef(null);
  const desdeRef = useRef(null);
  const hastaRef = useRef(null);

  useEffect(() => {
    fetch('/api/bodegas')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((lista) => setBodegas(Array.isArray(lista) ? lista : []))
      .catch((error) => {
        console.error('Error cargando bodegas:', error);
        alert('No se pudieron cargar las bodegas');
      });
  }, []);

  const buscarBodega = () => {
    const codigo = codigoBodega.trim().toLowerCase();

    if (!codigo) {
      alert('Digite el código de la bodega (carro)');
      return;
    }

    const encontrada = bodegas.find(
      (item) =>
        String(item.codigo || '').trim().toLowerCase() === codigo &&
        (!item.estado || item.estado === 'A')
    );

    if (!encontrada) {
      alert('No se encontró una bodega activa con ese código');
      setBodega(null);
      bodegaRef.current?.select();
      return;
    }

    setBodega(encontrada);
    setDatos(null);
    desdeRef.current?.focus();
  };

  const generarReporte = async () => {
    if (cargando) return;

    if (!bodega) {
      alert('Digite el código de la bodega y presione Enter');
      bodegaRef.current?.focus();
      return;
    }

    if (!desde || !hasta) {
      alert('Seleccione las fechas Desde y Hasta');
      return;
    }

    if (desde > hasta) {
      alert('La fecha Desde no puede ser mayor que la fecha Hasta');
      desdeRef.current?.focus();
      return;
    }

    try {
      setCargando(true);

      const parametros = new URLSearchParams({ id_bodega: bodega.id_bodega, desde, hasta });
      const respuesta = await fetch(`/api/reportes/ventas-carro?${parametros}`);
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'No se pudo generar el reporte');
        return;
      }

      setDatos({ ...resultado, fechaReporte: fechaLocalHoy() });
    } catch (error) {
      console.error('Error generando reporte de ventas por carro:', error);
      alert('No se pudo generar el reporte');
    } finally {
      setCargando(false);
    }
  };

  const validarHayDatos = () => {
    if (!datos) {
      alert('Primero genere el reporte');
      return false;
    }
    return true;
  };

  const nombreArchivo = () =>
    datos
      ? `ventas-devoluciones-carro-${datos.bodega.codigo}-${datos.desde}-a-${datos.hasta}`
      : 'ventas-devoluciones-carro';

  const exportarPDF = () => {
    if (!validarHayDatos()) return;

    const doc = new jsPDF();
    const ancho = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Fecha del reporte:', 14, 14);
    doc.text(mostrarFecha(datos.fechaReporte), 14, 19);
    doc.text(`Usuario: ${nombreUsuario()}`, ancho - 14, 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('REPORTE DE VENTAS Y DEVOLUCIONES', ancho / 2, 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('POR CARRO SEGÚN RANGO DE FECHAS', ancho / 2, 21, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.line(14, 25, ancho - 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.text('Carro:', 14, 32);
    doc.text('Desde:', 14, 38);
    doc.text('Hasta:', 80, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`${datos.bodega.codigo}  ${datos.bodega.descripcion}`, 32, 32);
    doc.text(mostrarFecha(datos.desde), 32, 38);
    doc.text(mostrarFecha(datos.hasta), 96, 38);

    const boletas = datos.boletas;

    autoTable(doc, {
      theme: 'grid',
      startY: 46,
      head: [['Fecha', 'Boleta', 'Ruta', 'Devoluciones', 'Ventas', 'Subtotal']],
      body: boletas.length
        ? boletas.map((fila) => [
            mostrarFecha(fila.fecha),
            fila.numero_boleta,
            fila.numero_rollo ? `${fila.numero_rollo}  ${fila.rollo}` : '-',
            formatoMonedaReporte(negativo(fila.devoluciones)),
            formatoMonedaReporte(fila.ventas),
            formatoMonedaReporte(fila.subtotal)
          ])
        : [['', '', 'No hay ventas ni devoluciones en ese rango', '', '', '']],
      foot: [[
        '',
        '',
        `Totales (${datos.totales.boletas} boletas)`,
        formatoMonedaReporte(negativo(datos.totales.devoluciones)),
        formatoMonedaReporte(datos.totales.ventas),
        formatoMonedaReporte(datos.totales.subtotal)
      ]],
      styles: {
        fontSize: 9,
        cellPadding: { top: 2.2, bottom: 2.2, left: 3, right: 4 },
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [15, 23, 42]
      },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 24 },
        1: { cellWidth: 20 },
        3: { cellWidth: 32 },
        4: { cellWidth: 32 },
        5: { cellWidth: 32 }
      },
      didParseCell: (data) => {
        if ([0, 1].includes(data.column.index)) data.cell.styles.halign = 'center';
        if ([3, 4, 5].includes(data.column.index)) data.cell.styles.halign = 'right';

        // Montos negativos en rojo (devoluciones y subtotales negativos).
        if (data.section !== 'head' && [3, 5].includes(data.column.index)) {
          const fila = data.section === 'body' ? boletas[data.row.index] : null;
          const valor =
            data.section === 'foot'
              ? (data.column.index === 3 ? -datos.totales.devoluciones : datos.totales.subtotal)
              : fila
                ? (data.column.index === 3 ? -Number(fila.devoluciones) : Number(fila.subtotal))
                : 0;

          if (valor < 0) data.cell.styles.textColor = [185, 28, 28];
        }
      }
    });

    doc.setProperties({
      title: `Ventas y devoluciones - ${datos.bodega.descripcion} - ${mostrarFecha(datos.desde)} a ${mostrarFecha(datos.hasta)}`
    });
    doc.viewerPreferences({ DisplayDocTitle: true });

    window.open(doc.output('bloburl'), '_blank') || doc.save(`${nombreArchivo()}.pdf`);
  };

  const exportarExcel = () => {
    if (!validarHayDatos()) return;

    const filas = [
      ['REPORTE DE VENTAS Y DEVOLUCIONES POR CARRO SEGÚN RANGO DE FECHAS'],
      [`Carro: ${datos.bodega.codigo} ${datos.bodega.descripcion}`],
      [`Desde: ${mostrarFecha(datos.desde)}`, '', `Hasta: ${mostrarFecha(datos.hasta)}`],
      [],
      ['Fecha', 'Boleta', 'Ruta', 'Devoluciones', 'Ventas', 'Subtotal'],
      ...datos.boletas.map((fila) => [
        mostrarFecha(fila.fecha),
        fila.numero_boleta,
        fila.numero_rollo ? `${fila.numero_rollo} ${fila.rollo}` : '',
        negativo(fila.devoluciones),
        Number(fila.ventas),
        Number(fila.subtotal)
      ]),
      [
        '',
        '',
        'Totales',
        negativo(datos.totales.devoluciones),
        datos.totales.ventas,
        datos.totales.subtotal
      ]
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Ventas por carro');
    XLSX.writeFile(libro, `${nombreArchivo()}.xlsx`);
  };

  return (
    <div className="reportes-page">
      <header className="reportes-header no-imprimir">
        <h2>Ventas / Devoluciones por carro</h2>
        <button type="button" onClick={() => navigate('/reportes')}>Volver</button>
      </header>

      <section className="reportes-card no-imprimir">
        <h3>Parámetros del informe</h3>

        <div className="reportes-parametros reportes-parametros-5">
          <div>
            <label>Código de bodega (carro)</label>
            <input
              ref={bodegaRef}
              autoFocus
              type="text"
              value={codigoBodega}
              placeholder="Digite el código"
              onChange={(e) => {
                setCodigoBodega(e.target.value);
                setBodega(null);
                setDatos(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarBodega();
                }
              }}
            />
          </div>

          <div>
            <label>Bodega</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={bodega?.descripcion || ''}
              placeholder="Automático"
              style={{ background: '#f1f5f9' }}
            />
          </div>

          <div>
            <label>Desde</label>
            <input
              ref={desdeRef}
              type="date"
              value={desde}
              onChange={(e) => {
                setDesde(e.target.value);
                setDatos(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  hastaRef.current?.focus();
                }
              }}
            />
          </div>

          <div>
            <label>Hasta</label>
            <input
              ref={hastaRef}
              type="date"
              value={hasta}
              onChange={(e) => {
                setHasta(e.target.value);
                setDatos(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  generarReporte();
                }
              }}
            />
          </div>

          <div className="reportes-parametros-boton">
            <button
              type="button"
              className="reportes-btn-generar"
              disabled={cargando}
              onClick={generarReporte}
            >
              {cargando ? 'Generando...' : 'Generar reporte'}
            </button>
          </div>
        </div>
      </section>

      {datos && (
        <section className="reportes-card reportes-resultado">
          <div className="reportes-acciones no-imprimir">
            <button type="button" className="reportes-btn-imprimir" onClick={() => window.print()}>
              Imprimir
            </button>
            <button type="button" className="reportes-btn-pdf" onClick={exportarPDF}>
              Exportar PDF
            </button>
            <button type="button" className="reportes-btn-excel" onClick={exportarExcel}>
              Exportar Excel
            </button>
          </div>

          <div className="reportes-encabezado-informe">
            <h3>Reporte de ventas y devoluciones</h3>
            <p className="reportes-subtitulo">Por carro según rango de fechas</p>
            <div className="reportes-encabezado-datos">
              <span><strong>Carro:</strong> {datos.bodega.codigo} {datos.bodega.descripcion}</span>
              <span><strong>Desde:</strong> {mostrarFecha(datos.desde)}</span>
              <span><strong>Hasta:</strong> {mostrarFecha(datos.hasta)}</span>
            </div>
          </div>

          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Boleta</th>
                  <th>Ruta</th>
                  <th>Devoluciones</th>
                  <th>Ventas</th>
                  <th>Subtotal</th>
                </tr>
              </thead>

              <tbody>
                {datos.boletas.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="reportes-sin-datos">
                      No hay ventas ni devoluciones de este carro en ese rango de fechas
                    </td>
                  </tr>
                ) : (
                  datos.boletas.map((fila) => (
                    <tr key={`${fila.fecha}-${fila.numero_boleta}`}>
                      <td>{mostrarFecha(fila.fecha)}</td>
                      <td>{fila.numero_boleta}</td>
                      <td className="reportes-celda-empleado">
                        {fila.numero_rollo ? `${fila.numero_rollo} ${fila.rollo}` : '-'}
                      </td>
                      <td
                        className={`reportes-celda-monto ${Number(fila.devoluciones) > 0 ? 'reportes-negativo' : ''}`}
                      >
                        {formatoMoneda(negativo(fila.devoluciones))}
                      </td>
                      <td className="reportes-celda-monto">{formatoMoneda(fila.ventas)}</td>
                      <td
                        className={`reportes-celda-monto ${Number(fila.subtotal) < 0 ? 'reportes-negativo' : ''}`}
                      >
                        {formatoMoneda(fila.subtotal)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {datos.boletas.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan="3" className="reportes-celda-empleado">
                      Totales ({datos.totales.boletas} boletas)
                    </td>
                    <td
                      className={`reportes-celda-monto ${datos.totales.devoluciones > 0 ? 'reportes-negativo' : ''}`}
                    >
                      {formatoMoneda(negativo(datos.totales.devoluciones))}
                    </td>
                    <td className="reportes-celda-monto">{formatoMoneda(datos.totales.ventas)}</td>
                    <td
                      className={`reportes-celda-monto ${datos.totales.subtotal < 0 ? 'reportes-negativo' : ''}`}
                    >
                      {formatoMoneda(datos.totales.subtotal)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

export default ReporteVentasCarro;
