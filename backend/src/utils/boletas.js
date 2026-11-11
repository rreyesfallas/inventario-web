const { sql } = require('../config/db');
 
/*
  Reglas de la boleta (hoja del talonario):
  - Puede tener varias ventas y devoluciones, de varios clientes y vendedores.
  - Todas deben ser de la MISMA fecha, la MISMA bodega y el MISMO rollo.
  - Por eso una boleta no puede reutilizarse otro día.
*/
 
const fechaTexto = (fecha) => {
  if (!fecha) return '';
  const iso = fecha instanceof Date ? fecha.toISOString() : String(fecha);
  return iso.slice(0, 10);
};
 
const fechaDMY = (fecha) => {
  const texto = fechaTexto(fecha);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
};
 
// Datos con los que se abrió la boleta (null si todavía no existe).
// Se llama dentro de la transacción: bloquea la boleta hasta terminar,
// así dos usuarios no la pueden "abrir" con datos distintos al mismo tiempo.
const obtenerDatosBoleta = async (transaction, boleta) => {
  const resultado = await new sql.Request(transaction)
    .input('numero_boleta', sql.VarChar(20), boleta)
    .query(`
      SELECT TOP 1
        t.fecha,
        t.id_bodega,
        t.id_rollo,
        b.codigo      AS codigo_bodega,
        b.descripcion AS bodega,
        r.numero      AS numero_rollo,
        r.descripcion AS rollo
      FROM (
        SELECT fecha, id_bodega, id_rollo
        FROM ventas WITH (UPDLOCK, HOLDLOCK)
        WHERE numero_boleta = @numero_boleta
          AND estado = 'ACTIVA'
 
        UNION ALL
 
        SELECT fecha, id_bodega, id_rollo
        FROM devoluciones WITH (UPDLOCK, HOLDLOCK)
        WHERE numero_boleta = @numero_boleta
          AND estado = 'A'
      ) t
      LEFT JOIN bodegas b ON b.id_bodega = t.id_bodega
      LEFT JOIN rollos r  ON r.id_rollo  = t.id_rollo
      ORDER BY CASE WHEN t.id_rollo IS NULL THEN 1 ELSE 0 END
    `);
 
  return resultado.recordset[0] || null;
};
 
// Devuelve un mensaje de error si la boleta ya existe con otros datos, o null si se puede usar.
const validarBoleta = async (transaction, { boleta, fecha, idBodega, idRollo }) => {
  const existente = await obtenerDatosBoleta(transaction, boleta);
 
  if (!existente) return null; // Boleta nueva: se abre con estos datos.
 
  if (fechaTexto(existente.fecha) !== fecha) {
    return `La boleta ${boleta} ya fue usada el ${fechaDMY(existente.fecha)}. Una boleta no puede repetirse en otra fecha.`;
  }
 
  if (Number(existente.id_bodega) !== Number(idBodega)) {
    return `La boleta ${boleta} pertenece a la bodega ${existente.codigo_bodega} ${existente.bodega}.`;
  }
 
  if (existente.id_rollo && Number(existente.id_rollo) !== Number(idRollo)) {
    return `La boleta ${boleta} es del rollo ${existente.numero_rollo} ${existente.rollo}. Solo puede llevar clientes de ese rollo.`;
  }
 
  return null;
};
 
module.exports = {
  obtenerDatosBoleta,
  validarBoleta,
  fechaTexto
};
 