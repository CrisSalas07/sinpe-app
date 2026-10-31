USE sinpe_movil;

DELIMITER //

-- 1. procedimiento para registrar una cuenta
drop procedure if exists sp_registrar_cuenta //
create procedure sp_registrar_cuenta(
    in  p_id_cliente     int,
    in  p_id_entidad     int,
    in  p_moneda         char(3),
    in  p_iban           varchar(30),
    in  p_saldo          decimal(15,2),
    in  p_fecha_apertura date,
    in  p_estado         varchar(10)
)
begin
    if not exists (select 1 from cliente where id_cliente = p_id_cliente) then
        signal sqlstate '45000' set message_text = 'El cliente no existe';
    end if;

    if exists (select 1 from cliente where id_cliente = p_id_cliente and estado = 'INACTIVO') then
        signal sqlstate '45000' set message_text = 'El cliente esta inactivo';
    end if;

    if not exists (select 1 from entidad_financiera where id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'La entidad financiera no existe';
    end if;

    if not exists (select 1 from moneda where codigo = p_moneda) then
        signal sqlstate '45000' set message_text = 'La moneda no existe en el catalogo';
    end if;

    if p_iban is null or p_iban not regexp '^CR[0-9]{20}$' then
        signal sqlstate '45000' set message_text = 'IBAN invalido: debe ser CR seguido de 20 digitos';
    end if;

    if exists (select 1 from cuenta_iban where iban = p_iban) then
        signal sqlstate '45000' set message_text = 'El IBAN ya esta registrado';
    end if;

    if p_saldo is null or p_saldo < 0 then
        signal sqlstate '45000' set message_text = 'El saldo inicial no puede ser negativo';
    end if;

    if p_estado not in ('ACTIVA','INACTIVA','BLOQUEADA') then
        signal sqlstate '45000' set message_text = 'Estado de cuenta inválido';
    end if;

    insert into cuenta_iban (id_cliente, id_entidad, moneda, iban, saldo, estado, fecha_apertura)
    values (p_id_cliente, p_id_entidad, p_moneda, p_iban, p_saldo, p_estado,
            coalesce(p_fecha_apertura, curdate()));
end //

-- 2. procedimiento para registrar un telefono
drop procedure if exists sp_registrar_telefono //
create procedure sp_registrar_telefono(p_identificacion varchar(20), p_numero varchar(8))
begin
    declare v_id_cliente int;
    declare v_id_telefono int;

    select id_cliente into v_id_cliente
    from cliente
    where identificacion = p_identificacion;

    if v_id_cliente is null then
        signal sqlstate '45000' set message_text = 'El cliente no esta registrado';
    end if;

    if p_numero not regexp '^[0-9]{8}$' then
        signal sqlstate '45000' set message_text = 'El numero tiene que ser 8 digitos';
    end if;

    select id_telefono into v_id_telefono
    from telefono_cliente
    where numero = p_numero;

    if v_id_telefono is not null then
        signal sqlstate '45000' set message_text = 'Este numero ya esta registrado';
    end if;

    insert into telefono_cliente (id_cliente, numero) values (v_id_cliente, p_numero);
end //

-- 3. procedimiento para afiliar un teléfono a sinpe
drop procedure if exists sp_afiliar_sinpe //
create procedure sp_afiliar_sinpe(in p_id_telefono int, in p_id_cuenta int)
begin
    if not exists (select 1 from telefono_cliente where id_telefono = p_id_telefono) then
        signal sqlstate '45000' set message_text = 'El telefono no existe';
    end if;

    if not exists (select 1 from cuenta_iban where id_cuenta = p_id_cuenta) then
        signal sqlstate '45000' set message_text = 'La cuenta no existe';
    end if;

    if exists (select 1 from afiliacion_sinpe where id_telefono = p_id_telefono) then
        signal sqlstate '45000' set message_text = 'El telefono ya esta afiliado';
    end if;

    insert into afiliacion_sinpe (id_telefono, id_cuenta)
    values (p_id_telefono, p_id_cuenta);
end //

-- 4. procedimiento para desafiliar un teléfono de sinpe
drop procedure if exists sp_desafiliar_sinpe //
create procedure sp_desafiliar_sinpe(p_numero varchar(20))
begin
    declare v_id_telefono int;
    declare v_id_afiliacion int;

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    start transaction;

    select id_telefono into v_id_telefono
    from telefono_cliente
    where numero = p_numero;

    select id_afiliacion into v_id_afiliacion
    from afiliacion_sinpe
    where id_telefono = v_id_telefono;

    if v_id_afiliacion is null then
        signal sqlstate '45000' set message_text = 'El numero no esta afiliado a SINPE Movil';
    end if;

    delete from afiliacion_sinpe
    where id_afiliacion = v_id_afiliacion;

    commit;
end //

-- 5. procedimiento para trasladar un teléfono a otra cuenta
drop procedure if exists sp_cambiar_cuenta_sinpe //
create procedure sp_cambiar_cuenta_sinpe(
    in p_id_telefono     int,
    in p_id_cuenta_nueva int
)
begin
    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    if not exists (select 1 from afiliacion_sinpe where id_telefono = p_id_telefono) then
        signal sqlstate '45000' set message_text = 'El telefono no esta afiliado';
    end if;

    if exists (select 1 from afiliacion_sinpe
               where id_telefono = p_id_telefono and id_cuenta = p_id_cuenta_nueva) then
        signal sqlstate '45000' set message_text = 'El telefono ya esta afiliado a esa cuenta';
    end if;

    start transaction;

        delete from afiliacion_sinpe where id_telefono = p_id_telefono;

        insert into afiliacion_sinpe (id_telefono, id_cuenta)
        values (p_id_telefono, p_id_cuenta_nueva);

    commit;
end //

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

-- 8. procedimiento para consultar movimientos de una cuenta en un período
drop procedure if exists sp_consultar_movimientos //
create procedure sp_consultar_movimientos(p_iban varchar(22), p_fecha_inicio date, p_fecha_fin date)
begin
    declare v_id_cuenta int;

    select id_cuenta into v_id_cuenta
    from cuenta_iban
    where iban = p_iban;

    if v_id_cuenta is null then
        signal sqlstate '45000' set message_text = 'La cuenta IBAN no existe';
    end if;

    if p_fecha_inicio > p_fecha_fin then
        signal sqlstate '45000' set message_text = 'La fecha de inicio no puede ser mayor que la fecha final';
    end if;

    select t.id_transferencia, t.fecha, t.tipo,
           case when t.id_cuenta_origen = v_id_cuenta then 'ENVIADA' else 'RECIBIDA' end as movimiento,
           cp.iban as iban_contraparte,
           concat(cl.nombres, ' ', cl.primer_apellido) as contraparte,
           t.monto
    from transferencia t
    join cuenta_iban cp on cp.id_cuenta = case when t.id_cuenta_origen = v_id_cuenta
                                               then t.id_cuenta_destino else t.id_cuenta_origen end
    join cliente cl on cl.id_cliente = cp.id_cliente
    where (t.id_cuenta_origen = v_id_cuenta or t.id_cuenta_destino = v_id_cuenta)
      and date(t.fecha) between p_fecha_inicio and p_fecha_fin
    order by t.fecha;

    select coalesce(sum(case when t.id_cuenta_origen = v_id_cuenta then t.monto else 0 end), 0) as total_enviado,
           coalesce(sum(case when t.id_cuenta_destino = v_id_cuenta then t.monto else 0 end), 0) as total_recibido
    from transferencia t
    where (t.id_cuenta_origen = v_id_cuenta or t.id_cuenta_destino = v_id_cuenta)
      and date(t.fecha) between p_fecha_inicio and p_fecha_fin;
end //

-- 9. procedimiento para registrar un cliente
drop procedure if exists sp_registrar_cliente //
create procedure sp_registrar_cliente(
    in p_identificacion   varchar(20),
    in p_nombres          varchar(80),
    in p_primer_apellido  varchar(60),
    in p_segundo_apellido varchar(60),
    in p_correo           varchar(120),
    in p_estado           varchar(10)
)
begin
    if exists (select 1 from cliente where identificacion = p_identificacion) then
        signal sqlstate '45000' set message_text = 'La identificación ya está registrada';
    end if;

    if exists (select 1 from cliente where correo = p_correo) then
        signal sqlstate '45000' set message_text = 'El correo ya pertenece a otro cliente';
    end if;

    insert into cliente (identificacion, nombres, primer_apellido, segundo_apellido, correo, estado)
    values (p_identificacion, upper(p_nombres), upper(p_primer_apellido),
            upper(p_segundo_apellido), lower(p_correo), p_estado);
end //

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
