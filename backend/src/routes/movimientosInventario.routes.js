const express = require('express');
const router = express.Router();

const {
  registrarMovimiento,
  listarExistencias,
  listarMovimientos,
  obtenerDetalleMovimiento
} = require('../controllers/movimientosInventario.controller');

router.get('/existencias', listarExistencias);
router.get('/', listarMovimientos);
router.get('/:id/detalle', obtenerDetalleMovimiento);
router.post('/', registrarMovimiento);

module.exports = router;