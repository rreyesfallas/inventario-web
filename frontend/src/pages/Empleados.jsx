import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Empleados.css';

function Empleados() {
  const navigate = useNavigate();

  const [empleados, setEmpleados] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState('');


  const [empleado, setEmpleado] = useState({
    codigo: '',
    nombre: '',
  });


  const limpiarEmpleado = () => {
    setEmpleado({
      codigo: '',
      nombre: '',
      estado: 'ACTIVO'
    });
  };

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setEmpleadoSeleccionado('');

    setEmpleado({
      codigo: '',
      nombre: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setEmpleadoSeleccionado(item.id_empleado);

    setEmpleado({
      codigo: item.codigo || '',
      nombre: item.nombre || ''
    });

    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
  };

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setEmpleado({
      ...empleado,
      [name]: value
    });
  };
  const guardarEmpleado = async () => {
    if (!empleado.codigo || !empleado.nombre) {
      alert('Código y nombre son obligatorios');
      return;
    }

    try { 
      const url =
        modoModal === 'agregar'
          ? 'http://localhost:3001/api/empleados'
          : `http://localhost:3001/api/empleados/${empleadoSeleccionado}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(empleado)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar empleado');
        return;
      }

      alert(datos.mensaje);
      setModalAbierto(false);
      cargarEmpleados();
    } catch (error) {
      console.error('Error guardando empleado:', error);
      alert('Error al guardar empleado');
    }
  };

  const desactivarEmpleado = async (idEmpleado) => {
    const confirmar = confirm('¿Desea desactivar este empleado?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/empleados/${idEmpleado}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar empleado');
        return;
      }

      alert('Empleado desactivado correctamente');
      cargarEmpleados();
    } catch (error) {
      console.error('Error desactivando empleado:', error);
      alert('Error al desactivar empleado');
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
    cargarEmpleados();
  }, []);

  const empleadosFiltrados = empleados.filter((item) => {
    const texto = busqueda.toLowerCase();

    return (
      item.codigo?.toLowerCase().includes(texto) ||
      item.nombre?.toLowerCase().includes(texto)
    );
  });

  return (
    <div className="empleados-page">
      <header className="empleados-header">
        <h2>Empleados</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="empleados-actions">
        <button onClick={abrirModalAgregar}>Agregar</button>
      </section>

      <section className="empleados-lista">
        <h3>Vista de empleados</h3>

        <input
          className="buscar-empleado"
          type="text"
          placeholder="Buscar por código, nombre o estado"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {empleadosFiltrados.map((item) => (
                <tr key={item.codigo}>
                  <td>{item.codigo}</td>
                  <td>{item.nombre}</td>
                  <td>
                    <span
                      className={
                        item.estado === 'ACTIVO'
                          ? 'estado-activo'
                          : 'estado-inactivo'
                      }
                    >
                      {item.estado}
                    </span>
                  </td>
                  <td>
                    <div className="acciones-tabla">
                      <button
                        className="btn-modificar"
                        onClick={() => abrirModalModificar(item)}
                      >
                        Modificar
                      </button>

                      <button
                        className="btn-desactivar"
                        onClick={() => desactivarEmpleado(item.id_empleado)}
                      >
                        Desactivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {empleadosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="4" className="sin-resultados">
                    No hay empleados registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalAbierto && (
        <div className="modal-fondo">
          <div className="modal-contenido">
            <div className="modal-header">
              <h3>
                {modoModal === 'agregar'
                  ? 'Agregar empleado'
                  : 'Modificar empleado'}
              </h3>

              <button onClick={cerrarModal}>X</button>
            </div>

            <div className="modal-form">
              <div>
                <label>Código</label>
                <input
                  type="text"
                  name="codigo"
                  value={empleado.codigo}
                  onChange={cambiarDato}
                  disabled={modoModal === 'modificar'}
                />
              </div>

              <div>
                <label>Nombre</label>
                <input
                  type="text"
                  name="nombre"
                  value={empleado.nombre}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Estado</label>
                <select
                  name="estado"
                  value={empleado.estado}
                  onChange={cambiarDato}
                >
                  <option value="ACTIVO">Activo</option>
                  <option value="INACTIVO">Inactivo</option>
                </select>
              </div>
            </div>

            <div className="modal-botones">
              <button onClick={guardarEmpleado}>Guardar</button>
              <button onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Empleados;