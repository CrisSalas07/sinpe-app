USE sinpe_movil;

DELIMITER //

-- la entidad (p_id_entidad) y el cliente (p_id_cliente) siempre salen de la sesion de la aplicacion,
-- nunca de lo que envia el navegador.

-- 1. procedimiento para registrar una cuenta (se crea ACTIVA)
drop procedure if exists sp_registrar_cuenta //
create procedure sp_registrar_cuenta(
    in  p_id_entidad     int,
    in  p_id_cliente     int,
    in  p_moneda         char(3),
    in  p_iban           varchar(30),
    in  p_saldo          decimal(15,2),
    in  p_fecha_apertura date
)
begin
    declare v_codigo_iban char(3);

    if not exists (select 1 from cliente where id_cliente = p_id_cliente) then
        signal sqlstate '45000' set message_text = 'El cliente no existe';
    end if;

    if exists (select 1 from cliente where id_cliente = p_id_cliente and estado = 'INACTIVO') then
        signal sqlstate '45000' set message_text = 'El cliente está inactivo';
    end if;

    select codigo_iban into v_codigo_iban
    from entidad_financiera
    where id_entidad = p_id_entidad;

    if v_codigo_iban is null then
        signal sqlstate '45000' set message_text = 'La entidad financiera no existe';
    end if;

    if not exists (select 1 from cliente_entidad
                   where id_cliente = p_id_cliente and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El cliente no pertenece a esta entidad';
    end if;

    if not exists (select 1 from moneda where codigo = p_moneda) then
        signal sqlstate '45000' set message_text = 'La moneda no existe en el catálogo';
    end if;

    if p_iban is null or p_iban not regexp '^CR[0-9]{20}$' then
        signal sqlstate '45000' set message_text = 'IBAN inválido: debe ser CR seguido de 20 dígitos';
    end if;

    if substring(p_iban, 5, 4) <> concat('0', v_codigo_iban) then
        signal sqlstate '45000' set message_text = 'El IBAN no corresponde a esta entidad';
    end if;

    if exists (select 1 from cuenta_iban where iban = p_iban) then
        signal sqlstate '45000' set message_text = 'El IBAN ya está registrado';
    end if;

    if p_saldo is null or p_saldo < 0 then
        signal sqlstate '45000' set message_text = 'El saldo inicial no puede ser negativo';
    end if;

    insert into cuenta_iban (id_cliente, id_entidad, moneda, iban, saldo, fecha_apertura)
    values (p_id_cliente, p_id_entidad, p_moneda, p_iban, p_saldo,
            coalesce(p_fecha_apertura, curdate()));
end //

-- 2. procedimiento para registrar un telefono (el titular es el cliente de la sesion)
drop procedure if exists sp_registrar_telefono //
create procedure sp_registrar_telefono(in p_id_cliente int, in p_numero varchar(8))
begin
    if not exists (select 1 from cliente where id_cliente = p_id_cliente) then
        signal sqlstate '45000' set message_text = 'El cliente no está registrado';
    end if;

    if p_numero not regexp '^[0-9]{8}$' then
        signal sqlstate '45000' set message_text = 'El número tiene que ser 8 dígitos';
    end if;

    if exists (select 1 from telefono_cliente where numero = p_numero) then
        signal sqlstate '45000' set message_text = 'Este número ya está registrado';
    end if;

    insert into telefono_cliente (id_cliente, numero) values (p_id_cliente, p_numero);
end //

-- 3. procedimiento para afiliar un telefono a sinpe
-- la cuenta se valida antes que la afiliacion para seguir el orden de la regla: asi un telefono ya
-- afiliado en otra entidad con una cuenta invalida recibe el error de la cuenta. Los mensajes de
-- estado, moneda y titularidad son los de trg_validar_afiliacion, que sigue siendo la ultima defensa.
drop procedure if exists sp_afiliar_sinpe //
create procedure sp_afiliar_sinpe(in p_id_entidad int, in p_id_telefono int, in p_id_cuenta int)
begin
    declare v_dueno_telefono int;
    declare v_dueno_cuenta int;
    declare v_entidad_cuenta int;
    declare v_estado varchar(10);
    declare v_moneda char(3);
    declare v_entidad_afiliada int;
    declare v_codigo_afiliada varchar(12);
    declare v_mensaje varchar(128);

    select id_cliente into v_dueno_telefono
    from telefono_cliente
    where id_telefono = p_id_telefono;

    if v_dueno_telefono is null then
        signal sqlstate '45000' set message_text = 'El teléfono no existe';
    end if;

    if not exists (select 1 from cliente_entidad
                   where id_cliente = v_dueno_telefono and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El teléfono no pertenece a un cliente de esta entidad';
    end if;

    select id_cliente, id_entidad, estado, moneda
    into v_dueno_cuenta, v_entidad_cuenta, v_estado, v_moneda
    from cuenta_iban
    where id_cuenta = p_id_cuenta;

    if v_dueno_cuenta is null then
        signal sqlstate '45000' set message_text = 'La cuenta no existe';
    end if;

    if v_entidad_cuenta <> p_id_entidad then
        signal sqlstate '45000' set message_text = 'La cuenta no pertenece a esta entidad';
    end if;

    if v_estado <> 'ACTIVA' then
        signal sqlstate '45000' set message_text = 'La cuenta no está activa';
    end if;

    if v_moneda <> 'CRC' then
        signal sqlstate '45000' set message_text = 'La cuenta no es en colones';
    end if;

    if v_dueno_cuenta <> v_dueno_telefono then
        signal sqlstate '45000' set message_text = 'El teléfono y la cuenta son de clientes distintos';
    end if;

    select c.id_entidad, e.codigo into v_entidad_afiliada, v_codigo_afiliada
    from afiliacion_sinpe a
    join cuenta_iban c on c.id_cuenta = a.id_cuenta
    join entidad_financiera e on e.id_entidad = c.id_entidad
    where a.id_telefono = p_id_telefono;

    if v_entidad_afiliada = p_id_entidad then
        signal sqlstate '45000' set message_text = 'El teléfono ya está afiliado en esta entidad. Use Cambiar cuenta.';
    end if;

    if v_entidad_afiliada is not null then
        set v_mensaje = concat('El teléfono ya está afiliado en otra entidad (', v_codigo_afiliada,
                               '). Debe desafiliarse allá primero.');
        signal sqlstate '45000' set message_text = v_mensaje;
    end if;

    insert into afiliacion_sinpe (id_telefono, id_cuenta)
    values (p_id_telefono, p_id_cuenta);
end //

-- 4. procedimiento para desafiliar un telefono de sinpe
drop procedure if exists sp_desafiliar_sinpe //
create procedure sp_desafiliar_sinpe(in p_id_entidad int, in p_numero varchar(20))
begin
    declare v_id_telefono int;
    declare v_id_afiliacion int;
    declare v_id_cuenta int;

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    start transaction;

    select id_telefono into v_id_telefono
    from telefono_cliente
    where numero = p_numero;

    select id_afiliacion, id_cuenta into v_id_afiliacion, v_id_cuenta
    from afiliacion_sinpe
    where id_telefono = v_id_telefono
    for update;

    if v_id_afiliacion is null then
        signal sqlstate '45000' set message_text = 'El número no está afiliado a SINPE Móvil';
    end if;

    if not exists (select 1 from cuenta_iban
                   where id_cuenta = v_id_cuenta and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El teléfono está afiliado en otra entidad; solo esa entidad puede modificarlo';
    end if;

    delete from afiliacion_sinpe
    where id_afiliacion = v_id_afiliacion;

    commit;
end //

-- 5. procedimiento para trasladar un telefono a otra cuenta
-- si algo falla se hace rollback y se conserva la afiliacion original.
drop procedure if exists sp_cambiar_cuenta_sinpe //
create procedure sp_cambiar_cuenta_sinpe(
    in p_id_entidad      int,
    in p_id_telefono     int,
    in p_id_cuenta_nueva int
)
begin
    declare v_id_cuenta_actual int;

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    start transaction;

    select id_cuenta into v_id_cuenta_actual
    from afiliacion_sinpe
    where id_telefono = p_id_telefono
    for update;

    if v_id_cuenta_actual is null then
        signal sqlstate '45000' set message_text = 'El teléfono no está afiliado';
    end if;

    if not exists (select 1 from cuenta_iban
                   where id_cuenta = v_id_cuenta_actual and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El teléfono está afiliado en otra entidad; solo esa entidad puede modificarlo';
    end if;

    if not exists (select 1 from cuenta_iban
                   where id_cuenta = p_id_cuenta_nueva and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'La cuenta no pertenece a esta entidad';
    end if;

    if v_id_cuenta_actual = p_id_cuenta_nueva then
        signal sqlstate '45000' set message_text = 'El teléfono ya está afiliado a esa cuenta';
    end if;

    delete from afiliacion_sinpe where id_telefono = p_id_telefono;

    insert into afiliacion_sinpe (id_telefono, id_cuenta)
    values (p_id_telefono, p_id_cuenta_nueva);

    commit;
end //

-- 6. procedimiento para transferir por sinpe movil: de una cuenta propia a un numero de telefono
drop procedure if exists sp_transferir_sinpe //
create procedure sp_transferir_sinpe(
    in p_id_entidad      int,
    in p_id_cliente      int,
    in p_iban_origen     varchar(30),
    in p_numero_destino  varchar(20),
    in p_monto           decimal(15,2),
    in p_detalle         varchar(100)
)
begin
    declare v_cuenta_origen int;
    declare v_cuenta_destino int;
    declare v_tel_origen int;
    declare v_tel_destino int;
    declare v_estado_origen varchar(10);
    declare v_estado_destino varchar(10);
    declare v_moneda_origen char(3);
    declare v_moneda_destino char(3);
    declare v_saldo_origen decimal(15,2);
    declare v_limite decimal(15,2);
    declare v_enviado_hoy decimal(15,2);

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    start transaction;

    -- 1. la cuenta de origen es del cliente y de la entidad de la sesion
    select id_cuenta, estado, moneda, saldo
    into v_cuenta_origen, v_estado_origen, v_moneda_origen, v_saldo_origen
    from cuenta_iban
    where iban = p_iban_origen and id_cliente = p_id_cliente and id_entidad = p_id_entidad
    for update;

    if v_cuenta_origen is null then
        signal sqlstate '45000' set message_text = 'La cuenta de origen no pertenece al cliente';
    end if;

    -- 2. la cuenta de origen esta activa y es en colones
    if v_estado_origen <> 'ACTIVA' then
        signal sqlstate '45000' set message_text = 'La cuenta de origen no está activa';
    end if;

    if v_moneda_origen <> 'CRC' then
        signal sqlstate '45000' set message_text = 'SINPE Móvil solo permite cuentas en CRC';
    end if;

    -- 3. el numero de destino esta registrado y afiliado en cualquier entidad
    select id_telefono into v_tel_destino
    from telefono_cliente
    where numero = p_numero_destino;

    if v_tel_destino is null then
        signal sqlstate '45000' set message_text = 'El número de destino no está registrado';
    end if;

    select id_cuenta into v_cuenta_destino
    from afiliacion_sinpe
    where id_telefono = v_tel_destino;

    if v_cuenta_destino is null then
        signal sqlstate '45000' set message_text = 'El número de destino no está afiliado a SINPE Móvil';
    end if;

    -- 4. la cuenta de destino esta activa
    select estado, moneda into v_estado_destino, v_moneda_destino
    from cuenta_iban
    where id_cuenta = v_cuenta_destino
    for update;

    if v_estado_destino <> 'ACTIVA' then
        signal sqlstate '45000' set message_text = 'La cuenta de destino no está activa';
    end if;

    if v_moneda_destino <> 'CRC' then
        signal sqlstate '45000' set message_text = 'SINPE Móvil solo permite cuentas en CRC';
    end if;

    -- 5. origen y destino son cuentas distintas
    if v_cuenta_origen = v_cuenta_destino then
        signal sqlstate '45000' set message_text = 'No se puede transferir a la misma cuenta';
    end if;

    -- 6. el monto es positivo
    if p_monto is null or p_monto <= 0 then
        signal sqlstate '45000' set message_text = 'El monto debe ser positivo';
    end if;

    -- 7. limite diario: la cuenta de origen esta bloqueada, asi que dos envios no pueden sumar a la vez
    select limite_diario_sinpe into v_limite
    from entidad_financiera
    where id_entidad = p_id_entidad;

    select coalesce(sum(monto), 0) into v_enviado_hoy
    from transferencia
    where id_cuenta_origen = v_cuenta_origen
      and tipo = 'SINPE_MOVIL'
      and fecha >= curdate()
      and fecha < curdate() + interval 1 day;

    if v_enviado_hoy + p_monto > v_limite then
        signal sqlstate '45000' set message_text = 'El monto supera su límite diario de SINPE Móvil';
    end if;

    -- 8. hay saldo suficiente
    if v_saldo_origen < p_monto then
        signal sqlstate '45000' set message_text = 'Saldo insuficiente';
    end if;

    -- una cuenta puede tener varios telefonos: se guarda el primero que se afilio, o null si no tiene
    select id_telefono into v_tel_origen
    from afiliacion_sinpe
    where id_cuenta = v_cuenta_origen
    order by id_afiliacion
    limit 1;

    update cuenta_iban set saldo = saldo - p_monto where id_cuenta = v_cuenta_origen;
    update cuenta_iban set saldo = saldo + p_monto where id_cuenta = v_cuenta_destino;

    insert into transferencia (id_cuenta_origen, id_cuenta_destino, monto, tipo, detalle)
    values (v_cuenta_origen, v_cuenta_destino, p_monto, 'SINPE_MOVIL', nullif(trim(p_detalle), ''));

    insert into transferencia_sinpe (id_transferencia, id_telefono_origen, id_telefono_destino)
    values (last_insert_id(), v_tel_origen, v_tel_destino);

    commit;
end //

-- 7. procedimiento para transferir por iban: de una cuenta propia a cualquier cuenta
drop procedure if exists sp_transferir_iban //
create procedure sp_transferir_iban(
    in p_id_entidad   int,
    in p_id_cliente   int,
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

    start transaction;

        select id_cuenta, saldo, estado, moneda
        into v_id_origen, v_saldo_origen, v_estado_origen, v_moneda_origen
        from cuenta_iban
        where iban = p_iban_origen and id_cliente = p_id_cliente and id_entidad = p_id_entidad
        for update;

        if v_id_origen is null then
            signal sqlstate '45000' set message_text = 'La cuenta de origen no pertenece al cliente';
        end if;

        select id_cuenta, estado, moneda
        into v_id_destino, v_estado_destino, v_moneda_destino
        from cuenta_iban
        where iban = p_iban_destino
        for update;

        if v_id_destino is null then
            signal sqlstate '45000' set message_text = 'La cuenta destino no existe';
        end if;

        if v_id_origen = v_id_destino then
            signal sqlstate '45000' set message_text = 'No se puede transferir a la misma cuenta';
        end if;

        if p_monto is null or p_monto <= 0 then
            signal sqlstate '45000' set message_text = 'El monto debe ser positivo';
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

-- 8. procedimiento para consultar movimientos de una cuenta en un periodo
drop procedure if exists sp_consultar_movimientos //
create procedure sp_consultar_movimientos(
    in p_id_cliente   int,
    in p_id_entidad   int,
    in p_iban         varchar(22),
    in p_fecha_inicio date,
    in p_fecha_fin    date
)
begin
    declare v_id_cuenta int;

    select id_cuenta into v_id_cuenta
    from cuenta_iban
    where iban = p_iban and id_cliente = p_id_cliente and id_entidad = p_id_entidad;

    if v_id_cuenta is null then
        signal sqlstate '45000' set message_text = 'La cuenta no pertenece al cliente';
    end if;

    if p_fecha_inicio > p_fecha_fin then
        signal sqlstate '45000' set message_text = 'La fecha de inicio no puede ser mayor que la fecha final';
    end if;

    select t.id_transferencia, t.fecha, t.tipo,
           case when t.id_cuenta_origen = v_id_cuenta then 'ENVIADA' else 'RECIBIDA' end as movimiento,
           cp.iban as iban_contraparte,
           cl.nombres as nombres_contraparte,
           cl.primer_apellido as apellido_contraparte,
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

-- 9. procedimiento para registrar un cliente en una entidad con sus credenciales (se crea ACTIVO)
-- la persona es unica por identificacion: si ya es cliente de otra entidad no se crea otra persona,
-- solo se agrega su relacion con esta entidad. p_password_hash ya viene con hash desde la aplicacion.
-- si la persona ya existe, los datos escritos deben coincidir con los guardados: asi no se ignoran en
-- silencio y una entidad no recibe datos que solo conocia otra. El mensaje no dice que campo fallo.
drop procedure if exists sp_registrar_cliente //
create procedure sp_registrar_cliente(
    in p_id_entidad       int,
    in p_identificacion   varchar(20),
    in p_nombres          varchar(80),
    in p_primer_apellido  varchar(60),
    in p_segundo_apellido varchar(60),
    in p_correo           varchar(120),
    in p_usuario          varchar(50),
    in p_password_hash    varchar(255)
)
begin
    declare v_id_cliente int;

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    start transaction;

    select id_cliente into v_id_cliente
    from cliente
    where identificacion = p_identificacion;

    if exists (select 1 from cliente_entidad
               where id_cliente = v_id_cliente and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El cliente ya está registrado en esta entidad';
    end if;

    if v_id_cliente is not null then
        if not exists (select 1 from cliente
                       where id_cliente = v_id_cliente
                         and nombres = p_nombres
                         and primer_apellido = p_primer_apellido
                         and segundo_apellido = p_segundo_apellido
                         and correo = p_correo) then
            signal sqlstate '45000' set message_text = 'Los datos no coinciden con la persona registrada con esa identificación';
        end if;

        if exists (select 1 from cliente where id_cliente = v_id_cliente and estado = 'INACTIVO') then
            signal sqlstate '45000' set message_text = 'El cliente está inactivo';
        end if;
    end if;

    if exists (select 1 from cliente
               where correo = p_correo and (v_id_cliente is null or id_cliente <> v_id_cliente)) then
        signal sqlstate '45000' set message_text = 'El correo ya pertenece a otro cliente';
    end if;

    if exists (select 1 from cliente_entidad
               where id_entidad = p_id_entidad and usuario = p_usuario) then
        signal sqlstate '45000' set message_text = 'El usuario ya está en uso en esta entidad';
    end if;

    if v_id_cliente is null then
        insert into cliente (identificacion, nombres, primer_apellido, segundo_apellido, correo)
        values (p_identificacion, upper(p_nombres), upper(p_primer_apellido),
                upper(p_segundo_apellido), lower(p_correo));

        set v_id_cliente = last_insert_id();
    end if;

    insert into cliente_entidad (id_cliente, id_entidad, usuario, password_hash)
    values (v_id_cliente, p_id_entidad, p_usuario, p_password_hash);

    commit;
end //

-- 10. procedimiento para cambiar el titular de un telefono
-- trg_telefono_validar_update sigue impidiendo el cambio si el telefono esta afiliado.
drop procedure if exists sp_cambiar_titular_telefono //
create procedure sp_cambiar_titular_telefono(
    in p_id_entidad           int,
    in p_numero               varchar(8),
    in p_identificacion_nueva varchar(20)
)
begin
    declare v_id_cliente int;
    declare v_id_titular_actual int;

    select id_cliente into v_id_cliente
    from cliente
    where identificacion = p_identificacion_nueva;

    if v_id_cliente is null then
        signal sqlstate '45000' set message_text = 'El nuevo titular no está registrado';
    end if;

    -- misma regla que trg_telefono_validar_insert: un cliente inactivo no puede recibir un telefono
    if exists (select 1 from cliente where id_cliente = v_id_cliente and estado = 'INACTIVO') then
        signal sqlstate '45000' set message_text = 'Este cliente está inactivo';
    end if;

    select id_cliente into v_id_titular_actual
    from telefono_cliente
    where numero = p_numero;

    if v_id_titular_actual is null then
        signal sqlstate '45000' set message_text = 'El teléfono no está registrado';
    end if;

    if not exists (select 1 from cliente_entidad
                   where id_cliente = v_id_titular_actual and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El teléfono no pertenece a un cliente de esta entidad';
    end if;

    if not exists (select 1 from cliente_entidad
                   where id_cliente = v_id_cliente and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El nuevo titular no pertenece a esta entidad';
    end if;

    update telefono_cliente set id_cliente = v_id_cliente where numero = p_numero;
end //

DELIMITER ;

-- usuario de la aplicacion con minimo privilegio: solo lee y ejecuta procedimientos.
-- toda escritura pasa por los procedimientos, que corren con los privilegios de su DEFINER.
-- CAMBIE LA CONTRASEÑA DE EJEMPLO y use la misma en DB_PASSWORD del archivo .env.
CREATE USER IF NOT EXISTS 'sinpe_app'@'localhost' IDENTIFIED BY 'cambie-esta-contrasena';
GRANT SELECT, EXECUTE ON sinpe_movil.* TO 'sinpe_app'@'localhost';
