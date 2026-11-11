const { sql, getConnection } = require('../config/db');
const { validarBoleta, fechaTexto } = require('../utils/boletas');
 
const esEnteroPositivo = (valor) => Number.isInteger(valor) && valor > 0;
const maxDosDecimales = (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 0.000001;
const redondear = (valor) => Math.round(Number(valor) * 100) / 100;
 
/* ------------------------------------------------------------
   GET /api/ventas/boleta/:numero_boleta
   Informa si la boleta ya existe y con qué datos se abrió
   (fecha, bodega y rollo), para llenarlos solos en pantalla.
   ------------------------------------------------------------ */
const buscarBoleta = async (req, res) => {
  try {
    const boleta = String(req.params.numero_boleta || '').trim();
    const pool = await getConnection();
 
    const result = await pool.request()
      .input('numero_boleta', sql.VarChar(20), boleta)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM ventas
            WHERE numero_boleta = @numero_boleta AND estado = 'ACTIVA') AS cantidad_ventas,
          (SELECT COUNT(*) FROM devoluciones
            WHERE numero_boleta = @numero_boleta AND estado = 'A') AS cantidad_devoluciones;
 
        SELECT TOP 1
          t.fecha,
          t.id_bodega,
          t.id_rollo,
          b.codigo      AS codigo_bodega,
          b.descripcion AS bodega,
          r.numero      AS numero_rollo,
          r.descripcion AS rollo
        FROM (
          SELECT fecha, id_bodega, id_rollo
          FROM ventas
          WHERE numero_boleta = @numero_boleta AND estado = 'ACTIVA'
          UNION ALL
          SELECT fecha, id_bodega, id_rollo
          FROM devoluciones
          WHERE numero_boleta = @numero_boleta AND estado = 'A'
        ) t
        LEFT JOIN bodegas b ON b.id_bodega = t.id_bodega
        LEFT JOIN rollos r  ON r.id_rollo  = t.id_rollo
        ORDER BY CASE WHEN t.id_rollo IS NULL THEN 1 ELSE 0 END;
      `);
 
    const [conteos, datos] = result.recordsets;
    const datosBoleta = datos[0] || null;
 
    res.json({
      existe: Boolean(datosBoleta),
      cantidad_ventas: conteos[0].cantidad_ventas,
      cantidad_devoluciones: conteos[0].cantidad_devoluciones,
      fecha: datosBoleta ? fechaTexto(datosBoleta.fecha) : null,
      id_bodega: datosBoleta?.id_bodega ?? null,
      codigo_bodega: datosBoleta?.codigo_bodega ?? null,
      bodega: datosBoleta?.bodega ?? null,
      id_rollo: datosBoleta?.id_rollo ?? null,
      numero_rollo: datosBoleta?.numero_rollo ?? null,
      rollo: datosBoleta?.rollo ?? null
    });
  } catch (error) {
    console.error('Error buscando boleta:', error);
    res.status(500).json({
      mensaje: 'Error al buscar boleta',
      error: error.message
    });
  }
};
 
/* ------------------------------------------------------------
   POST /api/ventas
   Una venta = un cliente. Varias ventas pueden compartir la
   boleta, siempre que coincidan fecha, bodega y rollo.
   ------------------------------------------------------------ */
const registrarVenta = async (req, res) => {
  const {
    numero_boleta,
    fecha,
    id_cliente,
    id_bodega,
    id_empleado,
    observacion,
    detalle
  } = req.body;
 
  const boleta = numero_boleta === undefined || numero_boleta === null
    ? ''
    : String(numero_boleta).trim();
  const idCliente = Number(id_cliente);
  const idBodega = Number(id_bodega);
  const idEmpleado = Number(id_empleado);
 
  if (!boleta || boleta.length > 20) {
    return res.status(400).json({ mensaje: 'Debe indicar un número de boleta válido (máximo 20 caracteres)' });
  }
 
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return res.status(400).json({ mensaje: 'La fecha de la venta no es válida' });
  }
 
  if (![idCliente, idBodega, idEmpleado].every(esEnteroPositivo)) {
    return res.status(400).json({ mensaje: 'Cliente, bodega y empleado son obligatorios' });
  }
 
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return res.status(400).json({ mensaje: 'Debe agregar al menos un artículo a la venta' });
  }
 
  // Validar cada línea: artículo, cantidad y precio de venta (el digitado, que puede ser corregido).
  const lineasSolicitadas = [];
 
  for (const item of detalle) {
    const idArticulo = Number(item?.id_articulo);
    const cantidad = Number(item?.cantidad);
    const precio = Number(item?.precio_unitario ?? item?.precio);
 
    if (
      !esEnteroPositivo(idArticulo) ||
      !Number.isFinite(cantidad) || cantidad <= 0 || !maxDosDecimales(cantidad) ||
      !Number.isFinite(precio) || precio <= 0 || !maxDosDecimales(precio)
    ) {
      return res.status(400).json({
        mensaje: 'Todos los artículos deben tener cantidad y precio mayores a cero (máximo dos decimales)'
      });
    }
 
    lineasSolicitadas.push({ id_articulo: idArticulo, cantidad, precio_unitario: precio });
  }
 
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
 
    // 1. Cliente activo y con rollo (bloqueado mientras se actualiza su saldo).
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
 
    if (!cliente.id_rollo) {
      return cancelar(400, 'El cliente no tiene un rollo asignado. Asígnele un rollo antes de venderle.');
    }
 
    // 2. Bodega y empleado activos.
    const resultadoCatalogos = await consulta()
      .input('id_bodega', sql.Int, idBodega)
      .input('id_empleado', sql.Int, idEmpleado)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM bodegas   WHERE id_bodega   = @id_bodega   AND estado = 'A') AS bodega_ok,
          (SELECT COUNT(*) FROM empleados WHERE id_empleado = @id_empleado AND estado = 'A') AS empleado_ok
      `);
 
    if (!resultadoCatalogos.recordset[0].bodega_ok) {
      return cancelar(400, 'La bodega no existe o está inactiva');
    }
 
    if (!resultadoCatalogos.recordset[0].empleado_ok) {
      return cancelar(400, 'El empleado no existe o está inactivo');
    }
 
    // 3. Reglas de la boleta: misma fecha, misma bodega y mismo rollo.
    const errorBoleta = await validarBoleta(transaction, {
      boleta,
      fecha,
      idBodega,
      idRollo: cliente.id_rollo
    });
 
    if (errorBoleta) {
      return cancelar(400, errorBoleta);
    }
 
    // 4. Costo de cada artículo: se toma de la base, nunca del navegador.
    const idsArticulos = [...new Set(lineasSolicitadas.map((linea) => linea.id_articulo))];
    const consultaArticulos = consulta();
 
    const marcadores = idsArticulos
      .map((id, indice) => {
        consultaArticulos.input(`articulo${indice}`, sql.Int, id);
        return `@articulo${indice}`;
      })
      .join(', ');
 
    const resultadoArticulos = await consultaArticulos.query(`
      SELECT id_articulo, codigo, descripcion, costo
      FROM articulos
      WHERE id_articulo IN (${marcadores})
        AND estado = 'A'
    `);
 
    const articulosPorId = new Map(
      resultadoArticulos.recordset.map((articulo) => [articulo.id_articulo, articulo])
    );
 
    if (articulosPorId.size !== idsArticulos.length) {
      return cancelar(400, 'Uno o más artículos no existen o están inactivos');
    }
 
    const lineas = lineasSolicitadas.map((linea) => {
      const articulo = articulosPorId.get(linea.id_articulo);
      const costo = Number(articulo.costo || 0);
 
      return {
        ...linea,
        codigo: articulo.codigo,
        descripcion: articulo.descripcion,
        costo_unitario: costo,
        subtotal: redondear(linea.cantidad * linea.precio_unitario),
        subtotal_costo: redondear(linea.cantidad * costo)
      };
    });
 
    const totalVenta = redondear(lineas.reduce((suma, linea) => suma + linea.subtotal, 0));
    const totalCosto = redondear(lineas.reduce((suma, linea) => suma + linea.subtotal_costo, 0));
 
    // 5. Encabezado de la venta.
    const textoObservacion =
      typeof observacion === 'string' && observacion.trim()
        ? observacion.trim().toUpperCase().slice(0, 300)
        : null;
 
    const resultadoVenta = await consulta()
      .input('numero_boleta', sql.VarChar(20), boleta)
      .input('fecha', sql.Date, fecha)
      .input('id_cliente', sql.Int, idCliente)
      .input('id_bodega', sql.Int, idBodega)
      .input('id_rollo', sql.Int, cliente.id_rollo)
      .input('id_empleado', sql.Int, idEmpleado)
      .input('total', sql.Decimal(14, 2), totalVenta)
      .input('observacion', sql.VarChar(300), textoObservacion)
      .query(`
        INSERT INTO ventas (
          numero_boleta, fecha, id_cliente, id_bodega, id_rollo,
          id_empleado, total, estado, observacion
        )
        OUTPUT INSERTED.id_venta
        VALUES (
          @numero_boleta, @fecha, @id_cliente, @id_bodega, @id_rollo,
          @id_empleado, @total, 'ACTIVA', @observacion
        )
      `);
 
    const idVenta = resultadoVenta.recordset[0].id_venta;
 
    // 6. Salida de inventario (valorada al costo).
    const resultadoMovimiento = await consulta()
      .input('numero_boleta', sql.VarChar(30), boleta)
      .input('id_venta', sql.Int, idVenta)
      .input('id_bodega', sql.Int, idBodega)
      .input('fecha', sql.Date, fecha)
      .input('total', sql.Decimal(14, 2), totalCosto)
      .query(`
        INSERT INTO movimientos_inventario (
          numero_boleta, id_venta, id_bodega, fecha, tipo_movimiento, total, estado
        )
        OUTPUT INSERTED.id_movimiento
        VALUES (
          @numero_boleta, @id_venta, @id_bodega, @fecha, 'S', @total, 'A'
        )
      `);
 
    const idMovimiento = resultadoMovimiento.recordset[0].id_movimiento;
 
    // 7. Líneas: detalle de venta, detalle de inventario y rebajo de existencia.
    for (const linea of lineas) {
      await consulta()
        .input('id_venta', sql.Int, idVenta)
        .input('id_articulo', sql.Int, linea.id_articulo)
        .input('cantidad', sql.Decimal(14, 2), linea.cantidad)
        .input('costo_unitario', sql.Decimal(14, 2), linea.costo_unitario)
        .input('precio_unitario', sql.Decimal(14, 2), linea.precio_unitario)
        .input('subtotal', sql.Decimal(14, 2), linea.subtotal)
        .query(`
          INSERT INTO ventas_detalle (
            id_venta, id_articulo, cantidad, costo_unitario, precio_unitario, subtotal, estado
          )
          VALUES (
            @id_venta, @id_articulo, @cantidad, @costo_unitario, @precio_unitario, @subtotal, 'ACTIVO'
          )
        `);
 
      await consulta()
        .input('id_movimiento', sql.Int, idMovimiento)
        .input('id_articulo', sql.Int, linea.id_articulo)
        .input('cantidad', sql.Decimal(12, 2), linea.cantidad)
        .input('precio', sql.Decimal(14, 2), linea.costo_unitario)
        .input('subtotal', sql.Decimal(14, 2), linea.subtotal_costo)
        .query(`
          INSERT INTO movimientos_inventario_detalle (
            id_movimiento, id_articulo, cantidad, precio, subtotal
          )
          VALUES (
            @id_movimiento, @id_articulo, @cantidad, @precio, @subtotal
          )
        `);
 
      const resultadoRebaja = await consulta()
        .input('id_bodega', sql.Int, idBodega)
        .input('id_articulo', sql.Int, linea.id_articulo)
        .input('cantidad', sql.Decimal(12, 2), linea.cantidad)
        .query(`
          UPDATE existencias_bodega WITH (UPDLOCK, HOLDLOCK)
          SET existencia = existencia - @cantidad,
              fecha_actualizacion = GETDATE()
          WHERE id_bodega = @id_bodega
            AND id_articulo = @id_articulo
            AND existencia >= @cantidad
        `);
 
      if (resultadoRebaja.rowsAffected[0] !== 1) {
        return cancelar(
          400,
          `Existencia insuficiente para ${linea.codigo} - ${linea.descripcion}. No se registró la venta.`
        );
      }
    }
 
    // 8. Movimiento del cliente (con rollo y empleado, para los reportes) y saldo.
    const saldoAnterior = Number(cliente.saldo_actual || 0);
    const saldoNuevo = redondear(saldoAnterior + totalVenta);
 
    await consulta()
      .input('id_cliente', sql.Int, idCliente)
      .input('id_rollo', sql.Int, cliente.id_rollo)
      .input('id_empleado', sql.Int, idEmpleado)
      .input('fecha', sql.Date, fecha)
      .input('monto', sql.Decimal(14, 2), totalVenta)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input(
        'observacion',
        sql.VarChar(500),
        textoObservacion
          ? `VENTA BOLETA ${boleta} - ${textoObservacion}`
          : `VENTA BOLETA ${boleta}`
      )
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente, id_rollo, id_empleado, fecha, tipo_movimiento,
          monto, saldo_anterior, saldo_nuevo, observacion
        )
        VALUES (
          @id_cliente, @id_rollo, @id_empleado, @fecha, 'VENTA',
          @monto, @saldo_anterior, @saldo_nuevo, @observacion
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
      mensaje: 'Venta registrada correctamente',
      id_venta: idVenta,
      numero_boleta: boleta,
      cliente: cliente.nombre,
      total: totalVenta,
      saldo_anterior: saldoAnterior,
      saldo_nuevo: saldoNuevo
    });
  } catch (error) {
    if (transaction && !finalizada) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error haciendo rollback venta:', rollbackError);
      }
    }
 
    console.error('Error registrando venta:', error);
 
    return res.status(500).json({
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
          id_rollo,
          id_empleado,
          total,
          estado
        FROM ventas WITH (UPDLOCK, HOLDLOCK)
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
 
    // No eliminar una venta con devoluciones activas: se devolvería todo dos veces.
    const devolucionesResult = await new sql.Request(transaction)
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        SELECT TOP 1 d.numero_boleta
        FROM devoluciones_detalle dd
        INNER JOIN devoluciones d    ON d.id_devolucion = dd.id_devolucion
        INNER JOIN ventas_detalle vd ON vd.id_venta_detalle = dd.id_venta_detalle
        WHERE vd.id_venta = @id_venta
          AND d.estado = 'A'
      `);
 
    if (devolucionesResult.recordset.length > 0) {
      await transaction.rollback();
 
      return res.status(400).json({
        mensaje: `No se puede eliminar: la venta tiene devoluciones activas (boleta ${devolucionesResult.recordset[0].numero_boleta}). Anule primero las devoluciones.`
      });
    }
 
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
      // Devuelve la existencia; si el registro no existe (caso raro), lo crea.
      await new sql.Request(transaction)
        .input('id_bodega', sql.Int, Number(venta.id_bodega))
        .input('id_articulo', sql.Int, Number(item.id_articulo))
        .input('cantidad', sql.Decimal(12, 2), Number(item.cantidad))
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
 
    const requestCliente = new sql.Request(transaction);
 
    const clienteResult = await requestCliente
      .input('id_cliente', sql.Int, Number(venta.id_cliente))
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
        mensaje: 'Cliente no encontrado para reversar saldo'
      });
    }
 
    const cliente = clienteResult.recordset[0];
    const saldoAnterior = Number(cliente.saldo_actual || 0);
    const totalVenta = Number(venta.total || 0);
    const saldoNuevo = redondear(saldoAnterior - totalVenta);
 
    if (saldoNuevo < 0) {
      await transaction.rollback();
 
      return res.status(400).json({
        mensaje: 'No se puede eliminar la venta porque el saldo del cliente quedaría negativo'
      });
    }
 
    await new sql.Request(transaction)
      .input('id_cliente', sql.Int, Number(venta.id_cliente))
      .input('id_rollo', sql.Int, venta.id_rollo || cliente.id_rollo || null)
      .input('id_empleado', sql.Int, venta.id_empleado || null)
      .input('fecha', sql.Date, venta.fecha)
      .input('monto', sql.Decimal(14, 2), totalVenta)
      .input('saldo_anterior', sql.Decimal(14, 2), saldoAnterior)
      .input('saldo_nuevo', sql.Decimal(14, 2), saldoNuevo)
      .input('observacion', sql.VarChar(500), `ELIMINACION DE VENTA BOLETA ${venta.numero_boleta}`)
      .query(`
        INSERT INTO movimientos_cliente (
          id_cliente, id_rollo, id_empleado, fecha, tipo_movimiento,
          monto, saldo_anterior, saldo_nuevo, observacion
        )
        VALUES (
          @id_cliente, @id_rollo, @id_empleado, @fecha, 'ELIMINACION_VENTA',
          @monto, @saldo_anterior, @saldo_nuevo, @observacion
        )
      `);
 
    await new sql.Request(transaction)
      .input('id_cliente', sql.Int, Number(venta.id_cliente))
      .input('saldo_actual', sql.Decimal(12, 2), saldoNuevo)
      .query(`
        UPDATE clientes
        SET saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);
 
    await new sql.Request(transaction)
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        UPDATE ventas_detalle
        SET estado = 'ELIMINADO'
        WHERE id_venta = @id_venta
          AND estado = 'ACTIVO'
      `);
 
    await new sql.Request(transaction)
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        UPDATE ventas
        SET estado = 'ELIMINADA',
            fecha_eliminacion = GETDATE()
        WHERE id_venta = @id_venta
      `);
 
    const resultadoMovimiento = await new sql.Request(transaction)
      .input('id_venta', sql.Int, Number(id_venta))
      .query(`
        UPDATE movimientos_inventario
        SET estado = 'I'
        WHERE id_venta = @id_venta
          AND tipo_movimiento = 'S'
          AND estado = 'A'
      `);
 
    if (resultadoMovimiento.rowsAffected[0] !== 1) {
      await transaction.rollback();
 
      return res.status(409).json({
        mensaje: 'No se encontró un único movimiento activo asociado a esta venta. No se realizó la eliminación.'
      });
    }
 
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
          e.nombre AS nombre_empleado,
          r.numero AS numero_rollo,
          r.descripcion AS nombre_rollo
        FROM ventas v
        LEFT JOIN clientes c  ON v.id_cliente = c.id_cliente
        LEFT JOIN bodegas b   ON v.id_bodega = b.id_bodega
        LEFT JOIN empleados e ON v.id_empleado = e.id_empleado
        LEFT JOIN rollos r    ON v.id_rollo = r.id_rollo
        WHERE v.id_venta = @id_venta
      `);
 
    if (resultadoVenta.recordset.length === 0) {
      return res.status(404).json({
        mensaje: 'Venta no encontrada'
      });
    }
 
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
      .input('numero_boleta', sql.VarChar(20), String(numero_boleta).trim())
      .query(`
        SELECT
          v.id_venta,
          v.numero_boleta,
          v.fecha,
          v.total,
          v.estado,
          v.observacion,
          c.codigo AS codigo_cliente,
          c.nombre AS nombre_cliente,
          e.nombre AS nombre_empleado
        FROM ventas v
        LEFT JOIN clientes c  ON v.id_cliente = c.id_cliente
        LEFT JOIN empleados e ON v.id_empleado = e.id_empleado
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