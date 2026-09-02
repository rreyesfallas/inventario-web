import { Navigate, useLocation } from 'react-router-dom';

function RutaProtegida({ children }) {
  const location = useLocation();

  const usuarioGuardado = localStorage.getItem('usuario');

  if (!usuarioGuardado) {
    return <Navigate to="/login" replace />;
  }

  const usuario = JSON.parse(usuarioGuardado);

  if (
    usuario.debe_cambiar_clave === 'S' &&
    location.pathname !== '/cambiar-clave'
  ) {
    return <Navigate to="/cambiar-clave" replace />;
  }

  return children;
}

export default RutaProtegida;