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

const formatoMoneda = (valor) => {
  const numero = Number(valor || 0);
  const texto = Math.abs(numero).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' });
  return numero < 0 ? `-${texto}` : texto;
};

const formatoMonedaReporte = (valor) => {
  const numero = Number(valor || 0);
  const signo = numero < 0 ? '-' : '';
  return `${signo}¢${Math.abs(numero).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatoCantidad = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { maximumFractionDigits: 2 });

// Diferencia: negativa entre paréntesis (como el sistema anterior).
const formatoDiferencia = (valor) => {
  const numero = Number(valor || 0);
  return numero < 0 ? `(${formatoCantidad(Math.abs(numero))})` : formatoCantidad(numero);
};

const claseDiferencia = (valor) => {
  const numero = Number(valor || 0);
  if (numero < 0) return 'inventario-faltante';
  if (numero > 0) return 'inventario-sobrante';
  return '';
};

const nombreUsuario = () => {
  try {
    return JSON.parse(localStorage.getItem('usuario'))?.nombre || '';
  } catch {
    return '';
  }
};

function ReporteResultadoInventario() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [codigoBodega, setCodigoBodega] = useState('');
  const [bodega, setBodega] = useState(null);
  const [soloContados, setSoloContados] = useState(false);

  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);

  const bodegaRef = useRef(null);

  useEffect(() => {
    fetch('/api/bodegas')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((lista) => setBodegas(Array.isArray(lista) ? lista : []))
      .catch((error) => {
        console.error('Error cargando bodegas:', error);
        alert('No se pudieron cargar las bodegas');
      });
  }, []);

  const generarReporte = async () => {
    if (cargando) return;

    const codigo = codigoBodega.trim().toLowerCase();

    if (!codigo) {
      alert('Digite el código de la bodega');
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

    try {
      setCargando(true);

      const respuesta = await fetch(`/api/inventarios/resultado?id_bodega=${encontrada.id_bodega}`);
      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'No se pudo generar el reporte');
        return;
      }

      setDatos({ ...resultado, fechaReporte: fechaLocalHoy() });
    } catch (error) {
      console.error('Error generando resultado de inventario:', error);
      alert('No se pudo generar el reporte');
    } finally {
      setCargando(false);
    }
  };

  const articulosVisibles = datos
    ? datos.articulos.filter((item) => !soloContados || item.contado)
    : [];

  // Totales de lo que se está mostrando (respeta el filtro "solo contados").
  // Igual que el sistema anterior: valor de la toma física, valor de las
  // existencias del sistema y la diferencia entre ambos (total inventario).
  const totalesVisibles = articulosVisibles.reduce(
    (acum, item) => {
      const costo = Number(item.costo || 0);

      return {
        toma_fisica: acum.toma_fisica + Number(item.toma || 0) * costo,
        existencias: acum.existencias + Number(item.existencia || 0) * costo,
        inventario: acum.inventario + Number(item.diferencia_monto || 0)
      };
    },
    { toma_fisica: 0, existencias: 0, inventario: 0 }
  );

  const validarHayDatos = () => {
    if (!datos) {
      alert('Primero genere el reporte');
      return false;
    }
    return true;
  };

  const nombreArchivo = () =>
    datos ? `resultado-inventario-${datos.bodega.codigo}-${datos.fechaReporte}` : 'resultado-inventario';

  const exportarPDF = () => {
    if (!validarHayDatos()) return;

    const doc = new jsPDF('landscape');
    const ancho = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Fecha del reporte:', 14, 14);
    doc.text(mostrarFecha(datos.fechaReporte), 14, 19);
    doc.text(`Usuario: ${nombreUsuario()}`, ancho - 14, 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('REPORTE RESULTADOS DE INVENTARIOS', ancho / 2, 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('SEGÚN BODEGA', ancho / 2, 21, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.line(14, 25, ancho - 14, 25);

    doc.setFont('helvetica', 'bold');
    doc.text('Bodega:', 14, 32);
    doc.setFont('helvetica', 'normal');
    doc.text(`${datos.bodega.codigo}  ${datos.bodega.descripcion}`, 32, 32);

    doc.text(
      `Artículos: ${articulosVisibles.length}   ·   Contados: ${articulosVisibles.filter((i) => i.contado).length}` +
        (soloContados ? '   ·   (solo artículos contados)' : ''),
      ancho - 14,
      32,
      { align: 'right' }
    );

    autoTable(doc, {
      theme: 'grid',
      startY: 38,
      head: [['Código', 'Descripción', 'Precio', 'Exist.', 'Toma', 'Difer.', 'Dif. monto']],
      body: articulosVisibles.map((item) => [
        item.codigo,
        item.contado ? item.descripcion : `${item.descripcion}  (sin contar)`,
        formatoMonedaReporte(item.costo),
        formatoCantidad(item.existencia),
        formatoCantidad(item.toma),
        formatoDiferencia(item.diferencia),
        formatoMonedaReporte(item.diferencia_monto)
      ]),
      foot: [
        ['', 'Total toma física', '', '', '', '', formatoMonedaReporte(totalesVisibles.toma_fisica)],
        ['', 'Total existencias', '', '', '', '', formatoMonedaReporte(totalesVisibles.existencias)],
        ['', 'Total inventario (diferencia)', '', '', '', '', formatoMonedaReporte(totalesVisibles.inventario)]
      ],
      styles: {
        fontSize: 8.5,
        cellPadding: { top: 2, bottom: 2, left: 3, right: 4 },
        lineColor: [203, 213, 225],
        lineWidth: 0.2,
        textColor: [15, 23, 42]
      },
      headStyles: { fillColor: [55, 65, 81], textColor: [255, 255, 255], fontStyle: 'bold' },
      footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 24 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 20 },
        5: { cellWidth: 22 },
        6: { cellWidth: 34 }
      },
      didParseCell: (data) => {
        if ([0, 3, 4, 5].includes(data.column.index)) data.cell.styles.halign = 'center';
        if ([2, 6].includes(data.column.index)) data.cell.styles.halign = 'right';

        if (data.section === 'body') {
          const item = articulosVisibles[data.row.index];

          // Artículos sin contar en gris.
          if (item && !item.contado) data.cell.styles.textColor = [148, 163, 184];

          // Diferencias negativas en rojo, positivas en verde.
          if (item && item.contado && [5, 6].includes(data.column.index)) {
            if (item.diferencia < 0) data.cell.styles.textColor = [185, 28, 28];
            if (item.diferencia > 0) data.cell.styles.textColor = [21, 128, 61];
          }
        }
      }
    });

    doc.setProperties({
      title: `Resultado de inventario - ${datos.bodega.descripcion} - ${mostrarFecha(datos.fechaReporte)}`
    });
    doc.viewerPreferences({ DisplayDocTitle: true });

    window.open(doc.output('bloburl'), '_blank') || doc.save(`${nombreArchivo()}.pdf`);
  };

  const exportarExcel = () => {
    if (!validarHayDatos()) return;

    const filas = [
      ['REPORTE RESULTADOS DE INVENTARIOS SEGÚN BODEGA'],
      [`Bodega: ${datos.bodega.codigo} ${datos.bodega.descripcion}`],
      [`Fecha del reporte: ${mostrarFecha(datos.fechaReporte)}`],
      [],
      ['Código', 'Descripción', 'Precio', 'Exist.', 'Toma', 'Difer.', 'Dif. monto', 'Estado'],
      ...articulosVisibles.map((item) => [
        item.codigo,
        item.descripcion,
        Number(item.costo),
        Number(item.existencia),
        Number(item.toma),
        Number(item.diferencia),
        Number(item.diferencia_monto),
        item.contado ? 'Contado' : 'Sin contar'
      ]),
      [],
      ['', 'Total toma física', '', '', '', '', totalesVisibles.toma_fisica],
      ['', 'Total existencias', '', '', '', '', totalesVisibles.existencias],
      ['', 'Total inventario (diferencia)', '', '', '', '', totalesVisibles.inventario]
    ];

    const hoja = XLSX.utils.aoa_to_sheet(filas);
    hoja['!cols'] = [
      { wch: 12 }, { wch: 36 }, { wch: 12 }, { wch: 10 },
      { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 12 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Resultado');
    XLSX.writeFile(libro, `${nombreArchivo()}.xlsx`);
  };

  return (
    <div className="reportes-page">
      <header className="reportes-header no-imprimir">
        <h2>Resultado de inventario</h2>
        <button type="button" onClick={() => navigate('/inventarios')}>Volver</button>
      </header>

      <section className="reportes-card no-imprimir">
        <h3>Parámetros del informe</h3>

        <div className="inventario-grid-bodega inventario-grid-resultado">
          <div>
            <label>Código de bodega</label>
            <input
              ref={bodegaRef}
              autoFocus
              type="text"
              value={codigoBodega}
              placeholder="Código y Enter"
              onChange={(e) => {
                setCodigoBodega(e.target.value);
                setBodega(null);
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

          <div>
            <label>Descripción de la bodega</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={bodega?.descripcion || ''}
              placeholder="Automático"
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
          <div className="inventario-barra-resultado no-imprimir">
            <label className="inventario-check">
              <input
                type="checkbox"
                checked={soloContados}
                onChange={(e) => setSoloContados(e.target.checked)}
              />
              Mostrar solo artículos contados
            </label>

            <div className="reportes-acciones" style={{ marginBottom: 0 }}>
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
          </div>

          <div className="reportes-encabezado-informe">
            <h3>Reporte resultados de inventarios</h3>
            <p className="reportes-subtitulo">Según bodega</p>
            <div className="reportes-encabezado-datos">
              <span><strong>Bodega:</strong> {datos.bodega.codigo} {datos.bodega.descripcion}</span>
              <span><strong>Artículos:</strong> {articulosVisibles.length}</span>
              <span>
                <strong>Contados:</strong> {articulosVisibles.filter((item) => item.contado).length}
              </span>
              <span><strong>Fecha del reporte:</strong> {mostrarFecha(datos.fechaReporte)}</span>
            </div>
          </div>

          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Precio</th>
                  <th>Exist.</th>
                  <th>Toma</th>
                  <th>Difer.</th>
                  <th>Dif. monto</th>
                </tr>
              </thead>

              <tbody>
                {articulosVisibles.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="reportes-sin-datos">
                      {soloContados
                        ? 'Todavía no se ha contado ningún artículo en esta bodega'
                        : 'Esta bodega no tiene artículos con existencia ni tomas físicas'}
                    </td>
                  </tr>
                ) : (
                  articulosVisibles.map((item) => (
                    <tr key={item.id_articulo} className={item.contado ? '' : 'inventario-sin-contar'}>
                      <td>{item.codigo}</td>
                      <td className="reportes-celda-empleado">
                        {item.descripcion}
                        {!item.contado && <span className="inventario-etiqueta">sin contar</span>}
                      </td>
                      <td className="reportes-celda-monto">{formatoMoneda(item.costo)}</td>
                      <td>{formatoCantidad(item.existencia)}</td>
                      <td>{formatoCantidad(item.toma)}</td>
                      <td className={item.contado ? claseDiferencia(item.diferencia) : ''}>
                        {formatoDiferencia(item.diferencia)}
                      </td>
                      <td
                        className={`reportes-celda-monto ${item.contado ? claseDiferencia(item.diferencia_monto) : ''}`}
                      >
                        {formatoMoneda(item.diferencia_monto)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {articulosVisibles.length > 0 && (
                <tfoot>
                  <tr>
                    <td colSpan="6" className="reportes-celda-empleado">Total toma física</td>
                    <td className="reportes-celda-monto">
                      {formatoMoneda(totalesVisibles.toma_fisica)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="6" className="reportes-celda-empleado">Total existencias</td>
                    <td className="reportes-celda-monto">
                      {formatoMoneda(totalesVisibles.existencias)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan="6" className="reportes-celda-empleado">
                      Total inventario (diferencia)
                    </td>
                    <td className={`reportes-celda-monto ${claseDiferencia(totalesVisibles.inventario)}`}>
                      {formatoMoneda(totalesVisibles.inventario)}
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

export default ReporteResultadoInventario;