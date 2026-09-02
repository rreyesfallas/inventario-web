import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Login.css';
import { useEffect} from 'react';

function Login() {
  const navigate = useNavigate();

  const [datos, setDatos] = useState({
    login: '',
    password: ''
  });

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setDatos({
      ...datos,
      [name]: value
    });
  };

  const iniciarSesion = async (e) => {
    e.preventDefault();

    if (!datos.login || !datos.password) {
      alert('Digite usuario y contraseña');
      return;
    }

    try {
      const respuesta = await fetch('http://localhost:3001/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(datos)
      });

      const resultado = await respuesta.json();

      if (!respuesta.ok) {
        alert(resultado.mensaje || 'Error al iniciar sesión');
        return;
      }

      localStorage.setItem('usuario', JSON.stringify(resultado.usuario));

      if (resultado.usuario.debe_cambiar_clave === 'S') {
        navigate('/cambiar-clave');
      } else {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error iniciando sesión:', error);
      alert('Error de conexión con el servidor');
    }
 
  };

  useEffect(() => {
    const usuarioGuardado = localStorage.getItem('usuario');

    if (usuarioGuardado) {
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Sistema de Inventario</h1>
        <p>Inicio de sesión</p>

        <form onSubmit={iniciarSesion}>
          <div className="form-group">
            <label>Usuario</label>
            <input
              type="text"
              name="login"
              value={datos.login}
              onChange={cambiarDato}
              placeholder="Digite su usuario"
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label>Contraseña</label>
            <input
              type="password"
              name="password"
              value={datos.password}
              onChange={cambiarDato}
              placeholder="Digite su contraseña"
              autoComplete="current-password"
            />
          </div>

          <button type="submit">Ingresar</button>
        </form>
      </div>
    </div>
  );
}

export default Login;