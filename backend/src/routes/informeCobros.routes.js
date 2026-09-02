const express = require('express');
const router = express.Router();

const {
  obtenerInformeCobros
} = require('../controllers/informeCobros.controller');

router.get('/', obtenerInformeCobros);

module.exports = router;