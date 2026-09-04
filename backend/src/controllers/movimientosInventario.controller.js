const { sql, getConnection } = require('../config/db');

const registrarMovimiento = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      numero_boleta,
      id_bodega,
      fecha,
      tipo_movimiento,
      detalle
    } = req.body;

    if (!numero_boleta || !id_bodega || !fecha || !tipo_movimiento) {
      return res.status(400).json({
        mensaje: 'Número de boleta, bodega, fecha y tipo de movimiento son obligatorios'
      });
    }

    if (!Array.isArray(detalle) || detalle.length === 0) {
      return res.status(400).json({
        mensaje: 'Debe agregar al menos un artículo al movimiento'
      });
    }

    if (!['E', 'S'].includes(tipo_movimiento)) {
      return res.status(400).json({
        mensaje: 'El tipo de movimiento debe ser E o S'
      });
    }

    await transaction.begin();

    const requestExiste = new sql.Request(transaction);

    const existeBoleta = await requestExiste
      .input('numero_boleta', sql.VarChar, numero_boleta.trim())
      .query(`
        SELECT id_movimiento
        FROM movimientos_inventario
        WHERE numero_boleta = @numero_boleta
      `);

    if (existeBoleta.recordset.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'Ya existe un movimiento con ese número de boleta'
      });
    }

    let total = 0;

    for (const item of detalle) {
      const cantidad = Number(item.cantidad);
      const precio = Number(item.precio);

      if (!item.id_articulo || cantidad <= 0 || precio < 0) {
        await transaction.rollback();

        return res.status(400).json({
          mensaje: 'Cada detalle debe tener artículo, cantidad válida y precio válido'
        });
      }

      total += cantidad * precio;
    }

    const requestEncabezado = new sql.Request(transaction);

    const encabezado = await requestEncabezado
      .input('numero_boleta', sql.VarChar, numero_boleta.trim())
      .input('id_bodega', sql.Int, Number(id_bodega))
      .input('fecha', sql.Date, fecha)
      .input('tipo_movimiento', sql.VarChar, tipo_movimiento)
      .input('total', sql.Decimal(14, 2), total)
      .query(`
        INSERT INTO movimientos_inventario (
          numero_boleta,
          id_bodega,
          fecha,
          tipo_movimiento,
          total
        )
        OUTPUT INSERTED.id_movimiento
        VALUES (
          @numero_boleta,
          @id_bodega,
          @fecha,
          @tipo_movimiento,
          @total
        )
      `);

    const idMovimiento = encabezado.recordset[0].id_movimiento;

    for (const item of detalle) {
      const idArticulo = Number(item.id_articulo);
      const cantidad = Number(item.cantidad);
      const precio = Number(item.precio);
      const subtotal = cantidad * precio;

      const requestDetalle = new sql.Request(transaction);

      await requestDetalle
        .input('id_movimiento', sql.Int, idMovimiento)
        .input('id_articulo', sql.Int, idArticulo)
        .input('cantidad', sql.Decimal(12, 2), cantidad)
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

      const requestExistencia = new sql.Request(transaction);

      const existenciaActual = await requestExistencia
        .input('id_bodega', sql.Int, Number(id_bodega))
        .input('id_articulo', sql.Int, idArticulo)
        .query(`
          SELECT existencia
          FROM existencias_bodega
          WHERE id_bodega = @id_bodega
            AND id_articulo = @id_articulo
        `);

      if (existenciaActual.recordset.length === 0) {
        if (tipo_movimiento === 'S') {
          await transaction.rollback();

          return res.status(400).json({
            mensaje: 'No hay existencia disponible para uno de los artículos'
          });
        }

        const requestCrearExistencia = new sql.Request(transaction);

        await requestCrearExistencia
          .input('id_bodega', sql.Int, Number(id_bodega))
          .input('id_articulo', sql.Int, idArticulo)
          .input('existencia', sql.Decimal(12, 2), cantidad)
          .query(`
            INSERT INTO existencias_bodega (
              id_bodega,
              id_articulo,
              existencia
            )
            VALUES (
              @id_bodega,
              @id_articulo,
              @existencia
            )
          `);
      } else {
        const existencia = Number(existenciaActual.recordset[0].existencia);

        let nuevaExistencia = existencia;

        if (tipo_movimiento === 'E') {
          nuevaExistencia = existencia + cantidad;
        } else {
          nuevaExistencia = existencia - cantidad;
        }

        if (nuevaExistencia < 0) {
          await transaction.rollback();

          return res.status(400).json({
            mensaje: 'La salida no puede dejar existencia negativa'
          });
        }

        const requestActualizarExistencia = new sql.Request(transaction);

        await requestActualizarExistencia
          .input('id_bodega', sql.Int, Number(id_bodega))
          .input('id_articulo', sql.Int, idArticulo)
          .input('existencia', sql.Decimal(12, 2), nuevaExistencia)
          .query(`
            UPDATE existencias_bodega
            SET existencia = @existencia,
                fecha_actualizacion = GETDATE()
            WHERE id_bodega = @id_bodega
              AND id_articulo = @id_articulo
          `);
      }
    }

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Movimiento registrado correctamente',
      id_movimiento: idMovimiento,
      total
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error registrando movimiento:', error);

    res.status(500).json({
      mensaje: 'Error al registrar movimiento',
      error: error.message
    });
  }
};

const listarExistencias = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        eb.id_existencia,
        eb.id_bodega,
        b.codigo AS codigo_bodega,
        b.descripcion AS bodega,
        a.codigo AS codigo_articulo,
        a.descripcion AS articulo,
        a.precio,
        l.descripcion AS linea,
        eb.existencia,
        eb.fecha_actualizacion
      FROM existencias_bodega eb
      INNER JOIN bodegas b
        ON eb.id_bodega = b.id_bodega
      INNER JOIN articulos a
        ON eb.id_articulo = a.id_articulo
      LEFT JOIN lineas_articulo l
        ON a.id_linea = l.id_linea
      ORDER BY b.codigo, a.codigo
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando existencias:', error);

    res.status(500).json({
      mensaje: 'Error al listar existencias',
      error: error.message
    });
  }
};

const listarMovimientos = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        mi.id_movimiento,
        mi.numero_boleta,
        mi.id_bodega,
        b.codigo AS codigo_bodega,
        b.descripcion AS bodega,
        mi.fecha,
        mi.tipo_movimiento,
        CASE 
          WHEN mi.tipo_movimiento = 'E' THEN 'Entrada'
          WHEN mi.tipo_movimiento = 'S' THEN 'Salida'
        END AS tipo_movimiento_descripcion,
        mi.total,
        mi.estado,
        mi.fecha_creacion
      FROM movimientos_inventario mi
      INNER JOIN bodegas b
        ON mi.id_bodega = b.id_bodega
      WHERE mi.estado = 'A'
      ORDER BY mi.fecha_creacion DESC
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando movimientos:', error);

    res.status(500).json({
      mensaje: 'Error al listar movimientos',
      error: error.message
    });
  }
};

  const obtenerDetalleMovimiento = async (req, res) => {
    try {
      const { id } = req.params;

      const pool = await getConnection();

      const result = await pool.request()
        .input('id_movimiento', sql.Int, Number(id))
        .query(`
          SELECT
            mid.id_detalle,
            mid.id_movimiento,
            mid.id_articulo,
            a.codigo AS codigo_articulo,
            a.descripcion AS articulo,
            mid.cantidad,
            mid.precio,
            mid.subtotal
          FROM movimientos_inventario_detalle mid
          INNER JOIN articulos a
            ON mid.id_articulo = a.id_articulo
          WHERE mid.id_movimiento = @id_movimiento
          ORDER BY a.descripcion
        `);

      res.json(result.recordset);
    } catch (error) {
      console.error('Error obteniendo detalle del movimiento:', error);

      res.status(500).json({
        mensaje: 'Error al obtener detalle del movimiento',
        error: error.message
      });
    }
  };

module.exports = {
  registrarMovimiento,
  listarExistencias,
  listarMovimientos,
  obtenerDetalleMovimiento
};