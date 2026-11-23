const express = require('express');
const router = express.Router();

const {
  buscarArticuloToma,
  listarTomasPendientes,
  registrarToma,
  anularToma,
  reporteResultadoInventario,
  reporteExistenciasBodega
} = require('../controllers/inventarios.controller');

router.get('/articulo', buscarArticuloToma);
router.get('/tomas', listarTomasPendientes);
router.post('/tomas', registrarToma);
router.patch('/tomas/:id/anular', anularToma);
router.get('/resultado', reporteResultadoInventario);
router.get('/existencias', reporteExistenciasBodega);

module.exports = router;