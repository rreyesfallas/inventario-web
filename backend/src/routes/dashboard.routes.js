const express = require('express');
const router = express.Router();

const {
  obtenerResumenDashboard
} = require('../controllers/dashboard.controller');

router.get('/resumen', obtenerResumenDashboard);

module.exports = router;