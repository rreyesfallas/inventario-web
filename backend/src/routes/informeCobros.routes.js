const express = require('express');
const router = express.Router();

const {
  obtenerInformeCobros,
   reporteCobrosRollo,
   reporteVentasDevoluciones
} = require('../controllers/informeCobros.controller');

router.get('/', obtenerInformeCobros);
router.get('/reportes', reporteCobrosRollo);
router.get('/ventas-devoluciones', reporteVentasDevoluciones);

module.exports = router;