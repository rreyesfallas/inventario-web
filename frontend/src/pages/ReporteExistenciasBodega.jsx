import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Reportes.css';
import './Inventarios.css';

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

const formatoMonedaReporte = (valor) =>
  `¢${Number(valor || 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const formatoCantidad = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { maximumFractionDigits: 2 });

const nombreUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario'))?.nombre || '';
  } catch {
    return '';
  }
};

function ReporteExistenciasBodega() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [idBodega, setIdBodega] = useState('');
  const [codigoBodega, setCodigoBodega] = useState('');
  const [soloConExistencia, setSoloConExistencia] = useState(false);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const codigoRef = useRef(null);
  const bodegaRef = useRef(null);
  const generarRef = useRef(null);

  useEffect(() => {
    fetch('/api/bodegas')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((lista) => {
        const activas = (Array.isArray(lista) ? lista : [])
          .filter((item) => !item.estado || item.estado === 'A')
          .sort((a, b) =>
            String(a.codigo).localeCompare(String(b.codigo), 'es', { numeric: true })
          );
        setBodegas(activas);
      })
      .catch((error) => {
        console.error('Error cargando bodegas:', error);
        alert('No se pudieron cargar las bodegas');
      });
  }, []);

  const buscarBodegaPorCodigo = (codigo) =>
    bodegas.find(
      (item) =>
        String(item.codigo || '').trim().toUpperCase() === String(codigo || '').trim().toUpperCase()
    );

  // Al digitar el código, la lista se sincroniza sola.
  const cambiarCodigo = (e) => {
    const codigo = e.target.value;
    setCodigoBodega(codigo);
    setDatos(null);
    const bodega = buscarBodegaPorCodigo(codigo);
    setIdBodega(bodega ? String(bodega.id_bodega) : '');
  };

  // Al elegir en la lista, el código se rellena solo.
  const cambiarSeleccion = (e) => {
    const id = e.target.value;
    setIdBodega(id);
    setDatos(null);
    const bodega = bodegas.find((item) => String(item.id_bodega) === String(id));
    setCodigoBodega(bodega ? String(bodega.codigo) : '');
  };

  const generarReporte = async (idForzado) => {
    if (cargando) return;

    const id = idForzado || idBodega;

    if (!id) {
      alert('Digite el código o seleccione una bodega');
      codigoRef.current?.focus();
      return;
    }

    try {
      setCargando(true);

      const respuesta = await fetch(`/api/inventarios/existencias?id_bodega=${id}`);
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'No se pudo generar el reporte');
        return;
      }

      setDatos({ ...resultado, fechaReporte: fechaLocalHoy() });
    } catch (error) {
      console.error('Error generando existencias según bodega:', error);
      alert('No se pudo generar el reporte');
    } finally {
      setCargando(false);
    }
  };

  const articulosVisibles = datos
    ? datos.articulos.filter((item) => !soloConExistencia || item.existencia !== 0)
    : [];

  const totales = articulosVisibles.reduce(
    (acum, item) => ({
      existencia: acum.existencia + Number(item.existencia || 0),
      subtotal: acum.subtotal + Number(item.subtotal || 0)
    }),
    { existencia: 0, subtotal: 0 }
  );

  const validarHayDatos = () => {
    if (!datos) {
      alert('Primero genere el reporte');
      return false;
    }
    return true;
  };

  const textoBodega = () => (datos ? `${datos.bodega.codigo}  ${datos.bodega.descripcion}` : '');

  const nombreArchivo = () =>
    datos ? `existencias-bodega-${datos.bodega.codigo}-${datos.fechaReporte}` : 'existencias-bodega';

  const exportarPDF = () => {
    if (!validarHayDatos()) return;

    const doc = new jsPDF();
    const ancho = doc.internal.pageSize.getWidth();
    const alto = doc.internal.pageSize.getHeight();

    // Encabezado (se repite en cada página).
    const dibujarEncabezado = () => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Fecha del reporte:', 14, 14);
      doc.text(mostrarFecha(datos.fechaReporte), 14, 19);
      doc.text(`Usuario: ${nombreUsuario()}`, ancho - 14, 14, { align: 'right' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('REPORTE DE EXISTENCIAS', ancho / 2, 14, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('SEGÚN BODEGA', ancho / 2, 19.5, { align: 'center' });

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(`BODEGA: ${textoBodega()}`, ancho / 2, 27, { align: 'center' });

      doc.setLineWidth(0.4);
      doc.line(14, 30, ancho - 14, 30);
    };

    autoTable(doc, {
      theme: 'grid',
      startY: 34,
      margin: { top: 34, left: 14, right: 14, bottom: 16 },
      head: [['Cód. art.', 'Descripción', 'Precio', 'Exist.', 'Subtotal', 'T. física', 'Línea']],
      body: articulosVisibles.map((item) => [
        item.codigo,
        item.descripcion,
        formatoMonedaReporte(item.precio),
        formatoCantidad(item.existencia),
        formatoMonedaReporte(item.subtotal),
        '',
        item.linea || ''
      ]),
      foot: [[
        '',
        `Total (${articulosVisibles.length} artículos)`,
        '',
        formatoCantidad(totales.existencia),
        formatoMonedaReporte(totales.subtotal),
        '',
        ''
      ]],
      showFoot: 'lastPage',
      styles: {
        fontSize: 8,
        cellPadding: { top: 1.8, bottom: 1.8, left: 2, right: 2.5 },
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [15, 23, 42]
      },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 18 },
        2: { cellWidth: 22 },
        3: { cellWidth: 14 },
        4: { cellWidth: 25 },
        5: { cellWidth: 20 },
        6: { cellWidth: 36, fontSize: 7.5 }
      },
      didParseCell: (data) => {
        if ([0, 3, 5].includes(data.column.index)) data.cell.styles.halign = 'center';
        if ([2, 4].includes(data.column.index)) data.cell.styles.halign = 'right';

        // Artículos sin existencia en gris, para que resalten los que sí tienen.
        if (data.section === 'body') {
          const item = articulosVisibles[data.row.index];
          if (item && item.existencia === 0 && data.column.index !== 5) {
            data.cell.styles.textColor = [148, 163, 184];
          }
        }
      },
      // Raya para anotar a mano la cantidad contada.
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 5) {
          const y = data.cell.y + data.cell.height - 1.6;
          doc.setDrawColor(100, 116, 139);
          doc.setLineWidth(0.25);
          doc.line(data.cell.x + 2.5, y, data.cell.x + data.cell.width - 2.5, y);
        }
      },
      didDrawPage: dibujarEncabezado
    });

    // Número de página.
    const paginas = doc.getNumberOfPages();
    for (let i = 1; i <= paginas; i += 1) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Pág. ${i} de ${paginas}`, ancho - 14, 19, { align: 'right' });
      doc.text('Contado por: ______________________', 14, alto - 8);
    }

    doc.setProperties({
      title: `Existencias - ${datos.bodega.descripcion} - ${mostrarFecha(datos.fechaReporte)}`
    });
    doc.viewerPreferences({ DisplayDocTitle: true });

    window.open(doc.output('bloburl'), '_blank') || doc.save(`${nombreArchivo()}.pdf`);
  };

  const exportarExcel = () => {
    if (!validarHayDatos()) return;

    const filas = [
      ['REPORTE DE EXISTENCIAS SEGÚN BODEGA'],
      [`Bodega: ${textoBodega()}`],
      [`Fecha del reporte: ${mostrarFecha(datos.fechaReporte)}`],
      [],
      ['Cód. art.', 'Descripción', 'Precio', 'Exist.', 'Subtotal', 'T. física', 'Línea'],
      ...articulosVisibles.map((item) => [
        item.codigo,
        item.descripcion,
        Number(item.precio),
        Number(item.existencia),
        Number(item.subtotal),
        '',
        item.linea || ''
      ]),
      [],
      ['', 'Total', '', totales.existencia, totales.subtotal, '', '']
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = [
      { wch: 12 }, { wch: 38 }, { wch: 12 }, { wch: 10 },
      { wch: 14 }, { wch: 12 }, { wch: 18 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Existencias');
    XLSX.writeFile(libro, `${nombreArchivo()}.xlsx`);
  };

  return (
    <div className="reportes-page">
      <header className="reportes-header no-imprimir">
        <h2>Existencias según bodega</h2>
        <button type="button" onClick={() => navigate('/inventarios')}>Volver</button>
      </header>

      <section className="reportes-card no-imprimir">
        <h3>Parámetros del informe</h3>

        <div className="inventario-grid-bodega inventario-grid-existencias">
          <div>
            <label>Código</label>
            <input
              ref={codigoRef}
              autoFocus
              type="text"
              value={codigoBodega}
              placeholder="Código y Enter"
              onChange={cambiarCodigo}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();

                if (!codigoBodega.trim()) {
                  bodegaRef.current?.focus();
                  return;
                }

                const bodega = buscarBodegaPorCodigo(codigoBodega);

                if (!bodega) {
                  alert('No se encontró una bodega activa con ese código');
                  codigoRef.current?.select();
                  return;
                }

                generarReporte(String(bodega.id_bodega));
              }}
            />
          </div>

          <div>
            <label>Bodega</label>
            <select
              ref={bodegaRef}
              className="inventario-select"
              value={idBodega}
              onChange={cambiarSeleccion}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  generarReporte();
                }
              }}
            >
              <option value="">Seleccione una bodega</option>
              {bodegas.map((item) => (
                <option key={item.id_bodega} value={item.id_bodega}>
                  {item.codigo} - {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="inventario-check inventario-check-parametro">
              <input
                type="checkbox"
                checked={soloConExistencia}
                onChange={(e) => setSoloConExistencia(e.target.checked)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    generarRef.current?.focus();
                  }
                }}
              />
              Mostrar solo artículos con existencia
            </label>
          </div>

          <div className="reportes-parametros-boton">
            <button
              ref={generarRef}
              type="button"
              className="reportes-btn-generar"
              disabled={cargando}
              onClick={() => generarReporte()}
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
            <h3>Reporte de existencias</h3>
            <p className="reportes-subtitulo">Según bodega</p>
            <div className="reportes-encabezado-datos">
              <span><strong>Bodega:</strong> {textoBodega()}</span>
              <span><strong>Artículos:</strong> {articulosVisibles.length}</span>
              <span><strong>Fecha del reporte:</strong> {mostrarFecha(datos.fechaReporte)}</span>
            </div>
          </div>

          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th>Cód. art.</th>
                  <th>Descripción</th>
                  <th>Precio</th>
                  <th>Exist.</th>
                  <th>Subtotal</th>
                  <th>T. física</th>
                  <th>Línea</th>
                </tr>
              </thead>

              <tbody>
                {articulosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="reportes-sin-datos">
                      {soloConExistencia
                        ? 'Esta bodega no tiene artículos con existencia'
                        : 'No hay artículos activos'}
                    </td>
                  </tr>
                ) : (
                  articulosVisibles.map((item) => (
                    <tr
                      key={item.id_articulo}
                      className={item.existencia === 0 ? 'inventario-sin-contar' : ''}
                    >
                      <td>{item.codigo}</td>
                      <td className="reportes-celda-empleado">{item.descripcion}</td>
                      <td className="reportes-celda-monto">{formatoMoneda(item.precio)}</td>
                      <td>{formatoCantidad(item.existencia)}</td>
                      <td className="reportes-celda-monto">{formatoMoneda(item.subtotal)}</td>
                      <td><span className="inventario-raya-toma" /></td>
                      <td>{item.linea || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>

              {articulosVisibles.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan="3" className="reportes-celda-empleado">Total</td>
                    <td>{formatoCantidad(totales.existencia)}</td>
                    <td className="reportes-celda-monto">{formatoMoneda(totales.subtotal)}</td>
                    <td colSpan="2"></td>
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

export default ReporteExistenciasBodega;
