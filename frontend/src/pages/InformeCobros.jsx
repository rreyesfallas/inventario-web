import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './InformeCobros.css';

function InformeCobros() {
  const navigate = useNavigate();

  const [rollos, setRollos] = useState([]);
  const [filtros, setFiltros] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    id_rollo: ''
  });

  const [resumen, setResumen] = useState({
    total_clientes: 0,
    total_saldo_actual: 0,
    total_efectivo: 0,
    total_sinpe: 0,
    total_cobrado_fecha: 0,
    total_cobrado_acumulado: 0,
    saldo_pendiente_estimado: 0
  });

  const [detalleClientes, setDetalleClientes] = useState([]);
  const [consultado, setConsultado] = useState(false);

  const cargarRollos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/rollos');
      const datos = await respuesta.json();

      setRollos(datos);
    } catch (error) {
      console.error('Error cargando rollos:', error);
      alert('Error al cargar rollos');
    }
  };

  useEffect(() => {
    cargarRollos();
  }, []);

  const cambiarFiltro = (e) => {
    const { name, value } = e.target;

    setFiltros({
      ...filtros,
      [name]: value
    });
  };

  const consultarInforme = async () => {
    if (!filtros.fecha || !filtros.id_rollo) {
      alert('Fecha y rollo son obligatorios');
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/informe-cobros?fecha=${filtros.fecha}&id_rollo=${filtros.id_rollo}`
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al consultar informe');
        return;
      }

      setResumen(datos.resumen);
      setDetalleClientes(datos.detalle_clientes);
      setConsultado(true);
    } catch (error) {
      console.error('Error consultando informe:', error);
      alert('Error al consultar informe de cobros');
    }
  };

  const limpiar = () => {
    setFiltros({
      fecha: new Date().toISOString().slice(0, 10),
      id_rollo: ''
    });

    setResumen({
      total_clientes: 0,
      total_saldo_actual: 0,
      total_efectivo: 0,
      total_sinpe: 0,
      total_cobrado_fecha: 0,
      total_cobrado_acumulado: 0,
      saldo_pendiente_estimado: 0
    });

    setDetalleClientes([]);
    setConsultado(false);
  };

  const formatoMoneda = (valor) => {
    return Number(valor || 0).toLocaleString('es-CR', {
      style: 'currency',
      currency: 'CRC'
    });
  };

  return (
    <div className="informe-page">
      <header className="informe-header">
        <h2>Informe Cobros</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="informe-card">
        <h3>Filtros del informe</h3>

        <div className="form-grid">
          <div>
            <label>Fecha</label>
            <input
              type="date"
              name="fecha"
              value={filtros.fecha}
              onChange={cambiarFiltro}
            />
          </div>

          <div>
            <label>Rollo</label>
            <select
              name="id_rollo"
              value={filtros.id_rollo}
              onChange={cambiarFiltro}
            >
              <option value="">Seleccione</option>

              {rollos.map((item) => (
                <option key={item.id_rollo} value={item.id_rollo}>
                  {item.numero} - {item.descripcion}
                </option>
              ))}
            </select>
          </div>

          <div className="botones-filtro">
            <button className="btn-consultar" onClick={consultarInforme}>
              Consultar
            </button>

            <button className="btn-limpiar" onClick={limpiar}>
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="informe-card">
        <h3>Resumen del cobro</h3>

      <div className="resumen-grid">
        <div className="resumen-item">
          <span>Total clientes</span>
          <strong>{resumen.total_clientes}</strong>
        </div>

        <div className="resumen-item">
          <span>Saldo actual del rollo</span>
          <strong>{formatoMoneda(resumen.total_saldo_actual)}</strong>
        </div>

        <div className="resumen-item">
          <span>Efectivo en la fecha</span>
          <strong>{formatoMoneda(resumen.total_efectivo)}</strong>
        </div>

        <div className="resumen-item">
          <span>SINPE en la fecha</span>
          <strong>{formatoMoneda(resumen.total_sinpe)}</strong>
        </div>

        <div className="resumen-item">
          <span>Cobrado en la fecha</span>
          <strong>{formatoMoneda(resumen.total_cobrado_fecha)}</strong>
        </div>

        <div className="resumen-item">
          <span>Cobrado acumulado</span>
          <strong>{formatoMoneda(resumen.total_cobrado_acumulado)}</strong>
        </div>

        <div className="resumen-item">
          <span>Saldo pendiente estimado</span>
          <strong>{formatoMoneda(resumen.saldo_pendiente_estimado)}</strong>
        </div>
      </div>
      </section>

      <section className="informe-card">
        <h3>Detalle de clientes del rollo</h3>

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cédula</th>
                <th>Cliente</th>
                <th>Teléfono</th>
                <th>Rollo</th>
                <th>Saldo actual</th>
              </tr>
            </thead>

            <tbody>
              {detalleClientes.map((item) => (
                <tr key={item.id_cliente}>
                  <td>{item.codigo}</td>
                  <td>{item.cedula}</td>
                  <td>{item.nombre}</td>
                  <td>{item.telefono || '-'}</td>
                  <td>{item.numero_rollo} - {item.rollo}</td>
                  <td>{formatoMoneda(item.saldo_actual)}</td>
                </tr>
              ))}

              {detalleClientes.length === 0 && (
                <tr>
                  <td colSpan="6" className="sin-datos">
                    {consultado
                      ? 'No hay clientes para los filtros seleccionados'
                      : 'Seleccione fecha y rollo para consultar'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

export default InformeCobros;