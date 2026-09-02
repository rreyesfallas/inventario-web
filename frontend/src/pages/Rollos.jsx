import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Rollos.css';

function Rollos() {
  const navigate = useNavigate();

  const [rollos, setRollos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [rolloSeleccionado, setRolloSeleccionado] = useState('');
  const [vehiculos, setVehiculos] = useState([]);

  const [rollo, setRollo] = useState({
    numero: '',
    descripcion: '',
    dia_cobro: '',
    id_vehiculo: ''
  });

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

  useEffect(() => {
    cargarRollos();
    cargarVehiculos();
  }, []);

  const rollosFiltrados = rollos.filter((item) => {
    const texto = busqueda.toLowerCase();

    return (
      String(item.numero || '').toLowerCase().includes(texto) ||
      item.descripcion?.toLowerCase().includes(texto) ||
      item.dia_cobro?.toLowerCase().includes(texto) ||
      item.vehiculo?.toLowerCase().includes(texto)
    );
  });

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setRollo({
      ...rollo,
      [name]: value
    });
  };

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setRolloSeleccionado('');

    setRollo({
      numero: '',
      descripcion: '',
      dia_cobro: '',
      id_vehiculo: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setRolloSeleccionado(item.id_rollo);

    setRollo({
      numero: item.numero || '',
      descripcion: item.descripcion || '',
      dia_cobro: item.dia_cobro || '',
      id_vehiculo: item.id_vehiculo || ''
    });

    setModalAbierto(true);
  };

  const guardarRollo = async () => {
    if (!rollo.numero || !rollo.descripcion || !rollo.dia_cobro) {
      alert('Número, descripción y día de cobro son obligatorios');
      return;
    }

    try {
      const url =
        modoModal === 'agregar'
          ? 'http://localhost:3001/api/rollos'
          : `http://localhost:3001/api/rollos/${rolloSeleccionado}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(rollo)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar rollo');
        return;
      }

      alert(datos.mensaje);
      setModalAbierto(false);
      cargarRollos();
    } catch (error) {
      console.error('Error guardando rollo:', error);
      alert('Error al guardar rollo');
    }
  };

  const desactivarRollo = async (idRollo) => {
    const confirmar = confirm('¿Desea desactivar este rollo?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/rollos/${idRollo}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar rollo');
        return;
      }

      alert('Rollo desactivado correctamente');
      cargarRollos();
    } catch (error) {
      console.error('Error desactivando rollo:', error);
      alert('Error al desactivar rollo');
    }
  };

  return (
    <div className="rollos-page">
      <header className="rollos-header">
        <h2>Rollos</h2>
        <button onClick={() => navigate('/configuracion')}>Volver</button>
      </header>

      <button className="btn-agregar" onClick={abrirModalAgregar}>
        Agregar
      </button>

      <section className="rollos-card">
        <h3>Vista de rollos</h3>

        <input
          type="text"
          className="buscar"
          placeholder="Buscar por número, zona, día o vehículo"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Zona / Descripción</th>
              <th>Día de cobro</th>
              <th>Vehículo</th>
              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {rollosFiltrados.map((item) => (
              <tr key={item.id_rollo}>
                <td>{item.numero}</td>
                <td>{item.descripcion}</td>
                <td>{item.dia_cobro}</td>
                <td>{item.vehiculo || '-'}</td>
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
                      onClick={() => desactivarRollo(item.id_rollo)}
                    >
                      Desactivar
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {rollosFiltrados.length === 0 && (
              <tr>
                <td colSpan="5" className="sin-datos">
                  No se encontraron rollos
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                ? 'Agregar rollo'
                : 'Modificar rollo'}
            </h3>

            <div className="modal-grid">
              <div>
                <label>Número</label>
                <input
                  type="text"
                  name="numero"
                  value={rollo.numero}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Día de cobro</label>
                <select
                  name="dia_cobro"
                  value={rollo.dia_cobro}
                  onChange={cambiarDato}
                >
                  <option value="">Seleccione</option>
                  <option value="LUNES">Lunes</option>
                  <option value="MARTES">Martes</option>
                  <option value="MIERCOLES">Miércoles</option>
                  <option value="JUEVES">Jueves</option>
                  <option value="VIERNES">Viernes</option>
                  <option value="SABADO">Sábado</option>
                  <option value="DOMINGO">Domingo</option>
                </select>
              </div>

              <div className="campo-completo">
                <label>Zona / Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={rollo.descripcion}
                  onChange={cambiarDato}
                />
              </div>
            </div>

            <div className="campo-completo">
                <label>Vehículo asignado</label>
                <select
                    name="id_vehiculo"
                    value={rollo.id_vehiculo}
                    onChange={cambiarDato}
                >
                    <option value="">Sin asignar</option>

                    {vehiculos.map((item) => (
                    <option key={item.id_vehiculo} value={item.id_vehiculo}>
                        {item.codigo} - {item.descripcion}
                    </option>
                    ))}
                </select>
            </div>

            <div className="modal-acciones">
              <button className="btn-guardar" onClick={guardarRollo}>
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

export default Rollos;