const express = require('express');
const router = express.Router();

const {
  registrarAbono,
  registrarDescuento,
  registrarVenta,
  registrarTransferencia,
  listarMovimientosCliente,
  listarHistorialCliente,
  cambiarFechaAbono,
  cambiarEmpleadoAbono,
  eliminarAbono,
  eliminarDescuento,
  eliminarTransferencia
} = require('../controllers/transacciones.controller');

const {
  listarVentasClienteDevolucion,
  obtenerBoletaSugerida,
  registrarDevolucion
} = require('../controllers/devoluciones.controller');


router.get('/', listarMovimientosCliente);
router.get('/cliente/:id', listarHistorialCliente);
router.get('/devolucion/boleta-sugerida', obtenerBoletaSugerida);
router.get('/devolucion/cliente/:id/ventas', listarVentasClienteDevolucion);

router.post('/abono', registrarAbono);
router.post('/descuento', registrarDescuento);
router.post('/venta', registrarVenta);
router.post('/devolucion', registrarDevolucion);
router.post('/transferencia', registrarTransferencia);

router.patch('/abono/:id/fecha', cambiarFechaAbono);
router.patch('/abono/:id/empleado', cambiarEmpleadoAbono);
router.patch('/:id/eliminar-abono', eliminarAbono);
router.patch('/descuento/:id/eliminar', eliminarDescuento);
router.patch('/transferencia/:id/eliminar', eliminarTransferencia);

module.exports = router;