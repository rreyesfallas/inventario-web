import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Reportes.css';
import './RegistrarTarjetas.css';

// Fecha de hoy en hora local (Costa Rica), formato YYYY-MM-DD.
const fechaLocalHoy = () => {
  const hoy = new Date();
  const desfase = hoy.getTimezoneOffset() * 60000;
  return new Date(hoy.getTime() - desfase).toISOString().slice(0, 10);
};

const mostrarFecha = (fecha) => {
  const texto = String(fecha || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
};

// SQL Server devuelve DATETIME como si fuera UTC; se toma la hora tal cual viene.
const mostrarHora = (fechaHora) => {
  const texto = String(fechaHora || '');
  return texto.length >= 16 ? texto.slice(11, 16) : '-';
};

const formatoMoneda = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', { style: 'currency', currency: 'CRC' });

function RegistrarTarjetas() {
  const navigate = useNavigate();

  const [rollos, setRollos] = useState([]);
  const [numeroRollo, setNumeroRollo] = useState('');
  const [rollo, setRollo] = useState(null);
  const [fecha, setFecha] = useState(fechaLocalHoy());

  // true cuando ya se confirmó rollo + fecha y se puede digitar.
  const [enCaptura, setEnCaptura] = useState(false);

  const [codigoTarjeta, setCodigoTarjeta] = useState('');
  const [ultimaTarjeta, setUltimaTarjeta] = useState(null);
  const [registradas, setRegistradas] = useState([]);
  const [totalRollo, setTotalRollo] = useState(0);

  const [cargando, setCargando] = useState(false);
  const [registrando, setRegistrando] = useState(false);
  const [anulandoId, setAnulandoId] = useState(null);

  const rolloRef = useRef(null);
  const fechaRef = useRef(null);
  const tarjetaRef = useRef(null);

  useEffect(() => {
    fetch('/api/rollos')
      .then((respuesta) => (respuesta.ok ? respuesta.json() : []))
      .then((datos) => setRollos(Array.isArray(datos) ? datos : []))
      .catch((error) => {
        console.error('Error cargando rollos:', error);
        alert('No se pudieron cargar los rollos');
      });
  }, []);

  const reiniciarCaptura = () => {
    setEnCaptura(false);
    setRegistradas([]);
    setTotalRollo(0);
    setUltimaTarjeta(null);
    setCodigoTarjeta('');
  };

  const buscarRollo = () => {
    const numero = numeroRollo.trim();

    if (!numero) {
      alert('Digite el número del rollo');
      return;
    }

    const encontrado = rollos.find(
      (item) =>
        String(item.numero).trim() === numero &&
        (!item.estado || item.estado === 'A')
    );

    if (!encontrado) {
      alert('No se encontró un rollo activo con ese número');
      setRollo(null);
      return;
    }

    setRollo(encontrado);
    fechaRef.current?.focus();
  };

  // Confirma rollo + fecha y carga lo que ya se haya digitado (para retomar).
  const iniciarCaptura = async () => {
    if (!rollo) {
      alert('Primero digite el número del rollo y presione Enter');
      rolloRef.current?.focus();
      return;
    }

    if (!fecha) {
      alert('Seleccione la fecha');
      fechaRef.current?.focus();
      return;
    }

    try {
      setCargando(true);

      const parametros = new URLSearchParams({ id_rollo: rollo.id_rollo, fecha });
      const respuesta = await fetch(`/api/tarjetas?${parametros}`);
      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudieron consultar las tarjetas');
        return;
      }

      setRegistradas(Array.isArray(datos.registradas) ? datos.registradas : []);
      setTotalRollo(Number(datos.total_tarjetas_rollo || 0));
      setUltimaTarjeta(null);
      setEnCaptura(true);

      setTimeout(() => tarjetaRef.current?.focus(), 0);
    } catch (error) {
      console.error('Error consultando tarjetas:', error);
      alert('No se pudieron consultar las tarjetas');
    } finally {
      setCargando(false);
    }
  };

  const registrarTarjeta = async () => {
    if (registrando) return;

    const codigo = codigoTarjeta.trim();

    if (!codigo) return;

    try {
      setRegistrando(true);

      const respuesta = await fetch('/api/tarjetas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_rollo: rollo.id_rollo,
          fecha,
          codigo_cliente: codigo
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo registrar la tarjeta');
        // Deja el código seleccionado para corregirlo de una vez.
        setTimeout(() => tarjetaRef.current?.select(), 0);
        return;
      }

      setUltimaTarjeta(datos.tarjeta);
      setRegistradas((anteriores) => [datos.tarjeta, ...anteriores]);
      setCodigoTarjeta('');
    } catch (error) {
      console.error('Error registrando tarjeta:', error);
      alert('No se pudo registrar la tarjeta');
    } finally {
      setRegistrando(false);
      setTimeout(() => tarjetaRef.current?.focus(), 0);
    }
  };

  const anularTarjeta = async (tarjeta) => {
    if (anulandoId !== null) return;

    const confirmar = window.confirm(
      `¿Anular la tarjeta ${tarjeta.codigo_cliente} - ${tarjeta.cliente}?\n\n` +
      'Volverá a contar como faltante hasta que se digite de nuevo.'
    );

    if (!confirmar) return;

    try {
      setAnulandoId(tarjeta.id_tarjeta_registrada);

      const respuesta = await fetch(
        `/api/tarjetas/${tarjeta.id_tarjeta_registrada}/anular`,
        { method: 'PATCH' }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'No se pudo anular la tarjeta');
        return;
      }

      setRegistradas((anteriores) =>
        anteriores.filter(
          (item) => item.id_tarjeta_registrada !== tarjeta.id_tarjeta_registrada
        )
      );

      if (ultimaTarjeta?.id_tarjeta_registrada === tarjeta.id_tarjeta_registrada) {
        setUltimaTarjeta(null);
      }
    } catch (error) {
      console.error('Error anulando tarjeta:', error);
      alert('No se pudo anular la tarjeta');
    } finally {
      setAnulandoId(null);
      tarjetaRef.current?.focus();
    }
  };

  const faltan = Math.max(totalRollo - registradas.length, 0);

  return (
    <div className="reportes-page">
      <header className="reportes-header">
        <h2>Registrar tarjetas</h2>
        <button type="button" onClick={() => navigate('/reportes')}>Volver</button>
      </header>

      {/* DATOS DEL ROLLO */}
      <section className="reportes-card">
        <h3>Datos del rollo</h3>

        <div className="tarjetas-grid-rollo">
          <div>
            <label>Número de rollo</label>
            <input
              ref={rolloRef}
              autoFocus
              type="text"
              value={numeroRollo}
              placeholder="Digite el número del rollo"
              onChange={(e) => {
                setNumeroRollo(e.target.value);
                setRollo(null);
                reiniciarCaptura();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  buscarRollo();
                }
              }}
            />
          </div>

          <div>
            <label>Descripción</label>
            <input type="text" readOnly tabIndex={-1} value={rollo?.descripcion || ''} placeholder="Automático" />
          </div>

          <div>
            <label>Bodega</label>
            <input
              type="text"
              readOnly
              tabIndex={-1}
              value={rollo?.bodega ? `${rollo.codigo_bodega} - ${rollo.bodega}` : ''}
              placeholder="Automático"
            />
          </div>

          <div>
            <label>Fecha</label>
            <input
              ref={fechaRef}
              type="date"
              value={fecha}
              onChange={(e) => {
                setFecha(e.target.value);
                reiniciarCaptura();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  iniciarCaptura();
                }
              }}
            />
          </div>
        </div>

        {!enCaptura && (
          <p className="tarjetas-ayuda">
            Digite el rollo ⏎, confirme la fecha ⏎ y comience a digitar las tarjetas.
          </p>
        )}
        {cargando && <p className="tarjetas-ayuda">Cargando tarjetas...</p>}
      </section>

      {/* CAPTURA DE TARJETAS */}
      {enCaptura && (
        <>
          <section className="reportes-card">
            <div className="tarjetas-contadores">
              <div className="tarjetas-contador">
                <span>Tarjetas del rollo</span>
                <strong>{totalRollo}</strong>
              </div>
              <div className="tarjetas-contador tarjetas-contador-ok">
                <span>Digitadas</span>
                <strong>{registradas.length}</strong>
              </div>
              <div className={`tarjetas-contador ${faltan > 0 ? 'tarjetas-contador-alerta' : 'tarjetas-contador-ok'}`}>
                <span>Faltan</span>
                <strong>{faltan}</strong>
              </div>
            </div>

            <div className="tarjetas-grid-captura">
              <div>
                <label>Código de tarjeta</label>
                <input
                    ref={tarjetaRef}
                    type="text"
                    className="tarjetas-input-codigo"
                    value={codigoTarjeta}
                    placeholder="Digite el código y presione Enter"
                    onChange={(e) => setCodigoTarjeta(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                        e.preventDefault();
                        registrarTarjeta();
                        }
                    }}
                />
              </div>

              <div>
                <label>Nombre</label>
                <input type="text" readOnly tabIndex={-1} value={ultimaTarjeta?.cliente || ''} placeholder="Última tarjeta digitada" />
              </div>

              <div>
                <label>Saldo actual</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={ultimaTarjeta ? formatoMoneda(ultimaTarjeta.saldo_registrado) : ''}
                />
              </div>

              <div>
                <label>Fecha de registro</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  value={ultimaTarjeta ? mostrarFecha(ultimaTarjeta.fecha) : ''}
                />
              </div>
            </div>

            {faltan === 0 && totalRollo > 0 && (
              <p className="tarjetas-completo">✔ Todas las tarjetas del rollo fueron digitadas.</p>
            )}
          </section>

          {/* TARJETAS DIGITADAS */}
          <section className="reportes-card">
            <h3>Tarjetas digitadas</h3>

            <div className="reportes-tabla-contenedor">
              <table className="reportes-tabla">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Saldo actual</th>
                    <th>Fecha</th>
                    <th>Hora</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {registradas.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="reportes-sin-datos">
                        Todavía no se ha digitado ninguna tarjeta de este rollo en esta fecha
                      </td>
                    </tr>
                  ) : (
                    registradas.map((item) => (
                      <tr key={item.id_tarjeta_registrada}>
                        <td>{item.codigo_cliente}</td>
                        <td className="reportes-celda-empleado">{item.cliente}</td>
                        <td className="reportes-celda-monto">{formatoMoneda(item.saldo_registrado)}</td>
                        <td>{mostrarFecha(item.fecha)}</td>
                        <td>{mostrarHora(item.fecha_creacion)}</td>
                        <td>
                          <button
                            type="button"
                            className="tarjetas-btn-anular"
                            tabIndex={-1}
                            disabled={anulandoId !== null}
                            onClick={() => anularTarjeta(item)}
                          >
                            {anulandoId === item.id_tarjeta_registrada ? 'Anulando...' : 'Anular'}
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

export default RegistrarTarjetas;
