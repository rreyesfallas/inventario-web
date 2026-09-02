\# Resumen técnico - Versión funcional inicial



\## Proyecto



Sistema web de inventario, cobros y control de clientes desarrollado para reemplazar un sistema anterior de escritorio.



\## Tecnologías utilizadas



\- Frontend: React con Vite

\- Backend: Node.js con Express

\- Base de datos: SQL Server Express

\- Autenticación: Login con usuarios almacenados en base de datos

\- Encriptación de contraseñas: bcryptjs

\- Control de versiones: Git y GitHub



\## Estructura general del proyecto



```txt

inventario-web/

├── backend/

├── frontend/

├── base de datos/

└── documentacion/

Módulos funcionales

Seguridad y acceso

Login de usuarios.

Validación de usuario y contraseña contra SQL Server.

Contraseñas almacenadas mediante hash.

Rutas protegidas en frontend.

Cierre de sesión.

Redirección automática al login si no hay sesión activa.

Redirección al dashboard si el usuario ya inició sesión.

Cambio obligatorio de contraseña cuando corresponde.

Usuarios

Listado de usuarios activos.

Creación de usuarios.

Modificación de usuarios.

Desactivación de usuarios.

Restablecimiento de contraseña.

Protección para no desactivar el usuario actualmente conectado.

Campo debe\_cambiar\_clave para obligar cambio de contraseña.

Dashboard

Menú principal del sistema.

Acceso a los módulos principales.

Visualización del usuario conectado.

Botón de salida.

Artículos

Registro de artículos.

Modificación de artículos.

Desactivación de artículos.

Búsqueda por código y descripción.

Asociación con líneas de artículo.

Validación de código duplicado.

Clientes

Registro de clientes.

Modificación de clientes.

Desactivación de clientes.

Búsqueda por código, cédula, nombre, rollo y zona.

Asociación con rollos.

Registro de saldo inicial.

Manejo de saldo actual.

Empleados

Registro de empleados.

Modificación de empleados.

Desactivación de empleados.

Búsqueda por código.

Validación de código duplicado.

Configuración



Incluye los catálogos generales del sistema:



Rollos.

Vehículos.

Líneas de artículo.

Bodegas.

Rollos

Registro de rollos.

Modificación de rollos.

Desactivación de rollos.

Asociación con vehículo.

Manejo de número de rollo, descripción y día de cobro.

Vehículos

Registro de vehículos.

Modificación de vehículos.

Desactivación de vehículos.

Asociación con empleados.

Líneas de artículo

Registro de líneas.

Modificación de líneas.

Desactivación de líneas.

Uso dentro del módulo de artículos.

Bodegas

Registro de bodegas.

Modificación de bodegas.

Desactivación de bodegas.

Uso dentro de entradas y salidas de inventario.

Entradas / Salidas

Registro de movimientos de inventario.

Manejo de número de boleta.

Selección de bodega.

Selección de tipo de movimiento: entrada o salida.

Agregado de artículos al detalle.

Cálculo automático de subtotales y total.

Actualización de existencias por bodega y artículo.

Validación para evitar salidas mayores a la existencia disponible.

Vista de existencias.

Vista de movimientos.

Vista de detalle de movimiento.

Vista de artículos con búsqueda y filtro por línea.

Efectivo

Registro de cobros por fecha y rollo.

Registro de cobradores.

Separación de efectivo y SINPE móvil.

Cálculo de total efectivo, total SINPE y total general.

Vista de cobros registrados.

Vista de detalle de cobro.

Validación para evitar que el total cobrado acumulado supere el saldo del rollo.

Transacciones

Registro de abonos.

Registro de ventas.

Registro de devoluciones.

Registro de transferencias entre clientes.

Actualización del saldo actual del cliente.

Validación para evitar saldos negativos.

Registro de historial en la tabla de movimientos del cliente.

Manejo de cliente relacionado en transferencias.

Informe Cobros

Consulta por fecha y rollo.

Visualización de total de clientes del rollo.

Visualización de saldo actual del rollo.

Visualización de efectivo en la fecha.

Visualización de SINPE en la fecha.

Visualización de cobrado en la fecha.

Visualización de cobrado acumulado hasta la fecha.

Visualización de saldo pendiente estimado.

Detalle de clientes del rollo.

Historial Clientes

Selección de cliente.

Visualización de movimientos del cliente.

Ordenamiento por movimientos más recientes.

Visualización de saldo anterior y saldo nuevo.

Visualización de cliente relacionado en transferencias.

Búsqueda dentro del historial.

Base de datos



Base de datos utilizada:



inventario\_web



Tablas principales:



articulos

bodegas

clientes

empleados

lineas\_articulo

rollos

vehiculos

usuarios

movimientos\_inventario

movimientos\_inventario\_detalle

existencias\_bodega

cobros\_efectivo

cobros\_efectivo\_detalle

movimientos\_cliente

Estado actual



El sistema se encuentra en una primera versión funcional. Los módulos principales fueron revisados y no se detectaron errores por el momento.



Pendientes futuros sugeridos

Exportar informes a PDF o Excel.

Mejorar reportes finales para entrega al cliente.

Agregar auditoría de usuario en movimientos importantes.

Agregar fecha de modificación en tablas principales.

Mejorar permisos por nivel si el cliente lo solicita.

Preparar documentación de instalación y despliegue.

