const { sql, getConnection } = require('../config/db');

 const registrarAbono = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      id_cliente,
      fecha,
      monto,
      observacion
    } = req.body;

    if (!id_cliente || !fecha || !monto) {
      return res.status(400).json({
        mensaje: 'Cliente, fecha y monto son obligatorios'
      });
    }

    const montoAbono = Number(monto);

    if (montoAbono <= 0) {
      return res.status(400).json({
        mensaje: 'El monto del abono debe ser mayor a cero'
      });
    }

    await transaction.begin();

    const requestCliente = new sql.Request(transaction);

    const clienteResult = await requestCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .query(`
        SELECT 
          id_cliente,
          nombre,
          saldo_actual
        FROM clientes
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);

    if (clienteResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'Cliente no encontrado'
      });
    }

    const cliente = clienteResult.recordset[0];
    const saldoAnterior = Number(cliente.saldo_actual || 0);

    if (montoAbono > saldoAnterior) {
    await transaction.rollback();

    return res.status(400).json({
        mensaje: 'El abono no puede ser mayor al saldo actual del cliente'
    });
    }

    const saldoNuevo = saldoAnterior - montoAbono;

    const requestMovimiento = new sql.Request(transaction);

    await requestMovimiento
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'ABONO')
      .input('monto', sql.Decimal(14, 2), montoAbono)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input('observacion', sql.VarChar, observacion ? observacion.trim().toUpperCase() : null)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente,
          fecha,
          tipo_movimiento,
          monto,
          saldo_anterior,
          saldo_nuevo,
          observacion
        )
        VALUES (
          @id_cliente,
          @fecha,
          @tipo_movimiento,
          @monto,
          @saldo_anterior,
          @saldo_nuevo,
          @observacion
        )
      `);

    const requestActualizarCliente = new sql.Request(transaction);

    await requestActualizarCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('saldo_actual', sql.Decimal(14, 2), saldoNuevo)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Abono registrado correctamente',
      cliente: cliente.nombre,
      saldo_anterior: saldoAnterior,
      monto: montoAbono,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error registrando abono:', error);

    res.status(500).json({
      mensaje: 'Error al registrar abono',
      error: error.message
    });
  }
 };

 const registrarVenta = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      id_cliente,
      fecha,
      monto,
      observacion
    } = req.body;

    if (!id_cliente || !fecha || !monto) {
      return res.status(400).json({
        mensaje: 'Cliente, fecha y monto son obligatorios'
      });
    }

    const montoVenta = Number(monto);

    if (montoVenta <= 0) {
      return res.status(400).json({
        mensaje: 'El monto de la venta debe ser mayor a cero'
      });
    }

    await transaction.begin();

    const requestCliente = new sql.Request(transaction);

    const clienteResult = await requestCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .query(`
        SELECT 
          id_cliente,
          nombre,
          saldo_actual
        FROM clientes
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);

    if (clienteResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'Cliente no encontrado'
      });
    }

    const cliente = clienteResult.recordset[0];
    const saldoAnterior = Number(cliente.saldo_actual || 0);
    const saldoNuevo = saldoAnterior + montoVenta;

    const requestMovimiento = new sql.Request(transaction);

    await requestMovimiento
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'VENTA')
      .input('monto', sql.Decimal(14, 2), montoVenta)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input('observacion', sql.VarChar, observacion ? observacion.trim().toUpperCase() : null)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente,
          fecha,
          tipo_movimiento,
          monto,
          saldo_anterior,
          saldo_nuevo,
          observacion
        )
        VALUES (
          @id_cliente,
          @fecha,
          @tipo_movimiento,
          @monto,
          @saldo_anterior,
          @saldo_nuevo,
          @observacion
        )
      `);

    const requestActualizarCliente = new sql.Request(transaction);

    await requestActualizarCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('saldo_actual', sql.Decimal(14, 2), saldoNuevo)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Venta registrada correctamente',
      cliente: cliente.nombre,
      saldo_anterior: saldoAnterior,
      monto: montoVenta,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error registrando venta:', error);

    res.status(500).json({
      mensaje: 'Error al registrar venta',
      error: error.message
    });
  }
 };

 const registrarDevolucion = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      id_cliente,
      fecha,
      monto,
      observacion
    } = req.body;

    if (!id_cliente || !fecha || !monto) {
      return res.status(400).json({
        mensaje: 'Cliente, fecha y monto son obligatorios'
      });
    }

    const montoDevolucion = Number(monto);

    if (montoDevolucion <= 0) {
      return res.status(400).json({
        mensaje: 'El monto de la devolución debe ser mayor a cero'
      });
    }

    await transaction.begin();

    const requestCliente = new sql.Request(transaction);

    const clienteResult = await requestCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .query(`
        SELECT 
          id_cliente,
          nombre,
          saldo_actual
        FROM clientes
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);

    if (clienteResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'Cliente no encontrado'
      });
    }

    const cliente = clienteResult.recordset[0];
    const saldoAnterior = Number(cliente.saldo_actual || 0);

    if (montoDevolucion > saldoAnterior) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'La devolución no puede ser mayor al saldo actual del cliente'
      });
    }

    const saldoNuevo = saldoAnterior - montoDevolucion;

    const requestMovimiento = new sql.Request(transaction);

    await requestMovimiento
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'DEVOLUCION')
      .input('monto', sql.Decimal(14, 2), montoDevolucion)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input('observacion', sql.VarChar, observacion ? observacion.trim().toUpperCase() : null)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente,
          fecha,
          tipo_movimiento,
          monto,
          saldo_anterior,
          saldo_nuevo,
          observacion
        )
        VALUES (
          @id_cliente,
          @fecha,
          @tipo_movimiento,
          @monto,
          @saldo_anterior,
          @saldo_nuevo,
          @observacion
        )
      `);

    const requestActualizarCliente = new sql.Request(transaction);

    await requestActualizarCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('saldo_actual', sql.Decimal(14, 2), saldoNuevo)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Devolución registrada correctamente',
      cliente: cliente.nombre,
      saldo_anterior: saldoAnterior,
      monto: montoDevolucion,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error registrando devolución:', error);

    res.status(500).json({
      mensaje: 'Error al registrar devolución',
      error: error.message
    });
  }
 };

 const registrarTransferencia = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      id_cliente_origen,
      id_cliente_destino,
      fecha,
      monto,
      observacion
    } = req.body;

    if (!id_cliente_origen || !id_cliente_destino || !fecha || !monto) {
      return res.status(400).json({
        mensaje: 'Cliente origen, cliente destino, fecha y monto son obligatorios'
      });
    }

    if (Number(id_cliente_origen) === Number(id_cliente_destino)) {
      return res.status(400).json({
        mensaje: 'El cliente origen y destino no pueden ser el mismo'
      });
    }

    const montoTransferencia = Number(monto);

    if (montoTransferencia <= 0) {
      return res.status(400).json({
        mensaje: 'El monto de la transferencia debe ser mayor a cero'
      });
    }

    await transaction.begin();

    const requestOrigen = new sql.Request(transaction);

    const clienteOrigenResult = await requestOrigen
      .input('id_cliente', sql.Int, Number(id_cliente_origen))
      .query(`
        SELECT 
          id_cliente,
          nombre,
          saldo_actual
        FROM clientes
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);

    if (clienteOrigenResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'Cliente origen no encontrado'
      });
    }

    const requestDestino = new sql.Request(transaction);

    const clienteDestinoResult = await requestDestino
      .input('id_cliente', sql.Int, Number(id_cliente_destino))
      .query(`
        SELECT 
          id_cliente,
          nombre,
          saldo_actual
        FROM clientes
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);

    if (clienteDestinoResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'Cliente destino no encontrado'
      });
    }

    const clienteOrigen = clienteOrigenResult.recordset[0];
    const clienteDestino = clienteDestinoResult.recordset[0];

    const saldoAnteriorOrigen = Number(clienteOrigen.saldo_actual || 0);
    const saldoAnteriorDestino = Number(clienteDestino.saldo_actual || 0);

    if (montoTransferencia > saldoAnteriorOrigen) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'La transferencia no puede ser mayor al saldo actual del cliente origen'
      });
    }

    const saldoNuevoOrigen = saldoAnteriorOrigen - montoTransferencia;
    const saldoNuevoDestino = saldoAnteriorDestino + montoTransferencia;

    const observacionFinal = observacion
      ? observacion.trim().toUpperCase()
      : 'TRANSFERENCIA DE SALDO ENTRE CLIENTES';

    const requestMovimientoOrigen = new sql.Request(transaction);

    await requestMovimientoOrigen
      .input('id_cliente', sql.Int, Number(id_cliente_origen))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'TRANSFERENCIA_SALIDA')
      .input('monto', sql.Decimal(14, 2), montoTransferencia)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnteriorOrigen)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevoOrigen)
      .input('id_cliente_relacionado', sql.Int, Number(id_cliente_destino))
      .input('observacion', sql.VarChar, observacionFinal)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente,
          fecha,
          tipo_movimiento,
          monto,
          saldo_anterior,
          saldo_nuevo,
          id_cliente_relacionado,
          observacion
        )
        VALUES (
          @id_cliente,
          @fecha,
          @tipo_movimiento,
          @monto,
          @saldo_anterior,
          @saldo_nuevo,
          @id_cliente_relacionado,
          @observacion
        )
      `);

    const requestMovimientoDestino = new sql.Request(transaction);

    await requestMovimientoDestino
      .input('id_cliente', sql.Int, Number(id_cliente_destino))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'TRANSFERENCIA_ENTRADA')
      .input('monto', sql.Decimal(14, 2), montoTransferencia)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnteriorDestino)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevoDestino)
      .input('id_cliente_relacionado', sql.Int, Number(id_cliente_origen))
      .input('observacion', sql.VarChar, observacionFinal)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente,
          fecha,
          tipo_movimiento,
          monto,
          saldo_anterior,
          saldo_nuevo,
          id_cliente_relacionado,
          observacion
        )
        VALUES (
          @id_cliente,
          @fecha,
          @tipo_movimiento,
          @monto,
          @saldo_anterior,
          @saldo_nuevo,
          @id_cliente_relacionado,
          @observacion
        )
      `);

    const requestActualizarOrigen = new sql.Request(transaction);

    await requestActualizarOrigen
      .input('id_cliente', sql.Int, Number(id_cliente_origen))
      .input('saldo_actual', sql.Decimal(14, 2), saldoNuevoOrigen)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    const requestActualizarDestino = new sql.Request(transaction);

    await requestActualizarDestino
      .input('id_cliente', sql.Int, Number(id_cliente_destino))
      .input('saldo_actual', sql.Decimal(14, 2), saldoNuevoDestino)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Transferencia registrada correctamente',
      cliente_origen: clienteOrigen.nombre,
      cliente_destino: clienteDestino.nombre,
      monto: montoTransferencia,
      saldo_nuevo_origen: saldoNuevoOrigen,
      saldo_nuevo_destino: saldoNuevoDestino
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error registrando transferencia:', error);

    res.status(500).json({
      mensaje: 'Error al registrar transferencia',
      error: error.message
    });
  }
 };

const listarMovimientosCliente = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        mc.id_movimiento_cliente,
        mc.id_cliente,
        c.codigo AS codigo_cliente,
        c.nombre AS cliente,
        mc.fecha,
        mc.tipo_movimiento,
        mc.monto,
        mc.saldo_anterior,
        mc.saldo_nuevo,
        mc.observacion,
        mc.estado,
        mc.fecha_creacion
      FROM movimientos_cliente mc
      INNER JOIN clientes c
        ON mc.id_cliente = c.id_cliente
      WHERE mc.estado = 'A'
      ORDER BY mc.fecha_creacion DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando movimientos de cliente:', error);

    res.status(500).json({
      mensaje: 'Error al listar movimientos de cliente',
      error: error.message
    });
  }
};

const listarHistorialCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_cliente', sql.Int, Number(id))
      .query(`
        SELECT
          mc.id_movimiento_cliente,
          mc.id_cliente,
          c.codigo AS codigo_cliente,
          c.nombre AS cliente,
          mc.fecha,
          mc.tipo_movimiento,
          mc.monto,
          mc.saldo_anterior,
          mc.saldo_nuevo,
          mc.id_cliente_relacionado,
          cr.codigo AS codigo_cliente_relacionado,
          cr.nombre AS cliente_relacionado,
          mc.observacion,
          mc.fecha_creacion
        FROM movimientos_cliente mc
        INNER JOIN clientes c
          ON mc.id_cliente = c.id_cliente
        LEFT JOIN clientes cr
          ON mc.id_cliente_relacionado = cr.id_cliente
        WHERE mc.id_cliente = @id_cliente
          AND mc.estado = 'A'
        ORDER BY mc.fecha_creacion DESC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando historial del cliente:', error);

    res.status(500).json({
      mensaje: 'Error al listar historial del cliente',
      error: error.message
    });
  }
};

module.exports = {
  registrarAbono,
  registrarVenta,
  registrarDevolucion,
  registrarTransferencia,
  listarMovimientosCliente,
  listarHistorialCliente
};