const { sql, getConnection } = require('../config/db');


const esFechaValida = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaValidada = new Date(`${fecha}T00:00:00Z`);
  return (
    !Number.isNaN(fechaValidada.getTime()) &&
    fechaValidada.toISOString().slice(0, 10) === fecha
  );
};

const obtenerInformeCobros = async (req, res) => {
  try {
    const { fecha, id_rollo } = req.query;

    if (!fecha || !id_rollo) {
      return res.status(400).json({
        mensaje: 'Fecha y rollo son obligatorios'
      });
    }

    const pool = await getConnection();

    const resumenClientes = await pool.request()
      .input('id_rollo', sql.Int, Number(id_rollo))
      .query(`
        SELECT
          COUNT(*) AS total_clientes,
          ISNULL(SUM(saldo_actual), 0) AS total_saldo_actual
        FROM clientes
        WHERE id_rollo = @id_rollo
          AND estado = 'A'
      `);

    const resumenCobrosFecha = await pool.request()
    .input('fecha', sql.Date, fecha)
    .input('id_rollo', sql.Int, Number(id_rollo))
    .query(`
      SELECT
        ISNULL(SUM(total_efectivo), 0) AS total_efectivo,
        ISNULL(SUM(total_sinpe), 0) AS total_sinpe,
        ISNULL(SUM(total_general), 0) AS total_cobrado_fecha
      FROM cobros_efectivo
      WHERE fecha = @fecha
        AND id_rollo = @id_rollo
        AND estado = 'A'
    `);

    const resumenCobrosAcumulado = await pool.request()
    .input('fecha', sql.Date, fecha)
    .input('id_rollo', sql.Int, Number(id_rollo))
    .query(`
      SELECT
        ISNULL(SUM(total_general), 0) AS total_cobrado_acumulado
      FROM cobros_efectivo
      WHERE fecha <= @fecha
        AND id_rollo = @id_rollo
        AND estado = 'A'
    `);

    const detalleClientes = await pool.request()
      .input('id_rollo', sql.Int, Number(id_rollo))
      .query(`
        SELECT
          c.id_cliente,
          c.codigo,
          c.cedula,
          c.nombre,
          c.telefono,
          c.saldo_actual,
          r.numero AS numero_rollo,
          r.descripcion AS rollo
        FROM clientes c
        INNER JOIN rollos r
          ON c.id_rollo = r.id_rollo
        WHERE c.id_rollo = @id_rollo
          AND c.estado = 'A'
        ORDER BY c.nombre
      `);

    const resumenCliente = resumenClientes.recordset[0];
    const resumenCobroFecha = resumenCobrosFecha.recordset[0];
    const resumenCobroAcumulado = resumenCobrosAcumulado.recordset[0];

    const totalSaldoActual = Number(resumenCliente.total_saldo_actual || 0);
    const totalCobradoFecha = Number(resumenCobroFecha.total_cobrado_fecha || 0);
    const totalCobradoAcumulado = Number(resumenCobroAcumulado.total_cobrado_acumulado || 0);
    const saldoPendienteEstimado = Math.max(
      totalSaldoActual - totalCobradoAcumulado,
      0
    );

    res.json({
      resumen: {
        total_clientes: resumenCliente.total_clientes,
        total_saldo_actual: totalSaldoActual,
        total_efectivo: resumenCobroFecha.total_efectivo,
        total_sinpe: resumenCobroFecha.total_sinpe,
        total_cobrado_fecha: totalCobradoFecha,
        total_cobrado_acumulado: totalCobradoAcumulado,
        saldo_pendiente_estimado: saldoPendienteEstimado
      },
      detalle_clientes: detalleClientes.recordset
    });
  } catch (error) {
    console.error('Error obteniendo informe de cobros:', error);

    res.status(500).json({
      mensaje: 'Error al obtener informe de cobros',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   GET /api/informe-cobros/reportes?id_rollo=6&fecha=YYYY-MM-DD
   Datos para los reportes de Abonos, Resumen por cobradores
   y Tarjetas faltantes de un rollo en una fecha de cobro.
   ------------------------------------------------------------ */
const reporteCobrosRollo = async (req, res) => {
  const idRollo = Number(req.query.id_rollo);
  const { fecha } = req.query;

  if (!Number.isInteger(idRollo) || idRollo <= 0) {
    return res.status(400).json({ mensaje: 'Debe indicar un rollo válido' });
  }

  if (!esFechaValida(fecha)) {
    return res.status(400).json({ mensaje: 'Debe indicar una fecha de cobro válida' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_rollo', sql.Int, idRollo)
      .input('fecha', sql.Date, fecha)
      .query(`
        -- 0. Rollo y su bodega
        SELECT
          r.id_rollo,
          r.numero,
          r.descripcion,
          b.codigo      AS codigo_bodega,
          b.descripcion AS bodega
        FROM rollos r
        LEFT JOIN bodegas b ON b.id_bodega = r.id_bodega
        WHERE r.id_rollo = @id_rollo;

        -- 1. Abonos del rollo en la fecha
        SELECT
          mc.id_movimiento_cliente,
          c.codigo AS codigo_cliente,
          c.nombre AS cliente,
          mc.monto,
          e.codigo AS codigo_empleado,
          e.nombre AS empleado
        FROM movimientos_cliente mc
        INNER JOIN clientes c ON c.id_cliente = mc.id_cliente
        LEFT JOIN empleados e ON e.id_empleado = mc.id_empleado
        WHERE mc.tipo_movimiento = 'ABONO'
          AND mc.estado = 'A'
          AND mc.id_rollo = @id_rollo
          AND mc.fecha = @fecha
        ORDER BY mc.id_movimiento_cliente;

        -- 2. Resumen por cobrador: reportado en Efectivo (efectivo + SINPE) vs. abonos digitados
        SELECT
          e.id_empleado,
          e.codigo AS codigo_empleado,
          e.nombre AS empleado,
          SUM(t.efectivo)        AS efectivo,
          SUM(t.sinpe)           AS sinpe,
          SUM(t.efectivo + t.sinpe) AS reporte_efectivo,
          SUM(t.reporte_sistema) AS reporte_sistema
        FROM (
          SELECT
            ced.id_empleado,
            ced.efectivo,
            ced.sinpe,
            CAST(0 AS DECIMAL(14,2)) AS reporte_sistema
          FROM cobros_efectivo_detalle ced
          INNER JOIN cobros_efectivo ce ON ce.id_cobro = ced.id_cobro
          WHERE ce.id_rollo = @id_rollo
            AND ce.fecha = @fecha
            AND ce.estado = 'A'

          UNION ALL

          SELECT
            mc.id_empleado,
            CAST(0 AS DECIMAL(14,2)),
            CAST(0 AS DECIMAL(14,2)),
            mc.monto
          FROM movimientos_cliente mc
          WHERE mc.tipo_movimiento = 'ABONO'
            AND mc.estado = 'A'
            AND mc.id_rollo = @id_rollo
            AND mc.fecha = @fecha
            AND mc.id_empleado IS NOT NULL
        ) t
        INNER JOIN empleados e ON e.id_empleado = t.id_empleado
        GROUP BY e.id_empleado, e.codigo, e.nombre
        ORDER BY e.codigo;

        -- 3. Tarjetas faltantes: clientes activos del rollo no registrados en la fecha
        SELECT
          c.id_cliente,
          c.codigo AS codigo_cliente,
          c.nombre AS cliente,
          c.direccion,
          c.lado_calle,
          c.saldo_actual,
          ult.ultimo_registro
        FROM clientes c
        OUTER APPLY (
          SELECT MAX(t.fecha) AS ultimo_registro
          FROM tarjetas_registradas t
          WHERE t.id_cliente = c.id_cliente
            AND t.estado = 'A'
        ) ult
        WHERE c.id_rollo = @id_rollo
          AND c.estado = 'A'
          AND NOT EXISTS (
            SELECT 1
            FROM tarjetas_registradas t
            WHERE t.id_cliente = c.id_cliente
              AND t.id_rollo = @id_rollo
              AND t.fecha = @fecha
              AND t.estado = 'A'
          )
        ORDER BY c.codigo;

        -- 4. Conteo de tarjetas
        SELECT
          (SELECT COUNT(*) FROM clientes
            WHERE id_rollo = @id_rollo AND estado = 'A') AS tarjetas_rollo,
          (SELECT COUNT(*) FROM tarjetas_registradas
            WHERE id_rollo = @id_rollo AND fecha = @fecha AND estado = 'A') AS tarjetas_digitadas;
      `);

    const [rollos, abonos, resumen, faltantes, conteos] = resultado.recordsets;

    if (rollos.length === 0) {
      return res.status(404).json({ mensaje: 'El rollo no existe' });
    }

    const redondear = (valor) => Math.round(Number(valor) * 100) / 100;

    const reporteEfectivo = redondear(
      resumen.reduce((suma, fila) => suma + Number(fila.reporte_efectivo || 0), 0)
    );
    const sumaSistema = redondear(
      abonos.reduce((suma, fila) => suma + Number(fila.monto || 0), 0)
    );

    return res.json({
      rollo: rollos[0],
      fecha,
      totales: {
        reporte_efectivo: reporteEfectivo,
        suma_sistema: sumaSistema,
        diferencia: redondear(reporteEfectivo - sumaSistema)
      },
      tarjetas: {
        del_rollo: conteos[0].tarjetas_rollo,
        digitadas: conteos[0].tarjetas_digitadas,
        faltantes: faltantes.length
      },
      abonos,
      resumen_cobradores: resumen.map((fila) => ({
        ...fila,
        diferencia: redondear(Number(fila.reporte_efectivo) - Number(fila.reporte_sistema))
      })),
      tarjetas_faltantes: faltantes
    });
  } catch (error) {
    console.error('Error generando reportes de cobros del rollo:', error);

    return res.status(500).json({
      mensaje: 'Error al generar los reportes de cobros',
      error: error.message
    });
  }
};


/* ------------------------------------------------------------
   GET /api/informe-cobros/ventas-devoluciones?boleta=22717
   Todas las ventas y devoluciones activas de una boleta.
   ------------------------------------------------------------ */
const reporteVentasDevoluciones = async (req, res) => {
  const boleta = String(req.query.boleta || '').trim();

  if (!boleta || boleta.length > 20) {
    return res.status(400).json({ mensaje: 'Digite un número de boleta válido' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('boleta', sql.VarChar(20), boleta)
      .query(`
        -- 0. Encabezado: fecha, bodega y rollo con que se abrió la boleta
        SELECT TOP 1
          t.fecha,
          b.codigo      AS codigo_bodega,
          b.descripcion AS bodega,
          r.numero      AS numero_rollo,
          r.descripcion AS rollo
        FROM (
          SELECT fecha, id_bodega, id_rollo FROM ventas
          WHERE numero_boleta = @boleta AND estado = 'ACTIVA'
          UNION ALL
          SELECT fecha, id_bodega, id_rollo FROM devoluciones
          WHERE numero_boleta = @boleta AND estado = 'A'
        ) t
        LEFT JOIN bodegas b ON b.id_bodega = t.id_bodega
        LEFT JOIN rollos r  ON r.id_rollo  = t.id_rollo
        ORDER BY CASE WHEN t.id_rollo IS NULL THEN 1 ELSE 0 END;

        -- 1. Líneas: ventas primero, después devoluciones
        SELECT
          0 AS orden,
          'VENTA' AS tipo,
          v.id_venta AS id_documento,
          c.codigo AS codigo_cliente,
          c.nombre AS cliente,
          a.codigo AS codigo_articulo,
          a.descripcion AS articulo,
          vd.cantidad,
          vd.cantidad * vd.costo_unitario AS total_costo,
          vd.subtotal AS total_venta,
          e.codigo AS codigo_empleado,
          e.nombre AS empleado
        FROM ventas v
        INNER JOIN ventas_detalle vd ON vd.id_venta = v.id_venta
        INNER JOIN clientes c        ON c.id_cliente = v.id_cliente
        INNER JOIN articulos a       ON a.id_articulo = vd.id_articulo
        LEFT JOIN empleados e        ON e.id_empleado = v.id_empleado
        WHERE v.numero_boleta = @boleta
          AND v.estado = 'ACTIVA'
          AND vd.estado = 'ACTIVO'

        UNION ALL

        SELECT
          1 AS orden,
          'DEVOLUCION' AS tipo,
          d.id_devolucion AS id_documento,
          c.codigo,
          c.nombre,
          a.codigo,
          a.descripcion,
          dd.cantidad,
          dd.cantidad * dd.costo_unitario,
          dd.subtotal,
          e.codigo,
          e.nombre
        FROM devoluciones d
        INNER JOIN devoluciones_detalle dd ON dd.id_devolucion = d.id_devolucion
        INNER JOIN clientes c              ON c.id_cliente = d.id_cliente
        INNER JOIN articulos a             ON a.id_articulo = dd.id_articulo
        LEFT JOIN empleados e              ON e.id_empleado = d.id_empleado
        WHERE d.numero_boleta = @boleta
          AND d.estado = 'A'

        ORDER BY orden, codigo_cliente, id_documento;
      `);

    const [encabezados, lineas] = resultado.recordsets;

    if (encabezados.length === 0 || lineas.length === 0) {
      return res.status(404).json({
        mensaje: `No hay ventas ni devoluciones activas con la boleta ${boleta}`
      });
    }

    const redondear = (valor) => Math.round(Number(valor) * 100) / 100;
    const sumar = (tipo, campo) =>
      redondear(
        lineas
          .filter((linea) => linea.tipo === tipo)
          .reduce((suma, linea) => suma + Number(linea[campo] || 0), 0)
      );

    const ventasCosto = sumar('VENTA', 'total_costo');
    const ventasCredito = sumar('VENTA', 'total_venta');
    const devolucionesCosto = sumar('DEVOLUCION', 'total_costo');
    const devolucionesCredito = sumar('DEVOLUCION', 'total_venta');

    const encabezado = encabezados[0];

    return res.json({
      boleta,
      fecha: encabezado.fecha,
      rollo: {
        numero: encabezado.numero_rollo || '-',
        descripcion: encabezado.rollo || '',
        codigo_bodega: encabezado.codigo_bodega,
        bodega: encabezado.bodega
      },
      lineas,
      totales: {
        lineas: lineas.length,
        ventas_costo: ventasCosto,
        ventas_credito: ventasCredito,
        devoluciones_costo: devolucionesCosto,
        devoluciones_credito: devolucionesCredito,
        neto_costo: redondear(ventasCosto - devolucionesCosto),
        neto_credito: redondear(ventasCredito - devolucionesCredito)
      }
    });
  } catch (error) {
    console.error('Error generando reporte de ventas y devoluciones:', error);

    return res.status(500).json({
      mensaje: 'Error al generar el reporte de ventas y devoluciones',
      error: error.message
    });
  }
};

module.exports = {
  obtenerInformeCobros,
  reporteCobrosRollo,
  reporteVentasDevoluciones
};