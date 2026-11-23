/* =====================================================================
   ACTUALIZACIÓN DE LA BASE inventario_web AL ESTADO ACTUAL DEL SISTEMA
   ---------------------------------------------------------------------
   - Se puede ejecutar más de una vez: cada paso revisa si ya existe.
   - Ejecutar completo en SSMS (F5), conectado a la instancia correcta.
   - Recomendado: hacer un respaldo (.bak) antes de ejecutarlo.
   ===================================================================== */

-- Opciones necesarias para índices filtrados.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
GO

USE inventario_web;
GO

/* ---------------------------------------------------------------------
   0. Configuración de la base
   --------------------------------------------------------------------- */
ALTER DATABASE inventario_web SET AUTO_CLOSE OFF;
GO

/* ---------------------------------------------------------------------
   1. ARTÍCULOS: costo (el precio de venta sugerido es costo × 2)
   --------------------------------------------------------------------- */
IF COL_LENGTH('dbo.articulos', 'costo') IS NULL
BEGIN
    ALTER TABLE dbo.articulos
        ADD costo DECIMAL(12,2) NOT NULL
            CONSTRAINT DF_articulos_costo DEFAULT (0);
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_articulos_costo')
    ALTER TABLE dbo.articulos ADD CONSTRAINT CK_articulos_costo CHECK (costo >= 0);
GO

-- Artículos sin costo: se calcula como la mitad del precio actual.
UPDATE dbo.articulos
SET costo = ROUND(precio / 2, 2)
WHERE costo = 0 AND precio > 0;
GO

/* ---------------------------------------------------------------------
   2. ROLLOS: bodega fija de cada rollo
   --------------------------------------------------------------------- */
IF COL_LENGTH('dbo.rollos', 'id_bodega') IS NULL
    ALTER TABLE dbo.rollos
        ADD id_bodega INT NULL
            CONSTRAINT FK_rollos_bodegas REFERENCES dbo.bodegas (id_bodega);
GO

/* ---------------------------------------------------------------------
   3. VENTAS
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.ventas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ventas (
        id_venta          INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        numero_boleta     VARCHAR(20)   NOT NULL,
        fecha             DATE          NOT NULL,
        id_cliente        INT           NOT NULL,
        id_bodega         INT           NOT NULL,
        id_empleado       INT           NOT NULL,
        total             DECIMAL(14,2) NOT NULL CONSTRAINT DF_ventas_total DEFAULT (0),
        estado            VARCHAR(20)   NOT NULL CONSTRAINT DF_ventas_estado DEFAULT ('ACTIVA'),
        observacion       VARCHAR(300)  NULL,
        fecha_creacion    DATETIME      NOT NULL CONSTRAINT DF_ventas_fecha_creacion DEFAULT (GETDATE()),
        fecha_eliminacion DATETIME      NULL,

        CONSTRAINT FK_ventas_clientes  FOREIGN KEY (id_cliente)  REFERENCES dbo.clientes (id_cliente),
        CONSTRAINT FK_ventas_bodegas   FOREIGN KEY (id_bodega)   REFERENCES dbo.bodegas (id_bodega),
        CONSTRAINT FK_ventas_empleados FOREIGN KEY (id_empleado) REFERENCES dbo.empleados (id_empleado)
    );
END
GO

-- La venta guarda su rollo (una boleta = un solo rollo).
IF COL_LENGTH('dbo.ventas', 'id_rollo') IS NULL
    ALTER TABLE dbo.ventas
        ADD id_rollo INT NULL
            CONSTRAINT FK_ventas_rollos REFERENCES dbo.rollos (id_rollo);
GO

-- La boleta NO es única (es la hoja del talonario): solo un índice para buscar.
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_ventas_boleta_activa' AND object_id = OBJECT_ID('dbo.ventas'))
    DROP INDEX UX_ventas_boleta_activa ON dbo.ventas;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ventas_boleta' AND object_id = OBJECT_ID('dbo.ventas'))
    CREATE NONCLUSTERED INDEX IX_ventas_boleta ON dbo.ventas (numero_boleta);
GO

IF OBJECT_ID('dbo.ventas_detalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.ventas_detalle (
        id_venta_detalle INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_venta         INT           NOT NULL,
        id_articulo      INT           NOT NULL,
        cantidad         DECIMAL(14,2) NOT NULL,
        precio_unitario  DECIMAL(14,2) NOT NULL,
        subtotal         DECIMAL(14,2) NOT NULL,
        estado           VARCHAR(20)   NOT NULL CONSTRAINT DF_ventas_detalle_estado DEFAULT ('ACTIVO'),

        CONSTRAINT FK_ventas_detalle_ventas    FOREIGN KEY (id_venta)    REFERENCES dbo.ventas (id_venta),
        CONSTRAINT FK_ventas_detalle_articulos FOREIGN KEY (id_articulo) REFERENCES dbo.articulos (id_articulo)
    );
END
GO

-- Costo del artículo el día de la venta.
IF COL_LENGTH('dbo.ventas_detalle', 'costo_unitario') IS NULL
    ALTER TABLE dbo.ventas_detalle
        ADD costo_unitario DECIMAL(14,2) NOT NULL
            CONSTRAINT DF_ventas_detalle_costo DEFAULT (0);
GO

/* ---------------------------------------------------------------------
   4. DEVOLUCIONES
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.devoluciones', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.devoluciones (
        id_devolucion   INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        numero_boleta   VARCHAR(20)   NOT NULL,
        fecha           DATE          NOT NULL CONSTRAINT DF_devoluciones_fecha DEFAULT (CAST(GETDATE() AS DATE)),
        id_cliente      INT           NOT NULL,
        id_rollo        INT           NULL,
        id_bodega       INT           NOT NULL,
        id_empleado     INT           NOT NULL,
        total           DECIMAL(14,2) NOT NULL,
        observacion     VARCHAR(300)  NULL,
        estado          CHAR(1)       NOT NULL CONSTRAINT DF_devoluciones_estado DEFAULT ('A'),
        fecha_creacion  DATETIME      NOT NULL CONSTRAINT DF_devoluciones_fecha_creacion DEFAULT (GETDATE()),
        fecha_anulacion DATETIME      NULL,

        CONSTRAINT FK_devoluciones_cliente  FOREIGN KEY (id_cliente)  REFERENCES dbo.clientes (id_cliente),
        CONSTRAINT FK_devoluciones_rollo    FOREIGN KEY (id_rollo)    REFERENCES dbo.rollos (id_rollo),
        CONSTRAINT FK_devoluciones_bodega   FOREIGN KEY (id_bodega)   REFERENCES dbo.bodegas (id_bodega),
        CONSTRAINT FK_devoluciones_empleado FOREIGN KEY (id_empleado) REFERENCES dbo.empleados (id_empleado),
        CONSTRAINT CK_devoluciones_estado   CHECK (estado IN ('A', 'I')),
        CONSTRAINT CK_devoluciones_total    CHECK (total > 0)
    );
END
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_devoluciones_boleta_activa' AND object_id = OBJECT_ID('dbo.devoluciones'))
    DROP INDEX UX_devoluciones_boleta_activa ON dbo.devoluciones;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_devoluciones_cliente' AND object_id = OBJECT_ID('dbo.devoluciones'))
    CREATE NONCLUSTERED INDEX IX_devoluciones_cliente ON dbo.devoluciones (id_cliente);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_devoluciones_boleta' AND object_id = OBJECT_ID('dbo.devoluciones'))
    CREATE NONCLUSTERED INDEX IX_devoluciones_boleta ON dbo.devoluciones (numero_boleta);
GO

IF OBJECT_ID('dbo.devoluciones_detalle', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.devoluciones_detalle (
        id_devolucion_detalle INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_devolucion         INT           NOT NULL,
        id_venta_detalle      INT           NOT NULL,
        id_articulo           INT           NOT NULL,
        cantidad              DECIMAL(14,2) NOT NULL,
        precio_unitario       DECIMAL(14,2) NOT NULL,
        subtotal              DECIMAL(14,2) NOT NULL,

        CONSTRAINT FK_devdet_devolucion    FOREIGN KEY (id_devolucion)    REFERENCES dbo.devoluciones (id_devolucion),
        CONSTRAINT FK_devdet_venta_detalle FOREIGN KEY (id_venta_detalle) REFERENCES dbo.ventas_detalle (id_venta_detalle),
        CONSTRAINT FK_devdet_articulo      FOREIGN KEY (id_articulo)      REFERENCES dbo.articulos (id_articulo),
        CONSTRAINT CK_devdet_cantidad      CHECK (cantidad > 0),
        CONSTRAINT CK_devdet_precio        CHECK (precio_unitario >= 0)
    );
END
GO

IF COL_LENGTH('dbo.devoluciones_detalle', 'costo_unitario') IS NULL
    ALTER TABLE dbo.devoluciones_detalle
        ADD costo_unitario DECIMAL(14,2) NOT NULL
            CONSTRAINT DF_devoluciones_detalle_costo DEFAULT (0);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_devdet_venta_detalle' AND object_id = OBJECT_ID('dbo.devoluciones_detalle'))
    CREATE NONCLUSTERED INDEX IX_devdet_venta_detalle
        ON dbo.devoluciones_detalle (id_venta_detalle)
        INCLUDE (cantidad, id_devolucion);
GO

/* ---------------------------------------------------------------------
   5. MOVIMIENTOS DE INVENTARIO
   --------------------------------------------------------------------- */
IF COL_LENGTH('dbo.movimientos_inventario', 'id_venta') IS NULL
    ALTER TABLE dbo.movimientos_inventario
        ADD id_venta INT NULL
            CONSTRAINT FK_movimientos_inventario_ventas REFERENCES dbo.ventas (id_venta);
GO

IF COL_LENGTH('dbo.movimientos_inventario', 'id_devolucion') IS NULL
    ALTER TABLE dbo.movimientos_inventario
        ADD id_devolucion INT NULL
            CONSTRAINT FK_movimientos_inventario_devoluciones REFERENCES dbo.devoluciones (id_devolucion);
GO

-- La boleta deja de ser única en todos los movimientos...
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_movimientos_numero_boleta')
    ALTER TABLE dbo.movimientos_inventario DROP CONSTRAINT UQ_movimientos_numero_boleta;
GO

IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_movimientos_boleta_activa' AND object_id = OBJECT_ID('dbo.movimientos_inventario'))
    DROP INDEX UX_movimientos_boleta_activa ON dbo.movimientos_inventario;
GO

-- ...y solo es única en las entradas/salidas MANUALES activas.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_movimientos_boleta_manual_activa' AND object_id = OBJECT_ID('dbo.movimientos_inventario'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_movimientos_boleta_manual_activa
        ON dbo.movimientos_inventario (numero_boleta)
        WHERE estado = 'A'
          AND id_venta IS NULL
          AND id_devolucion IS NULL;
GO

/* ---------------------------------------------------------------------
   6. MOVIMIENTOS DEL CLIENTE
   --------------------------------------------------------------------- */
IF COL_LENGTH('dbo.movimientos_cliente', 'id_rollo') IS NULL
    ALTER TABLE dbo.movimientos_cliente
        ADD id_rollo INT NULL
            CONSTRAINT FK_movimientos_cliente_rollo REFERENCES dbo.rollos (id_rollo);
GO

IF COL_LENGTH('dbo.movimientos_cliente', 'id_empleado') IS NULL
    ALTER TABLE dbo.movimientos_cliente
        ADD id_empleado INT NULL
            CONSTRAINT FK_movimientos_cliente_empleado REFERENCES dbo.empleados (id_empleado);
GO

IF COL_LENGTH('dbo.movimientos_cliente', 'id_transferencia') IS NULL
    ALTER TABLE dbo.movimientos_cliente ADD id_transferencia UNIQUEIDENTIFIER NULL;
GO

IF COL_LENGTH('dbo.movimientos_cliente', 'id_devolucion') IS NULL
    ALTER TABLE dbo.movimientos_cliente
        ADD id_devolucion INT NULL
            CONSTRAINT FK_movimientos_cliente_devoluciones REFERENCES dbo.devoluciones (id_devolucion);
GO

IF COL_LENGTH('dbo.movimientos_cliente', 'id_venta') IS NULL
    ALTER TABLE dbo.movimientos_cliente
        ADD id_venta INT NULL
            CONSTRAINT FK_movimientos_cliente_ventas REFERENCES dbo.ventas (id_venta);
GO

-- Tipos de movimiento permitidos (se agregan DESCUENTO y ELIMINACION_VENTA).
IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_movimientos_cliente_tipo')
    ALTER TABLE dbo.movimientos_cliente DROP CONSTRAINT CK_movimientos_cliente_tipo;
GO

ALTER TABLE dbo.movimientos_cliente WITH CHECK
    ADD CONSTRAINT CK_movimientos_cliente_tipo CHECK (
        tipo_movimiento IN (
            'ABONO', 'VENTA', 'DEVOLUCION', 'DESCUENTO',
            'TRANSFERENCIA_SALIDA', 'TRANSFERENCIA_ENTRADA', 'ELIMINACION_VENTA'
        )
    );
GO

/* ---------------------------------------------------------------------
   7. TARJETAS REGISTRADAS (control de tarjetas faltantes)
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.tarjetas_registradas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tarjetas_registradas (
        id_tarjeta_registrada INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_rollo              INT           NOT NULL,
        id_cliente            INT           NOT NULL,
        fecha                 DATE          NOT NULL,
        saldo_registrado      DECIMAL(14,2) NOT NULL,
        estado                CHAR(1)       NOT NULL CONSTRAINT DF_tarjetas_estado DEFAULT ('A'),
        fecha_creacion        DATETIME      NOT NULL CONSTRAINT DF_tarjetas_fecha_creacion DEFAULT (GETDATE()),

        CONSTRAINT FK_tarjetas_rollo   FOREIGN KEY (id_rollo)   REFERENCES dbo.rollos (id_rollo),
        CONSTRAINT FK_tarjetas_cliente FOREIGN KEY (id_cliente) REFERENCES dbo.clientes (id_cliente),
        CONSTRAINT CK_tarjetas_estado  CHECK (estado IN ('A', 'I'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_tarjetas_rollo_fecha_cliente' AND object_id = OBJECT_ID('dbo.tarjetas_registradas'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_tarjetas_rollo_fecha_cliente
        ON dbo.tarjetas_registradas (id_rollo, fecha, id_cliente)
        WHERE estado = 'A';
GO

/* ---------------------------------------------------------------------
   8. TOMAS FÍSICAS DE INVENTARIO
   --------------------------------------------------------------------- */
IF OBJECT_ID('dbo.tomas_fisicas', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.tomas_fisicas (
        id_toma             INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        id_bodega           INT           NOT NULL,
        id_articulo         INT           NOT NULL,
        cantidad_fisica     DECIMAL(12,2) NOT NULL,
        existencia_sistema  DECIMAL(12,2) NOT NULL,
        costo               DECIMAL(12,2) NOT NULL,
        fecha               DATE          NOT NULL CONSTRAINT DF_tomas_fecha DEFAULT (CAST(GETDATE() AS DATE)),
        estado              CHAR(1)       NOT NULL CONSTRAINT DF_tomas_estado DEFAULT ('P'),
        fecha_creacion      DATETIME      NOT NULL CONSTRAINT DF_tomas_fecha_creacion DEFAULT (GETDATE()),
        fecha_actualizacion DATETIME      NULL,

        CONSTRAINT FK_tomas_bodega   FOREIGN KEY (id_bodega)   REFERENCES dbo.bodegas (id_bodega),
        CONSTRAINT FK_tomas_articulo FOREIGN KEY (id_articulo) REFERENCES dbo.articulos (id_articulo),
        CONSTRAINT CK_tomas_cantidad CHECK (cantidad_fisica >= 0),
        CONSTRAINT CK_tomas_estado   CHECK (estado IN ('P', 'A', 'I'))
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_tomas_pendiente' AND object_id = OBJECT_ID('dbo.tomas_fisicas'))
    CREATE UNIQUE NONCLUSTERED INDEX UX_tomas_pendiente
        ON dbo.tomas_fisicas (id_bodega, id_articulo)
        WHERE estado = 'P';
GO

/* ---------------------------------------------------------------------
   9. VERIFICACIÓN: todo debe decir "OK"
   --------------------------------------------------------------------- */
SELECT objeto, CASE WHEN existe = 1 THEN 'OK' ELSE 'FALTA' END AS resultado
FROM (VALUES
    ('Tabla ventas',                          CASE WHEN OBJECT_ID('dbo.ventas', 'U') IS NOT NULL THEN 1 ELSE 0 END),
    ('Tabla ventas_detalle',                  CASE WHEN OBJECT_ID('dbo.ventas_detalle', 'U') IS NOT NULL THEN 1 ELSE 0 END),
    ('Tabla devoluciones',                    CASE WHEN OBJECT_ID('dbo.devoluciones', 'U') IS NOT NULL THEN 1 ELSE 0 END),
    ('Tabla devoluciones_detalle',            CASE WHEN OBJECT_ID('dbo.devoluciones_detalle', 'U') IS NOT NULL THEN 1 ELSE 0 END),
    ('Tabla tarjetas_registradas',            CASE WHEN OBJECT_ID('dbo.tarjetas_registradas', 'U') IS NOT NULL THEN 1 ELSE 0 END),
    ('Tabla tomas_fisicas',                   CASE WHEN OBJECT_ID('dbo.tomas_fisicas', 'U') IS NOT NULL THEN 1 ELSE 0 END),
    ('articulos.costo',                       CASE WHEN COL_LENGTH('dbo.articulos', 'costo') IS NOT NULL THEN 1 ELSE 0 END),
    ('rollos.id_bodega',                      CASE WHEN COL_LENGTH('dbo.rollos', 'id_bodega') IS NOT NULL THEN 1 ELSE 0 END),
    ('ventas.id_rollo',                       CASE WHEN COL_LENGTH('dbo.ventas', 'id_rollo') IS NOT NULL THEN 1 ELSE 0 END),
    ('ventas_detalle.costo_unitario',         CASE WHEN COL_LENGTH('dbo.ventas_detalle', 'costo_unitario') IS NOT NULL THEN 1 ELSE 0 END),
    ('devoluciones_detalle.costo_unitario',   CASE WHEN COL_LENGTH('dbo.devoluciones_detalle', 'costo_unitario') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_inventario.id_venta',       CASE WHEN COL_LENGTH('dbo.movimientos_inventario', 'id_venta') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_inventario.id_devolucion',  CASE WHEN COL_LENGTH('dbo.movimientos_inventario', 'id_devolucion') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_cliente.id_rollo',          CASE WHEN COL_LENGTH('dbo.movimientos_cliente', 'id_rollo') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_cliente.id_empleado',       CASE WHEN COL_LENGTH('dbo.movimientos_cliente', 'id_empleado') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_cliente.id_transferencia',  CASE WHEN COL_LENGTH('dbo.movimientos_cliente', 'id_transferencia') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_cliente.id_devolucion',     CASE WHEN COL_LENGTH('dbo.movimientos_cliente', 'id_devolucion') IS NOT NULL THEN 1 ELSE 0 END),
    ('movimientos_cliente.id_venta',          CASE WHEN COL_LENGTH('dbo.movimientos_cliente', 'id_venta') IS NOT NULL THEN 1 ELSE 0 END),
    ('Índice boleta manual (inventario)',     CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_movimientos_boleta_manual_activa') THEN 1 ELSE 0 END),
    ('Sin boleta única en movimientos',       CASE WHEN NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'UQ_movimientos_numero_boleta') THEN 1 ELSE 0 END),
    ('AUTO_CLOSE desactivado',                CASE WHEN (SELECT is_auto_close_on FROM sys.databases WHERE name = 'inventario_web') = 0 THEN 1 ELSE 0 END)
) AS revision (objeto, existe);
GO
