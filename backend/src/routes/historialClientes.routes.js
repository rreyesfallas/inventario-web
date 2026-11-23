const express = require('express');
const router = express.Router();

const { obtenerHistorialCliente } = require('../controllers/historialClientes.controller');

router.get('/:id', obtenerHistorialCliente);

module.exports = router;