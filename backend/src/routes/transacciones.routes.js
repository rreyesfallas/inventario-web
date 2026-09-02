const express = require('express');
const router = express.Router();

const {
  registrarAbono,
  registrarVenta,
  registrarDevolucion,
  registrarTransferencia,
  listarMovimientosCliente,
  listarHistorialCliente
} = require('../controllers/transacciones.controller');

router.get('/', listarMovimientosCliente);
router.get('/cliente/:id', listarHistorialCliente);
router.post('/abono', registrarAbono);
router.post('/venta', registrarVenta);
router.post('/devolucion', registrarDevolucion);
router.post('/transferencia', registrarTransferencia);

module.exports = router;