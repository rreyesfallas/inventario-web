const { sql, getConnection } = require('../config/db');

const listarArticulos = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT 
        a.id_articulo,
        a.codigo,
        a.descripcion,
        a.id_linea,
        a.precio,
        a.estado,
        l.descripcion AS linea
      FROM articulos a
      LEFT JOIN lineas_articulo l
        ON a.id_linea = l.id_linea
      WHERE a.estado = 'A'
      ORDER BY a.descripcion
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando artículos:', error);
    res.status(500).json({
      mensaje: 'Error al listar artículos'
    });
  }
};

const crearArticulo = async (req, res) => {
  try {
    const { codigo, descripcion, id_linea, precio } = req.body;

    if (!codigo || !descripcion || !id_linea || !precio) {
      return res.status(400).json({
        mensaje: 'Código, descripción, linea   y precio son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo)
      .query(`
        SELECT id_articulo
        FROM articulos
        WHERE codigo = @codigo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe un artículo con ese código'
      });
    }

    const idLinea = id_linea ? Number(id_linea) : null;

    await pool.request()
    .input('codigo', sql.VarChar, codigo.trim())
    .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
    .input('id_linea', sql.Int, idLinea)
    .input('precio', sql.Decimal(12, 2), Number(precio))
    .query(`
        INSERT INTO articulos (
        codigo,
        descripcion,
        id_linea,
        precio
        )
        VALUES (
        @codigo,
        @descripcion,
        @id_linea,
        @precio
        )
    `);

    res.status(201).json({
      mensaje: 'Artículo creado correctamente'
    });
  } catch (error) {
    console.error('Error creando artículo:', error);

    res.status(500).json({
      mensaje: 'Error al crear artículo',
      error: error.message
    });
  }
};

const desactivarArticulo = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_articulo', sql.Int, Number(id))
      .query(`
        UPDATE articulos
        SET estado = 'I'
        WHERE id_articulo = @id_articulo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Artículo no encontrado'
      });
    }

    res.json({
      mensaje: 'Artículo desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando artículo:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar artículo',
      error: error.message
    });
  }
};

const modificarArticulo = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion, id_linea, precio } = req.body;

    if (!codigo || !descripcion || !id_linea || !precio) {
      return res.status(400).json({
        mensaje: 'Código, descripción, línea y precio son obligatorios'
      });
    }

    const pool = await getConnection();

    const existeCodigo = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('id_articulo', sql.Int, Number(id))
      .query(`
        SELECT id_articulo
        FROM articulos
        WHERE codigo = @codigo
          AND id_articulo <> @id_articulo
      `);

    if (existeCodigo.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro artículo con ese código'
      });
    }

    const result = await pool.request()
      .input('id_articulo', sql.Int, Number(id))
      .input('codigo', sql.VarChar, codigo.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .input('id_linea', sql.Int, Number(id_linea))
      .input('precio', sql.Decimal(12, 2), Number(precio))
      .query(`
        UPDATE articulos
        SET codigo = @codigo,
            descripcion = @descripcion,
            id_linea = @id_linea,
            precio = @precio
        WHERE id_articulo = @id_articulo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Artículo no encontrado'
      });
    }

    res.json({
      mensaje: 'Artículo modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando artículo:', error);

    res.status(500).json({
      mensaje: 'Error al modificar artículo',
      error: error.message
    });
  }
};

module.exports = {
  listarArticulos,
  crearArticulo,
  modificarArticulo,
  desactivarArticulo
};