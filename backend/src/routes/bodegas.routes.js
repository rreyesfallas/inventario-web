const express = require('express');
const router = express.Router();

const {
  listarBodegas,
  crearBodega,
  modificarBodega,
  desactivarBodega
} = require('../controllers/bodegas.controller');

router.get('/', listarBodegas);
router.post('/', crearBodega);
router.put('/:id', modificarBodega);
router.patch('/:id/desactivar', desactivarBodega);

module.exports = router;