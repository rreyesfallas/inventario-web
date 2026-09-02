import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Vehiculos.css';

function Vehiculos() {
  const navigate = useNavigate();

  const [vehiculos, setVehiculos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [vehiculoSeleccionado, setVehiculoSeleccionado] = useState('');

  const [vehiculo, setVehiculo] = useState({
    codigo: '',
    descripcion: '',
    id_empleado: ''
  });

  const cargarVehiculos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/vehiculos');
      const datos = await respuesta.json();

      setVehiculos(datos);
    } catch (error) {
      console.error('Error cargando vehículos:', error);
      alert('Error al cargar vehículos');
    }
  };

  const cargarEmpleados = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/empleados');
      const datos = await respuesta.json();

      setEmpleados(datos);
    } catch (error) {
      console.error('Error cargando empleados:', error);
      alert('Error al cargar empleados');
    }
  };

  useEffect(() => {
    cargarVehiculos();
    cargarEmpleados();
  }, []);

  const vehiculosFiltrados = vehiculos.filter((item) => {
    const texto = busqueda.toLowerCase();

    return (
      item.codigo?.toLowerCase().includes(texto) ||
      item.descripcion?.toLowerCase().includes(texto) ||
      item.empleado?.toLowerCase().includes(texto)
    );
  });

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setVehiculo({
      ...vehiculo,
      [name]: value
    });
  };

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setVehiculoSeleccionado('');

    setVehiculo({
      codigo: '',
      descripcion: '',
      id_empleado: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setVehiculoSeleccionado(item.id_vehiculo);

    setVehiculo({
      codigo: item.codigo || '',
      descripcion: item.descripcion || '',
      id_empleado: item.id_empleado || ''
    });

    setModalAbierto(true);
  };

  const guardarVehiculo = async () => {
    if (!vehiculo.codigo || !vehiculo.descripcion) {
      alert('Código y descripción son obligatorios');
      return;
    }

    try {
      const url =
        modoModal === 'agregar'
          ? 'http://localhost:3001/api/vehiculos'
          : `http://localhost:3001/api/vehiculos/${vehiculoSeleccionado}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(vehiculo)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar vehículo');
        return;
      }

      alert(datos.mensaje);
      setModalAbierto(false);
      cargarVehiculos();
    } catch (error) {
      console.error('Error guardando vehículo:', error);
      alert('Error al guardar vehículo');
    }
  };

  const desactivarVehiculo = async (idVehiculo) => {
    const confirmar = confirm('¿Desea desactivar este vehículo?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/vehiculos/${idVehiculo}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar vehículo');
        return;
      }

      alert('Vehículo desactivado correctamente');
      cargarVehiculos();
    } catch (error) {
      console.error('Error desactivando vehículo:', error);
      alert('Error al desactivar vehículo');
    }
  };

  return (
    <div className="vehiculos-page">
      <header className="vehiculos-header">
        <h2>Vehículos</h2>
        <button onClick={() => navigate('/configuracion')}>Volver</button>
      </header>

      <button className="btn-agregar" onClick={abrirModalAgregar}>
        Agregar
      </button>

      <section className="vehiculos-card">
        <h3>Vista de vehículos</h3>

        <input
          type="text"
          className="buscar"
          placeholder="Buscar por código, descripción o empleado"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descripción</th>
                <th>Empleado asignado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {vehiculosFiltrados.map((item) => (
                <tr key={item.id_vehiculo}>
                  <td>{item.codigo}</td>
                  <td>{item.descripcion}</td>
                  <td>{item.empleado || '-'}</td>
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
                        onClick={() => desactivarVehiculo(item.id_vehiculo)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {vehiculosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="4" className="sin-datos">
                    No se encontraron vehículos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="modal-fondo">
          <div className="modal">
            <button
              className="btn-cerrar"
              onClick={() => setModalAbierto(false)}
            >
              X
            </button>

            <h3>
              {modoModal === 'agregar'
                ? 'Agregar vehículo'
                : 'Modificar vehículo'}
            </h3>

            <div className="modal-grid">
              <div>
                <label>Código</label>
                <input
                  type="text"
                  name="codigo"
                  value={vehiculo.codigo}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Empleado asignado</label>
                <select
                  name="id_empleado"
                  value={vehiculo.id_empleado}
                  onChange={cambiarDato}
                >
                  <option value="">Sin asignar</option>

                  {empleados.map((item) => (
                    <option key={item.id_empleado} value={item.id_empleado}>
                      {item.codigo} - {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="campo-completo">
                <label>Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={vehiculo.descripcion}
                  onChange={cambiarDato}
                />
              </div>
            </div>

            <div className="modal-acciones">
              <button className="btn-guardar" onClick={guardarVehiculo}>
                Guardar
              </button>

              <button
                className="btn-cancelar"
                onClick={() => setModalAbierto(false)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Vehiculos;   