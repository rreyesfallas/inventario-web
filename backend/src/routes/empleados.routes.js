const express = require('express');
const router = express.Router();

const {
  listarEmpleados,
  crearEmpleado,
  modificarEmpleado,
  desactivarEmpleado
} = require('../controllers/empleados.controller');

router.get('/', listarEmpleados);
router.post('/', crearEmpleado);
router.put('/:id', modificarEmpleado);
router.patch('/:id/desactivar', desactivarEmpleado);

module.exports = router;