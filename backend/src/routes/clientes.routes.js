const express = require('express');
const router = express.Router();

const {
  listarClientes,
  crearCliente,
  modificarCliente,
  desactivarCliente
} = require('../controllers/clientes.controller');

router.get('/', listarClientes);
router.post('/', crearCliente);
router.put('/:id', modificarCliente);
router.patch('/:id/desactivar', desactivarCliente);

module.exports = router;