import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Reportes.css';
import './Inventarios.css';

const formatoMoneda = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' });

const formatoCantidad = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { maximumFractionDigits: 2 });

// Diferencia: negativa entre paréntesis (como el sistema anterior).
const formatoDiferencia = (valor) => {
  const numero = Number(valor || 0);
  return numero < 0 ? `(${formatoCantidad(Math.abs(numero))})` : formatoCantidad(numero);
};

const claseDiferencia = (valor) => {
  const numero = Number(valor || 0);
  if (numero < 0) return 'inventario-faltante';
  if (numero > 0) return 'inventario-sobrante';
  return '';
};

const ARTICULO_VACIO = null;

function IngresarTomaFisica() {
  const navigate = useNavigate();

  const [bodegas, setBodegas] = useState([]);
  const [codigoBodega, setCodigoBodega] = useState('');
  const [bodega, setBodega] = useState(null);

  const [codigoArticulo, setCodigoArticulo] = useState('');
  const [articulo, setArticulo] = useState(ARTICULO_VACIO);
  const [toma, setToma] = useState('');

  const [tomas, setTomas] = useState([]);
  const [ultima, setUltima] = useState(null);

  const [guardando, setGuardando] = useState(false);
  const [anulandoId, setAnulandoId] = useState(null);

  const bodegaRef = useRef(null);
  const articuloRef = useRef(null);
  const tomaRef = useRef(null);

  useEffect(() => {
    fetch('/api/bodegas')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((lista) => setBodegas(Array.isArray(lista) ? lista : []))
      .catch((error) => {
        console.error('Error cargando bodegas:', error);
        alert('No se pudieron cargar las bodegas');
      });
  }, []);

  const cargarTomas = async (idBodega) => {
    try {
      const respuesta = await fetch(`/api/inventarios/tomas?id_bodega=${idBodega}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudieron consultar las tomas');
        return;
      }

      setTomas(Array.isArray(datos) ? datos : []);
    } catch (error) {
      console.error('Error cargando tomas:', error);
      alert('No se pudieron consultar las tomas');
    }
  };

  const limpiarArticulo = () => {
    setCodigoArticulo('');
    setArticulo(ARTICULO_VACIO);
    setToma('');
  };

  // ===================== BODEGA =====================

  const buscarBodega = async () => {
    const codigo = codigoBodega.trim().toLowerCase();

    if (!codigo) {
      alert('Digite el código de la bodega');
      return;
    }

    const encontrada = bodegas.find(
      (item) =>
        String(item.codigo || '').trim().toLowerCase() === codigo &&
        (!item.estado || item.estado === 'A')
    );

    if (!encontrada) {
      alert('No se encontró una bodega activa con ese código');
      setBodega(null);
      bodegaRef.current?.select();
      return;
    }

    setBodega(encontrada);
    setUltima(null);
    limpiarArticulo();
    await cargarTomas(encontrada.id_bodega);

    setTimeout(() => articuloRef.current?.focus(), 0);
  };

  // ===================== ARTÍCULO =====================

  const buscarArticulo = async () => {
    const codigo = codigoArticulo.trim();

    if (!codigo) return;

    try {
      const parametros = new URLSearchParams({ id_bodega: bodega.id_bodega, codigo });
      const respuesta = await fetch(`/api/inventarios/articulo?${parametros}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se encontró el artículo');
        setArticulo(ARTICULO_VACIO);
        articuloRef.current?.select();
        return;
      }

      setArticulo(datos);
      // Si ya se había contado, muestra ese conteo para corregirlo.
      setToma(datos.toma_pendiente !== null && datos.toma_pendiente !== undefined
        ? String(Number(datos.toma_pendiente))
        : '');

      setTimeout(() => {
        tomaRef.current?.focus();
        tomaRef.current?.select();
      }, 0);
    } catch (error) {
      console.error('Error buscando artículo:', error);
      alert('No se pudo buscar el artículo');
    }
  };

  // ===================== GUARDAR TOMA =====================

  const guardarToma = async () => {
    if (guardando) return;

    if (!articulo) {
      alert('Digite el código del artículo y presione Enter');
      articuloRef.current?.focus();
      return;
    }

    const cantidad = Number(toma);

    if (String(toma).trim() === '' || !Number.isFinite(cantidad) || cantidad < 0) {
      alert('Digite la cantidad que se contó (0 o más)');
      tomaRef.current?.focus();
      return;
    }

    try {
      setGuardando(true);

      const respuesta = await fetch('/api/inventarios/tomas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_bodega: bodega.id_bodega,
          id_articulo: articulo.id_articulo,
          cantidad
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo guardar la toma');
        tomaRef.current?.select();
        return;
      }

      setUltima({ ...datos.toma, accion: datos.accion });
      limpiarArticulo();
      await cargarTomas(bodega.id_bodega);
    } catch (error) {
      console.error('Error guardando toma:', error);
      alert('No se pudo guardar la toma');
    } finally {
      setGuardando(false);
      setTimeout(() => articuloRef.current?.focus(), 0);
    }
  };

  const anularToma = async (item) => {
    if (anulandoId !== null) return;

    const confirmar = window.confirm(
      `¿Anular la toma de ${item.codigo} - ${item.descripcion}?\n\n` +
      'Volverá a aparecer como "sin contar" en el resultado de inventario.'
    );

    if (!confirmar) return;

    try {
      setAnulandoId(item.id_toma);

      const respuesta = await fetch(`/api/inventarios/tomas/${item.id_toma}/anular`, {
        method: 'PATCH'
      });
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo anular la toma');
        return;
      }

      setTomas((anteriores) => anteriores.filter((toma) => toma.id_toma !== item.id_toma));

      if (ultima?.id_toma === item.id_toma) setUltima(null);
    } catch (error) {
      console.error('Error anulando toma:', error);
      alert('No se pudo anular la toma');
    } finally {
      setAnulandoId(null);
      articuloRef.current?.focus();
    }
  };

  const diferenciaActual =
    articulo && String(toma).trim() !== '' && Number.isFinite(Number(toma))
      ? Number(toma) - Number(articulo.existencia)
      : null;

  return (
    <div className="reportes-page">
      <header className="reportes-header">
        <h2>Toma física de inventario</h2>
        <button type="button" onClick={() => navigate('/inventarios')}>Volver</button>
      </header>

      {/* BODEGA */}
      <section className="reportes-card">
        <h3>Bodega</h3>

        <div className="inventario-grid-bodega">
          <div>
            <label>Código de bodega</label>
            <input
              ref={bodegaRef}
              autoFocus
              type="text"
              value={codigoBodega}
              placeholder="Digite el código"
              onChange={(e) => {
                setCodigoBodega(e.target.value);
                setBodega(null);
                setTomas([]);
                setUltima(null);
                limpiarArticulo();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarBodega();
                }
              }}
            />
          </div>

          <div>
            <label>Descripción de la bodega</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={bodega?.descripcion || ''}
              placeholder="Automático"
            />
          </div>
        </div>

        {!bodega && (
          <p className="inventario-ayuda">
            Digite el número de bodega (carro) y presione Enter.
          </p>
        )}
      </section>

      {/* ARTÍCULO */}
      {bodega && (
        <>
          <section className="reportes-card">
            <h3>Artículo</h3>

            <div className="inventario-grid-articulo">
              <div>
                <label>Código artículo</label>
                <input
                  ref={articuloRef}
                  type="text"
                  className="inventario-input-principal"
                  value={codigoArticulo}
                  placeholder="Código"
                  onChange={(e) => {
                    setCodigoArticulo(e.target.value);
                    setArticulo(ARTICULO_VACIO);
                    setToma('');
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      buscarArticulo();
                    }
                  }}
                />
              </div>

              <div className="inventario-campo-ancho">
                <label>Descripción del artículo</label>
                <input type="text" readOnly tabIndex={-1} value={articulo?.descripcion || ''} />
              </div>

              <div>
                <label>P. Costo</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={articulo ? formatoMoneda(articulo.costo) : ''}
                />
              </div>

              <div>
                <label>Exist. (sistema)</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={articulo ? formatoCantidad(articulo.existencia) : ''}
                />
              </div>

              <div>
                <label>Toma (contado)</label>
                <input
                  ref={tomaRef}
                  type="number"
                  min="0"
                  step="0.01"
                  className="inventario-input-principal"
                  value={toma}
                  readOnly={!articulo}
                  placeholder="Cant."
                  onChange={(e) => setToma(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      guardarToma();
                    }
                    if (e.key === 'Escape') {
                      limpiarArticulo();
                      articuloRef.current?.focus();
                    }
                  }}
                />
              </div>

              <div>
                <label>Diferencia</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className={claseDiferencia(diferenciaActual)}
                  value={diferenciaActual === null ? '' : formatoDiferencia(diferenciaActual)}
                />
              </div>
            </div>

            {articulo?.toma_pendiente !== null && articulo?.toma_pendiente !== undefined && (
              <p className="inventario-aviso">
                Este artículo ya se contó ({formatoCantidad(articulo.toma_pendiente)}). Si guarda,
                se reemplaza el conteo anterior.
              </p>
            )}

            {ultima && (
              <p className="inventario-ultima">
                ✔ {ultima.accion === 'ACTUALIZADA' ? 'Actualizado' : 'Registrado'}:{' '}
                <strong>{ultima.codigo} - {ultima.descripcion}</strong> · Exist.{' '}
                {formatoCantidad(ultima.existencia_sistema)} · Toma{' '}
                {formatoCantidad(ultima.cantidad_fisica)} · Diferencia{' '}
                <span className={claseDiferencia(ultima.diferencia)}>
                  {formatoDiferencia(ultima.diferencia)}
                </span>
              </p>
            )}

            <p className="inventario-ayuda">
              Código ⏎ → Toma ⏎ guarda y vuelve al código. Esc en Toma cancela el artículo.
            </p>
          </section>

          {/* CONTADOS */}
          <section className="reportes-card">
            <h3>Artículos contados en esta bodega ({tomas.length})</h3>

            <div className="reportes-tabla-contenedor">
              <table className="reportes-tabla">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>P. Costo</th>
                    <th>Exist.</th>
                    <th>Toma</th>
                    <th>Diferencia</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {tomas.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="reportes-sin-datos">
                        Todavía no se ha contado ningún artículo en esta bodega
                      </td>
                    </tr>
                  ) : (
                    tomas.map((item) => (
                      <tr key={item.id_toma}>
                        <td>{item.codigo}</td>
                        <td className="reportes-celda-empleado">{item.descripcion}</td>
                        <td className="reportes-celda-monto">{formatoMoneda(item.costo)}</td>
                        <td>{formatoCantidad(item.existencia_sistema)}</td>
                        <td>{formatoCantidad(item.cantidad_fisica)}</td>
                        <td className={claseDiferencia(item.diferencia)}>
                          {formatoDiferencia(item.diferencia)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="inventario-btn-anular"
                            tabIndex={-1}
                            disabled={anulandoId !== null}
                            onClick={() => anularToma(item)}
                          >
                            {anulandoId === item.id_toma ? 'Anulando...' : 'Anular'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default IngresarTomaFisica;