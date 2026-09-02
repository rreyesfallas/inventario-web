  const bcrypt = require('bcryptjs');
  const { sql, getConnection } = require('../config/db');

  const login = async (req, res) => {
    try {
      const { login, password } = req.body;

      if (!login || !password) {
        return res.status(400).json({
          mensaje: 'Usuario y contraseña son obligatorios'
        });
      }

      const pool = await getConnection();

      const resultado = await pool.request()
        .input('login', sql.VarChar(50), login)
        .query(`
          SELECT
            id_usuario,
            login,
            nombre,
            password_hash,
            nivel,
            estado,
            debe_cambiar_clave
          FROM usuarios
          WHERE login = @login
        `);

      if (resultado.recordset.length === 0) {
        return res.status(401).json({
          mensaje: 'Usuario o contraseña incorrectos'
        });
      }

      const usuario = resultado.recordset[0];

      if (usuario.estado !== 'A') {
        return res.status(403).json({
          mensaje: 'El usuario se encuentra inactivo'
        });
      }

      const passwordValida = await bcrypt.compare(password, usuario.password_hash);

      if (!passwordValida) {
        return res.status(401).json({
          mensaje: 'Usuario o contraseña incorrectos'
        });
      }

      res.json({
        mensaje: 'Inicio de sesión correcto',
        usuario: {
          id_usuario: usuario.id_usuario,
          login: usuario.login,
          nombre: usuario.nombre,
          nivel: usuario.nivel,
          debe_cambiar_clave: usuario.debe_cambiar_clave
        }
      });
    } catch (error) {
      console.error('Error en login:', error);

      res.status(500).json({
        mensaje: 'Error al iniciar sesión',
        error: error.message
      });
    }
  };

  const cambiarClave = async (req, res) => {
    try {
      const { id_usuario, claveActual, nuevaClave, confirmarClave } = req.body;

      if (!id_usuario || !claveActual || !nuevaClave || !confirmarClave) {
        return res.status(400).json({
          mensaje: 'Todos los campos son obligatorios'
        });
      }

      if (nuevaClave !== confirmarClave) {
        return res.status(400).json({
          mensaje: 'La nueva contraseña y la confirmación no coinciden'
        });
      }

      if (nuevaClave.length < 3) {
        return res.status(400).json({
          mensaje: 'La nueva contraseña debe tener al menos 3 caracteres'
        });
      }

      const pool = await getConnection();

      const resultado = await pool.request()
        .input('id_usuario', sql.Int, Number(id_usuario))
        .query(`
          SELECT
            id_usuario,
            password_hash,
            estado
          FROM usuarios
          WHERE id_usuario = @id_usuario
        `);

      if (resultado.recordset.length === 0) {
        return res.status(404).json({
          mensaje: 'Usuario no encontrado'
        });
      }

      const usuario = resultado.recordset[0];

      if (usuario.estado !== 'A') {
        return res.status(403).json({
          mensaje: 'El usuario se encuentra inactivo'
        });
      }

      const claveValida = await bcrypt.compare(claveActual, usuario.password_hash);

      if (!claveValida) {
        return res.status(401).json({
          mensaje: 'La contraseña actual es incorrecta'
        });
      }

      const nuevoHash = await bcrypt.hash(nuevaClave, 10);

      await pool.request()
        .input('id_usuario', sql.Int, Number(id_usuario))
        .input('password_hash', sql.VarChar(255), nuevoHash)
        .query(`
          UPDATE usuarios
          SET
            password_hash = @password_hash,
            debe_cambiar_clave = 'N'
          WHERE id_usuario = @id_usuario
        `);

      res.json({
        mensaje: 'Contraseña actualizada correctamente'
      });
    } catch (error) {
      console.error('Error cambiando contraseña:', error);

      res.status(500).json({
        mensaje: 'Error al cambiar contraseña',
        error: error.message
      });
    }
  };

module.exports = {
  login,
  cambiarClave
};