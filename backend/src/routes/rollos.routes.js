const express = require('express');
const router = express.Router();

const {
  listarRollos,
  crearRollo,
  modificarRollo,
  desactivarRollo
} = require('../controllers/rollos.controller');

router.get('/', listarRollos);
router.post('/', crearRollo);
router.put('/:id', modificarRollo);
router.patch('/:id/desactivar', desactivarRollo);

module.exports = router;