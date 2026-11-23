const { sql, getConnection } = require('../config/db');

const esFechaValida = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaValidada = new Date(`${fecha}T00:00:00Z`);
  return (
    !Number.isNaN(fechaValidada.getTime()) &&
    fechaValidada.toISOString().slice(0, 10) === fecha
  );
};

// Órdenes permitidos (lista blanca para no meter texto del usuario en el SQL).
const ORDENES_DESEMPENO = {
  abonos_cantidad: 'abonos_cantidad',
  abonos_monto: 'abonos_monto',
  ventas_cantidad: 'ventas_cantidad',
  ventas_monto: 'ventas_monto',
  devoluciones_cantidad: 'devoluciones_cantidad',
  devoluciones_monto: 'devoluciones_monto'
};

/* ------------------------------------------------------------
   GET /api/reportes/desempeno-empleados?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&orden=abonos_monto
   ------------------------------------------------------------ */
const reporteDesempenoEmpleados = async (req, res) => {
  const { desde, hasta } = req.query;
  const columnaOrden = ORDENES_DESEMPENO[req.query.orden] || ORDENES_DESEMPENO.abonos_monto;

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    return res.status(400).json({ mensaje: 'Debe indicar fechas Desde y Hasta válidas' });
  }

  if (desde > hasta) {
    return res.status(400).json({ mensaje: 'La fecha Desde no puede ser mayor que la fecha Hasta' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('desde', sql.Date, desde)
      .input('hasta', sql.Date, hasta)
      .query(`
        WITH abonos AS (
          SELECT id_empleado, COUNT(*) AS cantidad, SUM(monto) AS monto
          FROM movimientos_cliente
          WHERE tipo_movimiento = 'ABONO'
            AND estado = 'A'
            AND id_empleado IS NOT NULL
            AND fecha BETWEEN @desde AND @hasta
          GROUP BY id_empleado
        ),
        ventas_empleado AS (
          SELECT id_empleado, COUNT(*) AS cantidad, SUM(total) AS monto
          FROM ventas
          WHERE estado = 'ACTIVA'
            AND fecha BETWEEN @desde AND @hasta
          GROUP BY id_empleado
        ),
        devoluciones_empleado AS (
          SELECT id_empleado, COUNT(*) AS cantidad, SUM(total) AS monto
          FROM devoluciones
          WHERE estado = 'A'
            AND fecha BETWEEN @desde AND @hasta
          GROUP BY id_empleado
        )
        SELECT
          e.id_empleado,
          e.codigo,
          e.nombre,
          ISNULL(a.cantidad, 0) AS abonos_cantidad,
          ISNULL(a.monto, 0)    AS abonos_monto,
          ISNULL(v.cantidad, 0) AS ventas_cantidad,
          ISNULL(v.monto, 0)    AS ventas_monto,
          ISNULL(d.cantidad, 0) AS devoluciones_cantidad,
          ISNULL(d.monto, 0)    AS devoluciones_monto
        FROM empleados e
        LEFT JOIN abonos a                ON a.id_empleado = e.id_empleado
        LEFT JOIN ventas_empleado v       ON v.id_empleado = e.id_empleado
        LEFT JOIN devoluciones_empleado d ON d.id_empleado = e.id_empleado
        WHERE e.estado = 'A'
           OR a.id_empleado IS NOT NULL
           OR v.id_empleado IS NOT NULL
           OR d.id_empleado IS NOT NULL
        ORDER BY ${columnaOrden} DESC, e.nombre ASC
      `);

    return res.json(resultado.recordset);
  } catch (error) {
    console.error('Error generando reporte de desempeño:', error);

    return res.status(500).json({
      mensaje: 'Error al generar el reporte de desempeño de empleados',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   GET /api/reportes/estadisticas-rollos?id_bodega=3&fecha=YYYY-MM-DD
   Por cada rollo de la bodega (carro): tarjetas activas
   (clientes con saldo > 0) y total de saldos, a la fecha de corte.
   ------------------------------------------------------------ */
const reporteEstadisticasRollos = async (req, res) => {
  const idBodega = Number(req.query.id_bodega);
  const { fecha } = req.query;

  if (!Number.isInteger(idBodega) || idBodega <= 0) {
    return res.status(400).json({ mensaje: 'Debe indicar una bodega válida' });
  }

  if (!esFechaValida(fecha)) {
    return res.status(400).json({ mensaje: 'Debe indicar una fecha de corte válida' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_bodega', sql.Int, idBodega)
      .input('fecha', sql.Date, fecha)
      .query(`
        -- 0. Datos de la bodega
        SELECT id_bodega, codigo, descripcion
        FROM bodegas
        WHERE id_bodega = @id_bodega;

        -- 1. Saldo de cada cliente a la fecha de corte:
        --    saldo actual menos el efecto de los movimientos posteriores.
        WITH saldos AS (
          SELECT
            c.id_cliente,
            c.id_rollo,
            c.saldo_actual - ISNULL(posterior.efecto, 0) AS saldo_fecha
          FROM clientes c
          INNER JOIN rollos r ON r.id_rollo = c.id_rollo
          OUTER APPLY (
            SELECT SUM(
              CASE
                WHEN mc.tipo_movimiento IN ('VENTA', 'TRANSFERENCIA_ENTRADA') THEN mc.monto
                ELSE -mc.monto
              END
            ) AS efecto
            FROM movimientos_cliente mc
            WHERE mc.id_cliente = c.id_cliente
              AND mc.estado = 'A'
              AND mc.fecha > @fecha
          ) posterior
          WHERE r.id_bodega = @id_bodega
            AND r.estado = 'A'
            AND c.estado = 'A'
        )
        SELECT
          r.id_rollo,
          r.numero,
          r.descripcion,
          COUNT(CASE WHEN s.saldo_fecha > 0 THEN 1 END) AS tarjetas_activas,
          ISNULL(SUM(CASE WHEN s.saldo_fecha > 0 THEN s.saldo_fecha ELSE 0 END), 0) AS total_saldos
        FROM rollos r
        LEFT JOIN saldos s ON s.id_rollo = r.id_rollo
        WHERE r.id_bodega = @id_bodega
          AND r.estado = 'A'
        GROUP BY r.id_rollo, r.numero, r.descripcion
        ORDER BY TRY_CAST(r.numero AS INT), r.numero;
      `);

    const [bodegas, rollos] = resultado.recordsets;

    if (bodegas.length === 0) {
      return res.status(404).json({ mensaje: 'La bodega no existe' });
    }

    return res.json({
      bodega: bodegas[0],
      fecha,
      rollos,
      totales: {
        rollos: rollos.length,
        tarjetas_activas: rollos.reduce((suma, fila) => suma + Number(fila.tarjetas_activas || 0), 0),
        total_saldos: Math.round(
          rollos.reduce((suma, fila) => suma + Number(fila.total_saldos || 0), 0) * 100
        ) / 100
      }
    });
  } catch (error) {
    console.error('Error generando estadísticas de rollos:', error);

    return res.status(500).json({
      mensaje: 'Error al generar las estadísticas de rollos',
      error: error.message
    });
  }
};


/* ------------------------------------------------------------
   GET /api/reportes/ventas-carro?id_bodega=3&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
   Una fila por boleta: ventas, devoluciones y subtotal del carro
   (bodega) dentro del rango de fechas.
   ------------------------------------------------------------ */
const reporteVentasPorCarro = async (req, res) => {
  const idBodega = Number(req.query.id_bodega);
  const { desde, hasta } = req.query;

  if (!Number.isInteger(idBodega) || idBodega <= 0) {
    return res.status(400).json({ mensaje: 'Debe indicar una bodega válida' });
  }

  if (!esFechaValida(desde) || !esFechaValida(hasta)) {
    return res.status(400).json({ mensaje: 'Debe indicar fechas Desde y Hasta válidas' });
  }

  if (desde > hasta) {
    return res.status(400).json({ mensaje: 'La fecha Desde no puede ser mayor que la fecha Hasta' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_bodega', sql.Int, idBodega)
      .input('desde', sql.Date, desde)
      .input('hasta', sql.Date, hasta)
      .query(`
        -- 0. Datos de la bodega
        SELECT id_bodega, codigo, descripcion
        FROM bodegas
        WHERE id_bodega = @id_bodega;

        -- 1. Una fila por boleta (la boleta tiene una sola fecha y un solo rollo)
        WITH movimientos AS (
          SELECT
            numero_boleta,
            fecha,
            id_rollo,
            total AS ventas,
            CAST(0 AS DECIMAL(14, 2)) AS devoluciones
          FROM ventas
          WHERE id_bodega = @id_bodega
            AND estado = 'ACTIVA'
            AND fecha BETWEEN @desde AND @hasta

          UNION ALL

          SELECT
            numero_boleta,
            fecha,
            id_rollo,
            CAST(0 AS DECIMAL(14, 2)),
            total
          FROM devoluciones
          WHERE id_bodega = @id_bodega
            AND estado = 'A'
            AND fecha BETWEEN @desde AND @hasta
        )
        SELECT
          m.fecha,
          m.numero_boleta,
          r.numero      AS numero_rollo,
          r.descripcion AS rollo,
          SUM(m.ventas)       AS ventas,
          SUM(m.devoluciones) AS devoluciones,
          SUM(m.ventas) - SUM(m.devoluciones) AS subtotal
        FROM movimientos m
        LEFT JOIN rollos r ON r.id_rollo = m.id_rollo
        GROUP BY m.fecha, m.numero_boleta, r.id_rollo, r.numero, r.descripcion
        ORDER BY m.fecha, TRY_CAST(m.numero_boleta AS BIGINT), m.numero_boleta;
      `);

    const [bodegas, boletas] = resultado.recordsets;

    if (bodegas.length === 0) {
      return res.status(404).json({ mensaje: 'La bodega no existe' });
    }

    const redondear = (valor) => Math.round(Number(valor) * 100) / 100;
    const sumar = (campo) =>
      redondear(boletas.reduce((suma, fila) => suma + Number(fila[campo] || 0), 0));

    return res.json({
      bodega: bodegas[0],
      desde,
      hasta,
      boletas,
      totales: {
        boletas: boletas.length,
        ventas: sumar('ventas'),
        devoluciones: sumar('devoluciones'),
        subtotal: sumar('subtotal')
      }
    });
  } catch (error) {
    console.error('Error generando reporte de ventas por carro:', error);

    return res.status(500).json({
      mensaje: 'Error al generar el reporte de ventas por carro',
      error: error.message
    });
  }
};

module.exports = {
  reporteDesempenoEmpleados,
  reporteEstadisticasRollos,
  reporteVentasPorCarro
};