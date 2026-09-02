
USE inventario_web;
GO

CREATE TABLE empleados (
    id_empleado INT IDENTITY(1,1) PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    estado CHAR(1) NOT NULL DEFAULT 'A',
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE()
);

CREATE TABLE vehiculos (
    id_vehiculo INT IDENTITY(1,1) PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    descripcion VARCHAR(150) NOT NULL,
    id_empleado INT NULL,
    estado CHAR(1) NOT NULL DEFAULT 'A',
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT fk_vehiculos_empleados
        FOREIGN KEY (id_empleado)
        REFERENCES empleados(id_empleado)
);

CREATE TABLE rollos (
    id_rollo INT IDENTITY(1,1) PRIMARY KEY,
    numero VARCHAR(20) NOT NULL UNIQUE,
    descripcion VARCHAR(150) NOT NULL,
    dia_cobro VARCHAR(20) NULL,
    id_vehiculo INT NULL,
    estado CHAR(1) NOT NULL DEFAULT 'A',
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT fk_rollos_vehiculos
        FOREIGN KEY (id_vehiculo)
        REFERENCES vehiculos(id_vehiculo)
);

CREATE TABLE clientes (
    id_cliente INT IDENTITY(1,1) PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    cedula VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    direccion VARCHAR(250) NULL,
    color_casa VARCHAR(50) NULL,
    lado_calle VARCHAR(20) NULL,
    telefono VARCHAR(30) NULL,
    id_rollo INT NULL,
    saldo_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado CHAR(1) NOT NULL DEFAULT 'A',
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT fk_clientes_rollos
        FOREIGN KEY (id_rollo)
        REFERENCES rollos(id_rollo)
);

CREATE TABLE lineas_articulo (
    id_linea INT IDENTITY(1,1) PRIMARY KEY,
    descripcion VARCHAR(100) NOT NULL UNIQUE,
    estado CHAR(1) NOT NULL DEFAULT 'A'
);

CREATE TABLE articulos (
    id_articulo INT IDENTITY(1,1) PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    descripcion VARCHAR(200) NOT NULL,
    id_linea INT NULL,
    precio DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado CHAR(1) NOT NULL DEFAULT 'A',
    fecha_creacion DATETIME NOT NULL DEFAULT GETDATE(),

    CONSTRAINT fk_articulos_lineas
        FOREIGN KEY (id_linea)
        REFERENCES lineas_articulo(id_linea)
);

CREATE TABLE bodegas (
    id_bodega INT IDENTITY(1,1) PRIMARY KEY,
    codigo VARCHAR(20) NOT NULL UNIQUE,
    descripcion VARCHAR(150) NOT NULL,
    estado CHAR(1) NOT NULL DEFAULT 'A'
);
GO

