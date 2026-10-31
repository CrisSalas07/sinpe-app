USE sinpe_movil;

DELIMITER //

-- 1. trigger validar afiliación: impedir cuenta no activa, moneda distinta de CRC y titularidad diferente
drop trigger if exists trg_validar_afiliacion //
create trigger trg_validar_afiliacion
before insert on afiliacion_sinpe
for each row
begin
    declare v_estado varchar(10);
    declare v_moneda char(3);
    declare v_dueno_cuenta int;
    declare v_dueno_telefono int;

    select estado, moneda, id_cliente
    into v_estado, v_moneda, v_dueno_cuenta
    from cuenta_iban
    where id_cuenta = new.id_cuenta;

    select id_cliente
    into v_dueno_telefono
    from telefono_cliente
    where id_telefono = new.id_telefono;

    if v_estado <> 'ACTIVA' then
        signal sqlstate '45000' set message_text = 'La cuenta no esta activa';
    end if;

    if v_moneda <> 'CRC' then
        signal sqlstate '45000' set message_text = 'La cuenta no es en colones';
    end if;

    if v_dueno_cuenta <> v_dueno_telefono then
        signal sqlstate '45000' set message_text = 'El telefono y la cuenta son de clientes distintos';
    end if;
end //

-- 2. trigger auditar afiliación: registrar AFILIACION en historial_afiliacion
drop trigger if exists trg_historial_afiliacion //
create trigger trg_historial_afiliacion
after insert on afiliacion_sinpe
for each row
begin
    insert into historial_afiliacion (id_telefono, id_cuenta, accion)
    values (new.id_telefono, new.id_cuenta, 'AFILIACION');
end //

-- 3. trigger auditar desafiliación
drop trigger if exists trg_afiliacion_auditar_delete //
create trigger trg_afiliacion_auditar_delete
before delete on afiliacion_sinpe
for each row
begin
    insert into historial_afiliacion (id_telefono, id_cuenta, accion)
    values (old.id_telefono, old.id_cuenta, 'DESAFILIACION');
end //

-- 4. trigger validar transferencia: monto positivo y cuentas distintas
-- justificación: estado activo, moneda y saldo se validan en los procedimientos porque
-- necesitan bloquear las cuentas (for update) y forman parte de la transacción que
-- debita y acredita; además la regla de misma moneda aplica solo a transferencias iban.
drop trigger if exists trg_transferencia_validar //
create trigger trg_transferencia_validar
before insert on transferencia
for each row
begin
    if new.monto <= 0 then
        signal sqlstate '45000' set message_text = 'El monto debe ser positivo';
    end if;

    if new.id_cuenta_origen = new.id_cuenta_destino then
        signal sqlstate '45000' set message_text = 'No se puede transferir a la misma cuenta';
    end if;
end //

-- trigger extra: impide cambiar el titular de un teléfono con afiliación vigente
-- justificación: si el teléfono cambia de dueño estando afiliado, quedaría afiliado a la cuenta
-- de otro cliente, rompiendo la regla 4; como trigger protege cualquier update, no solo los de un procedimiento.
drop trigger if exists trg_telefono_validar_update //
create trigger trg_telefono_validar_update
before update on telefono_cliente
for each row
begin
    declare v_afiliacion int;

    select id_afiliacion into v_afiliacion
    from afiliacion_sinpe
    where id_telefono = old.id_telefono;

    if old.id_cliente != new.id_cliente and v_afiliacion is not null then
        signal sqlstate '45000' set message_text = 'No se puede cambiar el titular de un teléfono afiliado';
    end if;
end //

-- trigger extra: no registrar teléfonos a clientes inactivos
-- justificación: un cliente inactivo no debería incorporar nuevos medios de pago;
-- se valida al insertar en telefono_cliente, que es lo que hace sp_registrar_telefono.
drop trigger if exists trg_telefono_validar_insert //
create trigger trg_telefono_validar_insert
before insert on telefono_cliente
for each row
begin
    declare v_estado varchar(10);

    select estado into v_estado
    from cliente where id_cliente = new.id_cliente;

    if v_estado = 'INACTIVO' then
        signal sqlstate '45000' set message_text = 'Este cliente esta inactivo';
    end if;
end //

DELIMITER ;
