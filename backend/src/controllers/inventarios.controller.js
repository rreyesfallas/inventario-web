const { sql, getConnection } = require('../config/db');

const esEnteroPositivo = (valor) => Number.isInteger(valor) && valor > 0;
const maxDosDecimales = (valor) => Math.abs(valor * 100 - Math.round(valor * 100)) < 0.000001;
const redondear = (valor) => Math.round(Number(valor) * 100) / 100;

/* ------------------------------------------------------------
   GET /api/inventarios/articulo?id_bodega=3&codigo=101104
   Datos del artículo para la toma: descripción, costo,
   existencia en la bodega y la toma pendiente (si ya se contó).
   ------------------------------------------------------------ */
const buscarArticuloToma = async (req, res) => {
  const idBodega = Number(req.query.id_bodega);
  const codigo = String(req.query.codigo || '').trim();

  if (!esEnteroPositivo(idBodega) || !codigo) {
    return res.status(400).json({ mensaje: 'Debe indicar la bodega y el código del artículo' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_bodega', sql.Int, idBodega)
      .input('codigo', sql.VarChar(30), codigo)
      .query(`
        SELECT
          a.id_articulo,
          a.codigo,
          a.descripcion,
          a.costo,
          ISNULL(e.existencia, 0) AS existencia,
          t.id_toma,
          t.cantidad_fisica AS toma_pendiente
        FROM articulos a
        LEFT JOIN existencias_bodega e
          ON e.id_articulo = a.id_articulo
         AND e.id_bodega = @id_bodega
        LEFT JOIN tomas_fisicas t
          ON t.id_articulo = a.id_articulo
         AND t.id_bodega = @id_bodega
         AND t.estado = 'P'
        WHERE a.codigo = @codigo
          AND a.estado = 'A'
      `);

    if (resultado.recordset.length === 0) {
      return res.status(404).json({ mensaje: `No existe un artículo activo con el código ${codigo}` });
    }

    return res.json(resultado.recordset[0]);
  } catch (error) {
    console.error('Error buscando artículo para toma física:', error);

    return res.status(500).json({
      mensaje: 'Error al buscar el artículo',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   GET /api/inventarios/tomas?id_bodega=3
   Tomas pendientes de la bodega (lo que ya se contó).
   ------------------------------------------------------------ */
const listarTomasPendientes = async (req, res) => {
  const idBodega = Number(req.query.id_bodega);

  if (!esEnteroPositivo(idBodega)) {
    return res.status(400).json({ mensaje: 'Debe indicar una bodega válida' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_bodega', sql.Int, idBodega)
      .query(`
        SELECT
          t.id_toma,
          t.id_articulo,
          a.codigo,
          a.descripcion,
          t.costo,
          t.existencia_sistema,
          t.cantidad_fisica,
          t.cantidad_fisica - t.existencia_sistema AS diferencia,
          t.fecha,
          ISNULL(t.fecha_actualizacion, t.fecha_creacion) AS ultima_modificacion
        FROM tomas_fisicas t
        INNER JOIN articulos a ON a.id_articulo = t.id_articulo
        WHERE t.id_bodega = @id_bodega
          AND t.estado = 'P'
        ORDER BY ISNULL(t.fecha_actualizacion, t.fecha_creacion) DESC, t.id_toma DESC
      `);

    return res.json(resultado.recordset);
  } catch (error) {
    console.error('Error listando tomas físicas:', error);

    return res.status(500).json({
      mensaje: 'Error al consultar las tomas físicas',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   POST /api/inventarios/tomas
   body: { id_bodega, id_articulo, cantidad }
   Registra el conteo. Si el artículo ya se había contado en
   esa bodega (toma pendiente), lo reemplaza.
   ------------------------------------------------------------ */
const registrarToma = async (req, res) => {
  const idBodega = Number(req.body.id_bodega);
  const idArticulo = Number(req.body.id_articulo);
  const cantidad = Number(req.body.cantidad);

  if (!esEnteroPositivo(idBodega) || !esEnteroPositivo(idArticulo)) {
    return res.status(400).json({ mensaje: 'Debe indicar la bodega y el artículo' });
  }

  if (
    req.body.cantidad === undefined ||
    req.body.cantidad === null ||
    String(req.body.cantidad).trim() === '' ||
    !Number.isFinite(cantidad) ||
    cantidad < 0 ||
    !maxDosDecimales(cantidad)
  ) {
    return res.status(400).json({
      mensaje: 'La toma debe ser un número mayor o igual a cero (máximo dos decimales)'
    });
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

    // Bodega y artículo activos, con existencia y costo actuales.
    const resultadoDatos = await consulta()
      .input('id_bodega', sql.Int, idBodega)
      .input('id_articulo', sql.Int, idArticulo)
      .query(`
        SELECT
          (SELECT COUNT(*) FROM bodegas WHERE id_bodega = @id_bodega AND estado = 'A') AS bodega_ok,
          a.codigo,
          a.descripcion,
          a.costo,
          ISNULL(e.existencia, 0) AS existencia
        FROM articulos a
        LEFT JOIN existencias_bodega e
          ON e.id_articulo = a.id_articulo
         AND e.id_bodega = @id_bodega
        WHERE a.id_articulo = @id_articulo
          AND a.estado = 'A'
      `);

    if (resultadoDatos.recordset.length === 0) {
      return cancelar(400, 'El artículo no existe o está inactivo');
    }

    const datos = resultadoDatos.recordset[0];

    if (!datos.bodega_ok) {
      return cancelar(400, 'La bodega no existe o está inactiva');
    }

    // Reemplaza la toma pendiente o crea una nueva.
    const resultadoToma = await consulta()
      .input('id_bodega', sql.Int, idBodega)
      .input('id_articulo', sql.Int, idArticulo)
      .input('cantidad', sql.Decimal(12, 2), cantidad)
      .input('existencia', sql.Decimal(12, 2), Number(datos.existencia))
      .input('costo', sql.Decimal(12, 2), Number(datos.costo || 0))
      .query(`
        DECLARE @resultado TABLE (id_toma INT, accion VARCHAR(20));

        UPDATE tomas_fisicas WITH (UPDLOCK, HOLDLOCK)
        SET cantidad_fisica = @cantidad,
            existencia_sistema = @existencia,
            costo = @costo,
            fecha = CAST(GETDATE() AS DATE),
            fecha_actualizacion = GETDATE()
        OUTPUT INSERTED.id_toma, 'ACTUALIZADA' INTO @resultado
        WHERE id_bodega = @id_bodega
          AND id_articulo = @id_articulo
          AND estado = 'P';

        IF NOT EXISTS (SELECT 1 FROM @resultado)
          INSERT INTO tomas_fisicas (id_bodega, id_articulo, cantidad_fisica, existencia_sistema, costo)
          OUTPUT INSERTED.id_toma, 'REGISTRADA' INTO @resultado
          VALUES (@id_bodega, @id_articulo, @cantidad, @existencia, @costo);

        SELECT id_toma, accion FROM @resultado;
      `);

    await transaction.commit();
    finalizada = true;

    const { id_toma: idToma, accion } = resultadoToma.recordset[0];
    const diferencia = redondear(cantidad - Number(datos.existencia));

    return res.status(201).json({
      mensaje: accion === 'ACTUALIZADA' ? 'Toma física actualizada' : 'Toma física registrada',
      accion,
      toma: {
        id_toma: idToma,
        id_articulo: idArticulo,
        codigo: datos.codigo,
        descripcion: datos.descripcion,
        costo: Number(datos.costo || 0),
        existencia_sistema: Number(datos.existencia),
        cantidad_fisica: cantidad,
        diferencia
      }
    });
  } catch (error) {
    if (transaction && !finalizada) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        console.error('Error haciendo rollback:', rollbackError);
      }
    }

    console.error('Error registrando toma física:', error);

    return res.status(500).json({
      mensaje: 'Error al registrar la toma física',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   PATCH /api/inventarios/tomas/:id/anular
   Anula una toma pendiente (digitada por error).
   ------------------------------------------------------------ */
const anularToma = async (req, res) => {
  const idToma = Number(req.params.id);

  if (!esEnteroPositivo(idToma)) {
    return res.status(400).json({ mensaje: 'Identificador de toma no válido' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_toma', sql.Int, idToma)
      .query(`
        UPDATE tomas_fisicas
        SET estado = 'I',
            fecha_actualizacion = GETDATE()
        WHERE id_toma = @id_toma
          AND estado = 'P'
      `);

    if (resultado.rowsAffected[0] === 0) {
      return res.status(404).json({ mensaje: 'La toma no existe o ya no está pendiente' });
    }

    return res.json({ mensaje: 'Toma física anulada' });
  } catch (error) {
    console.error('Error anulando toma física:', error);

    return res.status(500).json({
      mensaje: 'Error al anular la toma física',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   GET /api/inventarios/resultado?id_bodega=3
   Resultado de inventario: existencia del sistema vs. toma física.
   Incluye los artículos con existencia en la bodega y los que
   tienen toma pendiente. Los no contados salen con toma 0.
   ------------------------------------------------------------ */
const reporteResultadoInventario = async (req, res) => {
  const idBodega = Number(req.query.id_bodega);

  if (!esEnteroPositivo(idBodega)) {
    return res.status(400).json({ mensaje: 'Debe indicar una bodega válida' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_bodega', sql.Int, idBodega)
      .query(`
        SELECT id_bodega, codigo, descripcion
        FROM bodegas
        WHERE id_bodega = @id_bodega;

        SELECT
          a.id_articulo,
          a.codigo,
          a.descripcion,
          -- Si ya se contó: costo y existencia del momento del conteo.
          ISNULL(t.costo, a.costo) AS costo,
          ISNULL(t.existencia_sistema, ISNULL(e.existencia, 0)) AS existencia,
          ISNULL(t.cantidad_fisica, 0) AS toma,
          CASE WHEN t.id_toma IS NULL THEN 0 ELSE 1 END AS contado,
          t.fecha AS fecha_toma
        FROM articulos a
        LEFT JOIN existencias_bodega e
          ON e.id_articulo = a.id_articulo
         AND e.id_bodega = @id_bodega
        LEFT JOIN tomas_fisicas t
          ON t.id_articulo = a.id_articulo
         AND t.id_bodega = @id_bodega
         AND t.estado = 'P'
        WHERE a.estado = 'A'
          AND (ISNULL(e.existencia, 0) <> 0 OR t.id_toma IS NOT NULL)
        ORDER BY TRY_CAST(a.codigo AS BIGINT), a.codigo;
      `);

    const [bodegas, filas] = resultado.recordsets;

    if (bodegas.length === 0) {
      return res.status(404).json({ mensaje: 'La bodega no existe' });
    }

    const articulos = filas.map((fila) => {
      const diferencia = redondear(Number(fila.toma) - Number(fila.existencia));

      return {
        ...fila,
        contado: Boolean(fila.contado),
        diferencia,
        diferencia_monto: redondear(diferencia * Number(fila.costo || 0))
      };
    });

    return res.json({
      bodega: bodegas[0],
      articulos,
      totales: {
        articulos: articulos.length,
        contados: articulos.filter((item) => item.contado).length,
        sin_contar: articulos.filter((item) => !item.contado).length,
        diferencia_monto: redondear(
          articulos.reduce((suma, item) => suma + item.diferencia_monto, 0)
        ),
        faltante_monto: redondear(
          articulos
            .filter((item) => item.diferencia_monto < 0)
            .reduce((suma, item) => suma + item.diferencia_monto, 0)
        ),
        sobrante_monto: redondear(
          articulos
            .filter((item) => item.diferencia_monto > 0)
            .reduce((suma, item) => suma + item.diferencia_monto, 0)
        )
      }
    });
  } catch (error) {
    console.error('Error generando resultado de inventario:', error);

    return res.status(500).json({
      mensaje: 'Error al generar el resultado de inventario',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   GET /api/inventarios/existencias?id_bodega=
   Reporte de existencias según bodega (hoja para la toma física).
   Trae TODOS los artículos activos; los que no tienen registro
   en la bodega salen con existencia 0, como el sistema anterior.
   ------------------------------------------------------------ */
const reporteExistenciasBodega = async (req, res) => {
  const idBodega = Number(req.query.id_bodega);

  if (!esEnteroPositivo(idBodega)) {
    return res.status(400).json({ mensaje: 'Debe indicar una bodega válida' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_bodega', sql.Int, idBodega)
      .query(`
        SELECT id_bodega, codigo, descripcion
        FROM bodegas
        WHERE id_bodega = @id_bodega;

        SELECT
          a.id_articulo,
          a.codigo,
          a.descripcion,
          a.precio,
          ISNULL(e.existencia, 0) AS existencia,
          a.precio * ISNULL(e.existencia, 0) AS subtotal,
          a.id_linea,
          l.descripcion AS linea
        FROM articulos a
        LEFT JOIN existencias_bodega e
          ON e.id_articulo = a.id_articulo
         AND e.id_bodega = @id_bodega
        LEFT JOIN lineas_articulo l
          ON l.id_linea = a.id_linea
        WHERE a.estado = 'A'
        ORDER BY TRY_CAST(a.codigo AS BIGINT), a.codigo;
      `);

    const [bodegas, filas] = resultado.recordsets;

    if (bodegas.length === 0) {
      return res.status(404).json({ mensaje: 'La bodega no existe' });
    }

    const articulos = filas.map((fila) => ({
      ...fila,
      precio: Number(fila.precio || 0),
      existencia: Number(fila.existencia || 0),
      subtotal: redondear(fila.subtotal || 0)
    }));

    return res.json({
      bodega: bodegas[0],
      articulos,
      totales: {
        articulos: articulos.length,
        con_existencia: articulos.filter((item) => item.existencia !== 0).length,
        existencia: redondear(articulos.reduce((suma, item) => suma + item.existencia, 0)),
        subtotal: redondear(articulos.reduce((suma, item) => suma + item.subtotal, 0))
      }
    });
  } catch (error) {
    console.error('Error generando existencias según bodega:', error);

    return res.status(500).json({
      mensaje: 'Error al generar el reporte de existencias',
      error: error.message
    });
  }
};

module.exports = {
  buscarArticuloToma,
  listarTomasPendientes,
  registrarToma,
  anularToma,
  reporteResultadoInventario,
  reporteExistenciasBodega
};
