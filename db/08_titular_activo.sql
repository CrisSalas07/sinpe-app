-- Recreates sp_cambiar_titular_telefono so the new owner must be ACTIVO
-- (same rule and message as trg_telefono_validar_insert when registering a phone).
-- Run as root on databases created before this change. Safe to run more than once.
-- A fresh install (01 -> 02 -> 03 -> 05 -> 06) already has this version: do not run this.
-- The procedure below is identical to the one in 03_procedimientos.sql.
USE sinpe_movil;

DELIMITER //

-- 10. procedimiento para cambiar el titular de un teléfono
drop procedure if exists sp_cambiar_titular_telefono //
create procedure sp_cambiar_titular_telefono(in p_numero varchar(8), in p_identificacion_nueva varchar(20))
begin
    declare v_id_cliente int;

    select id_cliente into v_id_cliente
    from cliente
    where identificacion = p_identificacion_nueva;

    if v_id_cliente is null then
        signal sqlstate '45000' set message_text = 'El nuevo titular no está registrado';
    end if;

    -- same rule as trg_telefono_validar_insert: an inactive client cannot receive a phone
    if exists (select 1 from cliente where id_cliente = v_id_cliente and estado = 'INACTIVO') then
        signal sqlstate '45000' set message_text = 'Este cliente esta inactivo';
    end if;

    if not exists (select 1 from telefono_cliente where numero = p_numero) then
        signal sqlstate '45000' set message_text = 'El teléfono no está registrado';
    end if;

    update telefono_cliente set id_cliente = v_id_cliente where numero = p_numero;
end //

DELIMITER ;
