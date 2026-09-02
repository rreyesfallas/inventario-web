const { sql, getConnection } = require('../config/db');

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

module.exports = {
  obtenerInformeCobros
};