const express = require('express');
const router = express.Router();

const {
  listarArticulos,
  crearArticulo,
  modificarArticulo,
  desactivarArticulo
} = require('../controllers/articulos.controller');

router.get('/', listarArticulos);
router.post('/', crearArticulo);
router.put('/:id', modificarArticulo);
router.patch('/:id/desactivar', desactivarArticulo);

module.exports = router;