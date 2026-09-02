import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Articulos from './pages/Articulos';
import Clientes from './pages/Clientes';
import Empleados from './pages/Empleados';
import Efectivo from './pages/Efectivo';
import Transacciones from './pages/Transacciones';
import InformeCobros from './pages/InformeCobros';
import EntradasSalidas from './pages/EntradasSalidas';
import HistorialClientes from './pages/HistorialClientes';
import Usuarios from './pages/Usuarios';
import Configuracion from './pages/Configuracion';
import Rollos from './pages/Rollos';
import Vehiculos from './pages/Vehiculos';
import LineasArticulo from './pages/LineasArticulo';
import Bodegas from './pages/Bodegas';
import RutaProtegida from './components/RutaProtegida';
import CambiarClave from './pages/CambiarClave';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />

      <Route
        path="/dashboard"
        element={
          <RutaProtegida>
            <Dashboard />
          </RutaProtegida>
        }
      />

      <Route
        path="/articulos"
        element={
          <RutaProtegida>
            <Articulos />
          </RutaProtegida>
        }
      />

      <Route
        path="/clientes"
        element={
          <RutaProtegida>
            <Clientes />
          </RutaProtegida>
        }
      />

      <Route
        path="/empleados"
        element={
          <RutaProtegida>
            <Empleados />
          </RutaProtegida>
        }
      />

      <Route
        path="/efectivo"
        element={
          <RutaProtegida>
            <Efectivo />
          </RutaProtegida>
        }
      />

      <Route
        path="/transacciones"
        element={
          <RutaProtegida>
            <Transacciones />
          </RutaProtegida>
        }
      />

      <Route
        path="/informe-cobros"
        element={
          <RutaProtegida>
            <InformeCobros />
          </RutaProtegida>
        }
      />

      <Route
        path="/entradas-salidas"
        element={
          <RutaProtegida>
            <EntradasSalidas />
          </RutaProtegida>
        }
      />

      <Route
        path="/historial-clientes"
        element={
          <RutaProtegida>
            <HistorialClientes />
          </RutaProtegida>
        }
      />

      <Route
        path="/usuarios"
        element={
          <RutaProtegida>
            <Usuarios />
          </RutaProtegida>
        }
      />

      <Route
        path="/configuracion"
        element={
          <RutaProtegida>
            <Configuracion />
          </RutaProtegida>
        }
      />

      <Route
        path="/rollos"
        element={
          <RutaProtegida>
            <Rollos />
          </RutaProtegida>
        }
      />

      <Route
        path="/vehiculos"
        element={
          <RutaProtegida>
            <Vehiculos />
          </RutaProtegida>
        }
      />

      <Route
        path="/lineas-articulo"
        element={
          <RutaProtegida>
            <LineasArticulo />
          </RutaProtegida>
        }
      />

      <Route
        path="/bodegas"
        element={
          <RutaProtegida>
            <Bodegas />
          </RutaProtegida>
        }
      />

      <Route
        path="/cambiar-clave"
        element={
          <RutaProtegida> 
            <CambiarClave />
          </RutaProtegida>
        }
      />
    </Routes>
  );
}

export default App;