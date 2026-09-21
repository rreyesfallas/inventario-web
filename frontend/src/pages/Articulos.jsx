import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Articulos.css';

function Articulos() {
  const navigate = useNavigate();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [codigoSeleccionado, setCodigoSeleccionado] = useState('');

  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState([]);

  const [filtroLinea, setFiltroLinea] = useState('');
  const [filtroPrecio, setFiltroPrecio] = useState('');
  const [filtroCompra, setFiltroCompra] = useState('');
  const [filtroMovimiento, setFiltroMovimiento] = useState('');

   const [articulo, setArticulo] = useState({
    codigo: '',
    id_linea: '',
    descripcion: '',
    precio: ''
  });

  const articulosFiltrados = articulos.filter((item) => {
    const textoBusqueda = busqueda.toLowerCase();

    const coincideBusqueda =
      String(item.codigo || '').toLowerCase().includes(textoBusqueda) ||
      String(item.descripcion || '').toLowerCase().includes(textoBusqueda);

    const coincideLinea =
      !filtroLinea || String(item.id_linea) === String(filtroLinea);

    const precio = Number(item.precio || 0);

    const coincidePrecio =
      !filtroPrecio ||
      (filtroPrecio === 'CON_PRECIO' && precio > 0) ||
      (filtroPrecio === 'SIN_PRECIO' && precio === 0);

    const coincideCompra =
      !filtroCompra ||
      (filtroCompra === 'CON_COMPRA' && item.ultima_compra) ||
      (filtroCompra === 'SIN_COMPRA' && !item.ultima_compra);

    const coincideMovimiento =
      !filtroMovimiento ||
      (filtroMovimiento === 'CON_MOVIMIENTO' && item.ultimo_movimiento) ||
      (filtroMovimiento === 'SIN_MOVIMIENTO' && !item.ultimo_movimiento);

    return (
      coincideBusqueda &&
      coincideLinea &&
      coincidePrecio &&
      coincideCompra &&
      coincideMovimiento
    );
  });
// hhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhh
  const desactivarArticulo = async (idArticulo) => {  
    const confirmar = confirm('¿Desea desactivar este artículo?');

    if (!confirmar) {
      return;
    }

    try {
      const respuesta = await fetch(
        `http://localhost:3001/api/articulos/${idArticulo}/desactivar`,
        {
          method: 'PATCH'
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al desactivar artículo');
        return;
      }

      alert('Artículo desactivado correctamente');
      cargarArticulos();
    } catch (error) {
      console.error('Error desactivando artículo:', error);
      alert('Error al desactivar artículo');
    }
  };
  const abrirModalAgregar = () => {
    setModoModal('agregar');
    setCodigoSeleccionado('');

    setArticulo({
      codigo: '',
      id_linea: '',
      descripcion: '',
      precio: ''
    });

    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setCodigoSeleccionado(item.id_articulo);

    setArticulo({
      codigo: item.codigo,
      id_linea: item.id_linea || '',
      descripcion: item.descripcion,
      precio: item.precio
    });

    setModalAbierto(true);
  };



  const cerrarModal = () => {
    setModalAbierto(false);
  };

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setArticulo({
      ...articulo,
      [name]: value
    });
  };

  const guardarArticulo = async () => {
  if (articulo.codigo.trim() === '') {
      alert('Debe ingresar el código');
      return;
    }

  if (articulo.descripcion.trim() === '') {
    alert('Debe ingresar la descripción');
    return;
  }

  if (articulo.precio === '') {
    alert('Debe ingresar el precio');
    return;
  }

  if (modoModal === 'agregar') {
    const existeCodigo = articulos.some(
      (item) => item.codigo === articulo.codigo
    );

    if (existeCodigo) {
      alert('Ya existe un artículo con ese código');
      return;
    }
//pppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppppp

  const respuesta = await fetch('http://localhost:3001/api/articulos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      codigo: articulo.codigo,
      descripcion: articulo.descripcion,
      id_linea: articulo.id_linea,
      precio: articulo.precio
    })
  });

  const datos = await respuesta.json();
  console.log('Respuesta backend:', datos);

  if (!respuesta.ok) {
    alert(datos.mensaje || 'Error al agregar artículo');
    return;
  }

  alert('Artículo agregado correctamente');
  cerrarModal();
  cargarArticulos();


  } else {
      const respuesta = await fetch(
        `http://localhost:3001/api/articulos/${codigoSeleccionado}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            codigo: articulo.codigo,
            descripcion: articulo.descripcion,
            id_linea: articulo.id_linea,
            precio: articulo.precio
          })
        }
      );

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(datos.mensaje || 'Error al modificar artículo');
        return;
      }

      alert('Artículo modificado correctamente');
      cerrarModal();
      cargarArticulos();
  }
  }

  const cargarArticulos = async () => {
    try {
      const respuesta = await fetch('http://localhost:3001/api/articulos');
      const datos = await respuesta.json();

      setArticulos(datos);
    } catch (error) {
      console.error('Error cargando artículos:', error);
      alert('Error al cargar los artículos');
    }
  };

  useEffect(() => {
    cargarArticulos();
    cargarLineas();
  }, []);

    const cargarLineas = async () => {
      try {
        const respuesta = await fetch('http://localhost:3001/api/lineas-articulo');
        const datos = await respuesta.json();

        setLineas(datos);
      } catch (error) {
        console.error('Error cargando líneas:', error);
        alert('Error al cargar las líneas');
      }
    };

    const articulosOrdenadosReporte = [...articulos].sort((a, b) => {
      const codigoA = Number(a.codigo);
      const codigoB = Number(b.codigo);

      if (!isNaN(codigoA) && !isNaN(codigoB)) {
        return codigoA - codigoB;
      }

      return String(a.codigo).localeCompare(String(b.codigo));
    });

    const formatoNumeroReporte = (valor) => {
  const numero = Number(valor || 0);

  return numero.toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const formatoFechaReporte = (valor) => {
    if (!valor) return '-';

    return new Date(valor).toLocaleDateString('es-CR');
  };

  const exportarPDFArticulos = () => {
    if (articulosOrdenadosReporte.length === 0) {
      alert('No hay artículos para generar el reporte');
      return;
    }

    const doc = new jsPDF('landscape');

    doc.setFontSize(16);
    doc.text('Sistema de Inventario', 14, 15);

    doc.setFontSize(14);
    doc.text('Listado de Artículos General', 14, 25);
    doc.text('Ordenado por Código', 14, 32);

    doc.setFontSize(10);
    doc.text(`Fecha del reporte: ${new Date().toLocaleDateString('es-CR')}`, 14, 42);

    autoTable(doc, {
      startY: 52,
      theme: 'striped',
      margin: { left: 10, right: 10 },
      head: [[
        'Código',
        'Descripción',
        'Precio',
        'Últ. compra',
        'Últ. movimiento',
        'Premio',
        'Línea'
      ]],
      body: articulosOrdenadosReporte.map((item) => [
        item.codigo || '-',
        item.descripcion || '-',
        formatoNumeroReporte(item.precio),
        formatoFechaReporte(item.ultima_compra),
        formatoFechaReporte(item.ultimo_movimiento),
        item.premio || 0,
        item.linea || '-'
      ]),
      styles: {
        fontSize: 8
      },
      headStyles: {
        fontSize: 8
      }
    });

    doc.save('listado-articulos-ordenado-codigo.pdf');
  };

  const exportarExcelArticulos = () => {
    if (articulosOrdenadosReporte.length === 0) {
      alert('No hay artículos para generar el reporte');
      return;
    }

    const datosExcel = [
      ['Listado de Artículos General'],
      ['Ordenado por Código'],
      [],
      ['Fecha del reporte', new Date().toLocaleDateString('es-CR')],
      [],
      [
        'Código',
        'Descripción',
        'Precio',
        'Últ. compra',
        'Últ. movimiento',
        'Premio',
        'Línea'
      ],
      ...articulosOrdenadosReporte.map((item) => [
        item.codigo || '',
        item.descripcion || '',
        Number(item.precio || 0),
        formatoFechaReporte(item.ultima_compra),
        formatoFechaReporte(item.ultimo_movimiento),
        item.premio || 0,
        item.linea || ''
      ])
    ];

    const hoja = XLSX.utils.aoa_to_sheet(datosExcel);

    hoja['!cols'] = [
      { wch: 12 },
      { wch: 35 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 12 },
      { wch: 18 }
    ];

    const libro = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(libro, hoja, 'Artículos');

    XLSX.writeFile(libro, 'listado-articulos-ordenado-codigo.xlsx');
  };

  const imprimirReporteArticulos = () => {
    if (articulosOrdenadosReporte.length === 0) {
      alert('No hay artículos para imprimir');
      return;
    }

    window.print();
  };

  return (
    <div className="articulos-page">
      <header className="articulos-header">
        <h2>Artículos</h2>
        <button onClick={() => navigate('/dashboard')}>Volver</button>
      </header>

      <section className="articulos-actions">
        <button onClick={abrirModalAgregar}>Agregar</button>
      </section>

      <section className="articulos-reporte">
        <h3>Reporte de artículos</h3>

        <div className="articulos-reporte-controles">
          <button className="btn-imprimir" onClick={imprimirReporteArticulos}>
            Imprimir
          </button>

          <button className="btn-pdf" onClick={exportarPDFArticulos}>
            Exportar PDF
          </button>

          <button className="btn-excel" onClick={exportarExcelArticulos}>
            Exportar Excel
          </button>
        </div>
      </section>

      <section className="articulos-lista">
        <h3>Vista de artículos</h3>

        <input
            className="buscar"
            type="text"
            placeholder="Buscar por código o descripción"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
        />

        <div className="articulos-filtros">
          <select
            value={filtroLinea}
            onChange={(e) => setFiltroLinea(e.target.value)}
          >
            <option value="">Todas las líneas</option>

            {lineas.map((item) => (
              <option key={item.id_linea} value={item.id_linea}>
                {item.descripcion}
              </option>
            ))}
          </select>

          <select
            value={filtroPrecio}
            onChange={(e) => setFiltroPrecio(e.target.value)}
          >
            <option value="">Todos los precios</option>
            <option value="CON_PRECIO">Con precio</option>
            <option value="SIN_PRECIO">Sin precio</option>
          </select>

          <select
            value={filtroCompra}
            onChange={(e) => setFiltroCompra(e.target.value)}
          >
            <option value="">Todas las compras</option>
            <option value="CON_COMPRA">Con última compra</option>
            <option value="SIN_COMPRA">Sin última compra</option>
          </select>

          <select
            value={filtroMovimiento}
            onChange={(e) => setFiltroMovimiento(e.target.value)}
          >
            <option value="">Todos los movimientos</option>
            <option value="CON_MOVIMIENTO">Con movimiento</option>
            <option value="SIN_MOVIMIENTO">Sin movimiento</option>
          </select>

          <button
            type="button"
            className="btn-limpiar-filtros"
            onClick={() => {
              setBusqueda('');
              setFiltroLinea('');
              setFiltroPrecio('');
              setFiltroCompra('');
              setFiltroMovimiento('');
            }}
          >
            Limpiar filtros
          </button>
        </div>

        <div className="tabla-contenedor">
          <table>
            <thead>
                  <tr>
                      <th>Código</th>
                      <th>Descripción</th>
                      <th>Precio</th>
                      <th>Última compra</th>
                      <th>Último movimiento</th>
                      <th>Acciones</th>
                  </tr>
            </thead>

            <tbody>
                  {articulosFiltrados.map((item) => (
                      <tr key={item.codigo}>
                      <td>{item.codigo}</td>
                      <td>{item.descripcion}</td>
                      <td>{item.precio}</td>
                      <td>{item.ultimaCompra || '-'}</td>
                      <td>{item.ultimoMovimiento || '-'}</td>
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
                              onClick={() => desactivarArticulo(item.id_articulo)}
                          >
                              Desactivar
                          </button>
                          </div>
                      </td>
                      </tr>
                  ))}

                  {articulosFiltrados.length === 0 && (
                      <tr>
                      <td colSpan="6" style={{ textAlign: 'center' }}>
                          No se encontraron artículos
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
              <h3>{modoModal === 'agregar' ? 'Agregar artículo' : 'Modificar artículo'}</h3>
              <button onClick={cerrarModal}>X</button>
            </div>

            <div className="modal-form">
              <div>
                <label>Código</label>
                <input
                  type="text"
                  name="codigo"
                  value={articulo.codigo}
                  onChange={cambiarDato}
                  disabled={modoModal === 'modificar'}
                />
              </div>

              <div>
                <label>Línea</label>
               <select
                  name="id_linea"
                  value={articulo.id_linea}
                  onChange={cambiarDato}
                >
                  <option value="">Seleccione</option>

                  {lineas.map((item) => (
                    <option key={item.id_linea} value={item.id_linea}>
                      {item.descripcion}
                    </option>
                  ))}
                </select>
              </div>

              <div className="full">
                <label>Descripción</label>
                <input
                  type="text"
                  name="descripcion"
                  value={articulo.descripcion}
                  onChange={cambiarDato}
                />
              </div>

              <div>
                <label>Precio</label>
                <input
                  type="number"
                  name="precio"
                  value={articulo.precio}
                  onChange={cambiarDato}
                />
              </div>
            </div>

            <div className="modal-botones">
              <button onClick={guardarArticulo}>Guardar</button>
              <button onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Articulos;