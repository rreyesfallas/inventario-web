const { sql, getConnection } = require('../config/db');

const listarEmpleados = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        id_empleado,
        codigo,
        nombre,
        estado
      FROM empleados
      WHERE estado = 'A'
      ORDER BY nombre
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando empleados:', error);

    res.status(500).json({
      mensaje: 'Error al listar empleados',
      error: error.message
    });
  }
};

const crearEmpleado = async (req, res) => {
  try {
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        mensaje: 'Código y nombre son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .query(`
        SELECT id_empleado
        FROM empleados
        WHERE codigo = @codigo
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe un empleado con ese código'
      });
    }

    await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('nombre', sql.VarChar, nombre.trim().toUpperCase())
      .query(`
        INSERT INTO empleados (
          codigo,
          nombre
        )
        VALUES (
          @codigo,
          @nombre
        )
      `);

    res.status(201).json({
      mensaje: 'Empleado creado correctamente'
    });
  } catch (error) {
    console.error('Error creando empleado:', error);

    res.status(500).json({
      mensaje: 'Error al crear empleado',
      error: error.message
    });
  }
};

const modificarEmpleado = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, nombre } = req.body;

    if (!codigo || !nombre) {
      return res.status(400).json({
        mensaje: 'Código y nombre son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('id_empleado', sql.Int, Number(id))
      .query(`
        SELECT id_empleado
        FROM empleados
        WHERE codigo = @codigo
          AND id_empleado <> @id_empleado
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro empleado con ese código'
      });
    }

    const result = await pool.request()
      .input('id_empleado', sql.Int, Number(id))
      .input('codigo', sql.VarChar, codigo.trim())
      .input('nombre', sql.VarChar, nombre.trim().toUpperCase())
      .query(`
        UPDATE empleados
        SET codigo = @codigo,
            nombre = @nombre
        WHERE id_empleado = @id_empleado
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Empleado no encontrado'
      });
    }

    res.json({
      mensaje: 'Empleado modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando empleado:', error);

    res.status(500).json({
      mensaje: 'Error al modificar empleado',
      error: error.message
    });
  }
};

const desactivarEmpleado = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_empleado', sql.Int, Number(id))
      .query(`
        UPDATE empleados
        SET estado = 'I'
        WHERE id_empleado = @id_empleado
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Empleado no encontrado'
      });
    }

    res.json({
      mensaje: 'Empleado desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando empleado:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar empleado',
      error: error.message
    });
  }
};

module.exports = {
  listarEmpleados,
  crearEmpleado,
  modificarEmpleado,
  desactivarEmpleado
};