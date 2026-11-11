const { sql, getConnection } = require('../config/db');
 
// El precio de venta sugerido siempre es el doble del costo.
const calcularPrecioVenta = (costo) => Math.round(Number(costo) * 2 * 100) / 100;
 
// Valida el costo: obligatorio, numérico, no negativo y con máximo dos decimales.
const validarCosto = (costo) => {
  if (costo === undefined || costo === null || String(costo).trim() === '') {
    return 'Debe ingresar el costo';
  }
 
  const numero = Number(costo);
 
  if (!Number.isFinite(numero) || numero < 0) {
    return 'El costo debe ser un número mayor o igual a cero';
  }
 
  if (Math.abs(numero * 100 - Math.round(numero * 100)) > 0.000001) {
    return 'El costo puede tener como máximo dos decimales';
  }
 
  return null;
};
 
const listarArticulos = async (req, res) => {
  try {
    const pool = await getConnection();
 
    const result = await pool.request().query(`
      SELECT
        a.id_articulo,
        a.codigo,
        a.descripcion,
        a.id_linea,
        a.costo,
        a.precio,
        a.estado,
        l.descripcion AS linea,
        CAST(0 AS DECIMAL(12, 2)) AS premio,
        mov.ultima_compra,
        mov.ultimo_movimiento
      FROM articulos a
      LEFT JOIN lineas_articulo l
        ON a.id_linea = l.id_linea
      OUTER APPLY (
        SELECT
          -- Última compra: entradas de inventario que no vienen de una devolución
          MAX(CASE
                WHEN mi.tipo_movimiento = 'E' AND mi.id_devolucion IS NULL
                THEN mi.fecha
              END) AS ultima_compra,
          -- Último movimiento: cualquier entrada o salida
          MAX(mi.fecha) AS ultimo_movimiento
        FROM movimientos_inventario_detalle d
        INNER JOIN movimientos_inventario mi
          ON mi.id_movimiento = d.id_movimiento
        WHERE d.id_articulo = a.id_articulo
          AND mi.estado = 'A'
      ) mov
      WHERE a.estado = 'A'
      ORDER BY a.descripcion
    `);
 
    res.json(result.recordset);
  } catch (error) {
    console.error('Error listando artículos:', error);
    res.status(500).json({
      mensaje: 'Error al listar artículos'
    });
  }
};
 
const crearArticulo = async (req, res) => {
  try {
    const { codigo, descripcion, id_linea, costo } = req.body;
 
    if (!codigo || !descripcion || !id_linea) {
      return res.status(400).json({
        mensaje: 'Código, descripción, línea y costo son obligatorios'
      });
    }
 
    const errorCosto = validarCosto(costo);
 
    if (errorCosto) {
      return res.status(400).json({ mensaje: errorCosto });
    }
 
    const pool = await getConnection();
 
    const existe = await pool.request()
      .input('codigo', sql.VarChar, String(codigo).trim())
      .query(`
        SELECT id_articulo
        FROM articulos
        WHERE codigo = @codigo
      `);
 
    if (existe.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe un artículo con ese código'
      });
    }
 
    const costoNumero = Number(costo);
 
    await pool.request()
      .input('codigo', sql.VarChar, String(codigo).trim())
      .input('descripcion', sql.VarChar, String(descripcion).trim().toUpperCase())
      .input('id_linea', sql.Int, Number(id_linea))
      .input('costo', sql.Decimal(12, 2), costoNumero)
      .input('precio', sql.Decimal(12, 2), calcularPrecioVenta(costoNumero))
      .query(`
        INSERT INTO articulos (
          codigo,
          descripcion,
          id_linea,
          costo,
          precio
        )
        VALUES (
          @codigo,
          @descripcion,
          @id_linea,
          @costo,
          @precio
        )
      `);
 
    res.status(201).json({
      mensaje: 'Artículo creado correctamente'
    });
  } catch (error) {
    console.error('Error creando artículo:', error);
 
    res.status(500).json({
      mensaje: 'Error al crear artículo',
      error: error.message
    });
  }
};
 
const desactivarArticulo = async (req, res) => {
  try {
    const { id } = req.params;
 
    const pool = await getConnection();
 
    const result = await pool.request()
      .input('id_articulo', sql.Int, Number(id))
      .query(`
        UPDATE articulos
        SET estado = 'I'
        WHERE id_articulo = @id_articulo
      `);
 
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Artículo no encontrado'
      });
    }
 
    res.json({
      mensaje: 'Artículo desactivado correctamente'
    });
  } catch (error) {
    console.error('Error desactivando artículo:', error);
 
    res.status(500).json({
      mensaje: 'Error al desactivar artículo',
      error: error.message
    });
  }
};
 
const modificarArticulo = async (req, res) => {
  try {
    const { id } = req.params;
    const { codigo, descripcion, id_linea, costo } = req.body;
 
    if (!codigo || !descripcion || !id_linea) {
      return res.status(400).json({
        mensaje: 'Código, descripción, línea y costo son obligatorios'
      });
    }
 
    const errorCosto = validarCosto(costo);
 
    if (errorCosto) {
      return res.status(400).json({ mensaje: errorCosto });
    }
 
    const pool = await getConnection();
 
    const existeCodigo = await pool.request()
      .input('codigo', sql.VarChar, String(codigo).trim())
      .input('id_articulo', sql.Int, Number(id))
      .query(`
        SELECT id_articulo
        FROM articulos
        WHERE codigo = @codigo
          AND id_articulo <> @id_articulo
      `);
 
    if (existeCodigo.recordset.length > 0) {
      return res.status(400).json({
        mensaje: 'Ya existe otro artículo con ese código'
      });
    }
 
    const costoNumero = Number(costo);
 
    const result = await pool.request()
      .input('id_articulo', sql.Int, Number(id))
      .input('codigo', sql.VarChar, String(codigo).trim())
      .input('descripcion', sql.VarChar, String(descripcion).trim().toUpperCase())
      .input('id_linea', sql.Int, Number(id_linea))
      .input('costo', sql.Decimal(12, 2), costoNumero)
      .input('precio', sql.Decimal(12, 2), calcularPrecioVenta(costoNumero))
      .query(`
        UPDATE articulos
        SET codigo = @codigo,
            descripcion = @descripcion,
            id_linea = @id_linea,
            costo = @costo,
            precio = @precio
        WHERE id_articulo = @id_articulo
      `);
 
    if (result.rowsAffected[0] === 0) {
      return res.status(404).json({
        mensaje: 'Artículo no encontrado'
      });
    }
 
    res.json({
      mensaje: 'Artículo modificado correctamente'
    });
  } catch (error) {
    console.error('Error modificando artículo:', error);
 
    res.status(500).json({
      mensaje: 'Error al modificar artículo',
      error: error.message
    });
  }
};
 
module.exports = {
  listarArticulos,
  crearArticulo,
  modificarArticulo,
  desactivarArticulo
};