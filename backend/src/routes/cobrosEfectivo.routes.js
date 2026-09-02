const express = require('express');
const router = express.Router();

const {
  registrarCobroEfectivo,
  listarCobrosEfectivo,
  obtenerDetalleCobroEfectivo
} = require('../controllers/cobrosEfectivo.controller');

router.get('/', listarCobrosEfectivo);
router.get('/:id/detalle', obtenerDetalleCobroEfectivo);
router.post('/', registrarCobroEfectivo);

module.exports = router;