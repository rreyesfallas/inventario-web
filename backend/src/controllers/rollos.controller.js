const { sql, getConnection } = require('../config/db');

const listarRollos = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        r.id_rollo,
        r.numero,
        r.descripcion,
        r.dia_cobro,
        r.id_vehiculo,
        v.codigo AS codigo_vehiculo,
        v.descripcion AS vehiculo,
        r.estado
      FROM rollos r
      LEFT JOIN vehiculos v
        ON r.id_vehiculo = v.id_vehiculo
      WHERE r.estado = 'A'
      ORDER BY r.numero
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando rollos:', error);

    res.status(500).json({
      mensaje: 'Error al listar rollos',
      error: error.message
    });
  }
};

const crearRollo = async (req, res) => {
  try {
    const { numero, descripcion, dia_cobro, id_vehiculo } = req.body;

    if (!numero || !descripcion || !dia_cobro) {
      return res.status(400).json({
        mensaje: 'Número, descripción y día de cobro son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('numero', sql.VarChar, numero.trim())
      .query(`
        SELECT id_rollo
        FROM rollos
        WHERE numero = @numero
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe un rollo con ese número'
      });
    }

    await pool.request()
      .input('numero', sql.VarChar, numero.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .input('dia_cobro', sql.VarChar, dia_cobro.trim().toUpperCase())
      .input('id_vehiculo', sql.Int, id_vehiculo ? Number(id_vehiculo) : null)
      .query(`
        INSERT INTO rollos (
          numero,
          descripcion,
          dia_cobro,
          id_vehiculo
        )
        VALUES (
          @numero,
          @descripcion,
          @dia_cobro,
          @id_vehiculo
        )
      `);

    res.status(201).json({
      mensaje: 'Rollo creado correctamente'
    });
  } catch (error) {
    console.error('Error creando rollo:', error);

    res.status(500).json({
      mensaje: 'Error al crear rollo',
      error: error.message
    });
  }
};

const modificarRollo = async (req, res) => {
  try {
    const { id } = req.params;
    const { numero, descripcion, dia_cobro, id_vehiculo } = req.body;

    if (!numero || !descripcion || !dia_cobro) {
      return res.status(400).json({
        mensaje: 'Número, descripción y día de cobro son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('numero', sql.VarChar, numero.trim())
      .input('id_rollo', sql.Int, Number(id))
      .query(`
        SELECT id_rollo
        FROM rollos
        WHERE numero = @numero
          AND id_rollo <> @id_rollo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro rollo con ese número'
      });
    }

    const result = await pool.request()
      .input('id_rollo', sql.Int, Number(id))
      .input('numero', sql.VarChar, numero.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .input('dia_cobro', sql.VarChar, dia_cobro.trim().toUpperCase())
      .input('id_vehiculo', sql.Int, id_vehiculo ? Number(id_vehiculo) : null)
      .query(`
        UPDATE rollos
        SET numero = @numero,
            descripcion = @descripcion,
            dia_cobro = @dia_cobro,
            id_vehiculo = @id_vehiculo
        WHERE id_rollo = @id_rollo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Rollo no encontrado'
      });
    }

    res.json({
      mensaje: 'Rollo modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando rollo:', error);

    res.status(500).json({
      mensaje: 'Error al modificar rollo',
      error: error.message
    });
  }
};

const desactivarRollo = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_rollo', sql.Int, Number(id))
      .query(`
        UPDATE rollos
        SET estado = 'I'
        WHERE id_rollo = @id_rollo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Rollo no encontrado'
      });
    }

    res.json({
      mensaje: 'Rollo desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando rollo:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar rollo',
      error: error.message
    });
  }
};

module.exports = {
  listarRollos,
  crearRollo,
  modificarRollo,
  desactivarRollo
};