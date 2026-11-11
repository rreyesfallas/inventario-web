/**
 * Navegación con Enter dentro de un formulario.
 * Se coloca en el onKeyDown del contenedor del formulario:
 *
 *   <div onKeyDown={(e) => manejarEnterFormulario(e, guardar)}>
 *
 * - Enter en un campo pasa al siguiente campo editable.
 * - Enter en el último campo ejecuta la acción final (guardar).
 * - Ignora campos de solo lectura, deshabilitados u ocultos.
 */
export const manejarEnterFormulario = (e, accionFinal) => {
  if (e.key !== 'Enter') return;

  const campoActual = e.target;

  // Solo inputs y selects. Los botones y textarea mantienen su comportamiento normal.
  if (!['INPUT', 'SELECT'].includes(campoActual.tagName)) return;

  e.preventDefault();

  const campos = Array.from(
    e.currentTarget.querySelectorAll('input, select')
  ).filter(
    (campo) =>
      !campo.disabled &&
      !campo.readOnly &&
      campo.type !== 'hidden' &&
      campo.tabIndex !== -1 &&
      campo.offsetParent !== null // visible en pantalla
  );

  const posicion = campos.indexOf(campoActual);

  if (posicion >= 0 && posicion < campos.length - 1) {
    campos[posicion + 1].focus();
    return;
  }

  accionFinal?.();
};