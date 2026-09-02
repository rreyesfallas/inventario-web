import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Transacciones.css';

function Transacciones() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaMovimiento, setBusquedaMovimiento] = useState('');

  const [modalClientesAbierto, setModalClientesAbierto] = useState(false);
  const [modalMovimientosAbierto, setModalMovimientosAbierto] = useState(false);

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const [clienteDestinoSeleccionado, setClienteDestinoSeleccionado] = useState(null);
  const [modalClienteDestinoAbierto, setModalClienteDestinoAbierto] = useState(false);
  const [busquedaClienteDestino, setBusquedaClienteDestino] = useState('');

  const [transaccion, setTransaccion] = useState({
    tipo: 'ABONO',
    fecha: new Date().toISOString().slice(0, 10),
    monto: '',
    observacion: ''
  });

  const cargarClientes = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/clientes');
      const datos = await respuesta.json();

      setClientes(datos);
    } catch (error) {
      console.error('Error cargando clientes:', error);
      alert('Error al cargar clientes');
    }
  };

  const cargarMovimientos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/transacciones');
      const datos = await respuesta.json();

      setMovimientos(datos);
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      alert('Error al cargar movimientos');
    }
  };

  useEffect(() => {
    cargarClientes();
    cargarMovimientos();
  }, []);

  const seleccionarCliente = (item) => {
    setClienteSeleccionado(item);
    setModalClientesAbierto(false);
    setBusquedaCliente('');
  };

  const seleccionarClienteDestino = (item) => {
    setClienteDestinoSeleccionado(item);
    setModalClienteDestinoAbierto(false);
    setBusquedaClienteDestino('');
  };

  const cambiarTransaccion = (e) => {
    const { name, value } = e.target;

    setTransaccion({
      ...transaccion,
      [name]: value
    });

    if (name === 'tipo' && value !== 'TRANSFERENCIA') {
      setClienteDestinoSeleccionado(null);
    }
  };
  

  const guardarTransaccion = async () => {
    if (!clienteSeleccionado) {
      alert('Seleccione un cliente origen');
      return;
    }

    if (!transaccion.fecha || !transaccion.monto) {
      alert('Fecha y monto son obligatorios');
      return;
    }

    const monto = Number(transaccion.monto);

    if (monto <= 0) {
      alert('El monto debe ser mayor a cero');
      return;
    }

    const saldoActual = Number(clienteSeleccionado.saldo_actual || 0);

    if (
      (transaccion.tipo === 'ABONO' ||
        transaccion.tipo === 'DEVOLUCION' ||
        transaccion.tipo === 'TRANSFERENCIA') &&
      monto > saldoActual
    ) {
      alert('El monto no puede ser mayor al saldo actual del cliente origen');
      return;
    }

    if (transaccion.tipo === 'TRANSFERENCIA' && !clienteDestinoSeleccionado) {
      alert('Seleccione el cliente destino');
      return;
    }

    if (
      transaccion.tipo === 'TRANSFERENCIA' &&
      clienteDestinoSeleccionado &&
      clienteDestinoSeleccionado.id_cliente === clienteSeleccionado.id_cliente
    ) {
      alert('El cliente origen y destino no pueden ser el mismo');
      return;
    }

    try {
      let endpoint = '';
      let body = {};

      if (transaccion.tipo === 'ABONO') {
        endpoint = 'http://localhost:3001/api/transacciones/abono';

        body = {
          id_cliente: clienteSeleccionado.id_cliente,
          fecha: transaccion.fecha,
          monto: transaccion.monto,
          observacion: transaccion.observacion
        };
      }

      if (transaccion.tipo === 'VENTA') {
        endpoint = 'http://localhost:3001/api/transacciones/venta';

        body = {
          id_cliente: clienteSeleccionado.id_cliente,
          fecha: transaccion.fecha,
          monto: transaccion.monto,
          observacion: transaccion.observacion
        };
      }

      if (transaccion.tipo === 'DEVOLUCION') {
        endpoint = 'http://localhost:3001/api/transacciones/devolucion';

        body = {
          id_cliente: clienteSeleccionado.id_cliente,
          fecha: transaccion.fecha,
          monto: transaccion.monto,
          observacion: transaccion.observacion
        };
      }

      if (transaccion.tipo === 'TRANSFERENCIA') {
        endpoint = 'http://localhost:3001/api/transacciones/transferencia';

        body = {
          id_cliente_origen: clienteSeleccionado.id_cliente,
          id_cliente_destino: clienteDestinoSeleccionado.id_cliente,
          fecha: transaccion.fecha,
          monto: transaccion.monto,
          observacion: transaccion.observacion
        };
      }

      const respuesta = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar transacción');
        return;
      }

      alert(datos.mensaje);

      if (transaccion.tipo === 'TRANSFERENCIA') {
        setClienteSeleccionado({
          ...clienteSeleccionado,
          saldo_actual: datos.saldo_nuevo_origen
        });
      } else {
        setClienteSeleccionado({
          ...clienteSeleccionado,
          saldo_actual: datos.saldo_nuevo
        });
      }

      setClienteDestinoSeleccionado(null);

      setTransaccion({
        tipo: 'ABONO',
        fecha: new Date().toISOString().slice(0, 10),
        monto: '',
        observacion: ''
      });

      cargarClientes();
      cargarMovimientos();
    } catch (error) {
      console.error('Error guardando transacción:', error);
      alert('Error al guardar transacción');
    }
  };

  const clientesFiltrados = clientes.filter((item) => {
    const texto = busquedaCliente.toLowerCase();

    return (
      item.codigo?.toLowerCase().includes(texto) ||
      item.cedula?.toLowerCase().includes(texto) ||
      item.nombre?.toLowerCase().includes(texto) ||
      String(item.numero_rollo || '').toLowerCase().includes(texto) ||
      item.rollo?.toLowerCase().includes(texto)
    );
  });

  const clientesDestinoFiltrados = clientes.filter((item) => {
    const texto = busquedaClienteDestino.toLowerCase();

    const coincideBusqueda =
      item.codigo?.toLowerCase().includes(texto) ||
      item.cedula?.toLowerCase().includes(texto) ||
      item.nombre?.toLowerCase().includes(texto) ||
      String(item.numero_rollo || '').toLowerCase().includes(texto) ||
      item.rollo?.toLowerCase().includes(texto);

    const noEsClienteOrigen =
      !clienteSeleccionado ||
      item.id_cliente !== clienteSeleccionado.id_cliente;

    return coincideBusqueda && noEsClienteOrigen;
  });

  const movimientosFiltrados = movimientos.filter((item) => {
    const texto = busquedaMovimiento.toLowerCase();

    return (
      item.codigo_cliente?.toLowerCase().includes(texto) ||
      item.cliente?.toLowerCase().includes(texto) ||
      item.tipo_movimiento?.toLowerCase().includes(texto) ||
      String(item.fecha || '').toLowerCase().includes(texto)
    );
  });

  const formatoMoneda = (valor) => {
    return Number(valor || 0).toLocaleString('es-CR', {
      style: 'currency',
      currency: 'CRC'
    });
  };

  return (
    <div className="transacciones-page">
      <header className="transacciones-header">
        <h2>Transacciones</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <div className="barra-acciones">
        <button
          className="btn-vista"
          onClick={() => setModalClientesAbierto(true)}
        >
          Vista de clientes
        </button>

        <button
          className="btn-vista"
          onClick={() => setModalMovimientosAbierto(true)}
        >
          Vista de movimientos
        </button>
      </div>

      <section className="transacciones-card">
        <h3>Cliente seleccionado</h3>

        <div className="cliente-info">
          <p>
            <strong>Código:</strong>{' '}
            {clienteSeleccionado ? clienteSeleccionado.codigo : '-'}
          </p>

          <p>
            <strong>Cliente:</strong>{' '}
            {clienteSeleccionado ? clienteSeleccionado.nombre : '-'}
          </p>

          <p>
            <strong>Rollo:</strong>{' '}
            {clienteSeleccionado
              ? `${clienteSeleccionado.numero_rollo || '-'} - ${clienteSeleccionado.rollo || '-'}`
              : '-'}
          </p>

          <p>
            <strong>Saldo actual:</strong>{' '}
            {clienteSeleccionado
              ? formatoMoneda(clienteSeleccionado.saldo_actual)
              : formatoMoneda(0)}
          </p>
        </div>
      </section>

      <section className="transacciones-card">
        <h3>Registrar transacción</h3>

        <div className="form-grid">
          <div>
            <label>Tipo</label>
            <select
              name="tipo"
              value={transaccion.tipo}
              onChange={cambiarTransaccion}
            >
              <option value="ABONO">Abono</option>
              <option value="VENTA">Venta</option>
              <option value="DEVOLUCION">Devolución</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>

          {transaccion.tipo === 'TRANSFERENCIA' && (
            <div>
              <label>Cliente destino</label>

              <button
                type="button"
                className="btn-buscar-cliente"
                onClick={() => setModalClienteDestinoAbierto(true)}
              >
                {clienteDestinoSeleccionado
                  ? `${clienteDestinoSeleccionado.codigo} - ${clienteDestinoSeleccionado.nombre}`
                  : 'Seleccionar destino'}
              </button>
            </div>
          )}

          <div>
            <label>Fecha</label>
            <input
              type="date"
              name="fecha"
              value={transaccion.fecha}
              onChange={cambiarTransaccion}
            />
          </div>

          <div>
            <label>Monto</label>
            <input
              type="number"
              name="monto"
              value={transaccion.monto}
              onChange={cambiarTransaccion}
              min="0"
            />
          </div>

          <div>
            <label>Observación</label>
            <input
              type="text"
              name="observacion"
              value={transaccion.observacion}
              onChange={cambiarTransaccion}
            />
          </div>
        </div>

        <div className="acciones-finales">
          <button className="btn-guardar" onClick={guardarTransaccion}>
           Guardar transacción
          </button>
        </div>
      </section>

      {modalClientesAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalClientesAbierto(false)}
            >
              X
            </button>

            <h3>Vista de clientes</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por código, cédula, nombre, rollo o zona"
              value={busquedaCliente}
              onChange={(e) => setBusquedaCliente(e.target.value)}
            />

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cédula</th>
                    <th>Cliente</th>
                    <th>Rollo</th>
                    <th>Saldo actual</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {clientesFiltrados.map((item) => (
                    <tr key={item.id_cliente}>
                      <td>{item.codigo}</td>
                      <td>{item.cedula}</td>
                      <td>{item.nombre}</td>
                      <td>{item.numero_rollo} - {item.rollo}</td>
                      <td>{formatoMoneda(item.saldo_actual)}</td>
                      <td>
                        <button
                          className="btn-seleccionar"
                          onClick={() => seleccionarCliente(item)}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {clientesFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="sin-datos">
                        No se encontraron clientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalMovimientosAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalMovimientosAbierto(false)}
            >
              X
            </button>

            <h3>Vista de movimientos de clientes</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por cliente, código, fecha o tipo"
              value={busquedaMovimiento}
              onChange={(e) => setBusquedaMovimiento(e.target.value)}
            />

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Código</th>
                    <th>Cliente</th>
                    <th>Tipo</th>
                    <th>Monto</th>
                    <th>Saldo anterior</th>
                    <th>Saldo nuevo</th>
                    <th>Observación</th>
                  </tr>
                </thead>

                <tbody>
                  {movimientosFiltrados.map((item) => (
                    <tr key={item.id_movimiento_cliente}>
                      <td>{new Date(item.fecha).toLocaleDateString('es-CR')}</td>
                      <td>{item.codigo_cliente}</td>
                      <td>{item.cliente}</td>
                      <td>{item.tipo_movimiento}</td>
                      <td>{formatoMoneda(item.monto)}</td>
                      <td>{formatoMoneda(item.saldo_anterior)}</td>
                      <td>{formatoMoneda(item.saldo_nuevo)}</td>
                      <td>{item.observacion || '-'}</td>
                    </tr>
                  ))}

                  {movimientosFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="8" className="sin-datos">
                        No hay movimientos registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {modalClienteDestinoAbierto && (
        <div className="modal-fondo">
          <div className="modal-vista">
            <button
              className="btn-cerrar"
              onClick={() => setModalClienteDestinoAbierto(false)}
            >
              X
            </button>

            <h3>Vista de clientes destino</h3>

            <input
              type="text"
              className="buscar"
              placeholder="Buscar por código, cédula, nombre, rollo o zona"
              value={busquedaClienteDestino}
              onChange={(e) => setBusquedaClienteDestino(e.target.value)}
            />

            <div className="tabla-contenedor">
              <table>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Cédula</th>
                    <th>Cliente</th>
                    <th>Rollo</th>
                    <th>Saldo actual</th>
                    <th>Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {clientesDestinoFiltrados.map((item) => (
                    <tr key={item.id_cliente}>
                      <td>{item.codigo}</td>
                      <td>{item.cedula}</td>
                      <td>{item.nombre}</td>
                      <td>{item.numero_rollo} - {item.rollo}</td>
                      <td>{formatoMoneda(item.saldo_actual)}</td>
                      <td>
                        <button
                          className="btn-seleccionar"
                          onClick={() => seleccionarClienteDestino(item)}
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}

                  {clientesDestinoFiltrados.length === 0 && (
                    <tr>
                      <td colSpan="6" className="sin-datos">
                        No se encontraron clientes destino
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Transacciones;