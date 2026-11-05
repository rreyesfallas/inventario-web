import { useRef, useState } from 'react';
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

const formatoMonedaReporte = (valor) =>
  `¢${Number(valor || 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const ORDENES = [
  { valor: 'abonos_cantidad', texto: 'Cantidad de abonos' },
  { valor: 'abonos_monto', texto: 'Monto de abonos' },
  { valor: 'ventas_cantidad', texto: 'Cantidad de ventas' },
  { valor: 'ventas_monto', texto: 'Monto de ventas' },
  { valor: 'devoluciones_cantidad', texto: 'Cantidad de devoluciones' },
  { valor: 'devoluciones_monto', texto: 'Monto de devoluciones' }
];

function ReporteDesempenoEmpleados() {
  const navigate = useNavigate();

  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(fechaLocalHoy());
  const [orden, setOrden] = useState('abonos_monto');

  const [filas, setFilas] = useState([]);
  // Parámetros con los que se generó lo que está en pantalla.
  const [generado, setGenerado] = useState(null);
  const [cargando, setCargando] = useState(false);

  const hastaRef = useRef(null);
  const ordenRef = useRef(null);

  const generarReporte = async () => {
    if (cargando) return;

    if (!desde || !hasta) {
      alert('Seleccione las fechas Desde y Hasta');
      return;
    }

    if (desde > hasta) {
      alert('La fecha Desde no puede ser mayor que la fecha Hasta');
      return;
    }

    try {
      setCargando(true);

      const parametros = new URLSearchParams({ desde, hasta, orden });
      const respuesta = await fetch(`/api/reportes/desempeno-empleados?${parametros}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo generar el reporte');
        return;
      }

      setFilas(Array.isArray(datos) ? datos : []);
      setGenerado({
        desde,
        hasta,
        ordenTexto: ORDENES.find((item) => item.valor === orden)?.texto || '',
        fechaReporte: fechaLocalHoy()
      });
    } catch (error) {
      console.error('Error generando reporte:', error);
      alert('No se pudo generar el reporte');
    } finally {
      setCargando(false);
    }
  };

  const totales = filas.reduce(
    (acum, fila) => ({
      abonos_cantidad: acum.abonos_cantidad + Number(fila.abonos_cantidad || 0),
      abonos_monto: acum.abonos_monto + Number(fila.abonos_monto || 0),
      ventas_cantidad: acum.ventas_cantidad + Number(fila.ventas_cantidad || 0),
      ventas_monto: acum.ventas_monto + Number(fila.ventas_monto || 0),
      devoluciones_cantidad: acum.devoluciones_cantidad + Number(fila.devoluciones_cantidad || 0),
      devoluciones_monto: acum.devoluciones_monto + Number(fila.devoluciones_monto || 0)
    }),
    {
      abonos_cantidad: 0,
      abonos_monto: 0,
      ventas_cantidad: 0,
      ventas_monto: 0,
      devoluciones_cantidad: 0,
      devoluciones_monto: 0
    }
  );

  // Las devoluciones se muestran en negativo, como en el sistema anterior.
  const montoDevolucion = (valor) => (Number(valor) > 0 ? -Number(valor) : 0);

  const nombreArchivo = () =>
    generado ? `desempeno-empleados-${generado.desde}-a-${generado.hasta}` : 'desempeno-empleados';

  const validarHayDatos = () => {
    if (!generado || filas.length === 0) {
      alert('Primero genere el reporte');
      return false;
    }
    return true;
  };

  const imprimir = () => {
    if (!validarHayDatos()) return;
    window.print();
  };

  const exportarPDF = () => {
    if (!validarHayDatos()) return;

    const doc = new jsPDF('landscape');

    doc.setFontSize(15);
    doc.text('REPORTE DE DESEMPEÑO DE EMPLEADOS', 148, 15, { align: 'center' });

    doc.setFontSize(11);
    doc.text(`ORDENADO POR ${generado.ordenTexto.toUpperCase()}`, 148, 22, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Desde: ${mostrarFecha(generado.desde)}`, 14, 32);
    doc.text(`Hasta: ${mostrarFecha(generado.hasta)}`, 70, 32);
    doc.text(`Fecha del reporte: ${mostrarFecha(generado.fechaReporte)}`, 283, 32, { align: 'right' });

    autoTable(doc, {
      startY: 38,
      head: [
        [
          { content: 'Empleado', rowSpan: 2, styles: { valign: 'middle' } },
          { content: 'Abonos', colSpan: 2, styles: { halign: 'center' } },
          { content: 'Ventas', colSpan: 2, styles: { halign: 'center' } },
          { content: 'Devoluciones', colSpan: 2, styles: { halign: 'center' } }
        ],
        ['Cant.', 'Monto', 'Cant.', 'Monto', 'Cant.', 'Monto']
      ],
      body: filas.map((fila) => [
        `${fila.codigo} ${fila.nombre}`,
        fila.abonos_cantidad,
        formatoMonedaReporte(fila.abonos_monto),
        fila.ventas_cantidad,
        formatoMonedaReporte(fila.ventas_monto),
        fila.devoluciones_cantidad,
        formatoMonedaReporte(montoDevolucion(fila.devoluciones_monto))
      ]),
      foot: [[
        'Totales',
        totales.abonos_cantidad,
        formatoMonedaReporte(totales.abonos_monto),
        totales.ventas_cantidad,
        formatoMonedaReporte(totales.ventas_monto),
        totales.devoluciones_cantidad,
        formatoMonedaReporte(montoDevolucion(totales.devoluciones_monto))
      ]],
      styles: { fontSize: 9 },
      headStyles: { fontSize: 9 },
      footStyles: { fontSize: 9 },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'right' },
        3: { halign: 'center' },
        4: { halign: 'right' },
        5: { halign: 'center' },
        6: { halign: 'right' }
      }
    });

    doc.save(`${nombreArchivo()}.pdf`);
  };

  const exportarExcel = () => {
    if (!validarHayDatos()) return;

    const datos = [
      ['REPORTE DE DESEMPEÑO DE EMPLEADOS'],
      [`ORDENADO POR ${generado.ordenTexto.toUpperCase()}`],
      [`Desde: ${mostrarFecha(generado.desde)}`, '', `Hasta: ${mostrarFecha(generado.hasta)}`],
      [],
      ['Empleado', 'Abonos', '', 'Ventas', '', 'Devoluciones', ''],
      ['', 'Cant.', 'Monto', 'Cant.', 'Monto', 'Cant.', 'Monto'],
      ...filas.map((fila) => [
        `${fila.codigo} ${fila.nombre}`,
        Number(fila.abonos_cantidad),
        Number(fila.abonos_monto),
        Number(fila.ventas_cantidad),
        Number(fila.ventas_monto),
        Number(fila.devoluciones_cantidad),
        montoDevolucion(fila.devoluciones_monto)
      ]),
      [
        'Totales',
        totales.abonos_cantidad,
        totales.abonos_monto,
        totales.ventas_cantidad,
        totales.ventas_monto,
        totales.devoluciones_cantidad,
        montoDevolucion(totales.devoluciones_monto)
      ]
    ];

    const hoja = XLSX.utils.aoa_to_sheet(datos);

    // Encabezados agrupados (Abonos / Ventas / Devoluciones).
    hoja['!merges'] = [
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
      { s: { r: 4, c: 5 }, e: { r: 4, c: 6 } }
    ];

    hoja['!cols'] = [
      { wch: 30 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 16 },
      { wch: 10 },
      { wch: 16 }
    ];

    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Desempeño');
    XLSX.writeFile(libro, `${nombreArchivo()}.xlsx`);
  };

  return (
    <div className="reportes-page">
      <header className="reportes-header no-imprimir">
        <h2>Desempeño de empleados</h2>
        <button type="button" onClick={() => navigate('/reportes')}>Volver</button>
      </header>

      <section className="reportes-card no-imprimir">
        <h3>Parámetros del informe</h3>

        <div className="reportes-parametros">
          <div>
            <label>Desde</label>
            <input
              type="date"
              autoFocus
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
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
              onChange={(e) => setHasta(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  ordenRef.current?.focus();
                }
              }}
            />
          </div>

          <div>
            <label>Ordenado por</label>
            <select
              ref={ordenRef}
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  generarReporte();
                }
              }}
            >
              {ORDENES.map((item) => (
                <option key={item.valor} value={item.valor}>{item.texto}</option>
              ))}
            </select>
          </div>

          <div className="reportes-parametros-boton">
            <button type="button" className="reportes-btn-generar" disabled={cargando} onClick={generarReporte}>
              {cargando ? 'Generando...' : 'Generar reporte'}
            </button>
          </div>
        </div>
      </section>

      {generado && (
        <section className="reportes-card reportes-resultado">
          <div className="reportes-acciones no-imprimir">
            <button type="button" className="reportes-btn-imprimir" onClick={imprimir}>Imprimir</button>
            <button type="button" className="reportes-btn-pdf" onClick={exportarPDF}>Exportar PDF</button>
            <button type="button" className="reportes-btn-excel" onClick={exportarExcel}>Exportar Excel</button>
          </div>

          <div className="reportes-encabezado-informe">
            <h3>Reporte de desempeño de empleados</h3>
            <p className="reportes-subtitulo">Ordenado por {generado.ordenTexto.toLowerCase()}</p>
            <div className="reportes-encabezado-datos">
              <span><strong>Desde:</strong> {mostrarFecha(generado.desde)}</span>
              <span><strong>Hasta:</strong> {mostrarFecha(generado.hasta)}</span>
              <span><strong>Fecha del reporte:</strong> {mostrarFecha(generado.fechaReporte)}</span>
            </div>
          </div>

          <div className="reportes-tabla-contenedor">
            <table className="reportes-tabla">
              <thead>
                <tr>
                  <th rowSpan="2">Empleado</th>
                  <th colSpan="2">Abonos</th>
                  <th colSpan="2">Ventas</th>
                  <th colSpan="2">Devoluciones</th>
                </tr>
                <tr>
                  <th>Cant.</th>
                  <th>Monto</th>
                  <th>Cant.</th>
                  <th>Monto</th>
                  <th>Cant.</th>
                  <th>Monto</th>
                </tr>
              </thead>

              <tbody>
                {filas.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="reportes-sin-datos">
                      No hay datos para el rango seleccionado
                    </td>
                  </tr>
                ) : (
                  filas.map((fila) => (
                    <tr key={fila.id_empleado}>
                      <td className="reportes-celda-empleado">{fila.codigo} {fila.nombre}</td>
                      <td>{fila.abonos_cantidad}</td>
                      <td className="reportes-celda-monto">{formatoMoneda(fila.abonos_monto)}</td>
                      <td>{fila.ventas_cantidad}</td>
                      <td className="reportes-celda-monto">{formatoMoneda(fila.ventas_monto)}</td>
                      <td>{fila.devoluciones_cantidad}</td>
                      <td className="reportes-celda-monto reportes-negativo">
                        {formatoMoneda(montoDevolucion(fila.devoluciones_monto))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {filas.length > 0 && (
                <tfoot>
                  <tr>
                    <td className="reportes-celda-empleado">Totales</td>
                    <td>{totales.abonos_cantidad}</td>
                    <td className="reportes-celda-monto">{formatoMoneda(totales.abonos_monto)}</td>
                    <td>{totales.ventas_cantidad}</td>
                    <td className="reportes-celda-monto">{formatoMoneda(totales.ventas_monto)}</td>
                    <td>{totales.devoluciones_cantidad}</td>
                    <td className="reportes-celda-monto reportes-negativo">
                      {formatoMoneda(montoDevolucion(totales.devoluciones_monto))}
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

export default ReporteDesempenoEmpleados;
