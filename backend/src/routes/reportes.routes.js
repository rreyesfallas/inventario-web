const express = require('express');
const router = express.Router();

const { reporteDesempenoEmpleados } = require('../controllers/reportes.controller');

router.get('/desempeno-empleados', reporteDesempenoEmpleados);

module.exports = router;