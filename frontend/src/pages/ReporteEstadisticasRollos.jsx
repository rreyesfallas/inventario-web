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

const nombreUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario'))?.nombre || '';
  } catch {
    return '';
  }
};

function ReporteEstadisticasRollos() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [codigoBodega, setCodigoBodega] = useState('');
  const [bodega, setBodega] = useState(null);
  const [fecha, setFecha] = useState(fechaLocalHoy());

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const bodegaRef = useRef(null);
  const fechaRef = useRef(null);

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
    fechaRef.current?.focus();
  };

  const generarReporte = async () => {
    if (cargando) return;

    if (!bodega) {
      alert('Digite el código de la bodega y presione Enter');
      bodegaRef.current?.focus();
      return;
    }

    if (!fecha) {
      alert('Seleccione la fecha de corte');
      fechaRef.current?.focus();
      return;
    }

    try {
      setCargando(true);

      const parametros = new URLSearchParams({ id_bodega: bodega.id_bodega, fecha });
      const respuesta = await fetch(`/api/reportes/estadisticas-rollos?${parametros}`);
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'No se pudo generar el reporte');
        return;
      }

      setDatos({ ...resultado, fechaReporte: fechaLocalHoy() });
    } catch (error) {
      console.error('Error generando estadísticas de rollos:', error);
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
    datos ? `estadisticas-rollos-${datos.bodega.codigo}-${datos.fecha}` : 'estadisticas-rollos';

  const exportarPDF = () => {
    if (!validarHayDatos()) return;

    const doc = new jsPDF();
    const ancho = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Fecha del reporte: ${mostrarFecha(datos.fechaReporte)}`, 14, 14);
    doc.text(`Usuario: ${nombreUsuario()}`, ancho - 14, 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('ESTADÍSTICAS DE ROLLOS', ancho / 2, 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('SEGÚN BODEGA / CARRO', ancho / 2, 21, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.line(14, 25, ancho - 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.text('Bodega:', 14, 32);
    doc.text('Fecha de corte:', 14, 38);
    doc.setFont('helvetica', 'normal');
    doc.text(`${datos.bodega.codigo}  ${datos.bodega.descripcion}`, 44, 32);
    doc.text(mostrarFecha(datos.fecha), 44, 38);

    autoTable(doc, {
      theme: 'grid',
      startY: 46,
      head: [['Rollo', 'Tarjetas activas', 'Total saldos']],
      body: datos.rollos.length
        ? datos.rollos.map((fila) => [
            `${fila.numero}  ${fila.descripcion}`,
            fila.tarjetas_activas,
            formatoMonedaReporte(fila.total_saldos)
          ])
        : [['Esta bodega no tiene rollos asignados', '', '']],
      foot: [[
        `Totales (${datos.totales.rollos} rollos)`,
        datos.totales.tarjetas_activas,
        formatoMonedaReporte(datos.totales.total_saldos)
      ]],
      styles: {
        fontSize: 9,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 4 },
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [15, 23, 42]
      },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        1: { cellWidth: 40 },
        2: { cellWidth: 50 }
      },
      didParseCell: (data) => {
        if (data.column.index === 1) data.cell.styles.halign = 'center';
        if (data.column.index === 2) data.cell.styles.halign = 'right';
      }
    });

    doc.setProperties({
      title: `Estadísticas de rollos - ${datos.bodega.descripcion} - ${mostrarFecha(datos.fecha)}`
    });
    doc.viewerPreferences({ DisplayDocTitle: true });

    window.open(doc.output('bloburl'), '_blank') || doc.save(`${nombreArchivo()}.pdf`);
  };

  const exportarExcel = () => {
    if (!validarHayDatos()) return;

    const filas = [
      ['ESTADÍSTICAS DE ROLLOS SEGÚN BODEGA / CARRO'],
      [`Bodega: ${datos.bodega.codigo} ${datos.bodega.descripcion}`],
      [`Fecha de corte: ${mostrarFecha(datos.fecha)}`],
      [],
      ['Rollo', 'Tarjetas activas', 'Total saldos'],
      ...datos.rollos.map((fila) => [
        `${fila.numero} ${fila.descripcion}`,
        Number(fila.tarjetas_activas),
        Number(fila.total_saldos)
      ]),
      ['Totales', datos.totales.tarjetas_activas, datos.totales.total_saldos]
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 18 }];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Estadísticas');
    XLSX.writeFile(libro, `${nombreArchivo()}.xlsx`);
  };

  return (
    <div className="reportes-page">
      <header className="reportes-header no-imprimir">
        <h2>Estadísticas de rollos</h2>
        <button type="button" onClick={() => navigate('/reportes')}>Volver</button>
      </header>

      <section className="reportes-card no-imprimir">
        <h3>Parámetros del informe</h3>

        <div className="reportes-parametros">
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
            <label>Fecha de corte</label>
            <input
              ref={fechaRef}
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
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
            <h3>Estadísticas de rollos</h3>
            <p className="reportes-subtitulo">Según bodega / carro</p>
            <div className="reportes-encabezado-datos">
              <span><strong>Bodega:</strong> {datos.bodega.codigo} {datos.bodega.descripcion}</span>
              <span><strong>Fecha de corte:</strong> {mostrarFecha(datos.fecha)}</span>
              <span><strong>Fecha del reporte:</strong> {mostrarFecha(datos.fechaReporte)}</span>
            </div>
          </div>

          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla" style={{ minWidth: 0 }}>
              <thead>
                <tr>
                  <th>Rollo</th>
                  <th>Tarjetas activas</th>
                  <th>Total saldos</th>
                </tr>
              </thead>

              <tbody>
                {datos.rollos.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="reportes-sin-datos">
                      Esta bodega no tiene rollos asignados. Asígnelos en Configuración → Rollos.
                    </td>
                  </tr>
                ) : (
                  datos.rollos.map((fila) => (
                    <tr key={fila.id_rollo}>
                      <td className="reportes-celda-empleado">
                        {fila.numero} {fila.descripcion}
                      </td>
                      <td>{fila.tarjetas_activas}</td>
                      <td className="reportes-celda-monto">{formatoMoneda(fila.total_saldos)}</td>
                    </tr>
                  ))
                )}
              </tbody>

              {datos.rollos.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="reportes-celda-empleado">
                      Totales ({datos.totales.rollos} rollos)
                    </td>
                    <td>{datos.totales.tarjetas_activas}</td>
                    <td className="reportes-celda-monto">
                      {formatoMoneda(datos.totales.total_saldos)}
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

export default ReporteEstadisticasRollos;
