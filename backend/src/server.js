const express = require('express');
const cors = require('cors');
require('dotenv').config();

const articulosRoutes = require('./routes/articulos.routes');
const lineasRoutes = require('./routes/lineas.routes');
const clientesRoutes = require('./routes/clientes.routes');
const rollosRoutes = require('./routes/rollos.routes');
const empleadosRoutes = require('./routes/empleados.routes');
const vehiculosRoutes = require('./routes/vehiculos.routes');
const bodegasRoutes = require('./routes/bodegas.routes');
const movimientosInventarioRoutes = require('./routes/movimientosInventario.routes');
const cobrosEfectivoRoutes = require('./routes/cobrosEfectivo.routes');
const transaccionesRoutes = require('./routes/transacciones.routes');
const informeCobrosRoutes = require('./routes/informeCobros.routes');
const authRoutes = require('./routes/auth.routes');
const usuariosRoutes = require('./routes/usuarios.routes');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    mensaje: 'API Sistema de Inventario funcionando'
  });
});

app.use('/api/articulos', articulosRoutes);
app.use('/api/lineas-articulo', lineasRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/rollos', rollosRoutes);
app.use('/api/empleados', empleadosRoutes);
app.use('/api/vehiculos', vehiculosRoutes);
app.use('/api/bodegas', bodegasRoutes);
app.use('/api/movimientos-inventario', movimientosInventarioRoutes);
app.use('/api/cobros-efectivo', cobrosEfectivoRoutes);
app.use('/api/transacciones', transaccionesRoutes);
app.use('/api/informe-cobros', informeCobrosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);


const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en puerto ${PORT}`);
});