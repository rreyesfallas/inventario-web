const express = require('express');
const router = express.Router();

const {
  listarLineas,
  crearLinea,
  modificarLinea,
  desactivarLinea
} = require('../controllers/lineas.controller');

router.get('/', listarLineas);
router.post('/', crearLinea);
router.put('/:id', modificarLinea);
router.patch('/:id/desactivar', desactivarLinea);

module.exports = router;