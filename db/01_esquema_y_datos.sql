DROP DATABASE IF EXISTS sinpe_movil;
CREATE DATABASE sinpe_movil CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sinpe_movil;

CREATE TABLE cliente (
    id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    identificacion VARCHAR(20) NOT NULL UNIQUE,
    nombres VARCHAR(80) NOT NULL,
    primer_apellido VARCHAR(60) NOT NULL,
    segundo_apellido VARCHAR(60) NOT NULL,
    correo VARCHAR(120) NOT NULL UNIQUE,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    estado ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO'
);

CREATE TABLE entidad_financiera (
    id_entidad INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(12) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    codigo_iban CHAR(3) NOT NULL UNIQUE,
    limite_diario_sinpe DECIMAL(15,2) NOT NULL DEFAULT 200000.00
);

-- La persona como cliente de una entidad, con sus credenciales. Una persona es unica por su
-- identificacion, pero puede ser cliente de varias entidades con un usuario distinto en cada una.
CREATE TABLE cliente_entidad (
    id_cliente INT NOT NULL,
    id_entidad INT NOT NULL,
    usuario VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_cliente, id_entidad),
    CONSTRAINT uq_cliente_entidad_usuario UNIQUE (id_entidad, usuario),
    CONSTRAINT fk_ce_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    CONSTRAINT fk_ce_entidad FOREIGN KEY (id_entidad) REFERENCES entidad_financiera(id_entidad)
);

CREATE TABLE moneda (
    codigo CHAR(3) PRIMARY KEY,
    descripcion VARCHAR(40) UNIQUE NOT NULL
);

CREATE TABLE cuenta_iban (
    id_cuenta INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    id_entidad INT NOT NULL,
    moneda CHAR(3) NOT NULL,
    iban CHAR(22) UNIQUE NOT NULL,
    saldo DECIMAL(15,2) NOT NULL DEFAULT 0,
    estado ENUM('ACTIVA','INACTIVA','BLOQUEADA') NOT NULL DEFAULT 'ACTIVA',
    fecha_apertura DATE NOT NULL,
    CONSTRAINT chk_cuenta_saldo CHECK (saldo >= 0),
    CONSTRAINT fk_cuenta_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente),
    CONSTRAINT fk_cuenta_entidad FOREIGN KEY (id_entidad) REFERENCES entidad_financiera(id_entidad),
    CONSTRAINT fk_cuenta_moneda FOREIGN KEY (moneda) REFERENCES moneda(codigo)
);

CREATE TABLE telefono_cliente (
    id_telefono INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    numero VARCHAR(8) UNIQUE NOT NULL,
    fecha_registro DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_telefono_formato CHECK (numero REGEXP '^[0-9]{8}$'),
    CONSTRAINT fk_telefono_cliente FOREIGN KEY (id_cliente) REFERENCES cliente(id_cliente)
);

CREATE TABLE afiliacion_sinpe (
    id_afiliacion INT AUTO_INCREMENT PRIMARY KEY,
    id_telefono INT UNIQUE NOT NULL,
    id_cuenta INT NOT NULL,
    fecha_afiliacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_afiliacion_telefono FOREIGN KEY (id_telefono) REFERENCES telefono_cliente(id_telefono),
    CONSTRAINT fk_afiliacion_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta_iban(id_cuenta)
);

CREATE TABLE historial_afiliacion (
    id_historial BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_telefono INT NOT NULL,
    id_cuenta INT NOT NULL,
    accion ENUM('AFILIACION','DESAFILIACION') NOT NULL,
    fecha_evento DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historial_telefono FOREIGN KEY (id_telefono) REFERENCES telefono_cliente(id_telefono),
    CONSTRAINT fk_historial_cuenta FOREIGN KEY (id_cuenta) REFERENCES cuenta_iban(id_cuenta)
);

CREATE TABLE transferencia (
    id_transferencia BIGINT AUTO_INCREMENT PRIMARY KEY,
    id_cuenta_origen INT NOT NULL,
    id_cuenta_destino INT NOT NULL,
    monto DECIMAL(15,2) NOT NULL,
    tipo ENUM('SINPE_MOVIL','IBAN') NOT NULL,
    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    detalle VARCHAR(100) NULL,
    CONSTRAINT fk_transferencia_origen FOREIGN KEY (id_cuenta_origen) REFERENCES cuenta_iban(id_cuenta),
    CONSTRAINT fk_transferencia_destino FOREIGN KEY (id_cuenta_destino) REFERENCES cuenta_iban(id_cuenta)
);

CREATE TABLE transferencia_sinpe (
    id_transferencia BIGINT PRIMARY KEY,
    id_telefono_origen INT NULL,
    id_telefono_destino INT NOT NULL,
    CONSTRAINT fk_ts_transferencia FOREIGN KEY (id_transferencia) REFERENCES transferencia(id_transferencia),
    CONSTRAINT fk_ts_telefono_origen FOREIGN KEY (id_telefono_origen) REFERENCES telefono_cliente(id_telefono),
    CONSTRAINT fk_ts_telefono_destino FOREIGN KEY (id_telefono_destino) REFERENCES telefono_cliente(id_telefono)
);

-- CATALOGO DE MONEDAS
INSERT INTO moneda (codigo, descripcion) VALUES
    ('CRC','Colón costarricense'),
    ('USD','Dólar estadounidense');

-- CATALOGO DE ENTIDADES FINANCIERAS
INSERT INTO entidad_financiera (codigo,nombre,codigo_iban)
	VALUES ('BCR','Banco de Costa Rica','152'),
    ('BN','Banco Nacional de Costa Rica','151'),
    ('BP','Banco Popular y de Desarrollo Comunal','161'),
    ('BAC','BAC Credomatic','102');

-- CLIENTES: 24
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000001','LEONARDO ANTONIO','AGUILAR','BERROCAL','leonardo.aguilar.berrocal@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000002','IVAN CALET','ALTAMIRANO','ABARCA','ivan.altamirano.abarca@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000003','HUGO ARIEL','ARAUZ','MAROTO','hugo.arauz.maroto@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000004','HAIRON DANIEL','AZOFEIFA','SANCHEZ','hairon.azofeifa.sanchez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000005','CRISTOPHER EDUARDO','BUSO','BOLAÑOS','cristopher.buso.bolanos@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000006','KEITY DAYANA','CHAVARRIA','STELLER','keity.chavarria.steller@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000007','DARLIN PATRICIA','CHAVES','ALVARADO','darlin.chaves.alvarado@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000008','MARIELA CAROLINA','CHINCHILLA','GONZALEZ','mariela.chinchilla.gonzalez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000009','DILAN JAVIER','GONZALEZ','BADILLA','dilan.gonzalez.badilla@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000010','REIKO JISLEN','GONZALEZ','PORTUGUEZ','reiko.gonzalez.portuguez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000011','JEFFERSON DAVID','GRANADOS','VENEGAS','jefferson.granados.venegas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000012','HUGO JOSE','GURDIAN','SOLORZANO','hugo.gurdian.solorzano@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000013','JOHN LEANDRO','MARIN','SALAS','john.marin.salas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000014','KENDALL NAUM','MONTERO','CORTES','kendall.montero.cortes@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000015','CRISTOPHER','MORA','SALAS','cristopher.mora.salas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000016','CAMILA NAHOMI','MORA','VILLALOBOS','camila.mora.villalobos@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000017','JANDANY','MOYA','GARCIA','jandany.moya.garcia@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000018','ASTRID VALESKA','MUNGUIA','ROJAS','astrid.munguia.rojas@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000019','LUCIA MARGARITA','PALACIO','AYERDIS','lucia.palacio.ayerdis@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000020','DIEGO','PASTRAN','MEDINA','diego.pastran.medina@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000021','STEVEN GABRIEL','RAMIREZ','PALACIOS','steven.ramirez.palacios@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000022','SCARLETTE YALENA','ROSALES','PEREZ','scarlette.rosales.perez@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000023','BAYRON AXEL','SANCHEZ','CONCEPCION','bayron.sanchez.concepcion@ucr.ac.cr','ACTIVO');
INSERT INTO cliente (identificacion,nombres,primer_apellido,segundo_apellido,correo,estado) VALUES ('UCR000024','DIEGO ARANTES','SANCHEZ','LEZAMA','diego.sanchez.lezama@ucr.ac.cr','ACTIVO');

-- CUENTAS: cada cliente tiene una cuenta CRC; algunos tienen una segunda cuenta
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (1,1,'CRC','CR12015200000000000001',123991.00,'ACTIVA','2026-01-02');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (2,2,'CRC','CR12015100000000000002',197982.00,'ACTIVA','2026-01-03');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (3,3,'CRC','CR12016100000000000003',271973.00,'ACTIVA','2026-01-04');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (4,4,'CRC','CR12010200000000000004',345964.00,'ACTIVA','2026-01-05');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (5,1,'CRC','CR12015200000000000005',419955.00,'ACTIVA','2026-01-06');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (6,2,'CRC','CR12015100000000000006',493946.00,'ACTIVA','2026-01-07');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (7,3,'CRC','CR12016100000000000007',567937.00,'ACTIVA','2026-01-08');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (8,4,'CRC','CR12010200000000000008',641928.00,'ACTIVA','2026-01-09');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (9,1,'CRC','CR12015200000000000009',715919.00,'ACTIVA','2026-01-10');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (10,2,'CRC','CR12015100000000000010',789910.00,'ACTIVA','2026-01-11');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (11,3,'CRC','CR12016100000000000011',63901.00,'ACTIVA','2026-01-12');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (12,4,'CRC','CR12010200000000000012',137892.00,'ACTIVA','2026-01-13');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (13,1,'CRC','CR12015200000000000013',211883.00,'ACTIVA','2026-01-14');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (14,2,'CRC','CR12015100000000000014',285874.00,'ACTIVA','2026-01-15');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (15,3,'CRC','CR12016100000000000015',359865.00,'ACTIVA','2026-01-16');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (16,4,'CRC','CR12010200000000000016',433856.00,'ACTIVA','2026-01-17');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (17,1,'CRC','CR12015200000000000017',507847.00,'ACTIVA','2026-01-18');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (18,2,'CRC','CR12015100000000000018',581838.00,'ACTIVA','2026-01-19');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (19,3,'CRC','CR12016100000000000019',655829.00,'ACTIVA','2026-01-20');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (20,4,'CRC','CR12010200000000000020',729820.00,'ACTIVA','2026-01-21');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (21,1,'CRC','CR12015200000000000021',803811.00,'ACTIVA','2026-01-22');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (22,2,'CRC','CR12015100000000000022',77802.00,'ACTIVA','2026-01-23');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (23,3,'CRC','CR12016100000000000023',151793.00,'ACTIVA','2026-01-24');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (24,4,'CRC','CR12010200000000000024',225784.00,'ACTIVA','2026-01-25');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (1,3,'USD','CR12016100000000000025',377.00,'ACTIVA','2026-01-26');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (3,1,'USD','CR12015200000000000026',631.00,'ACTIVA','2026-01-27');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (6,4,'USD','CR12010200000000000027',1012.00,'ACTIVA','2026-01-28');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (9,3,'USD','CR12016100000000000028',1393.00,'ACTIVA','2026-01-01');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (12,2,'USD','CR12015100000000000029',1774.00,'ACTIVA','2026-01-02');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (15,1,'USD','CR12015200000000000030',2155.00,'ACTIVA','2026-01-03');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (18,4,'USD','CR12010200000000000031',2536.00,'ACTIVA','2026-01-04');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (21,3,'USD','CR12016100000000000032',2917.00,'ACTIVA','2026-01-05');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (2,1,'CRC','CR12015200000000000033',45806.00,'ACTIVA','2026-01-06');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (7,2,'CRC','CR12015100000000000034',135321.00,'BLOQUEADA','2026-01-07');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (14,1,'CRC','CR12015200000000000035',40642.00,'ACTIVA','2026-01-08');
INSERT INTO cuenta_iban (id_cliente,id_entidad,moneda,iban,saldo,estado,fecha_apertura) VALUES (22,1,'CRC','CR12015200000000000036',183866.00,'ACTIVA','2026-01-09');

-- TELEFONOS: 1 o 2 por cliente; no todos estaran afiliados
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (1,'80000001');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (2,'80000002');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (3,'80000003');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (4,'80000004');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (5,'80000005');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (6,'80000006');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (7,'80000007');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (8,'80000008');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (9,'80000009');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (10,'80000010');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (11,'80000011');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (12,'80000012');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (13,'80000013');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (14,'80000014');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (15,'80000015');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (16,'80000016');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (17,'80000017');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (18,'80000018');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (19,'80000019');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (20,'80000020');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (21,'80000021');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (22,'80000022');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (23,'80000023');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (24,'80000024');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (1,'70000001');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (2,'70000002');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (3,'70000003');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (5,'70000005');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (6,'70000006');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (8,'70000008');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (10,'70000010');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (12,'70000012');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (14,'70000014');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (16,'70000016');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (18,'70000018');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (20,'70000020');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (22,'70000022');
INSERT INTO telefono_cliente (id_cliente,numero) VALUES (24,'70000024');

-- AFILIACIONES INICIALES: solo telefonos del titular hacia su cuenta CRC activa
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (1,1);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (2,2);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (3,3);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (4,4);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (5,5);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (6,6);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (7,7);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (8,8);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (9,9);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (10,10);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (11,11);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (12,12);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (13,13);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (14,14);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (15,15);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (16,16);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (17,17);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (18,18);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (19,19);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (25,1);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (27,3);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (29,6);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (31,10);
INSERT INTO afiliacion_sinpe (id_telefono,id_cuenta) VALUES (33,14);

-- CREDENCIALES: una fila por cada par (cliente, entidad) donde el cliente tiene al menos una cuenta.
-- Usuario: primer nombre + "." + primer apellido, en minusculas. Contraseña de todos: Cliente2026
-- (hash generado con src/utils/password.js; es una contraseña de prueba, publicada en el login).
INSERT INTO cliente_entidad (id_cliente, id_entidad, usuario, password_hash)
SELECT DISTINCT c.id_cliente, ci.id_entidad,
       LOWER(CONCAT(SUBSTRING_INDEX(c.nombres, ' ', 1), '.', c.primer_apellido)),
       'd91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793'
FROM cliente c
JOIN cuenta_iban ci ON ci.id_cliente = c.id_cliente;

-- HISTORIAL INICIAL: un evento AFILIACION por cada afiliacion inicial.
-- Los triggers de 02 aun no existen al cargar estos datos, asi que el historial se registra aqui.
INSERT INTO historial_afiliacion (id_telefono, id_cuenta, accion, fecha_evento)
SELECT id_telefono, id_cuenta, 'AFILIACION', fecha_afiliacion
FROM afiliacion_sinpe;
