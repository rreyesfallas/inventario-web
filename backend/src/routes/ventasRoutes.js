const express = require('express');
const router = express.Router();

const ventasController = require('../controllers/ventasController');

router.get('/boleta/:numero_boleta', ventasController.buscarBoleta);
router.post('/', ventasController.registrarVenta);
router.patch('/:id_venta/eliminar', ventasController.eliminarVenta);

module.exports = router;