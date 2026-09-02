const express = require('express');
const router = express.Router();

const {
  listarVehiculos,
  crearVehiculo,
  modificarVehiculo,
  desactivarVehiculo
} = require('../controllers/vehiculos.controller');

router.get('/', listarVehiculos);
router.post('/', crearVehiculo);
router.put('/:id', modificarVehiculo);
router.patch('/:id/desactivar', desactivarVehiculo);

module.exports = router;