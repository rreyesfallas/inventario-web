const { sql, getConnection } = require('../config/db');

const esEnteroPositivo = (valor) => Number.isInteger(valor) && valor > 0;

const esFechaValida = (fecha) => {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const fechaValidada = new Date(`${fecha}T00:00:00Z`);
  return (
    !Number.isNaN(fechaValidada.getTime()) &&
    fechaValidada.toISOString().slice(0, 10) === fecha
  );
};

/* ------------------------------------------------------------
   GET /api/tarjetas?id_rollo=13&fecha=YYYY-MM-DD
   Tarjetas registradas del rollo en la fecha + total del rollo.
   ------------------------------------------------------------ */
const listarTarjetasRegistradas = async (req, res) => {
  const idRollo = Number(req.query.id_rollo);
  const { fecha } = req.query;

  if (!esEnteroPositivo(idRollo) || !esFechaValida(fecha)) {
    return res.status(400).json({ mensaje: 'Debe indicar un rollo y una fecha válidos' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id_rollo', sql.Int, idRollo)
      .input('fecha', sql.Date, fecha)
      .query(`
        SELECT COUNT(*) AS total_tarjetas_rollo
        FROM clientes
        WHERE id_rollo = @id_rollo
          AND estado = 'A';

        SELECT
          t.id_tarjeta_registrada,
          t.id_cliente,
          c.codigo AS codigo_cliente,
          c.nombre AS cliente,
          t.saldo_registrado,
          t.fecha,
          t.fecha_creacion
        FROM tarjetas_registradas t
        INNER JOIN clientes c ON c.id_cliente = t.id_cliente
        WHERE t.id_rollo = @id_rollo
          AND t.fecha = @fecha
          AND t.estado = 'A'
        ORDER BY t.fecha_creacion DESC, t.id_tarjeta_registrada DESC;
      `);

    const [totales, registradas] = resultado.recordsets;

    return res.json({
      total_tarjetas_rollo: totales[0].total_tarjetas_rollo,
      registradas
    });
  } catch (error) {
    console.error('Error listando tarjetas registradas:', error);

    return res.status(500).json({
      mensaje: 'Error al consultar las tarjetas registradas',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   POST /api/tarjetas
   body: { id_rollo, fecha, codigo_cliente }
   ------------------------------------------------------------ */
const registrarTarjeta = async (req, res) => {
  const idRollo = Number(req.body.id_rollo);
  const { fecha } = req.body;
  const codigoCliente =
    req.body.codigo_cliente === undefined || req.body.codigo_cliente === null
      ? ''
      : String(req.body.codigo_cliente).trim();

  if (!esEnteroPositivo(idRollo)) {
    return res.status(400).json({ mensaje: 'Debe seleccionar un rollo válido' });
  }

  if (!esFechaValida(fecha)) {
    return res.status(400).json({ mensaje: 'La fecha no es válida' });
  }

  if (!codigoCliente) {
    return res.status(400).json({ mensaje: 'Digite el código de la tarjeta' });
  }

  try {
    const pool = await getConnection();

    // Rollo activo.
    const resultadoRollo = await pool.request()
      .input('id_rollo', sql.Int, idRollo)
      .query(`
        SELECT id_rollo, numero
        FROM rollos
        WHERE id_rollo = @id_rollo
          AND estado = 'A'
      `);

    if (resultadoRollo.recordset.length === 0) {
      return res.status(400).json({ mensaje: 'El rollo no existe o está inactivo' });
    }

    const rollo = resultadoRollo.recordset[0];

    // Cliente por código.
    const resultadoCliente = await pool.request()
      .input('codigo', sql.VarChar(20), codigoCliente)
      .query(`
        SELECT
          c.id_cliente,
          c.codigo,
          c.nombre,
          c.id_rollo,
          c.saldo_actual,
          c.estado,
          r.numero AS numero_rollo
        FROM clientes c
        LEFT JOIN rollos r ON r.id_rollo = c.id_rollo
        WHERE c.codigo = @codigo
      `);

    if (resultadoCliente.recordset.length === 0) {
      return res.status(404).json({ mensaje: `No existe una tarjeta con el código ${codigoCliente}` });
    }

    const cliente = resultadoCliente.recordset[0];

    if (cliente.estado !== 'A') {
      return res.status(400).json({ mensaje: `La tarjeta ${codigoCliente} pertenece a un cliente inactivo` });
    }

    if (Number(cliente.id_rollo) !== idRollo) {
      return res.status(400).json({
        mensaje: cliente.numero_rollo
          ? `La tarjeta ${codigoCliente} no pertenece al rollo ${rollo.numero} (es del rollo ${cliente.numero_rollo})`
          : `La tarjeta ${codigoCliente} no pertenece al rollo ${rollo.numero}`
      });
    }

    // Registrar. El índice único evita duplicados aunque se digite dos veces a la vez.
    const resultadoInsert = await pool.request()
      .input('id_rollo', sql.Int, idRollo)
      .input('id_cliente', sql.Int, cliente.id_cliente)
      .input('fecha', sql.Date, fecha)
      .input('saldo_registrado', sql.Decimal(14, 2), Number(cliente.saldo_actual || 0))
      .query(`
        INSERT INTO tarjetas_registradas (id_rollo, id_cliente, fecha, saldo_registrado)
        OUTPUT INSERTED.id_tarjeta_registrada, INSERTED.fecha_creacion
        VALUES (@id_rollo, @id_cliente, @fecha, @saldo_registrado)
      `);

    const insertado = resultadoInsert.recordset[0];

    return res.status(201).json({
      mensaje: 'Tarjeta registrada',
      tarjeta: {
        id_tarjeta_registrada: insertado.id_tarjeta_registrada,
        id_cliente: cliente.id_cliente,
        codigo_cliente: cliente.codigo,
        cliente: cliente.nombre,
        saldo_registrado: Number(cliente.saldo_actual || 0),
        fecha,
        fecha_creacion: insertado.fecha_creacion
      }
    });
  } catch (error) {
    if (error.number === 2601 || error.number === 2627) {
      return res.status(400).json({
        mensaje: `La tarjeta ${codigoCliente} ya fue registrada en este rollo y fecha`
      });
    }

    console.error('Error registrando tarjeta:', error);

    return res.status(500).json({
      mensaje: 'Error al registrar la tarjeta',
      error: error.message
    });
  }
};

/* ------------------------------------------------------------
   PATCH /api/tarjetas/:id/anular
   ------------------------------------------------------------ */
const anularTarjeta = async (req, res) => {
  const idTarjeta = Number(req.params.id);

  if (!esEnteroPositivo(idTarjeta)) {
    return res.status(400).json({ mensaje: 'Identificador de tarjeta no válido' });
  }

  try {
    const pool = await getConnection();

    const resultado = await pool.request()
      .input('id', sql.Int, idTarjeta)
      .query(`
        UPDATE tarjetas_registradas
        SET estado = 'I'
        WHERE id_tarjeta_registrada = @id
          AND estado = 'A'
      `);

    if (resultado.rowsAffected[0] === 0) {
      return res.status(404).json({ mensaje: 'La tarjeta no existe o ya fue anulada' });
    }

    return res.json({ mensaje: 'Tarjeta anulada correctamente' });
  } catch (error) {
    console.error('Error anulando tarjeta:', error);

    return res.status(500).json({
      mensaje: 'Error al anular la tarjeta',
      error: error.message
    });
  }
};

module.exports = {
  listarTarjetasRegistradas,
  registrarTarjeta,
  anularTarjeta
};