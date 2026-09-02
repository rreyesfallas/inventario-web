const { sql, getConnection } = require('../config/db');

const registrarCobroEfectivo = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      fecha,
      id_rollo,
      detalle
    } = req.body;

    if (!fecha || !id_rollo) {
      return res.status(400).json({
        mensaje: 'Fecha y rollo son obligatorios'
      });
    }

    if (!Array.isArray(detalle) || detalle.length === 0) {
      return res.status(400).json({
        mensaje: 'Debe agregar al menos un cobrador'
      });
    }

    let totalEfectivo = 0;
    let totalSinpe = 0;
    let totalGeneral = 0;

    for (const item of detalle) {
      const efectivo = Number(item.efectivo || 0);
      const sinpe = Number(item.sinpe || 0);

      if (!item.id_empleado) {
        return res.status(400).json({
          mensaje: 'Cada detalle debe tener un empleado'
        });
      }

      if (efectivo < 0 || sinpe < 0) {
        return res.status(400).json({
          mensaje: 'Los montos de efectivo y SINPE no pueden ser negativos'
        });
      }

      if (efectivo === 0 && sinpe === 0) {
        return res.status(400).json({
          mensaje: 'Cada cobrador debe tener al menos un monto en efectivo o SINPE'
        });
      }

      totalEfectivo += efectivo;
      totalSinpe += sinpe;
      totalGeneral += efectivo + sinpe;
    }

  await transaction.begin();

  const requestSaldoRollo = new sql.Request(transaction);

  const saldoRolloResult = await requestSaldoRollo
    .input('id_rollo', sql.Int, Number(id_rollo))
    .query(`
      SELECT
        ISNULL(SUM(saldo_actual), 0) AS saldo_total_rollo
      FROM clientes
      WHERE id_rollo = @id_rollo
        AND estado = 'A'
    `);

  const saldoTotalRollo = Number(
    saldoRolloResult.recordset[0].saldo_total_rollo || 0
  );

  if (totalGeneral > saldoTotalRollo) {
    await transaction.rollback();

    return res.status(400).json({
      mensaje: 'El total cobrado no puede ser mayor al saldo actual del rollo'
    });
  }

  const requestCobrosExistentes = new sql.Request(transaction);

  const cobrosExistentesResult = await requestCobrosExistentes
    .input('fecha', sql.Date, fecha)
    .input('id_rollo', sql.Int, Number(id_rollo))
    .query(`
      SELECT
        ISNULL(SUM(total_general), 0) AS total_cobrado_existente
      FROM cobros_efectivo
      WHERE fecha <= @fecha
        AND id_rollo = @id_rollo
        AND estado = 'A'
    `);

  const totalCobradoExistente = Number(
    cobrosExistentesResult.recordset[0].total_cobrado_existente || 0
  );

  const totalCobradoFinal = totalCobradoExistente + totalGeneral;

  if (totalCobradoFinal > saldoTotalRollo) {
    await transaction.rollback();

    return res.status(400).json({
      mensaje: 'El total cobrado no puede ser mayor al saldo actual del rollo'
    });
  }

  const requestEncabezado = new sql.Request(transaction);

    const encabezado = await requestEncabezado
      .input('fecha', sql.Date, fecha)
      .input('id_rollo', sql.Int, Number(id_rollo))
      .input('total_efectivo', sql.Decimal(14, 2), totalEfectivo)
      .input('total_sinpe', sql.Decimal(14, 2), totalSinpe)
      .input('total_general', sql.Decimal(14, 2), totalGeneral)
      .query(`
        INSERT INTO cobros_efectivo (
          fecha,
          id_rollo,
          total_efectivo,
          total_sinpe,
          total_general
        )
        OUTPUT INSERTED.id_cobro
        VALUES (
          @fecha,
          @id_rollo,
          @total_efectivo,
          @total_sinpe,
          @total_general
        )
      `);

    const idCobro = encabezado.recordset[0].id_cobro;

    for (const item of detalle) {
      const efectivo = Number(item.efectivo || 0);
      const sinpe = Number(item.sinpe || 0);
      const total = efectivo + sinpe;

      const requestDetalle = new sql.Request(transaction);

      await requestDetalle
        .input('id_cobro', sql.Int, idCobro)
        .input('id_empleado', sql.Int, Number(item.id_empleado))
        .input('efectivo', sql.Decimal(14, 2), efectivo)
        .input('sinpe', sql.Decimal(14, 2), sinpe)
        .input('total', sql.Decimal(14, 2), total)
        .query(`
          INSERT INTO cobros_efectivo_detalle (
            id_cobro,
            id_empleado,
            efectivo,
            sinpe,
            total
          )
          VALUES (
            @id_cobro,
            @id_empleado,
            @efectivo,
            @sinpe,
            @total
          )
        `);
    }

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Cobro de efectivo registrado correctamente',
      id_cobro: idCobro,
      total_efectivo: totalEfectivo,
      total_sinpe: totalSinpe,
      total_general: totalGeneral
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error registrando cobro de efectivo:', error);

    res.status(500).json({
      mensaje: 'Error al registrar cobro de efectivo',
      error: error.message
    });
  }
};

const listarCobrosEfectivo = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        ce.id_cobro,
        ce.fecha,
        ce.id_rollo,
        r.numero AS numero_rollo,
        r.descripcion AS rollo,
        ce.total_efectivo,
        ce.total_sinpe,
        ce.total_general,
        ce.estado,
        ce.fecha_creacion
      FROM cobros_efectivo ce
      INNER JOIN rollos r
        ON ce.id_rollo = r.id_rollo
      WHERE ce.estado = 'A'
      ORDER BY ce.fecha_creacion DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando cobros de efectivo:', error);

    res.status(500).json({
      mensaje: 'Error al listar cobros de efectivo',
      error: error.message
    });
  }
};

const obtenerDetalleCobroEfectivo = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_cobro', sql.Int, Number(id))
      .query(`
        SELECT
          ced.id_detalle,
          ced.id_cobro,
          ced.id_empleado,
          e.codigo AS codigo_empleado,
          e.nombre AS empleado,
          ced.efectivo,
          ced.sinpe,
          ced.total
        FROM cobros_efectivo_detalle ced
        INNER JOIN empleados e
          ON ced.id_empleado = e.id_empleado
        WHERE ced.id_cobro = @id_cobro
        ORDER BY e.nombre
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error obteniendo detalle del cobro:', error);

    res.status(500).json({
      mensaje: 'Error al obtener detalle del cobro',
      error: error.message
    });
  }
};

module.exports = {
  registrarCobroEfectivo,
  listarCobrosEfectivo,
  obtenerDetalleCobroEfectivo
};