const express = require('express');
const router = express.Router();

const {
  listarTarjetasRegistradas,
  registrarTarjeta,
  anularTarjeta
} = require('../controllers/tarjetas.controller');

router.get('/', listarTarjetasRegistradas);
router.post('/', registrarTarjeta);
router.patch('/:id/anular', anularTarjeta);

module.exports = router;