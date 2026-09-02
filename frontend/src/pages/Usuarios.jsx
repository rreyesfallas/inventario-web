import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Usuarios.css';

function Usuarios() {
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');

  const [usuarioActual, setUsuarioActual] = useState(null);

  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');

  const [usuario, setUsuario] = useState({
    id_usuario: null,
    login: '',
    nombre: '',
    password: '',
    nivel: 'ADMIN'
  });

  const [mostrarModalClave, setMostrarModalClave] = useState(false);
  const [usuarioClave, setUsuarioClave] = useState(null);
  const [nuevaClave, setNuevaClave] = useState('');

  const cargarUsuarios = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/usuarios');
      const datos = await respuesta.json();

      setUsuarios(datos);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      alert('Error al cargar usuarios');
    }
  };

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');

    if (usuarioGuardado) {
      setUsuarioActual(JSON.parse(usuarioGuardado));
    }

    cargarUsuarios();
  }, []);
  

  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setUsuario({
      id_usuario: null,
      login: '',
      nombre: '',
      password: '',
      nivel: 'ADMIN'
    });
    setMostrarModal(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setUsuario({
      id_usuario: item.id_usuario,
      login: item.login,
      nombre: item.nombre,
      password: '',
      nivel: item.nivel
    });
    setMostrarModal(true);
  };

  const cerrarModal = () => {
    setMostrarModal(false);
  };

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setUsuario({
      ...usuario,
      [name]: value
    });
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();

    if (!usuario.login || !usuario.nombre || !usuario.nivel) {
      alert('Usuario, nombre y nivel son obligatorios');
      return;
    }

    if (modoModal === 'agregar' && !usuario.password) {
      alert('La contraseña es obligatoria');
      return;
    }

    try {
      const url = modoModal === 'agregar'
        ? 'http://localhost:3001/api/usuarios'
        : `http://localhost:3001/api/usuarios/${usuario.id_usuario}`;

      const metodo = modoModal === 'agregar' ? 'POST' : 'PUT';

      const body = modoModal === 'agregar'
        ? {
            login: usuario.login,
            nombre: usuario.nombre,
            password: usuario.password,
            nivel: usuario.nivel
          }
        : {
            login: usuario.login,
            nombre: usuario.nombre,
            nivel: usuario.nivel
          };

      const respuesta = await fetch(url, {
        method: metodo,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al guardar usuario');
        return;
      }

      alert(datos.mensaje);
      cerrarModal();
      cargarUsuarios();
    } catch (error) {
      console.error('Error guardando usuario:', error);
      alert('Error al guardar usuario');
    }
  };

  const desactivarUsuario = async (item) => {
    if (Number(usuarioActual?.id_usuario) === Number(item.id_usuario)) {
      alert('No puede desactivar el usuario con el que inició sesión');
      return;
    }

    const confirmar = window.confirm(
      `¿Seguro que desea desactivar el usuario ${item.login}?`
    );

    if (!confirmar) return;

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/usuarios/${item.id_usuario}/desactivar`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            id_usuario_actual: usuarioActual.id_usuario
          })
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar usuario');
        return;
      }

      alert(datos.mensaje);
      cargarUsuarios();
    } catch (error) {
      console.error('Error desactivando usuario:', error);
      alert('Error al desactivar usuario');
    }
  };

  const abrirRestablecerClave = (item) => {
    setUsuarioClave(item);
    setNuevaClave('');
    setMostrarModalClave(true);
  };

  const cerrarModalClave = () => {
    setMostrarModalClave(false);
    setUsuarioClave(null);
    setNuevaClave('');
  };

  const restablecerClave = async (e) => {
    e.preventDefault();

    if (!nuevaClave) {
      alert('Digite la nueva contraseña');
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/usuarios/${usuarioClave.id_usuario}/restablecer-clave`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            nuevaClave
          })
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al restablecer contraseña');
        return;
      }

      alert(datos.mensaje);
      cerrarModalClave();
      cargarUsuarios();
    } catch (error) {
      console.error('Error restableciendo contraseña:', error);
      alert('Error al restablecer contraseña');
    }
  };

  const usuariosFiltrados = usuarios.filter((item) => {
    const texto = `${item.login} ${item.nombre} ${item.nivel}`.toLowerCase();
    return texto.includes(busqueda.toLowerCase());
  });

  return (
    <div className="usuarios-page">
      <header className="usuarios-header">
        <h2>Usuarios</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <div className="usuarios-acciones">
        <button className="btn-agregar" onClick={abrirModalAgregar}>
          Agregar
        </button>
      </div>

      <section className="usuarios-card">
        <h3>Vista de usuarios</h3>

        <input
          className="buscador"
          type="text"
          placeholder="Buscar por usuario, nombre o nivel"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Nombre</th>
                <th>Nivel</th>
                <th>Cambiar clave</th>
                <th>Fecha creación</th>
                <th>Acciones</th>
              </tr>
            </thead>

            <tbody>
              {usuariosFiltrados.map((item) => (
                <tr key={item.id_usuario}>
                  <td>{item.login}</td>
                  <td>{item.nombre}</td>
                  <td>{item.nivel}</td>
                  <td>{item.debe_cambiar_clave === 'S' ? 'Sí' : 'No'}</td>
                  <td>
                    {item.fecha_creacion
                      ? new Date(item.fecha_creacion).toLocaleDateString('es-CR')
                      : '-'}
                  </td>
                  <td>
                    <button
                      className="btn-editar"
                      onClick={() => abrirModalModificar(item)}
                    >
                      Editar
                    </button>

                    <button
                      className="btn-clave"
                      onClick={() => abrirRestablecerClave(item)}
                    >
                      Clave
                    </button>

                    {Number(usuarioActual?.id_usuario) !== Number(item.id_usuario) && (
                      <button
                        className="btn-desactivar"
                        onClick={() => desactivarUsuario(item)}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                </tr>
              ))}

              {usuariosFiltrados.length === 0 && (
                <tr>
                  <td colSpan="6" className="sin-datos">
                    No hay usuarios registrados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {mostrarModal && (
        <div className="modal-fondo">
          <div className="modal">
            <h3>
              {modoModal === 'agregar'
                ? 'Agregar usuario'
                : 'Modificar usuario'}
            </h3>

            <form onSubmit={guardarUsuario}>
              <div className="form-grid">
                <div>
                  <label>Usuario</label>
                  <input
                    type="text"
                    name="login"
                    value={usuario.login}
                    onChange={cambiarDato}
                  />
                </div>

                <div>
                  <label>Nombre</label>
                  <input
                    type="text"
                    name="nombre"
                    value={usuario.nombre}
                    onChange={cambiarDato}
                  />
                </div>

                {modoModal === 'agregar' && (
                  <div>
                    <label>Contraseña temporal</label>
                    <input
                      type="password"
                      name="password"
                      value={usuario.password}
                      onChange={cambiarDato}
                    />
                  </div>
                )}

                <div>
                  <label>Nivel</label>
                  <select
                    name="nivel"
                    value={usuario.nivel}
                    onChange={cambiarDato}
                  >
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
              </div>

              <div className="modal-botones">
                <button type="submit" className="btn-guardar">
                  Guardar
                </button>

                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={cerrarModal}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mostrarModalClave && (
        <div className="modal-fondo">
          <div className="modal modal-clave">
            <h3>Restablecer contraseña</h3>

            <p className="texto-clave">
              Usuario: <strong>{usuarioClave?.login}</strong>
            </p>

            <form onSubmit={restablecerClave}>
              <div className="form-grid">
                <div>
                  <label>Nueva contraseña temporal</label>
                  <input
                    type="password"
                    value={nuevaClave}
                    onChange={(e) => setNuevaClave(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-botones">
                <button type="submit" className="btn-guardar">
                  Restablecer
                </button>

                <button
                  type="button"
                  className="btn-cancelar"
                  onClick={cerrarModalClave}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Usuarios;