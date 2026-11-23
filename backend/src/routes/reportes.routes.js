const express = require('express');
const router = express.Router();

const {
  reporteDesempenoEmpleados,
  reporteEstadisticasRollos,
  reporteVentasPorCarro
} = require('../controllers/reportes.controller');

router.get('/desempeno-empleados', reporteDesempenoEmpleados);
router.get('/estadisticas-rollos', reporteEstadisticasRollos);
router.get('/ventas-carro', reporteVentasPorCarro);

module.exports = router;