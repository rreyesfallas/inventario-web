const { sql, getConnection } = require('../config/db');

const listarLineas = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        id_linea,
        descripcion,
        estado
      FROM lineas_articulo
      WHERE estado = 'A'
      ORDER BY descripcion
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando líneas:', error);

    res.status(500).json({
      mensaje: 'Error al listar líneas de artículo',
      error: error.message
    });
  }
};

const crearLinea = async (req, res) => {
  try {
    const { descripcion } = req.body;

    if (!descripcion) {
      return res.status(400).json({
        mensaje: 'La descripción es obligatoria'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .query(`
        SELECT id_linea
        FROM lineas_articulo
        WHERE descripcion = @descripcion
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe una línea con esa descripción'
      });
    }

    await pool.request()
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .query(`
        INSERT INTO lineas_articulo (
          descripcion
        )
        VALUES (
          @descripcion
        )
      `);

    res.status(201).json({
      mensaje: 'Línea de artículo creada correctamente'
    });
  } catch (error) {
    console.error('Error creando línea:', error);

    res.status(500).json({
      mensaje: 'Error al crear línea de artículo',
      error: error.message
    });
  }
};

const modificarLinea = async (req, res) => {
  try {
    const { id } = req.params;
    const { descripcion } = req.body;

    if (!descripcion) {
      return res.status(400).json({
        mensaje: 'La descripción es obligatoria'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .input('id_linea', sql.Int, Number(id))
      .query(`
        SELECT id_linea
        FROM lineas_articulo
        WHERE descripcion = @descripcion
          AND id_linea <> @id_linea
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otra línea con esa descripción'
      });
    }

    const result = await pool.request()
      .input('id_linea', sql.Int, Number(id))
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .query(`
        UPDATE lineas_articulo
        SET descripcion = @descripcion
        WHERE id_linea = @id_linea
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Línea de artículo no encontrada'
      });
    }

    res.json({
      mensaje: 'Línea de artículo modificada correctamente'
    });
  } catch (error) {
    console.error('Error modificando línea:', error);

    res.status(500).json({
      mensaje: 'Error al modificar línea de artículo',
      error: error.message
    });
  }
};

const desactivarLinea = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_linea', sql.Int, Number(id))
      .query(`
        UPDATE lineas_articulo
        SET estado = 'I'
        WHERE id_linea = @id_linea
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Línea de artículo no encontrada'
      });
    }

    res.json({
      mensaje: 'Línea de artículo desactivada correctamente'
    });
  } catch (error) {
    console.error('Error desactivando línea:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar línea de artículo',
      error: error.message
    });
  }
};

module.exports = {
  listarLineas,
  crearLinea,
  modificarLinea,
  desactivarLinea
};