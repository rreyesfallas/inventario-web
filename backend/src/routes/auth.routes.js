const express = require('express');
const router = express.Router();

const {
  login,
  cambiarClave
} = require('../controllers/auth.controller');

router.post('/login', login);
router.post('/cambiar-clave', cambiarClave);

module.exports = router;