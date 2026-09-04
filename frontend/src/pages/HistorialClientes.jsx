import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HistorialClientes.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

function HistorialClientes() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [historial, setHistorial] = useState([]);

  const [clienteSeleccionado, setClienteSeleccionado] = useState(null);

  const [modalClientesAbierto, setModalClientesAbierto] = useState(false);

  const [busquedaCliente, setBusquedaCliente] = useState('');
  const [busquedaHistorial, setBusquedaHistorial] = useState('');
  

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

  const cargarHistorialCliente = async (idCliente) => {
    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/transacciones/cliente/${idCliente}`
      );

      const datos = await respuesta.json();

      setHistorial(datos);
    } catch (error) {
      console.error('Error cargando historial del cliente:', error);
      alert('Error al cargar historial del cliente');
    }
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const seleccionarCliente = (item) => {
    setClienteSeleccionado(item);
    setModalClientesAbierto(false);
    setBusquedaCliente('');
    cargarHistorialCliente(item.id_cliente);
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

  const historialFiltrado = historial.filter((item) => {
    const texto = busquedaHistorial.toLowerCase();

    return (
      item.tipo_movimiento?.toLowerCase().includes(texto) ||
      item.observacion?.toLowerCase().includes(texto) ||
      String(item.fecha || '').toLowerCase().includes(texto)
    );
  });

  const formatoMoneda = (valor) => {
    return Number(valor || 0).toLocaleString('es-CR', {
      style: 'currency',
      currency: 'CRC'
    });
  };

  const formatoFecha = (fecha) => {
    if (!fecha) return '-';
    return new Date(fecha).toLocaleDateString('es-CR');
  };

  const formatoMonedaReporte = (valor) => {
  const numero = Number(valor || 0);

  return `¢${numero.toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const imprimirHistorial = () => {
  if (!clienteSeleccionado) {
    alert('Primero debe seleccionar un cliente');
    return;
  }

  window.print();
};

const exportarPDF = () => {
  if (!clienteSeleccionado) {
    alert('Primero debe seleccionar un cliente');
    return;
  }

  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text('Sistema de Inventario', 14, 15);

  doc.setFontSize(14);
  doc.text('Historial de Cliente', 14, 25);

  doc.setFontSize(10);
  doc.text(`Código: ${clienteSeleccionado.codigo}`, 14, 35);
  doc.text(`Cliente: ${clienteSeleccionado.nombre}`, 14, 42);
  doc.text(
    `Rollo: ${clienteSeleccionado.numero_rollo || ''} - ${clienteSeleccionado.rollo || ''}`,
    14,
    49
  );
  doc.text(
    `Saldo actual: ${formatoMonedaReporte(clienteSeleccionado.saldo_actual)}`,
    14,
    56
  );

  autoTable(doc, {
    startY: 66,
    head: [[
      'Fecha',
      'Tipo',
      'Monto',
      'Saldo anterior',
      'Saldo nuevo',
      'Cliente relacionado',
      'Observación'
    ]],
    body: historialFiltrado.map((item) => [
      item.fecha
        ? new Date(item.fecha).toLocaleDateString('es-CR')
        : '-',
      item.tipo_movimiento,
      formatoMonedaReporte(item.monto),
      formatoMonedaReporte(item.saldo_anterior),
      formatoMonedaReporte(item.saldo_nuevo),
      item.cliente_relacionado
        ? `${item.codigo_cliente_relacionado} - ${item.cliente_relacionado}`
        : '-',
      item.observacion || '-'
    ]),
    styles: {
      fontSize: 8
    },
    headStyles: {
      fontSize: 8
    }
  });

  doc.save(`historial-cliente-${clienteSeleccionado.codigo}.pdf`);
};

  const exportarExcel = () => {
    if (!clienteSeleccionado) {
      alert('Primero debe seleccionar un cliente');
      return;
    }

    const datosResumen = [
      ['Historial de Cliente'],
      [],
      ['Código', clienteSeleccionado.codigo],
      ['Cliente', clienteSeleccionado.nombre],
      [
        'Rollo',
        `${clienteSeleccionado.numero_rollo || ''} - ${clienteSeleccionado.rollo || ''}`
      ],
      ['Saldo actual', Number(clienteSeleccionado.saldo_actual || 0)]
    ];

    const datosMovimientos = historialFiltrado.map((item) => ({
      Fecha: item.fecha
        ? new Date(item.fecha).toLocaleDateString('es-CR')
        : '',
      Tipo: item.tipo_movimiento,
      Monto: Number(item.monto || 0),
      SaldoAnterior: Number(item.saldo_anterior || 0),
      SaldoNuevo: Number(item.saldo_nuevo || 0),
      ClienteRelacionado: item.cliente_relacionado
        ? `${item.codigo_cliente_relacionado} - ${item.cliente_relacionado}`
        : '',
      Observacion: item.observacion || ''
    }));

    const hojaResumen = XLSX.utils.aoa_to_sheet(datosResumen);
    const hojaMovimientos = XLSX.utils.json_to_sheet(datosMovimientos);

    hojaResumen['!cols'] = [
      { wch: 22 },
      { wch: 35 }
    ];

    hojaMovimientos['!cols'] = [
      { wch: 14 },
      { wch: 24 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 32 },
      { wch: 45 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hojaResumen, 'Resumen');
    XLSX.utils.book_append_sheet(libro, hojaMovimientos, 'Movimientos');

    XLSX.writeFile(libro, `historial-cliente-${clienteSeleccionado.codigo}.xlsx`);
  };

  return (
    <div className="historial-page">
      <header className="historial-header">
        <h2>Historial Clientes</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <div className="barra-acciones">
        <button
          className="btn-vista"
          onClick={() => setModalClientesAbierto(true)}
        >
          Vista de clientes
        </button>
      </div>

      <section className="historial-card">
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

        {clienteSeleccionado && (
          <section className="historial-card acciones-reporte">
            <button className="btn-imprimir" onClick={imprimirHistorial}>
              Imprimir
            </button>

            <button className="btn-pdf" onClick={exportarPDF}>
              Exportar PDF
            </button>

            <button className="btn-excel" onClick={exportarExcel}>
              Exportar Excel
            </button>
          </section>
      )}

      <section className="historial-card">
        <h3>Movimientos del cliente</h3>

        <input
          type="text"
          className="buscar"
          placeholder="Buscar por tipo, fecha u observación"
          value={busquedaHistorial}
          onChange={(e) => setBusquedaHistorial(e.target.value)}
        />

        <div className="tabla-contenedor">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Tipo</th>
                <th>Monto</th>
                <th>Saldo anterior</th>
                <th>Saldo nuevo</th>
                <th>Cliente relacionado</th>
                <th>Observación</th>
              </tr>
            </thead>

            <tbody>
              {historialFiltrado.map((item) => (
                <tr key={item.id_movimiento_cliente}>
                  <td>{formatoFecha(item.fecha)}</td>
                  <td>{item.tipo_movimiento}</td>
                  <td>{formatoMoneda(item.monto)}</td>
                  <td>{formatoMoneda(item.saldo_anterior)}</td>
                  <td>{formatoMoneda(item.saldo_nuevo)}</td>
                  <td>
                    {item.cliente_relacionado
                      ? `${item.codigo_cliente_relacionado} - ${item.cliente_relacionado}`
                      : '-'}
                  </td>
                  <td>{item.observacion || '-'}</td>
                </tr>
              ))}

              {historialFiltrado.length === 0 && (
                <tr>
                  <td colSpan="7" className="sin-datos">
                    {clienteSeleccionado
                      ? 'No hay movimientos para este cliente'
                      : 'Seleccione un cliente para ver su historial'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
    </div>
  );
}

export default HistorialClientes;