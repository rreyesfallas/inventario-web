import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './CambiarClave.css';

function CambiarClave() {
  const navigate = useNavigate();

  const [usuario, setUsuario] = useState(null);

  const [datos, setDatos] = useState({
    claveActual: '',
    nuevaClave: '',
    confirmarClave: ''
  });

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');

    if (!usuarioGuardado) {
      navigate('/login');
      return;
    }

    setUsuario(JSON.parse(usuarioGuardado));
  }, [navigate]);

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setDatos({
      ...datos,
      [name]: value
    });
  };

  const guardarClave = async (e) => {
    e.preventDefault();

    if (!datos.claveActual || !datos.nuevaClave || !datos.confirmarClave) {
      alert('Todos los campos son obligatorios');
      return;
    }

    if (datos.nuevaClave !== datos.confirmarClave) {
      alert('La nueva contraseña y la confirmación no coinciden');
      return;
    }

    try {
      const respuesta = await fetch('http://localhost:3001/api/auth/cambiar-clave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id_usuario: usuario.id_usuario,
          claveActual: datos.claveActual,
          nuevaClave: datos.nuevaClave,
          confirmarClave: datos.confirmarClave
        })
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'Error al cambiar contraseña');
        return;
      }

      const usuarioActualizado = {
        ...usuario,
        debe_cambiar_clave: 'N'
      };

      localStorage.setItem('usuario', JSON.stringify(usuarioActualizado));

      alert(resultado.mensaje);
      navigate('/dashboard');
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      alert('Error de conexión con el servidor');
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem('usuario');
    navigate('/login');
  };

  return (
    <div className="cambiar-clave-page">
      <div className="cambiar-clave-card">
        <h1>Cambiar contraseña</h1>

        <p>
          Por seguridad, debe cambiar su contraseña antes de continuar.
        </p>

        <form onSubmit={guardarClave}>
          <div className="form-group">
            <label>Contraseña actual</label>
            <input
              type="password"
              name="claveActual"
              value={datos.claveActual}
              onChange={cambiarDato}
              autoComplete="current-password"
            />
          </div>

          <div className="form-group">
            <label>Nueva contraseña</label>
            <input
              type="password"
              name="nuevaClave"
              value={datos.nuevaClave}
              onChange={cambiarDato}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label>Confirmar nueva contraseña</label>
            <input
              type="password"
              name="confirmarClave"
              value={datos.confirmarClave}
              onChange={cambiarDato}
              autoComplete="new-password"
            />
          </div>

          <button type="submit" className="btn-guardar">
            Guardar contraseña
          </button>

          <button type="button" className="btn-salir" onClick={cerrarSesion}>
            Salir
          </button>
        </form>
      </div>
    </div>
  );
}

export default CambiarClave;