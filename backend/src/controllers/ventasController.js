const { sql, getConnection } = require('../config/db');

const buscarBoleta = async (req, res) => {
  try {
    const { numero_boleta } = req.params;
    const pool = await getConnection();

    const result = await pool.request()
      .input('numero_boleta', sql.VarChar, numero_boleta)
      .query(`
        SELECT id_venta, numero_boleta, fecha, estado
        FROM ventas
        WHERE numero_boleta = @numero_boleta
          AND estado = 'ACTIVA'
      `);

    res.json({
      existe: result.recordset.length > 0,
      venta: result.recordset[0] || null
    });
  } catch (error) {
    console.error('Error buscando boleta:', error);
    res.status(500).json({
      mensaje: 'Error al buscar boleta',
      error: error.message
    });
  }
};

const registrarVenta = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      numero_boleta,
      fecha,
      id_cliente,
      id_bodega,
      id_empleado,
      observacion,
      detalle
    } = req.body;

    if (!numero_boleta || !fecha || !id_cliente || !id_bodega || !id_empleado) {
      return res.status(400).json({
        mensaje: 'Boleta, fecha, cliente, bodega y empleado son obligatorios'
      });
    }

    if (!Array.isArray(detalle) || detalle.length === 0) {
      return res.status(400).json({
        mensaje: 'Debe agregar al menos un artículo a la venta'
      });
    }

    await transaction.begin();

    const requestBoleta = new sql.Request(transaction);

    const boletaResult = await requestBoleta
      .input('numero_boleta', sql.VarChar, numero_boleta)
      .query(`
        SELECT id_venta
        FROM ventas
        WHERE numero_boleta = @numero_boleta
          AND estado = 'ACTIVA'
      `);

    if (boletaResult.recordset.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'Ya existe una venta activa con ese número de boleta'
      });
    }

    let totalVenta = 0;

    for (const item of detalle) {
      const cantidad = Number(item.cantidad || 0);
      const precio = Number(item.precio_unitario || item.precio || 0);

      if (!item.id_articulo || cantidad <= 0 || precio <= 0) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: 'Todos los artículos deben tener cantidad y precio mayor a cero'
        });
      }

      const requestExistencia = new sql.Request(transaction);

      const existenciaResult = await requestExistencia
        .input('id_bodega', sql.Int, Number(id_bodega))
        .input('id_articulo', sql.Int, Number(item.id_articulo))
        .query(`
          SELECT existencia
          FROM existencias_bodega
          WHERE id_bodega = @id_bodega
            AND id_articulo = @id_articulo
        `);

      const existenciaActual =
        existenciaResult.recordset.length > 0
          ? Number(existenciaResult.recordset[0].existencia || 0)
          : 0;

      if (cantidad > existenciaActual) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: `No hay existencia suficiente para el artículo ${item.codigo || item.id_articulo}`
        });
      }

      totalVenta += cantidad * precio;
    }

    const requestVenta = new sql.Request(transaction);

    const ventaResult = await requestVenta
      .input('numero_boleta', sql.VarChar, numero_boleta)
      .input('fecha', sql.Date, fecha)
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('id_bodega', sql.Int, Number(id_bodega))
      .input('id_empleado', sql.Int, Number(id_empleado))
      .input('total', sql.Decimal(14, 2), totalVenta)
      .input('observacion', sql.VarChar, observacion ? observacion.trim().toUpperCase() : null)
      .query(`
        INSERT INTO ventas (
          numero_boleta,
          fecha,
          id_cliente,
          id_bodega,
          id_empleado,
          total,
          estado,
          observacion
        )
        OUTPUT INSERTED.id_venta
        VALUES (
          @numero_boleta,
          @fecha,
          @id_cliente,
          @id_bodega,
          @id_empleado,
          @total,
          'ACTIVA',
          @observacion
        )
      `);

    const idVenta = ventaResult.recordset[0].id_venta;

    const requestMovimientoInventario = new sql.Request(transaction);

    const movimientoResult = await requestMovimientoInventario
      .input('numero_boleta', sql.VarChar, numero_boleta)
      .input('id_bodega', sql.Int, Number(id_bodega))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'S')
      .input('total', sql.Decimal(14, 2), totalVenta)
      .query(`
        INSERT INTO movimientos_inventario (
          numero_boleta,
          id_bodega,
          fecha,
          tipo_movimiento,
          total,
          estado
        )
        OUTPUT INSERTED.id_movimiento
        VALUES (
          @numero_boleta,
          @id_bodega,
          @fecha,
          @tipo_movimiento,
          @total,
          'A'
        )
      `);

    const idMovimiento = movimientoResult.recordset[0].id_movimiento;

    for (const item of detalle) {
      const cantidad = Number(item.cantidad);
      const precio = Number(item.precio_unitario || item.precio);
      const subtotal = cantidad * precio;

      const requestDetalleVenta = new sql.Request(transaction);

      await requestDetalleVenta
        .input('id_venta', sql.Int, idVenta)
        .input('id_articulo', sql.Int, Number(item.id_articulo))
        .input('cantidad', sql.Decimal(14, 2), cantidad)
        .input('precio_unitario', sql.Decimal(14, 2), precio)
        .input('subtotal', sql.Decimal(14, 2), subtotal)
        .query(`
          INSERT INTO ventas_detalle (
            id_venta,
            id_articulo,
            cantidad,
            precio_unitario,
            subtotal,
            estado
          )
          VALUES (
            @id_venta,
            @id_articulo,
            @cantidad,
            @precio_unitario,
            @subtotal,
            'ACTIVO'
          )
        `);

      const requestDetalleInventario = new sql.Request(transaction);

      await requestDetalleInventario
        .input('id_movimiento', sql.Int, idMovimiento)
        .input('id_articulo', sql.Int, Number(item.id_articulo))
        .input('cantidad', sql.Decimal(14, 2), cantidad)
        .input('precio', sql.Decimal(14, 2), precio)
        .input('subtotal', sql.Decimal(14, 2), subtotal)
        .query(`
          INSERT INTO movimientos_inventario_detalle (
            id_movimiento,
            id_articulo,
            cantidad,
            precio,
            subtotal
          )
          VALUES (
            @id_movimiento,
            @id_articulo,
            @cantidad,
            @precio,
            @subtotal
          )
        `);

      const requestRebajar = new sql.Request(transaction);

      await requestRebajar
        .input('id_bodega', sql.Int, Number(id_bodega))
        .input('id_articulo', sql.Int, Number(item.id_articulo))
        .input('cantidad', sql.Decimal(14, 2), cantidad)
        .query(`
          UPDATE existencias_bodega
          SET existencia = existencia - @cantidad,
              fecha_actualizacion = GETDATE()
          WHERE id_bodega = @id_bodega
            AND id_articulo = @id_articulo
        `);
    }

    const requestCliente = new sql.Request(transaction);

    const clienteResult = await requestCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .query(`
        SELECT saldo_actual
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

    const saldoAnterior = Number(clienteResult.recordset[0].saldo_actual || 0);
    const saldoNuevo = saldoAnterior + totalVenta;

    const requestMovimientoCliente = new sql.Request(transaction);

    await requestMovimientoCliente
      .input('id_cliente', sql.Int, Number(id_cliente))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, 'VENTA')
      .input('monto', sql.Decimal(14, 2), totalVenta)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input(
              'observacion',
              sql.VarChar,
              observacion && observacion.trim() !== ''
                ? `VENTA BOLETA ${numero_boleta} - ${observacion.trim().toUpperCase()}`
                : `VENTA BOLETA ${numero_boleta}`
            )
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
      id_venta: idVenta,
      numero_boleta,
      total: totalVenta,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback venta:', rollbackError);
    }

    console.error('Error registrando venta:', error);

    res.status(500).json({
      mensaje: 'Error al registrar venta',
      error: error.message
    });
  }
};

const eliminarVenta = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const { id_venta } = req.params;

    if (!id_venta) {
      return res.status(400).json({
        mensaje: 'Debe indicar la venta a eliminar'
      });
    }

    await transaction.begin();

    const requestVenta = new sql.Request(transaction);

    const ventaResult = await requestVenta
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        SELECT
          id_venta,
          numero_boleta,
          fecha,
          id_cliente,
          id_bodega,
          total,
          estado
        FROM ventas
        WHERE id_venta = @id_venta
          AND estado = 'ACTIVA'
      `);

    if (ventaResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(404).json({
        mensaje: 'Venta activa no encontrada'
      });
    }

    const venta = ventaResult.recordset[0];

    const requestDetalle = new sql.Request(transaction);

    const detalleResult = await requestDetalle
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        SELECT
          id_venta_detalle,
          id_articulo,
          cantidad,
          precio_unitario,
          subtotal
        FROM ventas_detalle
        WHERE id_venta = @id_venta
          AND estado = 'ACTIVO'
      `);

    if (detalleResult.recordset.length === 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'La venta no tiene detalle activo para eliminar'
      });
    }

    for (const item of detalleResult.recordset) {
      const requestDevolverInventario = new sql.Request(transaction);

      await requestDevolverInventario
        .input('id_bodega', sql.Int, Number(venta.id_bodega))
        .input('id_articulo', sql.Int, Number(item.id_articulo))
        .input('cantidad', sql.Decimal(14, 2), Number(item.cantidad))
        .query(`
          UPDATE existencias_bodega
          SET existencia = existencia + @cantidad,
              fecha_actualizacion = GETDATE()
          WHERE id_bodega = @id_bodega
            AND id_articulo = @id_articulo
        `);
    }

    const requestCliente = new sql.Request(transaction);

    const clienteResult = await requestCliente
      .input('id_cliente', sql.Int, Number(venta.id_cliente))
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
        mensaje: 'Cliente no encontrado para reversar saldo'
      });
    }

    const cliente = clienteResult.recordset[0];
    const saldoAnterior = Number(cliente.saldo_actual || 0);
    const totalVenta = Number(venta.total || 0);
    const saldoNuevo = saldoAnterior - totalVenta;

    if (saldoNuevo < 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'No se puede eliminar la venta porque el saldo del cliente quedaría negativo'
      });
    }

    const requestMovimientoCliente = new sql.Request(transaction);

    await requestMovimientoCliente
      .input('id_cliente', sql.Int, Number(venta.id_cliente))
      .input('fecha', sql.Date, venta.fecha)
      .input('tipo_movimiento', sql.VarChar, 'ELIMINACION_VENTA')
      .input('monto', sql.Decimal(14, 2), totalVenta)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input('observacion', sql.VarChar, `ELIMINACION DE VENTA BOLETA ${venta.numero_boleta}`)
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
      .input('id_cliente', sql.Int, Number(venta.id_cliente))
      .input('saldo_actual', sql.Decimal(14, 2), saldoNuevo)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    const requestEliminarDetalle = new sql.Request(transaction);

    await requestEliminarDetalle
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        UPDATE ventas_detalle
        SET estado = 'ELIMINADO'
        WHERE id_venta = @id_venta
          AND estado = 'ACTIVO'
      `);

    const requestEliminarVenta = new sql.Request(transaction);

    await requestEliminarVenta
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        UPDATE ventas
        SET estado = 'ELIMINADA',
            fecha_eliminacion = GETDATE()
        WHERE id_venta = @id_venta
      `);

    await transaction.commit();

    res.json({
      mensaje: 'Venta eliminada correctamente',
      id_venta: Number(id_venta),
      numero_boleta: venta.numero_boleta,
      total_reversado: totalVenta,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback eliminación venta:', rollbackError);
    }

    console.error('Error eliminando venta:', error);

    res.status(500).json({
      mensaje: 'Error al eliminar venta',
      error: error.message
    });
  }
};


const consultarVenta = async (req, res) => {
  try {
    const idVenta = Number(req.params.id_venta);

    if (!Number.isInteger(idVenta) || idVenta <= 0) {
      return res.status(400).json({
        mensaje: 'El ID de la venta no es válido'
      });
    }

    const pool = await getConnection();

    // Consultar el encabezado de la venta
    const resultadoVenta = await pool.request()
      .input('id_venta', sql.Int, idVenta)
      .query(`
        SELECT
          v.*,
          c.codigo AS codigo_cliente,
          c.nombre AS nombre_cliente,
          b.codigo AS codigo_bodega,
          b.descripcion AS nombre_bodega,
          e.codigo AS codigo_empleado,
          e.nombre AS nombre_empleado
        FROM ventas v
        LEFT JOIN clientes c ON v.id_cliente = c.id_cliente
        LEFT JOIN bodegas b ON v.id_bodega = b.id_bodega
        LEFT JOIN empleados e ON v.id_empleado = e.id_empleado
        WHERE v.id_venta = @id_venta
      `);

    if (resultadoVenta.recordset.length === 0) {
      return res.status(404).json({
        mensaje: 'Venta no encontrada'
      });
    }

    // Consultar los artículos de la venta
    const resultadoDetalle = await pool.request()
      .input('id_venta', sql.Int, idVenta)
      .query(`
        SELECT
          vd.*,
          a.codigo AS codigo_articulo,
          a.descripcion AS nombre_articulo
        FROM ventas_detalle vd
        LEFT JOIN articulos a ON vd.id_articulo = a.id_articulo
        WHERE vd.id_venta = @id_venta
        ORDER BY vd.id_venta_detalle
      `);

    res.json({
      venta: resultadoVenta.recordset[0],
      detalle: resultadoDetalle.recordset
    });

  } catch (error) {
    console.error('Error consultando venta:', error);

    res.status(500).json({
      mensaje: 'Error al consultar venta',
      error: error.message
    });
  }
};


const consultarVentasPorBoleta = async (req, res) => {
  try {
    const { numero_boleta } = req.params;

    const pool = await getConnection();

    const resultado = await pool.request()
      .input('numero_boleta', sql.VarChar, numero_boleta)
      .query(`
        SELECT
          v.id_venta,
          v.numero_boleta,
          v.fecha,
          v.total,
          v.estado,
          v.observacion,
          c.nombre AS nombre_cliente
        FROM ventas v
        LEFT JOIN clientes c
          ON v.id_cliente = c.id_cliente
        WHERE v.numero_boleta = @numero_boleta
        ORDER BY v.id_venta DESC
      `);

    res.json({
      ventas: resultado.recordset
    });

  } catch (error) {
    console.error('Error consultando ventas por boleta:', error);

    res.status(500).json({
      mensaje: 'Error al consultar ventas por boleta',
      error: error.message
    });
  }
};



module.exports = {
  buscarBoleta,
  registrarVenta,
  eliminarVenta,
  consultarVenta,
  consultarVentasPorBoleta
};