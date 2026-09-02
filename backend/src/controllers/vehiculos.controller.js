const { sql, getConnection } = require('../config/db');

const listarVehiculos = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        v.id_vehiculo,
        v.codigo,
        v.descripcion,
        v.id_empleado,
        e.nombre AS empleado,
        v.estado
      FROM vehiculos v
      LEFT JOIN empleados e
        ON v.id_empleado = e.id_empleado
      WHERE v.estado = 'A'
      ORDER BY v.codigo
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando vehículos:', error);

    res.status(500).json({
      mensaje: 'Error al listar vehículos',
      error: error.message
    });
  }
};

const crearVehiculo = async (req, res) => {
  try {
    const { codigo, descripcion, id_empleado } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({
        mensaje: 'Código y descripción son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .query(`
        SELECT id_vehiculo
        FROM vehiculos
        WHERE codigo = @codigo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe un vehículo con ese código'
      });
    }

    await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .input('id_empleado', sql.Int, id_empleado ? Number(id_empleado) : null)
      .query(`
        INSERT INTO vehiculos (
          codigo,
          descripcion,
          id_empleado
        )
        VALUES (
          @codigo,
          @descripcion,
          @id_empleado
        )
      `);

    res.status(201).json({
      mensaje: 'Vehículo creado correctamente'
    });
  } catch (error) {
    console.error('Error creando vehículo:', error);

    res.status(500).json({
      mensaje: 'Error al crear vehículo',
      error: error.message
    });
  }
};

const modificarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion, id_empleado } = req.body;

    if (!codigo || !descripcion) {
      return res.status(400).json({
        mensaje: 'Código y descripción son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('id_vehiculo', sql.Int, Number(id))
      .query(`
        SELECT id_vehiculo
        FROM vehiculos
        WHERE codigo = @codigo
          AND id_vehiculo <> @id_vehiculo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro vehículo con ese código'
      });
    }

    const result = await pool.request()
      .input('id_vehiculo', sql.Int, Number(id))
      .input('codigo', sql.VarChar, codigo.trim())
      .input('descripcion', sql.VarChar, descripcion.trim().toUpperCase())
      .input('id_empleado', sql.Int, id_empleado ? Number(id_empleado) : null)
      .query(`
        UPDATE vehiculos
        SET codigo = @codigo,
            descripcion = @descripcion,
            id_empleado = @id_empleado
        WHERE id_vehiculo = @id_vehiculo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Vehículo no encontrado'
      });
    }

    res.json({
      mensaje: 'Vehículo modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando vehículo:', error);

    res.status(500).json({
      mensaje: 'Error al modificar vehículo',
      error: error.message
    });
  }
};

const desactivarVehiculo = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_vehiculo', sql.Int, Number(id))
      .query(`
        UPDATE vehiculos
        SET estado = 'I'
        WHERE id_vehiculo = @id_vehiculo
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Vehículo no encontrado'
      });
    }

    res.json({
      mensaje: 'Vehículo desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando vehículo:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar vehículo',
      error: error.message
    });
  }
};

module.exports = {
  listarVehiculos,
  crearVehiculo,
  modificarVehiculo,
  desactivarVehiculo
};