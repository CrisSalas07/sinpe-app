-- Usuario de MySQL del módulo Respaldos (Laboratorio Copia de Seguridad, ejercicio 3).
-- Ejecutar como root, una vez, después de 01, 02 y 03:
--   mysql -u root -p < db/04_usuario_respaldos.sql
-- y poner la misma contraseña en BACKUP_DB_PASSWORD del .env (BACKUP_DB_USER=sinpe_backup).
--
-- Restaurar es ejecutar todo el SQL del archivo. Con este usuario, MySQL solo deja que ese SQL
-- toque la base sinpe_movil: no puede crear usuarios, dar permisos (no tiene GRANT OPTION), leer
-- otras bases ni crear objetos a nombre de root. Por eso la app quita los DEFINER=... del archivo
-- antes de restaurar, y los procedimientos y triggers restaurados quedan a nombre de sinpe_backup.
-- No borre este usuario: si lo hace, esos procedimientos dejan de funcionar.

CREATE USER IF NOT EXISTS 'sinpe_backup'@'localhost' IDENTIFIED BY 'cambie-esta-contrasena';
GRANT ALL PRIVILEGES ON sinpe_movil.* TO 'sinpe_backup'@'localhost';
-- mysqldump lee el código de los procedimientos que son de root (solo lectura, no los ejecuta).
GRANT SHOW_ROUTINE ON *.* TO 'sinpe_backup'@'localhost';
-- Restaurar borra los procedimientos actuales, y MySQL exige SYSTEM_USER para borrar los que son
-- de root. Solo con esto no puede crear nada a nombre de root: para eso haría falta SET_USER_ID,
-- que este usuario no tiene. Tampoco le da permisos sobre otras bases ni sobre usuarios.
GRANT SYSTEM_USER ON *.* TO 'sinpe_backup'@'localhost';

-- Con el registro binario activo (lo normal en MySQL 8), crear un trigger sin el privilegio SUPER
-- da el error 1419. Esta variable lo permite; solo afecta la réplica a otro servidor, que este
-- proyecto no usa. SET PERSIST la conserva cuando MySQL se reinicia.
SET PERSIST log_bin_trust_function_creators = 1;
