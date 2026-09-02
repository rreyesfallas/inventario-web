import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Clientes.css';

function Clientes() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [clienteSeleccionado, setClienteSeleccionado] = useState('');
  const [rollos, setRollos] = useState([]);
  

  const [cliente, setCliente] = useState({
    codigo: '',
    cedula: '',
    nombre: '',
    direccion: '',
    color_casa: '',
    lado_calle: '',
    numero_rollo: '',
    id_rollo: '',
    telefono: ''
  });

  const clientesFiltrados = clientes.filter((item) => {
    const texto = busqueda.toLowerCase();

    return (
      item.codigo?.toLowerCase().includes(texto) ||
      item.cedula?.toLowerCase().includes(texto) ||
      item.nombre?.toLowerCase().includes(texto) ||
      String(item.numero_rollo || '').toLowerCase().includes(texto) ||
      item.rollo?.toLowerCase().includes(texto)
    );
  });


  const limpiarCliente = () => {
    setCliente({
      codigo: '',
      cedula: '',
      nombre: '',
      direccion: '',
      color_casa: '',
      lado_calle: '',
      numero_rollo: '',
      id_rollo: '',
      telefono: ''
    });
  };

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setClienteSeleccionado('');

    setCliente({
      codigo: '',
      cedula: '',
      nombre: '',
      direccion: '',
      color_casa: '',
      lado_calle: '',
      telefono: '',
      id_rollo: '',
      saldo_actual: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setClienteSeleccionado(item.id_cliente);

    setCliente({
      codigo: item.codigo || '',
      cedula: item.cedula || '',
      nombre: item.nombre || '',
      direccion: item.direccion || '',
      color_casa: item.color_casa || '',
      lado_calle: item.lado_calle || '',
      telefono: item.telefono || '',
      id_rollo: item.id_rollo || '',
      saldo_actual: item.saldo_actual || 0
    });

    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
  };

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setCliente({
      ...cliente,
      [name]: value
    });
  };

  const guardarCliente = async () => {
    if (!cliente.codigo || !cliente.cedula || !cliente.nombre || !cliente.id_rollo) {
      alert('Código, cédula, nombre y rollo son obligatorios');
      return;
    }

    try {
      const url =
        modoModal === 'agregar'
          ? 'http://localhost:3001/api/clientes'
          : `http://localhost:3001/api/clientes/${clienteSeleccionado}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(cliente)
      });

      const datos = await respuesta.json();
      console.log('Respuesta backend:', datos);

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar cliente');
        return;
      }

      alert(datos.mensaje);
      setModalAbierto(false);
      cargarClientes();
    } catch (error) {
      console.error('Error guardando cliente:', error);
      alert('Error al guardar cliente');
    }
  };

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

  useEffect(() => {
      cargarClientes();
      cargarRollos();
    }, []);

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


  const desactivarCliente = async (idCliente) => {
    const confirmar = confirm('¿Desea desactivar este cliente?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/clientes/${idCliente}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar cliente');
        return;
      }

      alert('Cliente desactivado correctamente');
      cargarClientes();
    } catch (error) {
      console.error('Error desactivando cliente:', error);
      alert('Error al desactivar cliente');
    }
  };

  return (
    <div className="clientes-page">
      <header className="clientes-header">
        <h2>Clientes</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="clientes-actions">
        <button onClick={abrirModalAgregar}>Agregar</button>
      </section>

      <section className="clientes-lista">
        <h3>Vista de clientes</h3>

        <input
          type="text"
          className="buscar"
          placeholder="Buscar por código, cédula, nombre, número de rollo o zona"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Cédula</th>
                <th>Nombre</th>
                <th>Rollo</th>
                <th>Zona</th>
                <th>Teléfono</th>
                <th>Saldo</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {clientesFiltrados.map((item) => (
                <tr key={item.id_cliente}>
                  <td>{item.codigo}</td>
                  <td>{item.cedula}</td>
                  <td>{item.nombre}</td>
                  <td>{item.numero_rollo}</td>
                  <td>{item.rollo}</td>
                  <td>{item.telefono || '-'}</td>
                  <td>₡{Number(item.saldo_actual || 0).toLocaleString()}</td>
                  
                  <td>
                    <div className="acciones-tabla">
                      <button
                        className="btn-modificar"
                        onClick={() => abrirModalModificar(item)}
                      >
                        Editar
                      </button>

                      <button
                        className="btn-desactivar"
                        onClick={() => desactivarCliente(item.id_cliente)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {clientesFiltrados.length === 0 && (
                <tr>
                  <td colSpan="8" className="sin-resultados">
                    No se encontraron clientes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="modal-fondo">
          <div className="modal-contenido modal-clientes">
            <div className="modal-header">
              <h3>
                {modoModal === 'agregar'
                  ? 'Agregar cliente'
                  : 'Modificar cliente'}
              </h3>

              <button onClick={cerrarModal}>X</button>
            </div>
            
            <div className="modal-form">

               <div>
                  <label>Código</label>
                   <input
                     type="text"
                     name="codigo"
                     value={cliente.codigo}
                     onChange={cambiarDato}
                     disabled={modoModal === 'modificar'}
                    />
              </div>

              <div>
                <label>Cédula</label>
                <input
                  type="text"
                  name="cedula"
                  value={cliente.cedula}
                  onChange={cambiarDato}
                  disabled={modoModal === 'modificar'}
                />
              </div>

              <div>
                <label>Nombre</label>
                <input
                  type="text"
                  name="nombre"
                  value={cliente.nombre}
                  onChange={cambiarDato}
                />
              </div>

              
              <div>
                <label>Rollo / Zona</label>
                <select
                  name="id_rollo"
                  value={cliente.id_rollo}
                  onChange={cambiarDato}
                >
                  <option value="">Seleccione</option>

                  {rollos.map((item) => (
                    <option key={item.id_rollo} value={item.id_rollo}>
                      {item.numero} - {item.descripcion}
                    </option>
                  ))}
                </select>
            </div>

              <div className="full">
                <label>Dirección</label>
                <input
                  type="text"
                  name="direccion"
                  value={cliente.direccion}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Color de casa</label>
                <input
                  type="text"
                  name="color_casa"
                  value={cliente.color_casa}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Lado de la calle</label>
                <select
                  name="lado_calle"
                  value={cliente.lado_calle}
                  onChange={cambiarDato}
                >
                  <option value="">Seleccione</option>
                  <option value="DERECHO">Derecho</option>
                  <option value="IZQUIERDO">Izquierdo</option>
                </select>
              </div>

              <div>
                <label>Teléfono</label>
                <input
                  type="text"
                  name="telefono"
                  value={cliente.telefono}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Saldo</label>
            <input
              type="number"
              name="saldo_actual"
              value={cliente.saldo_actual}
              onChange={cambiarDato}
              placeholder="Digite saldo inicial"
              min="0"
              disabled={modoModal === 'modificar'}
            />
              </div>
            </div>

            <div className="modal-botones">
              <button onClick={guardarCliente}>Guardar</button>
              <button onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Clientes;