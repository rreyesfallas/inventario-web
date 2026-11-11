import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import './Articulos.css';

// El precio de venta sugerido siempre es el doble del costo.
const calcularPrecioVenta = (costo) => {
  const numero = Number(costo);
  if (!Number.isFinite(numero) || numero < 0) return 0;
  return Math.round(numero * 2 * 100) / 100;
};

const formatoNumero = (valor) =>
  Number(valor || 0).toLocaleString('es-CR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });

// Las fechas de SQL vienen como 'YYYY-MM-DDT00:00:00.000Z'.
// Se toma el texto tal cual para que no se corra un día por la zona horaria.
const formatoFecha = (valor) => {
  const texto = String(valor || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return '-';
  const [anio, mes, dia] = texto.split('-');
  return `${dia}/${mes}/${anio}`;
};

const ARTICULO_VACIO = {
  codigo: '',
  id_linea: '',
  descripcion: '',
  costo: ''
};

function Articulos() {
  const navigate = useNavigate();

  const [modalAbierto, setModalAbierto] = useState(false);
  const [modoModal, setModoModal] = useState('agregar');
  const [codigoSeleccionado, setCodigoSeleccionado] = useState('');
  const [guardando, setGuardando] = useState(false);

  const [articulos, setArticulos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState([]);

  const [filtroLinea, setFiltroLinea] = useState('');
  const [filtroPrecio, setFiltroPrecio] = useState('');
  const [filtroCompra, setFiltroCompra] = useState('');
  const [filtroMovimiento, setFiltroMovimiento] = useState('');

  const [paginaActual, setPaginaActual] = useState(1);
  const [registrosPorPagina, setRegistrosPorPagina] = useState(10);

  const [columnaOrden, setColumnaOrden] = useState('codigo');
  const [direccionOrden, setDireccionOrden] = useState('asc');

  const [textoLinea, setTextoLinea] = useState('');

  const [articulo, setArticulo] = useState(ARTICULO_VACIO);

  const codigoRef = useRef(null);
  const lineaRef = useRef(null);
  const descripcionRef = useRef(null);
  const costoRef = useRef(null);

  const articulosFiltrados = articulos.filter((item) => {
    const textoBusqueda = busqueda.toLowerCase();

    const coincideBusqueda =
      String(item.codigo || '').toLowerCase().includes(textoBusqueda) ||
      String(item.descripcion || '').toLowerCase().includes(textoBusqueda);

    const coincideLinea =
      !filtroLinea || String(item.id_linea) === String(filtroLinea);

    const costo = Number(item.costo || 0);

    const coincidePrecio =
      !filtroPrecio ||
      (filtroPrecio === 'CON_PRECIO' && costo > 0) ||
      (filtroPrecio === 'SIN_PRECIO' && costo === 0);

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

  const ordenarPor = (columna) => {
    if (columnaOrden === columna) {
      setDireccionOrden(direccionOrden === 'asc' ? 'desc' : 'asc');
    } else {
      setColumnaOrden(columna);
      setDireccionOrden('asc');
    }
  };

  const obtenerValorOrden = (item, columna) => {
    if (columna === 'codigo') return Number(item.codigo) || item.codigo || '';
    if (columna === 'descripcion') return item.descripcion || '';
    if (columna === 'costo') return Number(item.costo || 0);
    if (columna === 'precio') return Number(item.precio || 0);
    if (columna === 'ultima_compra') return String(item.ultima_compra || '');
    if (columna === 'ultimo_movimiento') return String(item.ultimo_movimiento || '');
    if (columna === 'premio') return Number(item.premio || 0);
    if (columna === 'linea') return item.linea || '';

    return '';
  };

  const articulosOrdenados = [...articulosFiltrados].sort((a, b) => {
    const valorA = obtenerValorOrden(a, columnaOrden);
    const valorB = obtenerValorOrden(b, columnaOrden);

    if (typeof valorA === 'number' && typeof valorB === 'number') {
      return direccionOrden === 'asc' ? valorA - valorB : valorB - valorA;
    }

    return direccionOrden === 'asc'
      ? String(valorA).localeCompare(String(valorB))
      : String(valorB).localeCompare(String(valorA));
  });

  const mostrarIndicadorOrden = (columna) => {
    if (columnaOrden !== columna) return '';
    return direccionOrden === 'asc' ? ' ↑' : ' ↓';
  };

  const totalPaginas = Math.ceil(articulosFiltrados.length / registrosPorPagina);

  const indiceInicial = (paginaActual - 1) * registrosPorPagina;
  const indiceFinal = indiceInicial + registrosPorPagina;

  const articulosPaginados = articulosOrdenados.slice(indiceInicial, indiceFinal);

  const irPaginaAnterior = () => {
    if (paginaActual > 1) setPaginaActual(paginaActual - 1);
  };

  const irPaginaSiguiente = () => {
    if (paginaActual < totalPaginas) setPaginaActual(paginaActual + 1);
  };

  useEffect(() => {
    setPaginaActual(1);
  }, [
    busqueda,
    filtroLinea,
    filtroPrecio,
    filtroCompra,
    filtroMovimiento,
    registrosPorPagina,
    columnaOrden,
    direccionOrden
  ]);

  const desactivarArticulo = async (idArticulo) => {
    const confirmar = confirm('¿Desea desactivar este artículo?');

    if (!confirmar) return;

    try {
      const respuesta = await fetch(`/api/articulos/${idArticulo}/desactivar`, {
        method: 'PATCH'
      });

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
    setArticulo(ARTICULO_VACIO);
    setTextoLinea('');
    setModalAbierto(true);
  };

  const abrirModalModificar = (item) => {
    setModoModal('modificar');
    setCodigoSeleccionado(item.id_articulo);

    setArticulo({
      codigo: item.codigo,
      id_linea: item.id_linea || '',
      descripcion: item.descripcion,
      costo: item.costo ?? ''
    });

    const lineaEncontrada = lineas.find(
      (linea) => String(linea.id_linea) === String(item.id_linea)
    );

    setTextoLinea(lineaEncontrada ? lineaEncontrada.descripcion : '');
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
  };

  const cambiarDato = (e) => {
    const { name, value } = e.target;

    setArticulo((anterior) => ({
      ...anterior,
      [name]: value
    }));
  };

  const manejarEnter = (e, siguienteRef) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      siguienteRef.current?.focus();
    }
  };

  const seleccionarLineaPorTexto = () => {
    const texto = textoLinea.trim().toLowerCase();

    const lineaEncontrada = lineas.find(
      (linea) => String(linea.descripcion || '').toLowerCase() === texto
    );

    if (lineaEncontrada) {
      setArticulo((anterior) => ({
        ...anterior,
        id_linea: lineaEncontrada.id_linea
      }));

      setTextoLinea(lineaEncontrada.descripcion);
      descripcionRef.current?.focus();
    } else {
      alert('Debe seleccionar una línea válida');
      lineaRef.current?.focus();
    }
  };

  const guardarArticulo = async () => {
    if (guardando) return;

    if (String(articulo.codigo).trim() === '') {
      alert('Debe ingresar el código');
      codigoRef.current?.focus();
      return;
    }

    if (!articulo.id_linea) {
      alert('Debe seleccionar una línea válida');
      lineaRef.current?.focus();
      return;
    }

    if (String(articulo.descripcion).trim() === '') {
      alert('Debe ingresar la descripción');
      descripcionRef.current?.focus();
      return;
    }

    const costo = Number(articulo.costo);

    if (String(articulo.costo).trim() === '' || !Number.isFinite(costo) || costo < 0) {
      alert('Debe ingresar un costo válido');
      costoRef.current?.focus();
      return;
    }

    if (modoModal === 'agregar') {
      const existeCodigo = articulos.some(
        (item) => String(item.codigo).trim() === String(articulo.codigo).trim()
      );

      if (existeCodigo) {
        alert('Ya existe un artículo con ese código');
        codigoRef.current?.focus();
        return;
      }
    }

    const url =
      modoModal === 'agregar'
        ? '/api/articulos'
        : `/api/articulos/${codigoSeleccionado}`;

    try {
      setGuardando(true);

      const respuesta = await fetch(url, {
        method: modoModal === 'agregar' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codigo: articulo.codigo,
          descripcion: articulo.descripcion,
          id_linea: articulo.id_linea,
          costo
        })
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        alert(
          datos.mensaje ||
            (modoModal === 'agregar' ? 'Error al agregar artículo' : 'Error al modificar artículo')
        );
        return;
      }

      alert(
        modoModal === 'agregar'
          ? 'Artículo agregado correctamente'
          : 'Artículo modificado correctamente'
      );
      cerrarModal();
      cargarArticulos();
    } catch (error) {
      console.error('Error guardando artículo:', error);
      alert('Error al guardar el artículo');
    } finally {
      setGuardando(false);
    }
  };

  const cargarArticulos = async () => {
    try {
      const respuesta = await fetch('/api/articulos');
      const datos = await respuesta.json();
      setArticulos(datos);
    } catch (error) {
      console.error('Error cargando artículos:', error);
      alert('Error al cargar los artículos');
    }
  };

  const cargarLineas = async () => {
    try {
      const respuesta = await fetch('/api/lineas-articulo');
      const datos = await respuesta.json();
      setLineas(datos);
    } catch (error) {
      console.error('Error cargando líneas:', error);
      alert('Error al cargar las líneas');
    }
  };

  useEffect(() => {
    cargarArticulos();
    cargarLineas();
  }, []);

  // Al abrir el modal: en "agregar" arranca en Código; en "modificar"
  // el código está bloqueado, así que arranca en Línea.
  useEffect(() => {
    if (modalAbierto) {
      setTimeout(() => {
        if (modoModal === 'modificar') {
          lineaRef.current?.focus();
        } else {
          codigoRef.current?.focus();
        }
      }, 100);
    }
  }, [modalAbierto, modoModal]);

  const articulosOrdenadosReporte = [...articulos].sort((a, b) => {
    const codigoA = Number(a.codigo);
    const codigoB = Number(b.codigo);

    if (!isNaN(codigoA) && !isNaN(codigoB)) return codigoA - codigoB;

    return String(a.codigo).localeCompare(String(b.codigo));
  });

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
      theme: 'grid',
      margin: { left: 10, right: 10 },
      head: [[
        'Código',
        'Descripción',
        'Costo',
        'Precio venta',
        'Últ. compra',
        'Últ. movimiento',
        'Premio',
        'Línea'
      ]],
      body: articulosOrdenadosReporte.map((item) => [
        item.codigo || '-',
        item.descripcion || '-',
        formatoNumero(item.costo),
        formatoNumero(item.precio),
        formatoFecha(item.ultima_compra),
        formatoFecha(item.ultimo_movimiento),
        Number(item.premio || 0),
        item.linea || '-'
      ]),
      styles: { fontSize: 8 },
      headStyles: { fontSize: 8, fillColor: [55, 65, 81] },
      didParseCell: (data) => {
        if ([2, 3].includes(data.column.index)) data.cell.styles.halign = 'right';
        if ([0, 4, 5, 6].includes(data.column.index)) data.cell.styles.halign = 'center';
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
        'Costo',
        'Precio venta',
        'Últ. compra',
        'Últ. movimiento',
        'Premio',
        'Línea'
      ],
      ...articulosOrdenadosReporte.map((item) => [
        item.codigo || '',
        item.descripcion || '',
        Number(item.costo || 0),
        Number(item.precio || 0),
        formatoFecha(item.ultima_compra),
        formatoFecha(item.ultimo_movimiento),
        Number(item.premio || 0),
        item.linea || ''
      ])
    ];

    const hoja = XLSX.utils.aoa_to_sheet(datosExcel);

    hoja['!cols'] = [
      { wch: 12 },
      { wch: 35 },
      { wch: 14 },
      { wch: 14 },
      { wch: 16 },
      { wch: 18 },
      { wch: 10 },
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

  const columnasOrdenables = [
    { clave: 'codigo', titulo: 'Código', clase: 'celda-centro' },
    { clave: 'descripcion', titulo: 'Descripción', clase: '' },
    { clave: 'costo', titulo: 'Costo', clase: 'celda-monto' },
    { clave: 'precio', titulo: 'Precio venta', clase: 'celda-monto' },
    { clave: 'ultima_compra', titulo: 'Últ. compra', clase: 'celda-centro' },
    { clave: 'ultimo_movimiento', titulo: 'Últ. movimiento', clase: 'celda-centro' },
    { clave: 'premio', titulo: 'Premio', clase: 'celda-centro' },
    { clave: 'linea', titulo: 'Línea', clase: '' }
  ];

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
          <select value={filtroLinea} onChange={(e) => setFiltroLinea(e.target.value)}>
            <option value="">Todas las líneas</option>
            {lineas.map((item) => (
              <option key={item.id_linea} value={item.id_linea}>
                {item.descripcion}
              </option>
            ))}
          </select>

          <select value={filtroPrecio} onChange={(e) => setFiltroPrecio(e.target.value)}>
            <option value="">Todos los costos</option>
            <option value="CON_PRECIO">Con costo</option>
            <option value="SIN_PRECIO">Sin costo</option>
          </select>

          <select value={filtroCompra} onChange={(e) => setFiltroCompra(e.target.value)}>
            <option value="">Todas las compras</option>
            <option value="CON_COMPRA">Con última compra</option>
            <option value="SIN_COMPRA">Sin última compra</option>
          </select>

          <select value={filtroMovimiento} onChange={(e) => setFiltroMovimiento(e.target.value)}>
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
                {columnasOrdenables.map((columna) => (
                  <th key={columna.clave} className={columna.clase}>
                    <button
                      type="button"
                      className="th-ordenable"
                      onClick={() => ordenarPor(columna.clave)}
                    >
                      {columna.titulo}
                      {mostrarIndicadorOrden(columna.clave)}
                    </button>
                  </th>
                ))}
                <th className="celda-centro">Acciones</th>
              </tr>
            </thead>

            <tbody>
              {articulosPaginados.map((item) => (
                <tr key={item.id_articulo}>
                  <td className="celda-centro">{item.codigo}</td>
                  <td>{item.descripcion}</td>
                  <td className="celda-monto">{formatoNumero(item.costo)}</td>
                  <td className="celda-monto">{formatoNumero(item.precio)}</td>
                  <td className="celda-centro">{formatoFecha(item.ultima_compra)}</td>
                  <td className="celda-centro">{formatoFecha(item.ultimo_movimiento)}</td>
                  <td className="celda-centro">{Number(item.premio || 0)}</td>
                  <td>{item.linea || '-'}</td>
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
                  <td colSpan="9" style={{ textAlign: 'center' }}>
                    No se encontraron artículos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="paginacion-tabla">
          <div className="paginacion-info">
            <span>
              Mostrando {articulosFiltrados.length === 0 ? 0 : indiceInicial + 1}
              {' '}a{' '}
              {Math.min(indiceFinal, articulosFiltrados.length)}
              {' '}de{' '}
              {articulosFiltrados.length}
              {' '}artículos
            </span>
          </div>

          <div className="paginacion-controles">
            <select
              value={registrosPorPagina}
              onChange={(e) => setRegistrosPorPagina(Number(e.target.value))}
            >
              <option value={10}>10 por página</option>
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
            </select>

            <button type="button" onClick={irPaginaAnterior} disabled={paginaActual === 1}>
              Anterior
            </button>

            <span>
              Página {articulosFiltrados.length === 0 ? 0 : paginaActual} de {totalPaginas || 0}
            </span>

            <button
              type="button"
              onClick={irPaginaSiguiente}
              disabled={paginaActual >= totalPaginas || totalPaginas === 0}
            >
              Siguiente
            </button>
          </div>
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
                  ref={codigoRef}
                  type="text"
                  name="codigo"
                  value={articulo.codigo}
                  onChange={cambiarDato}
                  onKeyDown={(e) => manejarEnter(e, lineaRef)}
                  disabled={modoModal === 'modificar'}
                />
              </div>

              <div>
                <label>Línea</label>
                <input
                  ref={lineaRef}
                  type="text"
                  list="lista-lineas"
                  value={textoLinea}
                  onChange={(e) => {
                    const valor = e.target.value;
                    setTextoLinea(valor);

                    const lineaEncontrada = lineas.find(
                      (linea) => String(linea.descripcion) === valor
                    );

                    setArticulo((anterior) => ({
                      ...anterior,
                      id_linea: lineaEncontrada ? lineaEncontrada.id_linea : ''
                    }));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      seleccionarLineaPorTexto();
                    }
                  }}
                  placeholder="Escriba o seleccione una línea"
                />

                <datalist id="lista-lineas">
                  {lineas.map((item) => (
                    <option key={item.id_linea} value={item.descripcion} />
                  ))}
                </datalist>
              </div>

              <div className="full">
                <label>Descripción</label>
                <input
                  ref={descripcionRef}
                  type="text"
                  name="descripcion"
                  value={articulo.descripcion}
                  onChange={cambiarDato}
                  onKeyDown={(e) => manejarEnter(e, costoRef)}
                />
              </div>

              <div>
                <label>Costo</label>
                <input
                  ref={costoRef}
                  type="number"
                  name="costo"
                  min="0"
                  step="0.01"
                  value={articulo.costo}
                  onChange={cambiarDato}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      guardarArticulo();
                    }
                  }}
                />
              </div>

              <div>
                <label>Precio de venta sugerido (costo × 2)</label>
                <input
                  type="text"
                  readOnly
                  tabIndex={-1}
                  className="campo-solo-lectura"
                  value={
                    String(articulo.costo).trim() === ''
                      ? ''
                      : formatoNumero(calcularPrecioVenta(articulo.costo))
                  }
                />
              </div>
            </div>

            <div className="modal-botones">
              <button onClick={guardarArticulo} disabled={guardando}>
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={cerrarModal}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Articulos;
