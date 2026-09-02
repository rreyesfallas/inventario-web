const bcrypt = require('bcryptjs');
const { sql, getConnection } = require('../config/db');

const listarUsuarios = async (req, res) => {
  try {
    const pool = await getConnection();

    const resultado = await pool.request().query(`
      SELECT
        id_usuario,
        login,
        nombre,
        nivel,
        estado,
        debe_cambiar_clave,
        fecha_creacion
      FROM usuarios
      WHERE estado = 'A'
      ORDER BY nombre
    `);

    res.json(resultado.recordset);
  } catch (error) {
    console.error('Error listando usuarios:', error);

    res.status(500).json({
      mensaje: 'Error al listar usuarios',
      error: error.message
    });
  }
};

const crearUsuario = async (req, res) => {
  try {
    const {
      login,
      nombre,
      password,
      nivel
    } = req.body;

    if (!login || !nombre || !password || !nivel) {
      return res.status(400).json({
        mensaje: 'Usuario, nombre, contraseña y nivel son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('login', sql.VarChar(50), login)
      .query(`
        SELECT id_usuario
        FROM usuarios
        WHERE login = @login
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe un usuario con ese login'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.request()
      .input('login', sql.VarChar(50), login)
      .input('nombre', sql.VarChar(150), nombre)
      .input('password_hash', sql.VarChar(255), passwordHash)
      .input('nivel', sql.VarChar(30), nivel)
      .query(`
        INSERT INTO usuarios (
          login,
          nombre,
          password_hash,
          nivel,
          estado,
          debe_cambiar_clave
        )
        VALUES (
          @login,
          @nombre,
          @password_hash,
          @nivel,
          'A',
          'S'
        )
      `);

    res.status(201).json({
      mensaje: 'Usuario creado correctamente'
    });
  } catch (error) {
    console.error('Error creando usuario:', error);

    res.status(500).json({
      mensaje: 'Error al crear usuario',
      error: error.message
    });
  }
};

const modificarUsuario = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      login,
      nombre,
      nivel
    } = req.body;

    if (!login || !nombre || !nivel) {
      return res.status(400).json({
        mensaje: 'Usuario, nombre y nivel son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('id_usuario', sql.Int, Number(id))
      .input('login', sql.VarChar(50), login)
      .query(`
        SELECT id_usuario
        FROM usuarios
        WHERE login = @login
          AND id_usuario <> @id_usuario
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro usuario con ese login'
      });
    }

    await pool.request()
      .input('id_usuario', sql.Int, Number(id))
      .input('login', sql.VarChar(50), login)
      .input('nombre', sql.VarChar(150), nombre)
      .input('nivel', sql.VarChar(30), nivel)
      .query(`
        UPDATE usuarios
        SET
          login = @login,
          nombre = @nombre,
          nivel = @nivel
        WHERE id_usuario = @id_usuario
      `);

    res.json({
      mensaje: 'Usuario modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando usuario:', error);

    res.status(500).json({
      mensaje: 'Error al modificar usuario',
      error: error.message
    });
  }
};

const desactivarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { id_usuario_actual } = req.body;

    if (!id_usuario_actual) {
      return res.status(400).json({
        mensaje: 'No se recibió el usuario actual'
      });
    }

    if (Number(id) === Number(id_usuario_actual)) {
      return res.status(400).json({
        mensaje: 'No puede desactivar el usuario con el que inició sesión'
      });
    }

    const pool = await getConnection();

    await pool.request()
      .input('id_usuario', sql.Int, Number(id))
      .query(`
        UPDATE usuarios
        SET estado = 'I'
        WHERE id_usuario = @id_usuario
      `);

    res.json({
      mensaje: 'Usuario desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando usuario:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar usuario',
      error: error.message
    });
  }
};

const restablecerClave = async (req, res) => {
  try {
    const { id } = req.params;
    const { nuevaClave } = req.body;

    if (!nuevaClave) {
      return res.status(400).json({
        mensaje: 'La nueva contraseña es obligatoria'
      });
    }

    const passwordHash = await bcrypt.hash(nuevaClave, 10);

    const pool = await getConnection();

    await pool.request()
      .input('id_usuario', sql.Int, Number(id))
      .input('password_hash', sql.VarChar(255), passwordHash)
      .query(`
        UPDATE usuarios
        SET
          password_hash = @password_hash,
          debe_cambiar_clave = 'S'
        WHERE id_usuario = @id_usuario
      `);

    res.json({
      mensaje: 'Contraseña restablecida correctamente'
    });
  } catch (error) {
    console.error('Error restableciendo contraseña:', error);

    res.status(500).json({
      mensaje: 'Error al restablecer contraseña',
      error: error.message
    });
  }
};

module.exports = {
  listarUsuarios,
  crearUsuario,
  modificarUsuario,
  desactivarUsuario,
  restablecerClave
};