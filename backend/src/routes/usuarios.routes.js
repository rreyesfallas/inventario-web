const express = require('express');
const router = express.Router();

const {
  listarUsuarios,
  crearUsuario,
  modificarUsuario,
  desactivarUsuario,
  restablecerClave
} = require('../controllers/usuarios.controller');

router.get('/', listarUsuarios);
router.post('/', crearUsuario);
router.put('/:id', modificarUsuario);
router.patch('/:id/desactivar', desactivarUsuario);
router.patch('/:id/restablecer-clave', restablecerClave);

module.exports = router;