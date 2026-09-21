const { getConnection } = require('../config/db');

const obtenerResumenDashboard = async (req, res) => {
  try {
    const pool = await getConnection();

    const consulta = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) 
         FROM clientes 
         WHERE estado = 'A') AS clientes_activos,

        (SELECT COUNT(*) 
         FROM articulos 
         WHERE estado = 'A') AS articulos_activos,

        (SELECT ISNULL(SUM(saldo_actual), 0)
         FROM clientes
         WHERE estado = 'A') AS saldo_pendiente,

        (SELECT ISNULL(SUM(total_efectivo + total_sinpe), 0)
         FROM cobros_efectivo
         WHERE estado = 'A'
           AND CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)) AS cobros_hoy,

        (SELECT COUNT(*)
         FROM movimientos_inventario
         WHERE estado = 'A'
           AND CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)) AS movimientos_inventario_hoy,

        (SELECT COUNT(*)
         FROM movimientos_cliente
         WHERE estado = 'A'
           AND CAST(fecha AS DATE) = CAST(GETDATE() AS DATE)) AS transacciones_hoy
    `);

    const resumen = consulta.recordset[0];

    res.json({
      clientesActivos: resumen.clientes_activos,
      articulosActivos: resumen.articulos_activos,
      saldoPendiente: resumen.saldo_pendiente,
      cobrosHoy: resumen.cobros_hoy,
      movimientosInventarioHoy: resumen.movimientos_inventario_hoy,
      transaccionesHoy: resumen.transacciones_hoy
    });
  } catch (error) {
    console.error('Error obteniendo resumen del dashboard:', error);

    res.status(500).json({
      mensaje: 'Error al obtener el resumen del dashboard'
    });
  }
};

module.exports = {
  obtenerResumenDashboard
};