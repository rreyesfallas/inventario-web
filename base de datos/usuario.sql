USE master;
GO

IF EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = 'inventario_user')
BEGIN
    DROP LOGIN inventario_user;
END
GO

CREATE LOGIN inventario_user 
WITH PASSWORD = 'Inventario123!',
CHECK_POLICY = OFF;
GO

USE inventario_web;
GO

IF EXISTS (SELECT 1 FROM sys.database_principals WHERE name = 'inventario_user')
BEGIN
    DROP USER inventario_user;
END
GO

CREATE USER inventario_user FOR LOGIN inventario_user;
GO

ALTER ROLE db_datareader ADD MEMBER inventario_user;
ALTER ROLE db_datawriter ADD MEMBER inventario_user;
GO