const { sql, getConnection } = require('../config/db');

const listarBodegas = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        id_bodega,
        codigo,
        descripcion,
        estado
      FROM bodegas
      WHERE estado = 'A'
      ORDER BY codigo
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando bodegas:', error);

    res.status(500).json({
      mensaje: 'Error al listar bodegas',
      error: error.message
    });
  }
};

const crearBodega = async (req, res) => {
  try {
    const { codigo, descripcion } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({
        mensaje: 'Código y descripción son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .query(`
        SELECT id_bodega
        FROM bodegas
        WHERE codigo = @codigo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe una bodega con ese código'
      });
    }

    await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .query(`
        INSERT INTO bodegas (
          codigo,
          descripcion
        )
        VALUES (
          @codigo,
          @descripcion
        )
      `);

    res.status(201).json({
      mensaje: 'Bodega creada correctamente'
    });
  } catch (error) {
    console.error('Error creando bodega:', error);

    res.status(500).json({
      mensaje: 'Error al crear bodega',
      error: error.message
    });
  }
};

const modificarBodega = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({
        mensaje: 'Código y descripción son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('id_bodega', sql.Int, Number(id))
      .query(`
        SELECT id_bodega
        FROM bodegas
        WHERE codigo = @codigo
          AND id_bodega <> @id_bodega
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otra bodega con ese código'
      });
    }

    const result = await pool.request()
      .input('id_bodega', sql.Int, Number(id))
      .input('codigo', sql.VarChar, codigo.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .query(`
        UPDATE bodegas
        SET codigo = @codigo,
            descripcion = @descripcion
        WHERE id_bodega = @id_bodega
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Bodega no encontrada'
      });
    }

    res.json({
      mensaje: 'Bodega modificada correctamente'
    });
  } catch (error) {
    console.error('Error modificando bodega:', error);

    res.status(500).json({
      mensaje: 'Error al modificar bodega',
      error: error.message
    });
  }
};

const desactivarBodega = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_bodega', sql.Int, Number(id))
      .query(`
        UPDATE bodegas
        SET estado = 'I'
        WHERE id_bodega = @id_bodega
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Bodega no encontrada'
      });
    }

    res.json({
      mensaje: 'Bodega desactivada correctamente'
    });
  } catch (error) {
    console.error('Error desactivando bodega:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar bodega',
      error: error.message
    });
  }
};

module.exports = {
  listarBodegas,
  crearBodega,
  modificarBodega,
  desactivarBodega
};