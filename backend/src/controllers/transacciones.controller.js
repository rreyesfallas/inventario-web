const { sql, getConnection } = require('../config/db');

const { randomUUID } = require('crypto');

 const registrarAbono = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      id_cliente,
      id_rollo,
      id_empleado,
      fecha,
      monto,
      observacion
    } = req.body;

    if (!id_cliente || !id_rollo || !id_empleado || !fecha || !monto) {
      return res.status(400).json({
        mensaje: 'Cliente, rollo, empleado, fecha y monto son obligatorios'
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
            id_rollo,
            saldo_actual
        FROM clientes WITH (UPDLOCK, HOLDLOCK)
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


    const idRolloFinal = id_rollo
        ? Number(id_rollo)
        : (cliente.id_rollo ?? null);

    const idEmpleadoFinal = id_empleado
        ? Number(id_empleado)
        : null;

        if (Number(cliente.id_rollo) !== idRolloFinal) {
          await transaction.rollback();

          return res.status(400).json({
            mensaje: 'El cliente no pertenece al rollo seleccionado'
          });
        }

    // Validar el rollo seleccionado
    if (idRolloFinal !== null) {
        if (!Number.isInteger(idRolloFinal) || idRolloFinal <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                mensaje: 'El identificador del rollo no es válido'
            });
        }

        const resultadoRollo = await new sql.Request(transaction)
            .input('id_rollo', sql.Int, idRolloFinal)
            .query(`
                SELECT id_rollo
                FROM rollos
                WHERE id_rollo = @id_rollo
                  AND estado = 'A'
            `);

        if (resultadoRollo.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                mensaje: 'El rollo no existe o está inactivo'
            });
        }
    }

    // Validar el empleado seleccionado
    if (idEmpleadoFinal !== null) {
        if (!Number.isInteger(idEmpleadoFinal) || idEmpleadoFinal <= 0) {
            await transaction.rollback();
            return res.status(400).json({
                mensaje: 'El identificador del empleado no es válido'
            });
        }

        const resultadoEmpleado = await new sql.Request(transaction)
            .input('id_empleado', sql.Int, idEmpleadoFinal)
            .query(`
                SELECT id_empleado
                FROM empleados
                WHERE id_empleado = @id_empleado
                  AND estado = 'A'
            `);

        if (resultadoEmpleado.recordset.length === 0) {
            await transaction.rollback();
            return res.status(400).json({
                mensaje: 'El empleado no existe o está inactivo'
            });
        }
    }


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
        .input('id_rollo', sql.Int, idRolloFinal)
        .input('id_empleado', sql.Int, idEmpleadoFinal)
        .input('fecha', sql.Date, fecha)
        .input('tipo_movimiento', sql.VarChar, 'ABONO')
        .input('monto', sql.Decimal(14, 2), montoAbono)
        .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
        .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
        .input(
            'observacion',
            sql.VarChar,
            observacion ? observacion.trim().toUpperCase() : null
        )
        .query(`
            INSERT INTO movimientos_cliente (
                id_cliente,
                id_rollo,
                id_empleado,
                fecha,
                tipo_movimiento,
                monto,
                saldo_anterior,
                saldo_nuevo,
                observacion
            )
            VALUES (
                @id_cliente,
                @id_rollo,
                @id_empleado,
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


 
  const registrarDescuento = async (req, res) => {
    let transaction;

    try {
      const {
        id_cliente,
        id_rollo,
        id_empleado,
        fecha,
        monto,
        observacion
      } = req.body;

      const idCliente = Number(id_cliente);
      const idRollo = Number(id_rollo);
      const idEmpleado = Number(id_empleado);
      const montoDescuento = Number(monto);
      const descripcion = typeof observacion === 'string'
        ? observacion.trim().toUpperCase()
        : '';

      // Validar datos obligatorios
      if (
        !Number.isInteger(idCliente) || idCliente <= 0 ||
        !Number.isInteger(idRollo) || idRollo <= 0 ||
        !Number.isInteger(idEmpleado) || idEmpleado <= 0 ||
        !fecha || monto === undefined || monto === null ||
        String(monto).trim() === '' || !descripcion
      ) {
        return res.status(400).json({
          mensaje: 'Cliente, rollo, empleado, fecha, monto y descripción son obligatorios'
        });
      }

      // Validar fecha
      const fechaValidada = new Date(`${fecha}T00:00:00Z`);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        Number.isNaN(fechaValidada.getTime()) ||
        fechaValidada.toISOString().slice(0, 10) !== fecha
      ) {
        return res.status(400).json({
          mensaje: 'La fecha del descuento no es válida'
        });
      }

      // Validar monto
      if (
        !Number.isFinite(montoDescuento) ||
        montoDescuento <= 0 ||
        montoDescuento > 999999999999.99 ||
        Math.abs(montoDescuento * 100 -
          Math.round(montoDescuento * 100)) > 0.000001
      ) {
        return res.status(400).json({
          mensaje: 'El monto debe ser mayor a cero y tener como máximo dos decimales'
        });
      }

      const pool = await getConnection();
      transaction = new sql.Transaction(pool);

      await transaction.begin();

      // Buscar y bloquear al cliente
      const resultadoCliente = await new sql.Request(transaction)
        .input('id_cliente', sql.Int, idCliente)
        .query(`
          SELECT
            id_cliente,
            nombre,
            id_rollo,
            saldo_actual
          FROM clientes WITH (UPDLOCK, HOLDLOCK)
          WHERE id_cliente = @id_cliente
            AND estado = 'A'
        `);

      if (resultadoCliente.recordset.length === 0) {
        await transaction.rollback();

        return res.status(404).json({
          mensaje: 'El cliente no existe o está inactivo'
        });
      }

      const cliente = resultadoCliente.recordset[0];

      // Comprobar que el cliente pertenece al rollo
      if (Number(cliente.id_rollo) !== idRollo) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: 'El cliente no pertenece al rollo seleccionado'
        });
      }

      // Validar que el rollo esté activo
      const resultadoRollo = await new sql.Request(transaction)
        .input('id_rollo', sql.Int, idRollo)
        .query(`
          SELECT id_rollo
          FROM rollos
          WHERE id_rollo = @id_rollo
            AND estado = 'A'
        `);

      if (resultadoRollo.recordset.length === 0) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: 'El rollo no existe o está inactivo'
        });
      }

      // Validar que el empleado esté activo
      const resultadoEmpleado = await new sql.Request(transaction)
        .input('id_empleado', sql.Int, idEmpleado)
        .query(`
          SELECT id_empleado
          FROM empleados
          WHERE id_empleado = @id_empleado
            AND estado = 'A'
        `);

      if (resultadoEmpleado.recordset.length === 0) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: 'El empleado no existe o está inactivo'
        });
      }

      const saldoAnterior = Number(cliente.saldo_actual || 0);

      // No permitir descuentos mayores al saldo
      if (montoDescuento > saldoAnterior) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: 'El descuento no puede ser mayor al saldo actual del cliente'
        });
      }

      const saldoNuevo = Math.round(
        (saldoAnterior - montoDescuento) * 100
      ) / 100;

      // Registrar movimiento de descuento
      const resultadoMovimiento = await new sql.Request(transaction)
        .input('id_cliente', sql.Int, idCliente)
        .input('id_rollo', sql.Int, idRollo)
        .input('id_empleado', sql.Int, idEmpleado)
        .input('fecha', sql.Date, fecha)
        .input('tipo_movimiento', sql.VarChar, 'DESCUENTO')
        .input('monto', sql.Decimal(14, 2), montoDescuento)
        .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
        .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
        .input('observacion', sql.VarChar, descripcion)
        .query(`
          INSERT INTO movimientos_cliente (
            id_cliente,
            id_rollo,
            id_empleado,
            fecha,
            tipo_movimiento,
            monto,
            saldo_anterior,
            saldo_nuevo,
            observacion
          )
          OUTPUT INSERTED.id_movimiento_cliente
          VALUES (
            @id_cliente,
            @id_rollo,
            @id_empleado,
            @fecha,
            @tipo_movimiento,
            @monto,
            @saldo_anterior,
            @saldo_nuevo,
            @observacion
          )
        `);

      // Actualizar saldo del cliente
      await new sql.Request(transaction)
        .input('id_cliente', sql.Int, idCliente)
        .input('saldo_actual', sql.Decimal(14, 2), saldoNuevo)
        .query(`
          UPDATE clientes
          SET saldo_actual = @saldo_actual
          WHERE id_cliente = @id_cliente
        `);

      await transaction.commit();

      return res.status(201).json({
        mensaje: 'Descuento registrado correctamente',
        id_movimiento_cliente:
          resultadoMovimiento.recordset[0].id_movimiento_cliente,
        cliente: cliente.nombre,
        monto: montoDescuento,
        saldo_anterior: saldoAnterior,
        saldo_nuevo: saldoNuevo
      });

    } catch (error) {
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          console.error('Error haciendo rollback:', rollbackError);
        }
      }

      console.error('Error registrando descuento:', error);

      return res.status(500).json({
        mensaje: 'Error al registrar descuento',
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

 const registrarTransferencia = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      id_cliente_origen,
      id_cliente_destino,
      id_empleado,
      fecha,
      monto,
      observacion
    } = req.body;

    if (!id_cliente_origen || !id_cliente_destino || !id_empleado || !fecha || !monto) {
      return res.status(400).json({
        mensaje: 'Cliente origen, cliente destino, empleado, fecha y monto son obligatorios'
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

    const idTransferencia = randomUUID();

    await transaction.begin();

    const empleadoResult = await new sql.Request(transaction)
      .input('id_empleado', sql.Int, Number(id_empleado))
      .query(`
        SELECT id_empleado
        FROM empleados
        WHERE id_empleado = @id_empleado
          AND estado = 'A'
      `);

    if (empleadoResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'El empleado no existe o está inactivo'
      });
    }

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

    const observacionFinal =
      typeof observacion === 'string' && observacion.trim()
        ? observacion.trim().toUpperCase()
        : 'ENVÍO DE TRANSFERENCIA';

    const requestMovimientoOrigen = new sql.Request(transaction);
    

    await requestMovimientoOrigen
      .input('id_cliente', sql.Int, Number(id_cliente_origen))
      .input('id_empleado', sql.Int, Number(id_empleado))
      .input('id_transferencia', sql.UniqueIdentifier, idTransferencia)
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
            id_empleado,
            id_transferencia,
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
            @id_empleado,
            @id_transferencia,
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
      .input('id_empleado', sql.Int, Number(id_empleado))
      .input('id_transferencia', sql.UniqueIdentifier, idTransferencia)
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
            id_empleado,
            id_transferencia,
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
            @id_empleado,
            @id_transferencia,
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

 const eliminarTransferencia = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const idMovimiento = Number(req.params.id);

    if (!Number.isInteger(idMovimiento) || idMovimiento <= 0) {
      return res.status(400).json({
        mensaje: 'Movimiento inválido'
      });
    }

    await transaction.begin();

    const resultado = await new sql.Request(transaction)
      .input('id_movimiento', sql.Int, idMovimiento)
      .query(`
        SELECT id_transferencia
        FROM movimientos_cliente
        WHERE id_movimiento_cliente = @id_movimiento
          AND tipo_movimiento = 'TRANSFERENCIA_SALIDA'
          AND estado = 'A'
      `);

    if (resultado.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({
        mensaje: 'Transferencia no encontrada o ya eliminada'
      });
    }

    const idTransferencia = resultado.recordset[0].id_transferencia;

    if (!idTransferencia) {
      await transaction.rollback();
      return res.status(400).json({
        mensaje: 'Esta transferencia no tiene movimientos relacionados'
      });
    }

    const movimientos = await new sql.Request(transaction)
      .input('id_transferencia', sql.UniqueIdentifier, idTransferencia)
      .query(`
        SELECT
          id_movimiento_cliente,
          id_cliente,
          id_cliente_relacionado,
          tipo_movimiento,
          monto,
          estado
        FROM movimientos_cliente WITH (UPDLOCK, HOLDLOCK)
        WHERE id_transferencia = @id_transferencia
      `);

    const registros = movimientos.recordset;

    const salida = registros.find(
      item => item.tipo_movimiento === 'TRANSFERENCIA_SALIDA'
    );

    const entrada = registros.find(
      item => item.tipo_movimiento === 'TRANSFERENCIA_ENTRADA'
    );

    if (
      registros.length !== 2 ||
      !salida ||
      !entrada ||
      salida.estado !== 'A' ||
      entrada.estado !== 'A' ||
      Number(salida.monto) !== Number(entrada.monto) ||
      Number(salida.id_cliente) !== Number(entrada.id_cliente_relacionado) ||
      Number(entrada.id_cliente) !== Number(salida.id_cliente_relacionado)
    ) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'Los movimientos de la transferencia no son válidos'
      });
    }

    const monto = Number(salida.monto);

    // Bloquear los clientes en un orden fijo.
    const idsClientes = [
      Number(salida.id_cliente),
      Number(entrada.id_cliente)
    ].sort((a, b) => a - b);

    for (const idCliente of idsClientes) {
      await new sql.Request(transaction)
        .input('id_cliente', sql.Int, idCliente)
        .query(`
          SELECT id_cliente
          FROM clientes WITH (UPDLOCK, HOLDLOCK)
          WHERE id_cliente = @id_cliente
        `);
    }

    // Quitar el saldo recibido al cliente destino.
    const actualizarDestino = await new sql.Request(transaction)
      .input('id_cliente', sql.Int, Number(entrada.id_cliente))
      .input('monto', sql.Decimal(14, 2), monto)
      .query(`
        UPDATE clientes
        SET saldo_actual = saldo_actual - @monto
        OUTPUT INSERTED.saldo_actual
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
          AND saldo_actual >= @monto
      `);

    if (actualizarDestino.recordset.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'No se puede eliminar: el cliente que recibió la transferencia ya no tiene saldo suficiente'
      });
    }

    // Devolver el saldo al cliente origen.
    const actualizarOrigen = await new sql.Request(transaction)
      .input('id_cliente', sql.Int, Number(salida.id_cliente))
      .input('monto', sql.Decimal(14, 2), monto)
      .query(`
        UPDATE clientes
        SET saldo_actual = saldo_actual + @monto
        OUTPUT INSERTED.saldo_actual
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);

    if (actualizarOrigen.recordset.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'No se pudo actualizar el saldo del cliente origen'
      });
    }

    // Anular ambos movimientos, sin borrarlos físicamente.
    const anulacion = await new sql.Request(transaction)
      .input('id_transferencia', sql.UniqueIdentifier, idTransferencia)
      .query(`
        UPDATE movimientos_cliente
        SET estado = 'I'
        WHERE id_transferencia = @id_transferencia
          AND estado = 'A'
      `);

    if (anulacion.rowsAffected[0] !== 2) {
      throw new Error('No se pudieron anular ambos movimientos');
    }

    await transaction.commit();

    return res.json({
      mensaje: 'Transferencia eliminada correctamente',
      saldo_nuevo_origen: actualizarOrigen.recordset[0].saldo_actual,
      saldo_nuevo_destino: actualizarDestino.recordset[0].saldo_actual
    });

  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error eliminando transferencia:', error);

    return res.status(500).json({
      mensaje: 'Error al eliminar la transferencia'
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

          mc.id_rollo,
          r.numero AS numero_rollo,
          r.descripcion AS rollo,

          mc.id_empleado,
          e.codigo AS codigo_empleado,
          e.nombre AS empleado,

          mc.fecha,
          mc.tipo_movimiento,
          mc.monto,
          mc.saldo_anterior,
          mc.saldo_nuevo,

          mc.id_cliente_relacionado,
          cr.codigo AS codigo_cliente_relacionado,
          cr.nombre AS cliente_relacionado,

          mc.observacion,
          mc.estado,
          mc.fecha_creacion

        FROM movimientos_cliente mc

        INNER JOIN clientes c
          ON mc.id_cliente = c.id_cliente

        LEFT JOIN rollos r
          ON mc.id_rollo = r.id_rollo

        LEFT JOIN empleados e
          ON mc.id_empleado = e.id_empleado

        LEFT JOIN clientes cr
          ON mc.id_cliente_relacionado = cr.id_cliente

        WHERE mc.id_cliente = @id_cliente
          AND mc.estado = 'A'

        ORDER BY
          mc.fecha DESC,
          mc.id_movimiento_cliente DESC
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

const cambiarFechaAbono = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fecha } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'Identificador del abono no válido'
      });
    }

    if (!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return res.status(400).json({
        mensaje: 'Debe indicar una fecha válida'
      });
    }

    const fechaValidada = new Date(`${fecha}T00:00:00Z`);

    if (
      Number.isNaN(fechaValidada.getTime()) ||
      fechaValidada.toISOString().slice(0, 10) !== fecha
    ) {
      return res.status(400).json({
        mensaje: 'La fecha indicada no existe'
      });
    }

    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id', sql.Int, id)
      .input('fecha', sql.Date, fecha)
      .query(`
        UPDATE movimientos_cliente
        SET fecha = @fecha
        WHERE id_movimiento_cliente = @id
          AND tipo_movimiento = 'ABONO'
          AND estado = 'A'
      `);

    if (resultado.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'No se encontró un abono activo con ese identificador'
      });
    }

    res.json({
      mensaje: 'Fecha del abono modificada correctamente'
    });

  } catch (error) {
    console.error('Error cambiando fecha del abono:', error);

    res.status(500).json({
      mensaje: 'Error al cambiar la fecha del abono',
      error: error.message
    });
  }
};

const cambiarEmpleadoAbono = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const idEmpleado = Number(req.body.id_empleado);

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        mensaje: 'Identificador del abono no válido'
      });
    }

    if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) {
      return res.status(400).json({
        mensaje: 'Debe seleccionar un empleado válido'
      });
    }

    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id', sql.Int, id)
      .input('id_empleado', sql.Int, idEmpleado)
      .query(`
        UPDATE mc
        SET mc.id_empleado = @id_empleado
        FROM movimientos_cliente mc
        WHERE mc.id_movimiento_cliente = @id
          AND mc.tipo_movimiento = 'ABONO'
          AND mc.estado = 'A'
          AND EXISTS (
            SELECT 1
            FROM empleados e
            WHERE e.id_empleado = @id_empleado
              AND e.estado = 'A'
          )
      `);

    if (resultado.rowsAffected[0] === 0) {
      return res.status(400).json({
        mensaje: 'No se pudo modificar el abono. Verifique que el abono y el empleado estén activos.'
      });
    }

    res.json({
      mensaje: 'Empleado del abono modificado correctamente'
    });

  } catch (error) {
    console.error('Error cambiando empleado del abono:', error);

    res.status(500).json({
      mensaje: 'Error al cambiar el empleado del abono',
      error: error.message
    });
  }
};

const eliminarAbono = async (req, res) => {
  const idMovimiento = Number(req.params.id);

  if (!Number.isInteger(idMovimiento) || idMovimiento <= 0) {
    return res.status(400).json({
      mensaje: 'El identificador del abono no es válido'
    });
  }

  let transaction;

  try {
    const pool = await getConnection();
    transaction = new sql.Transaction(pool);

    await transaction.begin();

    // Buscar y bloquear el abono que se desea eliminar.
    const resultadoAbono = await new sql.Request(transaction)
      .input('id_movimiento', sql.Int, idMovimiento)
      .query(`
        SELECT
          id_movimiento_cliente,
          id_cliente,
          monto
        FROM movimientos_cliente WITH (UPDLOCK, HOLDLOCK)
        WHERE id_movimiento_cliente = @id_movimiento
          AND tipo_movimiento = 'ABONO'
          AND estado = 'A'
      `);

    if (resultadoAbono.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'El abono no existe o ya fue eliminado'
      });
    }

    const abono = resultadoAbono.recordset[0];
    const montoAbono = Number(abono.monto);

    // Devolver el monto al saldo actual del cliente.
    const resultadoCliente = await new sql.Request(transaction)
      .input('id_cliente', sql.Int, abono.id_cliente)
      .input('monto', sql.Decimal(14, 2), montoAbono)
      .query(`
        UPDATE clientes
        SET saldo_actual = saldo_actual + @monto
        OUTPUT INSERTED.saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    if (resultadoCliente.rowsAffected[0] === 0) {
      throw new Error('No se encontró el cliente del abono');
    }

    // Desactivar el abono, conservando su registro.
    await new sql.Request(transaction)
      .input('id_movimiento', sql.Int, idMovimiento)
      .query(`
        UPDATE movimientos_cliente
        SET estado = 'I'
        WHERE id_movimiento_cliente = @id_movimiento
          AND tipo_movimiento = 'ABONO'
          AND estado = 'A'
      `);

    await transaction.commit();

    res.json({
      mensaje: 'Abono eliminado correctamente',
      monto_reintegrado: montoAbono,
      saldo_nuevo: Number(
        resultadoCliente.recordset[0].saldo_actual
      )
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error haciendo rollback:', rollbackError);
      }
    }

    console.error('Error eliminando abono:', error);

    res.status(500).json({
      mensaje: 'Error al eliminar abono',
      error: error.message
    });
  }
};


const eliminarDescuento = async (req, res) => {
  const idMovimiento = Number(req.params.id);

  if (!Number.isInteger(idMovimiento) || idMovimiento <= 0) {
    return res.status(400).json({
      mensaje: 'El identificador del descuento no es válido'
    });
  }

  let transaction;

  try {
    const pool = await getConnection();
    transaction = new sql.Transaction(pool);

    await transaction.begin();

    // Buscar y bloquear el descuento activo.
    const resultadoDescuento = await new sql.Request(transaction)
      .input('id_movimiento', sql.Int, idMovimiento)
      .query(`
        SELECT
          id_movimiento_cliente,
          id_cliente,
          monto
        FROM movimientos_cliente WITH (UPDLOCK, HOLDLOCK)
        WHERE id_movimiento_cliente = @id_movimiento
          AND tipo_movimiento = 'DESCUENTO'
          AND estado = 'A'
      `);

    if (resultadoDescuento.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'El descuento no existe o ya fue eliminado'
      });
    }

    const descuento = resultadoDescuento.recordset[0];
    const montoDescuento = Number(descuento.monto);

    // Devolver el monto descontado al saldo del cliente.
    const resultadoCliente = await new sql.Request(transaction)
      .input('id_cliente', sql.Int, descuento.id_cliente)
      .input('monto', sql.Decimal(14, 2), montoDescuento)
      .query(`
        UPDATE clientes
        SET saldo_actual = saldo_actual + @monto
        OUTPUT INSERTED.saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    if (resultadoCliente.rowsAffected[0] !== 1) {
      throw new Error('No se encontró el cliente del descuento');
    }

    // Desactivar el descuento sin eliminar el registro.
    const resultadoMovimiento = await new sql.Request(transaction)
      .input('id_movimiento', sql.Int, idMovimiento)
      .query(`
        UPDATE movimientos_cliente
        SET estado = 'I'
        WHERE id_movimiento_cliente = @id_movimiento
          AND tipo_movimiento = 'DESCUENTO'
          AND estado = 'A'
      `);

    if (resultadoMovimiento.rowsAffected[0] !== 1) {
      throw new Error('No se pudo desactivar el descuento');
    }

    await transaction.commit();

    return res.json({
      mensaje: 'Descuento eliminado correctamente',
      id_movimiento_cliente: idMovimiento,
      monto_reintegrado: montoDescuento,
      saldo_nuevo: Number(
        resultadoCliente.recordset[0].saldo_actual
      )
    });

  } catch (error) {
    if (transaction) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error haciendo rollback:', rollbackError);
      }
    }

    console.error('Error eliminando descuento:', error);

    return res.status(500).json({
      mensaje: 'Error al eliminar descuento',
      error: error.message
    });
  }
};


module.exports = {
  registrarAbono,
  registrarDescuento,
  registrarVenta,
  registrarTransferencia,
  listarMovimientosCliente,
  listarHistorialCliente,
  cambiarFechaAbono,
  cambiarEmpleadoAbono,
  eliminarAbono,
  eliminarDescuento,
  eliminarTransferencia
};