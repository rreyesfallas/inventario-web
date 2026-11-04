const { sql, getConnection } = require('../config/db');
 
const redondear = (valor) => Math.round(Number(valor) * 100) / 100;
 
const esEnteroPositivo = (valor) => Number.isInteger(valor) && valor > 0;
 
const tieneMaxDosDecimales = (valor) =>
  Math.abs(valor * 100 - Math.round(valor * 100)) < 0.000001;
 
const esFechaValida = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return false;
  }
 
  const fechaValidada = new Date(`${fecha}T00:00:00Z`);
 
  return (
    !Number.isNaN(fechaValidada.getTime()) &&
    fechaValidada.toISOString().slice(0, 10) === fecha
  );
};
 
/* ------------------------------------------------------------
   GET /api/transacciones/devolucion/cliente/:id/ventas
   Líneas de venta activas del cliente con lo ya devuelto.
   ------------------------------------------------------------ */
const listarVentasClienteDevolucion = async (req, res) => {
  const idCliente = Number(req.params.id);
 
  if (!esEnteroPositivo(idCliente)) {
    return res.status(400).json({ mensaje: 'Cliente no válido' });
  }
 
  try {
    const pool = await getConnection();
 
    const resultado = await pool.request()
      .input('id_cliente', sql.Int, idCliente)
      .query(`
        SELECT
          vd.id_venta_detalle,
          v.id_venta,
          v.numero_boleta,
          v.fecha,
          v.id_bodega,
          b.codigo       AS codigo_bodega,
          b.descripcion  AS bodega,
          a.id_articulo,
          a.codigo       AS codigo_articulo,
          a.descripcion  AS articulo,
          vd.cantidad,
          vd.precio_unitario,
          vd.subtotal,
          ISNULL(dev.cantidad_devuelta, 0) AS cantidad_devuelta,
          vd.cantidad - ISNULL(dev.cantidad_devuelta, 0) AS cantidad_disponible
        FROM ventas v
        INNER JOIN ventas_detalle vd ON vd.id_venta = v.id_venta
        INNER JOIN articulos a       ON a.id_articulo = vd.id_articulo
        INNER JOIN bodegas b         ON b.id_bodega = v.id_bodega
        OUTER APPLY (
          SELECT SUM(dd.cantidad) AS cantidad_devuelta
          FROM devoluciones_detalle dd
          INNER JOIN devoluciones d ON d.id_devolucion = dd.id_devolucion
          WHERE dd.id_venta_detalle = vd.id_venta_detalle
            AND d.estado = 'A'
        ) dev
        WHERE v.id_cliente = @id_cliente
          AND v.estado = 'ACTIVA'
          AND vd.estado = 'ACTIVO'
        ORDER BY v.fecha DESC, v.id_venta DESC, vd.id_venta_detalle
      `);
 
    return res.json(resultado.recordset);
  } catch (error) {
    console.error('Error listando ventas para devolución:', error);
 
    return res.status(500).json({
      mensaje: 'Error al consultar las ventas del cliente',
      error: error.message
    });
  }
};
 
/* ------------------------------------------------------------
   GET /api/transacciones/devolucion/boleta-sugerida
   Siguiente número de boleta (máximo numérico usado + 1).
   ------------------------------------------------------------ */
const obtenerBoletaSugerida = async (req, res) => {
  try {
    const pool = await getConnection();
 
    const resultado = await pool.request().query(`
      SELECT ISNULL(MAX(numero), 0) + 1 AS numero_boleta
      FROM (
        SELECT TRY_CAST(numero_boleta AS BIGINT) AS numero FROM ventas
        UNION ALL
        SELECT TRY_CAST(numero_boleta AS BIGINT) FROM movimientos_inventario
        UNION ALL
        SELECT TRY_CAST(numero_boleta AS BIGINT) FROM devoluciones
      ) boletas
    `);
 
    return res.json({
      numero_boleta: String(resultado.recordset[0].numero_boleta)
    });
  } catch (error) {
    console.error('Error obteniendo boleta sugerida:', error);
 
    return res.status(500).json({
      mensaje: 'Error al obtener la boleta sugerida',
      error: error.message
    });
  }
};
 
/* ------------------------------------------------------------
   POST /api/transacciones/devolucion
   body: {
     id_cliente, id_rollo, id_empleado, id_bodega,
     numero_boleta, fecha, observacion,
     detalle: [{ id_venta_detalle, cantidad }]
   }
   ------------------------------------------------------------ */
const registrarDevolucion = async (req, res) => {
  const {
    id_cliente,
    id_rollo,
    id_empleado,
    id_bodega,
    numero_boleta,
    fecha,
    observacion,
    detalle
  } = req.body;
 
  const idCliente = Number(id_cliente);
  const idRollo = Number(id_rollo);
  const idEmpleado = Number(id_empleado);
  const idBodega = Number(id_bodega);
  const boleta =
    numero_boleta === undefined || numero_boleta === null
      ? ''
      : String(numero_boleta).trim();
 
  if (![idCliente, idRollo, idEmpleado, idBodega].every(esEnteroPositivo)) {
    return res.status(400).json({
      mensaje: 'Cliente, rollo, empleado y bodega son obligatorios'
    });
  }
 
  if (!boleta || boleta.length > 20) {
    return res.status(400).json({
      mensaje: 'Debe indicar un número de boleta válido (máximo 20 caracteres)'
    });
  }
 
  if (!esFechaValida(fecha)) {
    return res.status(400).json({ mensaje: 'La fecha de la devolución no es válida' });
  }
 
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return res.status(400).json({
      mensaje: 'Debe agregar al menos un artículo a devolver'
    });
  }
 
  // Agrupar cantidades por línea de venta (por si se agregó dos veces).
  const cantidadesPorLinea = new Map();
 
  for (const item of detalle) {
    const idLinea = Number(item?.id_venta_detalle);
    const cantidad = Number(item?.cantidad);
 
    if (
      !esEnteroPositivo(idLinea) ||
      !Number.isFinite(cantidad) ||
      cantidad <= 0 ||
      !tieneMaxDosDecimales(cantidad)
    ) {
      return res.status(400).json({
        mensaje: 'Cada artículo debe tener una cantidad mayor a cero con máximo dos decimales'
      });
    }
 
    cantidadesPorLinea.set(
      idLinea,
      redondear((cantidadesPorLinea.get(idLinea) || 0) + cantidad)
    );
  }
 
  if (cantidadesPorLinea.size > 100) {
    return res.status(400).json({ mensaje: 'Demasiados artículos en una sola devolución' });
  }
 
  const textoObservacion =
    typeof observacion === 'string' && observacion.trim()
      ? observacion.trim().toUpperCase().slice(0, 300)
      : `DEVOLUCIÓN BOLETA ${boleta}`;
 
  let transaction;
  let finalizada = false;
 
  const cancelar = async (status, mensaje) => {
    finalizada = true;
    await transaction.rollback();
    return res.status(status).json({ mensaje });
  };
 
  try {
    const pool = await getConnection();
    transaction = new sql.Transaction(pool);
    await transaction.begin();
 
    const consulta = () => new sql.Request(transaction);
 
    // 1. Cliente (bloqueado hasta terminar).
    const resultadoCliente = await consulta()
      .input('id_cliente', sql.Int, idCliente)
      .query(`
        SELECT id_cliente, nombre, id_rollo, saldo_actual
        FROM clientes WITH (UPDLOCK, HOLDLOCK)
        WHERE id_cliente = @id_cliente
          AND estado = 'A'
      `);
 
    if (resultadoCliente.recordset.length === 0) {
      return cancelar(404, 'El cliente no existe o está inactivo');
    }
 
    const cliente = resultadoCliente.recordset[0];
 
    if (Number(cliente.id_rollo) !== idRollo) {
      return cancelar(400, 'El cliente no pertenece al rollo seleccionado');
    }
 
    // 2. Rollo, empleado y bodega activos.
    const resultadoCatalogos = await consulta()
      .input('id_rollo', sql.Int, idRollo)
      .input('id_empleado', sql.Int, idEmpleado)
      .input('id_bodega', sql.Int, idBodega)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM rollos    WHERE id_rollo    = @id_rollo    AND estado = 'A') AS rollo_ok,
          (SELECT COUNT(*) FROM empleados WHERE id_empleado = @id_empleado AND estado = 'A') AS empleado_ok,
          (SELECT COUNT(*) FROM bodegas   WHERE id_bodega   = @id_bodega   AND estado = 'A') AS bodega_ok
      `);
 
    const catalogos = resultadoCatalogos.recordset[0];
 
    if (!catalogos.rollo_ok) return cancelar(400, 'El rollo no existe o está inactivo');
    if (!catalogos.empleado_ok) return cancelar(400, 'El empleado no existe o está inactivo');
    if (!catalogos.bodega_ok) return cancelar(400, 'La bodega no existe o está inactiva');
 
    // 3. Boleta no usada en devoluciones, movimientos ni ventas activas.
    const resultadoBoleta = await consulta()
      .input('numero_boleta', sql.VarChar(20), boleta)
      .query(`
        SELECT TOP 1 1 AS existe
        FROM (
          SELECT numero_boleta FROM devoluciones WITH (UPDLOCK, HOLDLOCK)
          WHERE numero_boleta = @numero_boleta AND estado = 'A'
          UNION ALL
          SELECT numero_boleta FROM movimientos_inventario WITH (UPDLOCK, HOLDLOCK)
          WHERE numero_boleta = @numero_boleta AND estado = 'A'
          UNION ALL
          SELECT numero_boleta FROM ventas WITH (UPDLOCK, HOLDLOCK)
          WHERE numero_boleta = @numero_boleta AND estado = 'ACTIVA'
        ) boletas
      `);
 
    if (resultadoBoleta.recordset.length > 0) {
      return cancelar(400, `La boleta ${boleta} ya está registrada`);
    }
 
    // 4. Líneas de venta a devolver (bloqueadas) con lo ya devuelto.
    const idsLineas = [...cantidadesPorLinea.keys()];
    const consultaLineas = consulta().input('id_cliente', sql.Int, idCliente);
 
    const marcadores = idsLineas
      .map((idLinea, indice) => {
        consultaLineas.input(`linea${indice}`, sql.Int, idLinea);
        return `@linea${indice}`;
      })
      .join(', ');
 
    const resultadoLineas = await consultaLineas.query(`
      SELECT
        vd.id_venta_detalle,
        vd.id_articulo,
        vd.cantidad,
        vd.precio_unitario,
        vd.estado AS estado_detalle,
        v.id_cliente,
        v.estado  AS estado_venta,
        v.numero_boleta,
        a.descripcion AS articulo,
        ISNULL(dev.cantidad_devuelta, 0) AS cantidad_devuelta
      FROM ventas_detalle vd WITH (UPDLOCK, HOLDLOCK)
      INNER JOIN ventas v    ON v.id_venta = vd.id_venta
      INNER JOIN articulos a ON a.id_articulo = vd.id_articulo
      OUTER APPLY (
        SELECT SUM(dd.cantidad) AS cantidad_devuelta
        FROM devoluciones_detalle dd
        INNER JOIN devoluciones d ON d.id_devolucion = dd.id_devolucion
        WHERE dd.id_venta_detalle = vd.id_venta_detalle
          AND d.estado = 'A'
      ) dev
      WHERE vd.id_venta_detalle IN (${marcadores})
    `);
 
    if (resultadoLineas.recordset.length !== idsLineas.length) {
      return cancelar(400, 'Una o más líneas de venta no existen');
    }
 
    const lineas = [];
 
    for (const fila of resultadoLineas.recordset) {
      if (Number(fila.id_cliente) !== idCliente) {
        return cancelar(400, 'Uno de los artículos no pertenece a una venta de este cliente');
      }
 
      if (fila.estado_venta !== 'ACTIVA' || fila.estado_detalle !== 'ACTIVO') {
        return cancelar(400, `La venta de la boleta ${fila.numero_boleta} ya no está activa`);
      }
 
      const cantidadDevolver = cantidadesPorLinea.get(fila.id_venta_detalle);
      const disponible = redondear(Number(fila.cantidad) - Number(fila.cantidad_devuelta));
 
      if (cantidadDevolver > disponible) {
        return cancelar(
          400,
          `Solo se pueden devolver ${disponible} unidad(es) de ${fila.articulo} (boleta ${fila.numero_boleta})`
        );
      }
 
      const precio = Number(fila.precio_unitario);
 
      lineas.push({
        id_venta_detalle: fila.id_venta_detalle,
        id_articulo: fila.id_articulo,
        cantidad: cantidadDevolver,
        precio_unitario: precio,
        subtotal: redondear(cantidadDevolver * precio)
      });
    }
 
    const total = redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0));
    const saldoAnterior = Number(cliente.saldo_actual || 0);
 
    if (total <= 0) {
      return cancelar(400, 'El total de la devolución debe ser mayor a cero');
    }
 
    if (total > saldoAnterior) {
      return cancelar(400, 'La devolución no puede ser mayor al saldo actual del cliente');
    }
 
    const saldoNuevo = redondear(saldoAnterior - total);
 
    // 5. Encabezado de la devolución.
    const resultadoDevolucion = await consulta()
      .input('numero_boleta', sql.VarChar(20), boleta)
      .input('fecha', sql.Date, fecha)
      .input('id_cliente', sql.Int, idCliente)
      .input('id_rollo', sql.Int, idRollo)
      .input('id_bodega', sql.Int, idBodega)
      .input('id_empleado', sql.Int, idEmpleado)
      .input('total', sql.Decimal(14, 2), total)
      .input('observacion', sql.VarChar(300), textoObservacion)
      .query(`
        INSERT INTO devoluciones (
          numero_boleta, fecha, id_cliente, id_rollo,
          id_bodega, id_empleado, total, observacion
        )
        OUTPUT INSERTED.id_devolucion
        VALUES (
          @numero_boleta, @fecha, @id_cliente, @id_rollo,
          @id_bodega, @id_empleado, @total, @observacion
        )
      `);
 
    const idDevolucion = resultadoDevolucion.recordset[0].id_devolucion;
 
    // 6. Entrada de inventario.
    const resultadoMovimiento = await consulta()
      .input('numero_boleta', sql.VarChar(30), boleta)
      .input('id_bodega', sql.Int, idBodega)
      .input('fecha', sql.Date, fecha)
      .input('total', sql.Decimal(14, 2), total)
      .input('id_devolucion', sql.Int, idDevolucion)
      .query(`
        INSERT INTO movimientos_inventario (
          numero_boleta, id_bodega, fecha, tipo_movimiento, total, id_devolucion
        )
        OUTPUT INSERTED.id_movimiento
        VALUES (
          @numero_boleta, @id_bodega, @fecha, 'E', @total, @id_devolucion
        )
      `);
 
    const idMovimiento = resultadoMovimiento.recordset[0].id_movimiento;
 
    // 7. Detalle, detalle de inventario y existencias por línea.
    for (const linea of lineas) {
      await consulta()
        .input('id_devolucion', sql.Int, idDevolucion)
        .input('id_venta_detalle', sql.Int, linea.id_venta_detalle)
        .input('id_articulo', sql.Int, linea.id_articulo)
        .input('cantidad', sql.Decimal(14, 2), linea.cantidad)
        .input('precio_unitario', sql.Decimal(14, 2), linea.precio_unitario)
        .input('subtotal', sql.Decimal(14, 2), linea.subtotal)
        .query(`
          INSERT INTO devoluciones_detalle (
            id_devolucion, id_venta_detalle, id_articulo,
            cantidad, precio_unitario, subtotal
          )
          VALUES (
            @id_devolucion, @id_venta_detalle, @id_articulo,
            @cantidad, @precio_unitario, @subtotal
          )
        `);
 
      await consulta()
        .input('id_movimiento', sql.Int, idMovimiento)
        .input('id_articulo', sql.Int, linea.id_articulo)
        .input('cantidad', sql.Decimal(12, 2), linea.cantidad)
        .input('precio', sql.Decimal(14, 2), linea.precio_unitario)
        .input('subtotal', sql.Decimal(14, 2), linea.subtotal)
        .query(`
          INSERT INTO movimientos_inventario_detalle (
            id_movimiento, id_articulo, cantidad, precio, subtotal
          )
          VALUES (
            @id_movimiento, @id_articulo, @cantidad, @precio, @subtotal
          )
        `);
 
      await consulta()
        .input('id_bodega', sql.Int, idBodega)
        .input('id_articulo', sql.Int, linea.id_articulo)
        .input('cantidad', sql.Decimal(12, 2), linea.cantidad)
        .query(`
          UPDATE existencias_bodega WITH (UPDLOCK, HOLDLOCK)
          SET existencia = existencia + @cantidad,
              fecha_actualizacion = GETDATE()
          WHERE id_bodega = @id_bodega
            AND id_articulo = @id_articulo;
 
          IF @@ROWCOUNT = 0
            INSERT INTO existencias_bodega (id_bodega, id_articulo, existencia, fecha_actualizacion)
            VALUES (@id_bodega, @id_articulo, @cantidad, GETDATE());
        `);
    }
 
    // 8. Movimiento del cliente y saldo.
    await consulta()
      .input('id_cliente', sql.Int, idCliente)
      .input('id_rollo', sql.Int, idRollo)
      .input('id_empleado', sql.Int, idEmpleado)
      .input('id_devolucion', sql.Int, idDevolucion)
      .input('fecha', sql.Date, fecha)
      .input('monto', sql.Decimal(14, 2), total)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input('observacion', sql.VarChar(500), textoObservacion)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente, id_rollo, id_empleado, id_devolucion, fecha,
          tipo_movimiento, monto, saldo_anterior, saldo_nuevo, observacion
        )
        VALUES (
          @id_cliente, @id_rollo, @id_empleado, @id_devolucion, @fecha,
          'DEVOLUCION', @monto, @saldo_anterior, @saldo_nuevo, @observacion
        )
      `);
 
    await consulta()
      .input('id_cliente', sql.Int, idCliente)
      .input('saldo_actual', sql.Decimal(12, 2), saldoNuevo)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);
 
    await transaction.commit();
    finalizada = true;
 
    return res.status(201).json({
      mensaje: 'Devolución registrada correctamente',
      id_devolucion: idDevolucion,
      numero_boleta: boleta,
      cliente: cliente.nombre,
      total,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    if (transaction && !finalizada) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error haciendo rollback:', rollbackError);
      }
    }
 
    // Violación de índice único (boleta registrada al mismo tiempo por otro usuario).
    if (error.number === 2601 || error.number === 2627) {
      return res.status(400).json({ mensaje: `La boleta ${boleta} ya está registrada` });
    }
 
    console.error('Error registrando devolución:', error);
 
    return res.status(500).json({
      mensaje: 'Error al registrar la devolución',
      error: error.message
    });
  }
};
 
module.exports = {
  listarVentasClienteDevolucion,
  obtenerBoletaSugerida,
  registrarDevolucion
};