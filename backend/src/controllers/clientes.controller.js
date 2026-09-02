const { sql, getConnection } = require('../config/db');

const listarClientes = async (req, res) => {
  try {
    const pool = await getConnection();

    const result = await pool.request().query(`
      SELECT
        c.id_cliente,
        c.codigo,
        c.cedula,
        c.nombre,
        c.direccion,
        c.color_casa,
        c.lado_calle,
        c.telefono,
        c.id_rollo,
        r.numero AS numero_rollo,
        r.descripcion AS rollo,
        c.saldo_actual,
        c.estado
      FROM clientes c
      LEFT JOIN rollos r
        ON c.id_rollo = r.id_rollo
      WHERE c.estado = 'A'
      ORDER BY c.nombre
    `);

    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando clientes:', error);

    res.status(500).json({
      mensaje: 'Error al listar clientes',
      error: error.message
    });
  }
};

const crearCliente = async (req, res) => {
  const pool = await getConnection();
  const transaction = new sql.Transaction(pool);

  try {
    const {
      codigo,
      cedula,
      nombre,
      direccion,
      color_casa,
      lado_calle,
      telefono,
      id_rollo,
      saldo_actual
    } = req.body;

    if (!codigo || !cedula || !nombre || !id_rollo) {
      return res.status(400).json({
        mensaje: 'Código, cédula, nombre y rollo son obligatorios'
      });
    }

    const saldoInicial = Number(saldo_actual || 0);

    if (saldoInicial < 0) {
      return res.status(400).json({
        mensaje: 'El saldo inicial no puede ser negativo'
      });
    }

    await transaction.begin();

    const requestExiste = new sql.Request(transaction);

    const existe = await requestExiste
      .input('codigo', sql.VarChar, codigo.trim())
      .input('cedula', sql.VarChar, cedula.trim())
      .query(`
        SELECT id_cliente
        FROM clientes
        WHERE codigo = @codigo
           OR cedula = @cedula
      `);

    if (existe.recordset.length > 0) {
      await transaction.rollback();

      return res.status(400).json({
        mensaje: 'Ya existe un cliente con ese código o cédula'
      });
    }

    const requestCliente = new sql.Request(transaction);

    const clienteInsertado = await requestCliente
      .input('codigo', sql.VarChar, codigo.trim())
      .input('cedula', sql.VarChar, cedula.trim())
      .input('nombre', sql.VarChar, nombre.trim().toUpperCase())
      .input('direccion', sql.VarChar, direccion ? direccion.trim().toUpperCase() : null)
      .input('color_casa', sql.VarChar, color_casa ? color_casa.trim().toUpperCase() : null)
      .input('lado_calle', sql.VarChar, lado_calle || null)
      .input('telefono', sql.VarChar, telefono ? telefono.trim() : null)
      .input('id_rollo', sql.Int, Number(id_rollo))
      .input('saldo_actual', sql.Decimal(14, 2), saldoInicial)
      .query(`
        INSERT INTO clientes (
          codigo,
          cedula,
          nombre,
          direccion,
          color_casa,
          lado_calle,
          telefono,
          id_rollo,
          saldo_actual
        )
        OUTPUT INSERTED.id_cliente
        VALUES (
          @codigo,
          @cedula,
          @nombre,
          @direccion,
          @color_casa,
          @lado_calle,
          @telefono,
          @id_rollo,
          @saldo_actual
        )
      `);

    const idCliente = clienteInsertado.recordset[0].id_cliente;

    if (saldoInicial > 0) {
      const requestMovimiento = new sql.Request(transaction);

      await requestMovimiento
        .input('id_cliente', sql.Int, idCliente)
        .input('fecha', sql.Date, new Date())
        .input('tipo_movimiento', sql.VarChar, 'VENTA')
        .input('monto', sql.Decimal(14, 2), saldoInicial)
        .input('saldo_anterior', sql.Decimal(14, 2), 0)
        .input('saldo_nuevo', sql.Decimal(14, 2), saldoInicial)
        .input('observacion', sql.VarChar, 'SALDO INICIAL AL CREAR CLIENTE')
        .query(`
          INSERT INTO movimientos_cliente (
            id_cliente,
            fecha,
            tipo_movimiento,
            monto,
            saldo_anterior,
            saldo_nuevo,
            observacion
          )
          VALUES (
            @id_cliente,
            @fecha,
            @tipo_movimiento,
            @monto,
            @saldo_anterior,
            @saldo_nuevo,
            @observacion
          )
        `);
    }

    await transaction.commit();

    res.status(201).json({
      mensaje: 'Cliente creado correctamente',
      id_cliente: idCliente
    });
  } catch (error) {
    try {
      await transaction.rollback();
    } catch (rollbackError) {
      console.error('Error haciendo rollback:', rollbackError);
    }

    console.error('Error creando cliente:', error);

    res.status(500).json({
      mensaje: 'Error al crear cliente',
      error: error.message
    });
  }
};
const modificarCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      codigo,
      cedula,
      nombre,
      direccion,
      color_casa,
      lado_calle,
      telefono,
      id_rollo,
      saldo_actual
    } = req.body;

    if (!codigo || !cedula || !nombre || !id_rollo) {
      return res.status(400).json({
        mensaje: 'Código, cédula, nombre y rollo son obligatorios'
      });
    }

    const pool = await getConnection();

    const existe = await pool.request()
      .input('codigo', sql.VarChar, codigo.trim())
      .input('cedula', sql.VarChar, cedula.trim())
      .input('id_cliente', sql.Int, Number(id))
      .query(`
        SELECT id_cliente
        FROM clientes
        WHERE (codigo = @codigo OR cedula = @cedula)
          AND id_cliente <> @id_cliente
      `);

    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro cliente con ese código o cédula'
      });
    }

    const result = await pool.request()
      .input('id_cliente', sql.Int, Number(id))
      .input('codigo', sql.VarChar, codigo.trim())
      .input('cedula', sql.VarChar, cedula.trim())
      .input('nombre', sql.VarChar, nombre.trim().toUpperCase())
      .input('direccion', sql.VarChar, direccion?.trim().toUpperCase() || null)
      .input('color_casa', sql.VarChar, color_casa?.trim().toUpperCase() || null)
      .input('lado_calle', sql.VarChar, lado_calle?.trim().toUpperCase() || null)
      .input('telefono', sql.VarChar, telefono?.trim() || null)
      .input('id_rollo', sql.Int, Number(id_rollo))
      .input('saldo_actual', sql.Decimal(12, 2), Number(saldo_actual || 0))
      .query(`
        UPDATE clientes
        SET codigo = @codigo,
            cedula = @cedula,
            nombre = @nombre,
            direccion = @direccion,
            color_casa = @color_casa,
            lado_calle = @lado_calle,
            telefono = @telefono,
            id_rollo = @id_rollo,
            saldo_actual = @saldo_actual
        WHERE id_cliente = @id_cliente
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Cliente no encontrado'
      });
    }

    res.json({
      mensaje: 'Cliente modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando cliente:', error);

    res.status(500).json({
      mensaje: 'Error al modificar cliente',
      error: error.message
    });
  }
};

const desactivarCliente = async (req, res) => {
  try {
    const { id } = req.params;

    const pool = await getConnection();

    const result = await pool.request()
      .input('id_cliente', sql.Int, Number(id))
      .query(`
        UPDATE clientes
        SET estado = 'I'
        WHERE id_cliente = @id_cliente
      `);

    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Cliente no encontrado'
      });
    }

    res.json({
      mensaje: 'Cliente desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando cliente:', error);

    res.status(500).json({
      mensaje: 'Error al desactivar cliente',
      error: error.message
    });
  }
};

module.exports = {
  listarClientes,
  crearCliente,
  modificarCliente,
  desactivarCliente
};