-- ONLY for databases created before transferencia.detalle was added to 01_esquema_y_datos.sql.
-- A fresh install (01 -> 02 -> 03 -> 05 -> 06) already has the column and these procedures: do not run this.
-- Adds an optional detail ("Detalle (opcional)" in the transfer form) to every transfer.
-- Run ONCE as root. Running the ALTER twice fails (duplicate column).
-- The procedures below are identical to the ones in 03_procedimientos.sql.
-- The new p_detalle parameter is required by MySQL; pass NULL when there is no detail.
USE sinpe_movil;

ALTER TABLE transferencia ADD COLUMN detalle VARCHAR(100) NULL;

DELIMITER //

-- 6. procedimiento para transferir por sinpe movil
drop procedure if exists sp_transferir_sinpe //
create procedure sp_transferir_sinpe(p_numero_origen varchar(20), p_numero_destino varchar(20), p_monto decimal(15,2), p_detalle varchar(100))
begin
    declare v_tel_origen int;
    declare v_tel_destino int;
    declare v_dueno_tel_origen int;
    declare v_dueno_tel_destino int;
    declare v_cuenta_origen int;
    declare v_cuenta_destino int;
    declare v_dueno_cta_origen int;
    declare v_dueno_cta_destino int;
    declare v_estado_origen varchar(10);
    declare v_estado_destino varchar(10);
    declare v_moneda_origen char(3);
    declare v_moneda_destino char(3);
    declare v_saldo_origen decimal(15,2);

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    start transaction;

    select id_telefono, id_cliente into v_tel_origen, v_dueno_tel_origen
    from telefono_cliente
    where numero = p_numero_origen;

    select id_telefono, id_cliente into v_tel_destino, v_dueno_tel_destino
    from telefono_cliente
    where numero = p_numero_destino;

    select id_cuenta into v_cuenta_origen
    from afiliacion_sinpe
    where id_telefono = v_tel_origen;

    select id_cuenta into v_cuenta_destino
    from afiliacion_sinpe
    where id_telefono = v_tel_destino;

    if v_cuenta_origen is null or v_cuenta_destino is null then
        signal sqlstate '45000' set message_text = 'Ambos numeros deben estar afiliados a SINPE Movil';
    end if;

    select id_cliente, estado, moneda, saldo
    into v_dueno_cta_origen, v_estado_origen, v_moneda_origen, v_saldo_origen
    from cuenta_iban
    where id_cuenta = v_cuenta_origen
    for update;

    select id_cliente, estado, moneda
    into v_dueno_cta_destino, v_estado_destino, v_moneda_destino
    from cuenta_iban
    where id_cuenta = v_cuenta_destino
    for update;

    if v_dueno_tel_origen != v_dueno_cta_origen or v_dueno_tel_destino != v_dueno_cta_destino then
        signal sqlstate '45000' set message_text = 'Los telefonos no pertenecen al titular de sus cuentas';
    end if;

    if v_estado_origen != 'ACTIVA' or v_estado_destino != 'ACTIVA' then
        signal sqlstate '45000' set message_text = 'Las cuentas deben estar activas';
    end if;

    if v_moneda_origen != 'CRC' or v_moneda_destino != 'CRC' then
        signal sqlstate '45000' set message_text = 'SINPE Movil solo permite cuentas en CRC';
    end if;

    if v_saldo_origen < p_monto then
        signal sqlstate '45000' set message_text = 'Saldo insuficiente';
    end if;

    update cuenta_iban set saldo = saldo - p_monto where id_cuenta = v_cuenta_origen;
    update cuenta_iban set saldo = saldo + p_monto where id_cuenta = v_cuenta_destino;

    insert into transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo, detalle)
    values (v_cuenta_origen, v_cuenta_destino, p_monto, 'SINPE_MOVIL', nullif(trim(p_detalle), ''));

    insert into transferencia_sinpe (id_transferencia, id_telefono_origen, id_telefono_destino)
    values (last_insert_id(), v_tel_origen, v_tel_destino);

    commit;
end //

-- 7. procedimiento para transferir por iban
drop procedure if exists sp_transferir_iban //
create procedure sp_transferir_iban(
    in p_iban_origen  varchar(30),
    in p_iban_destino varchar(30),
    in p_monto        decimal(15,2),
    in p_detalle      varchar(100)
)
begin
    declare v_id_origen      int;
    declare v_id_destino     int;
    declare v_saldo_origen   decimal(15,2);
    declare v_estado_origen  varchar(10);
    declare v_estado_destino varchar(10);
    declare v_moneda_origen  char(3);
    declare v_moneda_destino char(3);

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    if p_monto is null or p_monto <= 0 then
        signal sqlstate '45000' set message_text = 'El monto debe ser positivo';
    end if;

    if p_iban_origen = p_iban_destino then
        signal sqlstate '45000' set message_text = 'No se puede transferir a la misma cuenta';
    end if;

    start transaction;

        select id_cuenta, saldo, estado, moneda
        into v_id_origen, v_saldo_origen, v_estado_origen, v_moneda_origen
        from cuenta_iban
        where iban = p_iban_origen
        for update;

        select id_cuenta, estado, moneda
        into v_id_destino, v_estado_destino, v_moneda_destino
        from cuenta_iban
        where iban = p_iban_destino
        for update;

        if v_id_origen is null then
            signal sqlstate '45000' set message_text = 'La cuenta origen no existe';
        end if;

        if v_id_destino is null then
            signal sqlstate '45000' set message_text = 'La cuenta destino no existe';
        end if;

        if v_estado_origen <> 'ACTIVA' or v_estado_destino <> 'ACTIVA' then
            signal sqlstate '45000' set message_text = 'Ambas cuentas deben estar activas';
        end if;

        if v_moneda_origen <> v_moneda_destino then
            signal sqlstate '45000' set message_text = 'Las cuentas deben tener la misma moneda';
        end if;

        if v_saldo_origen < p_monto then
            signal sqlstate '45000' set message_text = 'Saldo insuficiente';
        end if;

        update cuenta_iban set saldo = saldo - p_monto where id_cuenta = v_id_origen;
        update cuenta_iban set saldo = saldo + p_monto where id_cuenta = v_id_destino;

        insert into transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo, detalle)
        values (v_id_origen, v_id_destino, p_monto, 'IBAN', nullif(trim(p_detalle), ''));

    commit;
end //

DELIMITER ;
