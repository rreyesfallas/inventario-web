
const express = require('express');
const router = express.Router();

const ventasController = require('../controllers/ventasController');

// Validar si una boleta está ocupada
router.get('/boleta/:numero_boleta', ventasController.buscarBoleta);

// Buscar todas las ventas de una boleta
router.get('/consultar/boleta/:numero_boleta', ventasController.consultarVentasPorBoleta);

// Consultar el detalle de una venta por ID
router.get('/:id_venta', ventasController.consultarVenta);

// Registrar una venta
router.post('/', ventasController.registrarVenta);

// Eliminar una venta
router.patch('/:id_venta/eliminar', ventasController.eliminarVenta);

module.exports = router;
