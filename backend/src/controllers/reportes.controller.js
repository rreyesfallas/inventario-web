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

module.exports = {
  reporteDesempenoEmpleados
};