import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './InformeCobros.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

// Fecha de hoy en hora local (Costa Rica), formato YYYY-MM-DD.
const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

function InformeCobros() {
  const navigate = useNavigate();

  const [rollos, setRollos] = useState([]);
  const [filtros, setFiltros] = useState({
    fecha: fechaLocalHoy(),
    id_rollo: ''
  });

  const [resumen, setResumen] = useState({
    total_clientes: 0,
    total_saldo_actual: 0,
    total_efectivo: 0,
    total_sinpe: 0,
    total_cobrado_fecha: 0,
    total_cobrado_acumulado: 0,
    saldo_pendiente_estimado: 0
  });

  const [detalleClientes, setDetalleClientes] = useState([]);
  const [consultado, setConsultado] = useState(false);

  const [numeroRollo, setNumeroRollo] = useState('');
  const rolloRef = useRef(null);
  const fechaRef = useRef(null);

  const [generandoReporte, setGenerandoReporte] = useState(null);

  const [modalBoletaAbierto, setModalBoletaAbierto] = useState(false);
  const [boletaReporte, setBoletaReporte] = useState('');

  const rolloSeleccionado = rollos.find(
    (item) => Number(item.id_rollo) === Number(filtros.id_rollo)
  );

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
      setFiltros((anterior) => ({ ...anterior, id_rollo: '' }));
      return;
    }

    setFiltros((anterior) => ({ ...anterior, id_rollo: String(encontrado.id_rollo) }));
    setConsultado(false);
    fechaRef.current?.focus();
  };

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

  useEffect(() => {
    cargarRollos();
  }, []);

  const cambiarFiltro = (e) => {
    const { name, value } = e.target;

    setFiltros({
      ...filtros,
      [name]: value
    });
  };

  const consultarInforme = async () => {
    if (!filtros.fecha || !filtros.id_rollo) {
      alert('Fecha y rollo son obligatorios');
      return;
    }

    try {
      const respuesta = await fetch(
        `/api/informe-cobros?fecha=${filtros.fecha}&id_rollo=${filtros.id_rollo}`
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al consultar informe');
        return;
      }

      setResumen(datos.resumen);
      setDetalleClientes(datos.detalle_clientes);
      setConsultado(true);
    } catch (error) {
      console.error('Error consultando informe:', error);
      alert('Error al consultar informe de cobros');
    }
  };

  const limpiar = () => {
    setFiltros({
      fecha: fechaLocalHoy(),
      id_rollo: ''
    });

    setResumen({
      total_clientes: 0,
      total_saldo_actual: 0,
      total_efectivo: 0,
      total_sinpe: 0,
      total_cobrado_fecha: 0,
      total_cobrado_acumulado: 0,
      saldo_pendiente_estimado: 0
    });

    setDetalleClientes([]);
    setConsultado(false);
    setNumeroRollo('');
    rolloRef.current?.focus();
  };

  const formatoMoneda = (valor) => {
    return Number(valor || 0).toLocaleString('es-CR', {
      style: 'currency',
      currency: 'CRC'
    });
  };

  const formatoMonedaReporte = (valor) => {
    const numero = Number(valor || 0);
    const signo = numero < 0 ? '-' : '';

    return `${signo}¢${Math.abs(numero).toLocaleString('es-CR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const obtenerRolloSeleccionado = () => {
    const rollo = rollos.find(
      (item) => Number(item.id_rollo) === Number(filtros.id_rollo)
    );

    if (!rollo) return '';

    return `${rollo.numero} - ${rollo.descripcion}`;
  };

  const imprimirInforme = () => {
    if (!consultado) {
      alert('Primero debe consultar un informe');
      return;
    }

    window.print();
  };

  const exportarPDF = () => {
    if (!consultado) {
      alert('Primero debe consultar un informe');
      return;
    }

    const doc = new jsPDF();

    const rolloTexto = obtenerRolloSeleccionado();

    doc.setFontSize(16);
    doc.text('Sistema de Inventario', 14, 15);

    doc.setFontSize(14);
    doc.text('Informe de Cobros', 14, 25);

    doc.setFontSize(10);
    doc.text(`Fecha: ${filtros.fecha}`, 14, 35);
    doc.text(`Rollo: ${rolloTexto}`, 14, 42);

    autoTable(doc, {
      startY: 52,
      head: [['Concepto', 'Monto / Cantidad']],
      body: [
        ['Saldo actual del rollo', formatoMonedaReporte(resumen.total_saldo_actual)],
        ['Efectivo en la fecha', formatoMonedaReporte(resumen.total_efectivo)],
        ['SINPE en la fecha', formatoMonedaReporte(resumen.total_sinpe)],
        ['Cobrado en la fecha', formatoMonedaReporte(resumen.total_cobrado_fecha)],
        ['Cobrado acumulado', formatoMonedaReporte(resumen.total_cobrado_acumulado)],
        ['Saldo pendiente estimado', formatoMonedaReporte(resumen.saldo_pendiente_estimado)]
      ]
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 12,
      head: [[
        'Código',
        'Cédula',
        'Cliente',
        'Teléfono',
        'Rollo',
        'Saldo actual'
      ]],
      body: detalleClientes.map((item) => [
        item.codigo,
        item.cedula,
        item.nombre,
        item.telefono || '-',
        `${item.numero_rollo} - ${item.rollo}`,
        formatoMonedaReporte(item.saldo_actual)
      ])
    });

    doc.save(`informe-cobros-${filtros.fecha}.pdf`);
  };

  const exportarExcel = () => {
     if (!consultado) {
    alert('Primero debe consultar un informe');
    return;
    }

    const rolloTexto = obtenerRolloSeleccionado();

    const datosResumen = [
      ['Informe de Cobros'],
      [],
      ['Fecha', filtros.fecha],
      ['Rollo', rolloTexto],
      [],
      ['Concepto', 'Monto / Cantidad'],
      ['Total clientes', resumen.total_clientes],
      ['Saldo actual del rollo', Number(resumen.total_saldo_actual || 0)],
      ['Efectivo en la fecha', Number(resumen.total_efectivo || 0)],
      ['SINPE en la fecha', Number(resumen.total_sinpe || 0)],
      ['Cobrado en la fecha', Number(resumen.total_cobrado_fecha || 0)],
      ['Cobrado acumulado', Number(resumen.total_cobrado_acumulado || 0)],
      ['Saldo pendiente estimado', Number(resumen.saldo_pendiente_estimado || 0)]
    ];

    const datosDetalle = detalleClientes.map((item) => ({
      Código: item.codigo,
      Cédula: item.cedula,
      Cliente: item.nombre,
      Teléfono: item.telefono || '',
      Rollo: `${item.numero_rollo} - ${item.rollo}`,
      'Saldo actual': Number(item.saldo_actual || 0)
    }));

    const hojaResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    const hojaDetalle = XLSX.utils.json_to_sheet(datosDetalle);

    hojaResumen['!cols'] = [
      { wch: 32 },
      { wch: 22 }
    ];

    hojaDetalle['!cols'] = [
      { wch: 12 },
      { wch: 16 },
      { wch: 28 },
      { wch: 16 },
      { wch: 22 },
      { wch: 18 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');
    XLSX.utils.book_append_sheet(libro, hojaDetalle, 'Detalle clientes');

    XLSX.writeFile(libro, `informe-cobros-${filtros.fecha}.xlsx`);
  };

  // ===================== REPORTES DEL COBRO =====================

  const fechaDMY = (fecha) => {
    const texto = String(fecha || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
    const [anio, mes, dia] = texto.split('-');
    return `${dia}/${mes}/${anio}`;
  };

  const nombreUsuario = () => {
    try {
      return JSON.parse(localStorage.getItem('usuario'))?.nombre || '';
    } catch {
      return '';
    }
  };

  // Encabezado común: fecha/hora, título, usuario, rollo, fecha de cobro y bodega.
  const encabezadoReporte = (doc, titulo, datos) => {
    const ancho = doc.internal.pageSize.getWidth();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(fechaDMY(fechaLocalHoy()), 14, 14);
    doc.text(
      new Date().toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' }),
      14,
      19
    );
    doc.text(`Usuario: ${nombreUsuario()}`, ancho - 14, 14, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(titulo, ancho / 2, 15, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('SEGÚN ROLLO Y FECHA', ancho / 2, 21, { align: 'center' });

    doc.setLineWidth(0.4);
    doc.line(14, 25, ancho - 14, 25);

    const datosRollo = [
      ['Rollo:', `${datos.rollo.numero}  ${datos.rollo.descripcion}`],
      ['Fecha de cobro:', fechaDMY(datos.fecha)],
      [
        'Bodega:',
        datos.rollo.bodega
          ? `${datos.rollo.codigo_bodega}  ${datos.rollo.bodega}`
          : 'Sin asignar'
      ]
    ];

    datosRollo.forEach(([etiqueta, valor], indice) => {
      const y = 32 + indice * 6;
      doc.setFont('helvetica', 'bold');
      doc.text(etiqueta, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(valor, 44, y);
    });
  };

  // Bloque de la derecha: etiquetas alineadas y valores alineados en su propia columna.
  const bloqueDerecha = (doc, filas) => {
    const ancho = doc.internal.pageSize.getWidth();

    filas.forEach(([etiqueta, valor], indice) => {
      const y = 32 + indice * 6;
      doc.setFont('helvetica', 'bold');
      doc.text(etiqueta, ancho - 52, y, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      doc.text(String(valor), ancho - 14, y, { align: 'right' });
    });
  };

  const totalesEncabezado = (doc, datos) => {
    bloqueDerecha(doc, [
      ['Reporte efectivo:', formatoMonedaReporte(datos.totales.reporte_efectivo)],
      ['Suma del sistema:', formatoMonedaReporte(datos.totales.suma_sistema)],
      ['Diferencia:', formatoMonedaReporte(datos.totales.diferencia)]
    ]);
  };

  const estiloTabla = {
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 4 },
      lineColor: [203, 213, 225],
      lineWidth: 0.2,
      textColor: [15, 23, 42],
      valign: 'middle'
    },
    headStyles: {
      fillColor: [55, 65, 81],
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    footStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold'
    }
  };

  // Alineación por columna, aplicada a encabezado, cuerpo y totales.
  const alinear = ({ derecha = [], centro = [] }) => (data) => {
    if (derecha.includes(data.column.index)) data.cell.styles.halign = 'right';
    if (centro.includes(data.column.index)) data.cell.styles.halign = 'center';
  };

  const pdfAbonos = (datos) => {
    const doc = new jsPDF();
    encabezadoReporte(doc, 'REPORTE DE ABONOS', datos);
    totalesEncabezado(doc, datos);

    autoTable(doc, {
      ...estiloTabla,
      startY: 52,
      head: [['Cliente', 'Nombre', 'Abono', 'Cobrador']],
      body: datos.abonos.length
        ? datos.abonos.map((item) => [
            item.codigo_cliente,
            item.cliente,
            formatoMonedaReporte(item.monto),
            item.codigo_empleado ? `${item.codigo_empleado} - ${item.empleado}` : '-'
          ])
        : [['', 'No hay abonos registrados para este rollo y fecha', '', '']],
      foot: [[
        '',
        `Total (${datos.abonos.length} abonos)`,
        formatoMonedaReporte(datos.totales.suma_sistema),
        ''
      ]],
      columnStyles: {
        0: { cellWidth: 24 },
        2: { cellWidth: 34 },
        3: { cellWidth: 50 }
      },
      didParseCell: alinear({ centro: [0], derecha: [2] })
    });

    return doc;
  };

  const pdfResumen = (datos) => {
    const doc = new jsPDF('landscape');
    encabezadoReporte(doc, 'RESUMEN POR COBRADORES', datos);
    totalesEncabezado(doc, datos);

    const filas = datos.resumen_cobradores;
    const suma = (campo) => filas.reduce((total, fila) => total + Number(fila[campo] || 0), 0);

    autoTable(doc, {
      ...estiloTabla,
      startY: 52,
      head: [['Cód. emp.', 'Nombre', 'Efectivo', 'SINPE', 'Reporte efectivo', 'Reporte sistema', 'Diferencia']],
      body: filas.length
        ? filas.map((fila) => [
            fila.codigo_empleado,
            fila.empleado,
            formatoMonedaReporte(fila.efectivo),
            formatoMonedaReporte(fila.sinpe),
            formatoMonedaReporte(fila.reporte_efectivo),
            formatoMonedaReporte(fila.reporte_sistema),
            formatoMonedaReporte(fila.diferencia)
          ])
        : [['', 'No hay cobros ni abonos para este rollo y fecha', '', '', '', '', '']],
      foot: [[
        '',
        'Totales',
        formatoMonedaReporte(suma('efectivo')),
        formatoMonedaReporte(suma('sinpe')),
        formatoMonedaReporte(suma('reporte_efectivo')),
        formatoMonedaReporte(suma('reporte_sistema')),
        formatoMonedaReporte(suma('diferencia'))
      ]],
      columnStyles: {
        0: { cellWidth: 24 },
        2: { cellWidth: 34 },
        3: { cellWidth: 34 },
        4: { cellWidth: 38 },
        5: { cellWidth: 38 },
        6: { cellWidth: 34 }
      },
      didParseCell: alinear({ centro: [0], derecha: [2, 3, 4, 5, 6] })
    });

    return doc;
  };

  const pdfTarjetasFaltantes = (datos) => {
    const doc = new jsPDF();
    encabezadoReporte(doc, 'REPORTE TARJETAS FALTANTES', datos);

    bloqueDerecha(doc, [
      ['Tarjetas del rollo:', datos.tarjetas.del_rollo],
      ['Digitadas:', datos.tarjetas.digitadas],
      ['Faltantes:', datos.tarjetas.faltantes]
    ]);

    const faltantes = datos.tarjetas_faltantes;

    autoTable(doc, {
      ...estiloTabla,
      startY: 52,
      head: [['Cliente', 'Nombre / Dirección', 'Lado', 'Saldo', 'Últ. registro']],
      body: faltantes.length
        ? faltantes.map((item) => [
            item.codigo_cliente,
            `${item.cliente}\n${item.direccion || ''}`,
            item.lado_calle || '-',
            formatoMonedaReporte(item.saldo_actual),
            item.ultimo_registro ? fechaDMY(item.ultimo_registro) : 'Nunca'
          ])
        : [['', 'No hay tarjetas faltantes: se digitaron todas las tarjetas del rollo', '', '', '']],
      foot: [[
        '',
        `Total faltantes: ${faltantes.length}`,
        '',
        formatoMonedaReporte(
          faltantes.reduce((total, item) => total + Number(item.saldo_actual || 0), 0)
        ),
        ''
      ]],
      columnStyles: {
        0: { cellWidth: 26 },
        2: { cellWidth: 26 },
        3: { cellWidth: 32 },
        4: { cellWidth: 28 }
      },
      didParseCell: alinear({ centro: [0, 2, 4], derecha: [3] })
    });

    return doc;
  };
  /************************************************* */

  const pdfVentasDevoluciones = (datos) => {
    const doc = new jsPDF('landscape');
    const ancho = doc.internal.pageSize.getWidth();

    // encabezadoReporte usa datos.rollo y datos.fecha
    encabezadoReporte(doc, 'REPORTE DE VENTAS Y DEVOLUCIONES', datos);

    bloqueDerecha(doc, [
      ['Boleta:', datos.boleta],
      ['Total líneas:', datos.totales.lineas]
    ]);

    const lineas = datos.lineas;
    const signo = (linea, valor) => (linea.tipo === 'DEVOLUCION' ? -Number(valor) : Number(valor));

    autoTable(doc, {
      ...estiloTabla,
      startY: 52,
      head: [['Tipo', 'Cliente', 'Nombre', 'Cód. art.', 'Descripción', 'Cant.', 'Costo', 'Venta', 'Empleado']],
      body: lineas.map((linea) => [
        linea.tipo === 'DEVOLUCION' ? 'DEVOL.' : 'VENTA',
        linea.codigo_cliente,
        linea.cliente,
        linea.codigo_articulo,
        linea.articulo,
        Number(linea.cantidad),
        formatoMonedaReporte(signo(linea, linea.total_costo)),
        formatoMonedaReporte(signo(linea, linea.total_venta)),
        linea.codigo_empleado ? `${linea.codigo_empleado} - ${linea.empleado}` : '-'
      ]),
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 22 },
        3: { cellWidth: 22 },
        5: { cellWidth: 16 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 },
        8: { cellWidth: 40 }
      },
      didParseCell: (data) => {
        alinear({ centro: [0, 1, 3, 5], derecha: [6, 7] })(data);

        // Las devoluciones en rojo
        if (data.section === 'body' && lineas[data.row.index]?.tipo === 'DEVOLUCION') {
          data.cell.styles.textColor = [185, 28, 28];
        }
      }
    });

    // Totales debajo de la tabla, alineados a la derecha
    const totales = [
      ['Total ventas costo:', formatoMonedaReporte(datos.totales.ventas_costo)],
      ['Total ventas crédito:', formatoMonedaReporte(datos.totales.ventas_credito)],
      ['Total devoluciones costo:', formatoMonedaReporte(-datos.totales.devoluciones_costo)],
      ['Total devoluciones crédito:', formatoMonedaReporte(-datos.totales.devoluciones_credito)],
      ['Neto crédito:', formatoMonedaReporte(datos.totales.neto_credito)]
    ];

    let y = doc.lastAutoTable.finalY + 10;

    totales.forEach(([etiqueta, valor], indice) => {
      const esNeto = indice === totales.length - 1;

      if (esNeto) {
        doc.setLineWidth(0.3);
        doc.line(ancho - 110, y - 4, ancho - 14, y - 4);
      }

      doc.setFont('helvetica', 'bold');
      doc.text(etiqueta, ancho - 52, y, { align: 'right' });
      doc.setFont('helvetica', esNeto ? 'bold' : 'normal');
      doc.text(valor, ancho - 14, y, { align: 'right' });
      y += 6;
    });

    return doc;
  };

  const generarReporteVentasDevoluciones = async () => {
    const boleta = boletaReporte.trim();

    if (!boleta) {
      alert('Digite el número de boleta');
      return;
    }

    if (generandoReporte) return;

    // La pestaña se abre antes de esperar al servidor para que el navegador no la bloquee.
    const ventana = window.open('', '_blank');

    try {
      setGenerandoReporte('ventas');

      const respuesta = await fetch(
        `/api/informe-cobros/ventas-devoluciones?boleta=${encodeURIComponent(boleta)}`
      );
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        ventana?.close();
        alert(datos.mensaje || 'No se pudo generar el reporte');
        return;
      }

      const doc = pdfVentasDevoluciones(datos);

      doc.setProperties({
        title: `Reporte de ventas y devoluciones - Boleta ${datos.boleta}`
      });
      doc.viewerPreferences({ DisplayDocTitle: true });

      if (ventana) {
        ventana.location.href = doc.output('bloburl');
      } else {
        doc.save(`ventas-devoluciones-boleta-${datos.boleta}.pdf`);
      }

      setModalBoletaAbierto(false);
      setBoletaReporte('');
    } catch (error) {
      ventana?.close();
      console.error('Error generando reporte de ventas y devoluciones:', error);
      alert('No se pudo generar el reporte');
    } finally {
      setGenerandoReporte(null);
    }
  };

  /**************************************************** */

  const generarReporteCobro = async (tipo) => {
    if (!consultado || !filtros.id_rollo) {
      alert('Primero consulte el rollo y la fecha');
      return;
    }

    if (generandoReporte) return;

    // La pestaña se abre antes de esperar al servidor para que el navegador no la bloquee.
    const ventana = window.open('', '_blank');

    try {
      setGenerandoReporte(tipo);

      const parametros = new URLSearchParams({
        id_rollo: filtros.id_rollo,
        fecha: filtros.fecha
      });

      const respuesta = await fetch(`/api/informe-cobros/reportes?${parametros}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        ventana?.close();
        alert(datos.mensaje || 'No se pudo generar el reporte');
        return;
      }

      const generadores = {
        abonos: pdfAbonos,
        resumen: pdfResumen,
        faltantes: pdfTarjetasFaltantes
      };

      const titulos = {
        abonos: 'Reporte de abonos',
        resumen: 'Resumen por cobradores',
        faltantes: 'Reporte de tarjetas faltantes'
      };

      const doc = generadores[tipo](datos);

      // Título que muestra la pestaña del navegador.
      doc.setProperties({
        title: `${titulos[tipo]} - Rollo ${datos.rollo.numero} - ${fechaDMY(datos.fecha)}`
      });
      doc.viewerPreferences({ DisplayDocTitle: true });

      const nombre = `${tipo}-rollo-${datos.rollo.numero}-${datos.fecha}.pdf`;

      if (ventana) {
        ventana.location.href = doc.output('bloburl');
      } else {
        // Si el navegador bloqueó la pestaña, se descarga el PDF.
        doc.save(nombre);
      }
    } catch (error) {
      ventana?.close();
      console.error('Error generando reporte:', error);
      alert('No se pudo generar el reporte');
    } finally {
      setGenerandoReporte(null);
    }
  };

  return (
    <div className="informe-page">

      <header className="informe-header">
        <h2>Informe Cobros</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="informe-card">
        <h3>Filtros del informe</h3>

        <div className="form-grid">
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
                setFiltros((anterior) => ({ ...anterior, id_rollo: '' }));
                setConsultado(false);
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
              style={{ background: '#f1f5f9' }}
            />
          </div>

          <div>
            <label>Fecha de cobro</label>
            <input
              ref={fechaRef}
              type="date"
              name="fecha"
              value={filtros.fecha}
              onChange={(e) => {
                cambiarFiltro(e);
                setConsultado(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  consultarInforme();
                }
              }}
            />
          </div>

          <div className="botones-filtro">
            <button className="btn-consultar" onClick={consultarInforme}>
              Consultar
            </button>

            <button className="btn-limpiar" onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="informe-card">
        <h3>Resumen del cobro</h3>

      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Total clientes</span>
          <strong>{resumen.total_clientes}</strong>
        </div>

        <div className="resumen-item">
          <span>Saldo actual del rollo</span>
          <strong>{formatoMoneda(resumen.total_saldo_actual)}</strong>
        </div>

        <div className="resumen-item">
          <span>Efectivo en la fecha</span>
          <strong>{formatoMoneda(resumen.total_efectivo)}</strong>
        </div>

        <div className="resumen-item">
          <span>SINPE en la fecha</span>
          <strong>{formatoMoneda(resumen.total_sinpe)}</strong>
        </div>

        <div className="resumen-item">
          <span>Cobrado en la fecha</span>
          <strong>{formatoMoneda(resumen.total_cobrado_fecha)}</strong>
        </div>

        <div className="resumen-item">
          <span>Cobrado acumulado</span>
          <strong>{formatoMoneda(resumen.total_cobrado_acumulado)}</strong>
        </div>

        <div className="resumen-item">
          <span>Saldo pendiente estimado</span>
          <strong>{formatoMoneda(resumen.saldo_pendiente_estimado)}</strong>
        </div>
      </div>


      {consultado && (
        <div className="acciones-reporte">
          <button className="btn-imprimir" onClick={imprimirInforme}>
            Imprimir
          </button>

          <button className="btn-pdf" onClick={exportarPDF}>
            Exportar PDF
          </button>

          <button className="btn-excel" onClick={exportarExcel}>
            Exportar Excel
          </button>
        </div>
      )}
      </section>


      <section className="informe-card">
        <h3>Reportes del cobro</h3>

        <div className="reportes-cobro-botones">
          <button
            type="button"
            disabled={!consultado || generandoReporte !== null}
            onClick={() => generarReporteCobro('abonos')}
          >
            🖨 {generandoReporte === 'abonos' ? 'Generando...' : 'Abonos'}
          </button>

          <button
            type="button"
            disabled={!consultado || generandoReporte !== null}
            onClick={() => generarReporteCobro('resumen')}
          >
            🖨 {generandoReporte === 'resumen' ? 'Generando...' : 'Resumen'}
          </button>

          <button
            type="button"
            disabled={!consultado || generandoReporte !== null}
            onClick={() => generarReporteCobro('faltantes')}
          >
            🖨 {generandoReporte === 'faltantes' ? 'Generando...' : 'Tarjetas faltantes'}
          </button>

           <button
            type="button"
            disabled={generandoReporte !== null}
            onClick={() => setModalBoletaAbierto(true)}
          >
            🖨 Ventas / Devol.
          </button>
        </div>

        {!consultado && (
          <p className="reportes-cobro-ayuda">
            Consulte un rollo y una fecha para generar los reportes.
          </p>
        )}
      </section>


      <section className="informe-card">
        <h3>Detalle de clientes del rollo</h3>

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cédula</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Rollo</th>
                <th>Saldo actual</th>
              </tr>
            </thead>

            <tbody>
              {detalleClientes.map((item) => (
                <tr key={item.id_cliente}>
                  <td>{item.codigo}</td>
                  <td>{item.cedula}</td>
                  <td>{item.nombre}</td>
                  <td>{item.telefono || '-'}</td>
                  <td>{item.numero_rollo} - {item.rollo}</td>
                  <td>{formatoMoneda(item.saldo_actual)}</td>
                </tr>
              ))}

              {detalleClientes.length === 0 && (
                <tr>
                  <td colSpan="6" className="sin-datos">
                    {consultado
                      ? 'No hay clientes para los filtros seleccionados'
                      : 'Seleccione fecha y rollo para consultar'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalBoletaAbierto && (
        <div className="informe-modal-fondo" onClick={() => setModalBoletaAbierto(false)}>
          <div className="informe-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Parámetros del informe</h3>

            <label>Documento (número de boleta)</label>
            <input
              type="text"
              autoFocus
              value={boletaReporte}
              placeholder="Ej: 22717"
              onChange={(e) => setBoletaReporte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  generarReporteVentasDevoluciones();
                }
                if (e.key === 'Escape') {
                  setModalBoletaAbierto(false);
                }
              }}
            />

            <div className="informe-modal-botones">
              <button
                type="button"
                className="btn-consultar"
                disabled={generandoReporte !== null}
                onClick={generarReporteVentasDevoluciones}
              >
                {generandoReporte === 'ventas' ? 'Generando...' : 'Aceptar'}
              </button>
              <button
                type="button"
                className="btn-limpiar"
                onClick={() => setModalBoletaAbierto(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
}

export default InformeCobros;