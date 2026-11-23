const { sql, getConnection } = require('../config/db');

const fechaTexto = (fecha) => {
  if (!fecha) return '';
  const iso = fecha instanceof Date ? fecha.toISOString() : String(fecha);
  return iso.slice(0, 10);
};

const NOMBRES_MOVIMIENTO = {
  ABONO: 'ABONO',
  VENTA: 'VENTA',
  DEVOLUCION: 'DEVOLUCIÓN',
  DESCUENTO: 'DESCUENTO',
  TRANSFERENCIA_SALIDA: 'TRANSF. ENVIADA',
  TRANSFERENCIA_ENTRADA: 'TRANSF. RECIBIDA',
  ELIMINACION_VENTA: 'VENTA ELIMINADA'
};

/* ------------------------------------------------------------
   GET /api/historial-clientes/:id
   Historial completo del cliente, como en el sistema anterior:
   - Ventas y devoluciones: una línea por artículo.
   - Abonos, descuentos, transferencias: una línea por movimiento.
   - "SIN MONTO": semanas en que la tarjeta se registró pero no hubo abono.
   ------------------------------------------------------------ */
const obtenerHistorialCliente = async (req, res) => {
  const idCliente = Number(req.params.id);

  if (!Number.isInteger(idCliente) || idCliente <= 0) {
    return res.status(400).json({ mensaje: 'Cliente no válido' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_cliente', sql.Int, idCliente)
      .query(`
        -- 0. Datos del cliente
        SELECT
          c.id_cliente,
          c.codigo,
          c.cedula,
          c.nombre,
          c.direccion,
          c.lado_calle,
          c.saldo_actual,
          r.numero      AS numero_rollo,
          r.descripcion AS rollo
        FROM clientes c
        LEFT JOIN rollos r ON r.id_rollo = c.id_rollo
        WHERE c.id_cliente = @id_cliente;

        -- 1. Movimientos activos del cliente
        SELECT
          mc.id_movimiento_cliente,
          mc.fecha,
          mc.tipo_movimiento,
          mc.monto,
          mc.saldo_anterior,
          mc.saldo_nuevo,
          mc.observacion,
          mc.id_venta,
          mc.id_devolucion,
          r.numero  AS numero_rollo,
          b.codigo  AS codigo_carro,
          e.codigo  AS codigo_empleado,
          e.nombre  AS empleado,
          cr.codigo AS codigo_cliente_relacionado,
          cr.nombre AS cliente_relacionado
        FROM movimientos_cliente mc
        LEFT JOIN rollos r        ON r.id_rollo = mc.id_rollo
        LEFT JOIN ventas v        ON v.id_venta = mc.id_venta
        LEFT JOIN devoluciones d  ON d.id_devolucion = mc.id_devolucion
        LEFT JOIN rollos rv       ON rv.id_rollo = COALESCE(mc.id_rollo, v.id_rollo, d.id_rollo)
        LEFT JOIN bodegas b       ON b.id_bodega = COALESCE(v.id_bodega, d.id_bodega, rv.id_bodega)
        LEFT JOIN empleados e     ON e.id_empleado = mc.id_empleado
        LEFT JOIN clientes cr     ON cr.id_cliente = mc.id_cliente_relacionado
        WHERE mc.id_cliente = @id_cliente
          AND mc.estado = 'A'
        ORDER BY mc.fecha, mc.id_movimiento_cliente;

        -- 2. Artículos de las ventas del cliente
        SELECT
          vd.id_venta,
          a.codigo      AS codigo_articulo,
          a.descripcion AS articulo,
          vd.cantidad,
          vd.subtotal
        FROM ventas_detalle vd
        INNER JOIN articulos a ON a.id_articulo = vd.id_articulo
        WHERE vd.id_venta IN (
          SELECT id_venta FROM movimientos_cliente
          WHERE id_cliente = @id_cliente AND id_venta IS NOT NULL
        )
        ORDER BY vd.id_venta_detalle;

        -- 3. Artículos de las devoluciones del cliente
        SELECT
          dd.id_devolucion,
          a.codigo      AS codigo_articulo,
          a.descripcion AS articulo,
          dd.cantidad,
          dd.subtotal
        FROM devoluciones_detalle dd
        INNER JOIN articulos a ON a.id_articulo = dd.id_articulo
        WHERE dd.id_devolucion IN (
          SELECT id_devolucion FROM movimientos_cliente
          WHERE id_cliente = @id_cliente AND id_devolucion IS NOT NULL
        )
        ORDER BY dd.id_devolucion_detalle;

        -- 4. Tarjetas registradas sin abono ese día ("SIN MONTO")
        SELECT
          t.id_tarjeta_registrada,
          t.fecha,
          r.numero AS numero_rollo,
          b.codigo AS codigo_carro
        FROM tarjetas_registradas t
        LEFT JOIN rollos r  ON r.id_rollo = t.id_rollo
        LEFT JOIN bodegas b ON b.id_bodega = r.id_bodega
        WHERE t.id_cliente = @id_cliente
          AND t.estado = 'A'
          AND NOT EXISTS (
            SELECT 1
            FROM movimientos_cliente a
            WHERE a.id_cliente = t.id_cliente
              AND a.tipo_movimiento = 'ABONO'
              AND a.estado = 'A'
              AND a.fecha = t.fecha
          )
        ORDER BY t.fecha;
      `);

    const [clientes, movimientos, lineasVenta, lineasDevolucion, sinMonto] = resultado.recordsets;

    if (clientes.length === 0) {
      return res.status(404).json({ mensaje: 'El cliente no existe' });
    }

    const agrupar = (lineas, campo) =>
      lineas.reduce((mapa, linea) => {
        const clave = linea[campo];
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push(linea);
        return mapa;
      }, new Map());

    const articulosPorVenta = agrupar(lineasVenta, 'id_venta');
    const articulosPorDevolucion = agrupar(lineasDevolucion, 'id_devolucion');

    const filas = [];

    // Movimientos (ventas y devoluciones se abren por artículo).
    for (const mov of movimientos) {
      const base = {
        clave: `M${mov.id_movimiento_cliente}`,
        fecha: fechaTexto(mov.fecha),
        tipo: mov.tipo_movimiento,
        movimiento: NOMBRES_MOVIMIENTO[mov.tipo_movimiento] || mov.tipo_movimiento,
        numero_rollo: mov.numero_rollo,
        codigo_carro: mov.codigo_carro,
        codigo_empleado: mov.codigo_empleado,
        empleado: mov.empleado,
        orden: mov.id_movimiento_cliente
      };

      const articulos =
        mov.tipo_movimiento === 'VENTA' || mov.tipo_movimiento === 'ELIMINACION_VENTA'
          ? articulosPorVenta.get(mov.id_venta)
          : mov.tipo_movimiento === 'DEVOLUCION'
            ? articulosPorDevolucion.get(mov.id_devolucion)
            : null;

      if (articulos && articulos.length > 0) {
        articulos.forEach((articulo, indice) => {
          const esUltima = indice === articulos.length - 1;

          filas.push({
            ...base,
            clave: `${base.clave}-${indice}`,
            codigo_articulo: articulo.codigo_articulo,
            descripcion: articulo.articulo,
            cantidad: Number(articulo.cantidad),
            monto: Number(articulo.subtotal),
            // El saldo se muestra en la última línea del movimiento.
            saldo: esUltima ? Number(mov.saldo_nuevo) : null
          });
        });

        continue;
      }

      let descripcion = mov.observacion || '';

      if (mov.cliente_relacionado) {
        const direccion = mov.tipo_movimiento === 'TRANSFERENCIA_SALIDA' ? 'A' : 'DE';
        descripcion = `${direccion}: ${mov.codigo_cliente_relacionado} ${mov.cliente_relacionado}`;
      }

      filas.push({
        ...base,
        codigo_articulo: null,
        descripcion,
        cantidad: null,
        monto: Number(mov.monto),
        saldo: Number(mov.saldo_nuevo)
      });
    }

    // "SIN MONTO": el saldo es el que tenía el cliente en esa fecha.
    const cliente = clientes[0];
    const saldoInicial = movimientos.length
      ? Number(movimientos[0].saldo_anterior)
      : Number(cliente.saldo_actual || 0);

    for (const tarjeta of sinMonto) {
      const fecha = fechaTexto(tarjeta.fecha);
      const anteriores = movimientos.filter((mov) => fechaTexto(mov.fecha) <= fecha);
      const saldo = anteriores.length
        ? Number(anteriores[anteriores.length - 1].saldo_nuevo)
        : saldoInicial;

      filas.push({
        clave: `T${tarjeta.id_tarjeta_registrada}`,
        fecha,
        tipo: 'SIN_MONTO',
        movimiento: 'SIN MONTO',
        codigo_articulo: null,
        descripcion: '',
        cantidad: null,
        monto: 0,
        saldo,
        numero_rollo: tarjeta.numero_rollo,
        codigo_carro: tarjeta.codigo_carro,
        codigo_empleado: null,
        empleado: null,
        // Va después de los movimientos de ese mismo día.
        orden: Number.MAX_SAFE_INTEGER - 1
      });
    }

    filas.sort((a, b) => (a.fecha === b.fecha ? a.orden - b.orden : a.fecha.localeCompare(b.fecha)));

    return res.json({
      cliente,
      filas
    });
  } catch (error) {
    console.error('Error obteniendo historial del cliente:', error);

    return res.status(500).json({
      mensaje: 'Error al consultar el historial del cliente',
      error: error.message
    });
  }
};

module.exports = {
  obtenerHistorialCliente
};