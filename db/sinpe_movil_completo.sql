-- SINPE JUNTAUCR: full database (schema, data, triggers and procedures).
-- Warning: drops and recreates the sinpe_movil database.

DROP DATABASE IF EXISTS sinpe_movil;
CREATE DATABASE sinpe_movil CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sinpe_movil;

-- ======================================================================
-- Tables
-- ======================================================================

CREATE TABLE `cliente` (
  `id_cliente` int NOT NULL AUTO_INCREMENT,
  `identificacion` varchar(20) NOT NULL,
  `nombres` varchar(80) NOT NULL,
  `primer_apellido` varchar(60) NOT NULL,
  `segundo_apellido` varchar(60) NOT NULL,
  `correo` varchar(120) NOT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `estado` enum('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  PRIMARY KEY (`id_cliente`),
  UNIQUE KEY `identificacion` (`identificacion`),
  UNIQUE KEY `correo` (`correo`)
);

CREATE TABLE `entidad_financiera` (
  `id_entidad` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(12) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `codigo_iban` char(3) NOT NULL,
  `limite_diario_sinpe` decimal(15,2) NOT NULL DEFAULT '200000.00',
  PRIMARY KEY (`id_entidad`),
  UNIQUE KEY `codigo` (`codigo`),
  UNIQUE KEY `nombre` (`nombre`),
  UNIQUE KEY `codigo_iban` (`codigo_iban`)
);

CREATE TABLE `moneda` (
  `codigo` char(3) NOT NULL,
  `descripcion` varchar(40) NOT NULL,
  PRIMARY KEY (`codigo`),
  UNIQUE KEY `descripcion` (`descripcion`)
);

CREATE TABLE `cuenta_iban` (
  `id_cuenta` int NOT NULL AUTO_INCREMENT,
  `id_cliente` int NOT NULL,
  `id_entidad` int NOT NULL,
  `moneda` char(3) NOT NULL,
  `iban` char(22) NOT NULL,
  `saldo` decimal(15,2) NOT NULL DEFAULT '0.00',
  `estado` enum('ACTIVA','INACTIVA','BLOQUEADA') NOT NULL DEFAULT 'ACTIVA',
  `fecha_apertura` date NOT NULL,
  PRIMARY KEY (`id_cuenta`),
  UNIQUE KEY `iban` (`iban`),
  KEY `fk_cuenta_cliente` (`id_cliente`),
  KEY `fk_cuenta_entidad` (`id_entidad`),
  KEY `fk_cuenta_moneda` (`moneda`),
  CONSTRAINT `fk_cuenta_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `fk_cuenta_entidad` FOREIGN KEY (`id_entidad`) REFERENCES `entidad_financiera` (`id_entidad`),
  CONSTRAINT `fk_cuenta_moneda` FOREIGN KEY (`moneda`) REFERENCES `moneda` (`codigo`),
  CONSTRAINT `chk_cuenta_saldo` CHECK ((`saldo` >= 0))
);

CREATE TABLE `telefono_cliente` (
  `id_telefono` int NOT NULL AUTO_INCREMENT,
  `id_cliente` int NOT NULL,
  `numero` varchar(8) NOT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_telefono`),
  UNIQUE KEY `numero` (`numero`),
  KEY `fk_telefono_cliente` (`id_cliente`),
  CONSTRAINT `fk_telefono_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `chk_telefono_formato` CHECK (regexp_like(`numero`,_utf8mb4'^[0-9]{8}$'))
);

CREATE TABLE `afiliacion_sinpe` (
  `id_afiliacion` int NOT NULL AUTO_INCREMENT,
  `id_telefono` int NOT NULL,
  `id_cuenta` int NOT NULL,
  `fecha_afiliacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_afiliacion`),
  UNIQUE KEY `id_telefono` (`id_telefono`),
  KEY `fk_afiliacion_cuenta` (`id_cuenta`),
  CONSTRAINT `fk_afiliacion_cuenta` FOREIGN KEY (`id_cuenta`) REFERENCES `cuenta_iban` (`id_cuenta`),
  CONSTRAINT `fk_afiliacion_telefono` FOREIGN KEY (`id_telefono`) REFERENCES `telefono_cliente` (`id_telefono`)
);

CREATE TABLE `cliente_entidad` (
  `id_cliente` int NOT NULL,
  `id_entidad` int NOT NULL,
  `usuario` varchar(50) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `fecha_registro` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_cliente`,`id_entidad`),
  UNIQUE KEY `uq_cliente_entidad_usuario` (`id_entidad`,`usuario`),
  CONSTRAINT `fk_ce_cliente` FOREIGN KEY (`id_cliente`) REFERENCES `cliente` (`id_cliente`),
  CONSTRAINT `fk_ce_entidad` FOREIGN KEY (`id_entidad`) REFERENCES `entidad_financiera` (`id_entidad`)
);

CREATE TABLE `historial_afiliacion` (
  `id_historial` bigint NOT NULL AUTO_INCREMENT,
  `id_telefono` int NOT NULL,
  `id_cuenta` int NOT NULL,
  `accion` enum('AFILIACION','DESAFILIACION') NOT NULL,
  `fecha_evento` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_historial`),
  KEY `fk_historial_telefono` (`id_telefono`),
  KEY `fk_historial_cuenta` (`id_cuenta`),
  CONSTRAINT `fk_historial_cuenta` FOREIGN KEY (`id_cuenta`) REFERENCES `cuenta_iban` (`id_cuenta`),
  CONSTRAINT `fk_historial_telefono` FOREIGN KEY (`id_telefono`) REFERENCES `telefono_cliente` (`id_telefono`)
);

CREATE TABLE `transferencia` (
  `id_transferencia` bigint NOT NULL AUTO_INCREMENT,
  `id_cuenta_origen` int NOT NULL,
  `id_cuenta_destino` int NOT NULL,
  `monto` decimal(15,2) NOT NULL,
  `tipo` enum('SINPE_MOVIL','IBAN') NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `detalle` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`id_transferencia`),
  KEY `fk_transferencia_origen` (`id_cuenta_origen`),
  KEY `fk_transferencia_destino` (`id_cuenta_destino`),
  CONSTRAINT `fk_transferencia_destino` FOREIGN KEY (`id_cuenta_destino`) REFERENCES `cuenta_iban` (`id_cuenta`),
  CONSTRAINT `fk_transferencia_origen` FOREIGN KEY (`id_cuenta_origen`) REFERENCES `cuenta_iban` (`id_cuenta`)
);

CREATE TABLE `transferencia_sinpe` (
  `id_transferencia` bigint NOT NULL,
  `id_telefono_origen` int DEFAULT NULL,
  `id_telefono_destino` int NOT NULL,
  PRIMARY KEY (`id_transferencia`),
  KEY `fk_ts_telefono_origen` (`id_telefono_origen`),
  KEY `fk_ts_telefono_destino` (`id_telefono_destino`),
  CONSTRAINT `fk_ts_telefono_destino` FOREIGN KEY (`id_telefono_destino`) REFERENCES `telefono_cliente` (`id_telefono`),
  CONSTRAINT `fk_ts_telefono_origen` FOREIGN KEY (`id_telefono_origen`) REFERENCES `telefono_cliente` (`id_telefono`),
  CONSTRAINT `fk_ts_transferencia` FOREIGN KEY (`id_transferencia`) REFERENCES `transferencia` (`id_transferencia`)
);


-- ======================================================================
-- Data
-- ======================================================================

INSERT INTO `cliente` (`id_cliente`, `identificacion`, `nombres`, `primer_apellido`, `segundo_apellido`, `correo`, `fecha_registro`, `estado`) VALUES
  (1,'UCR000001','LEONARDO ANTONIO','AGUILAR','BERROCAL','leonardo.aguilar.berrocal@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (2,'UCR000002','IVAN CALET','ALTAMIRANO','ABARCA','ivan.altamirano.abarca@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (3,'UCR000003','HUGO ARIEL','ARAUZ','MAROTO','hugo.arauz.maroto@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (4,'UCR000004','HAIRON DANIEL','AZOFEIFA','SANCHEZ','hairon.azofeifa.sanchez@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (5,'UCR000005','CRISTOPHER EDUARDO','BUSO','BOLAÑOS','cristopher.buso.bolanos@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (6,'UCR000006','KEITY DAYANA','CHAVARRIA','STELLER','keity.chavarria.steller@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (7,'UCR000007','DARLIN PATRICIA','CHAVES','ALVARADO','darlin.chaves.alvarado@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (8,'UCR000008','MARIELA CAROLINA','CHINCHILLA','GONZALEZ','mariela.chinchilla.gonzalez@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (9,'UCR000009','DILAN JAVIER','GONZALEZ','BADILLA','dilan.gonzalez.badilla@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (10,'UCR000010','REIKO JISLEN','GONZALEZ','PORTUGUEZ','reiko.gonzalez.portuguez@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (11,'UCR000011','JEFFERSON DAVID','GRANADOS','VENEGAS','jefferson.granados.venegas@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (12,'UCR000012','HUGO JOSE','GURDIAN','SOLORZANO','hugo.gurdian.solorzano@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (13,'UCR000013','JOHN LEANDRO','MARIN','SALAS','john.marin.salas@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (14,'UCR000014','KENDALL NAUM','MONTERO','CORTES','kendall.montero.cortes@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (15,'UCR000015','CRISTOPHER','MORA','SALAS','cristopher.mora.salas@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (16,'UCR000016','CAMILA NAHOMI','MORA','VILLALOBOS','camila.mora.villalobos@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (17,'UCR000017','JANDANY','MOYA','GARCIA','jandany.moya.garcia@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (18,'UCR000018','ASTRID VALESKA','MUNGUIA','ROJAS','astrid.munguia.rojas@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (19,'UCR000019','LUCIA MARGARITA','PALACIO','AYERDIS','lucia.palacio.ayerdis@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (20,'UCR000020','DIEGO','PASTRAN','MEDINA','diego.pastran.medina@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (21,'UCR000021','STEVEN GABRIEL','RAMIREZ','PALACIOS','steven.ramirez.palacios@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (22,'UCR000022','SCARLETTE YALENA','ROSALES','PEREZ','scarlette.rosales.perez@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (23,'UCR000023','BAYRON AXEL','SANCHEZ','CONCEPCION','bayron.sanchez.concepcion@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO'),
  (24,'UCR000024','DIEGO ARANTES','SANCHEZ','LEZAMA','diego.sanchez.lezama@ucr.ac.cr','2026-11-04 11:02:19','ACTIVO');

INSERT INTO `entidad_financiera` (`id_entidad`, `codigo`, `nombre`, `codigo_iban`, `limite_diario_sinpe`) VALUES
  (1,'BCR','Banco de Costa Rica','152',200000.00),
  (2,'BN','Banco Nacional de Costa Rica','151',200000.00),
  (3,'BP','Banco Popular y de Desarrollo Comunal','161',200000.00),
  (4,'BAC','BAC Credomatic','102',200000.00);

INSERT INTO `moneda` (`codigo`, `descripcion`) VALUES
  ('CRC','Colón costarricense'),
  ('USD','Dólar estadounidense');

INSERT INTO `cuenta_iban` (`id_cuenta`, `id_cliente`, `id_entidad`, `moneda`, `iban`, `saldo`, `estado`, `fecha_apertura`) VALUES
  (1,1,1,'CRC','CR12015200000000000001',118991.00,'ACTIVA','2026-01-02'),
  (2,2,2,'CRC','CR12015100000000000002',202982.00,'ACTIVA','2026-01-03'),
  (3,3,3,'CRC','CR12016100000000000003',271973.00,'ACTIVA','2026-01-04'),
  (4,4,4,'CRC','CR12010200000000000004',345964.00,'ACTIVA','2026-01-05'),
  (5,5,1,'CRC','CR12015200000000000005',419955.00,'ACTIVA','2026-01-06'),
  (6,6,2,'CRC','CR12015100000000000006',493946.00,'ACTIVA','2026-01-07'),
  (7,7,3,'CRC','CR12016100000000000007',567937.00,'ACTIVA','2026-01-08'),
  (8,8,4,'CRC','CR12010200000000000008',641928.00,'ACTIVA','2026-01-09'),
  (9,9,1,'CRC','CR12015200000000000009',715919.00,'ACTIVA','2026-01-10'),
  (10,10,2,'CRC','CR12015100000000000010',789910.00,'ACTIVA','2026-01-11'),
  (11,11,3,'CRC','CR12016100000000000011',63901.00,'ACTIVA','2026-01-12'),
  (12,12,4,'CRC','CR12010200000000000012',137892.00,'ACTIVA','2026-01-13'),
  (13,13,1,'CRC','CR12015200000000000013',211883.00,'ACTIVA','2026-01-14'),
  (14,14,2,'CRC','CR12015100000000000014',285874.00,'ACTIVA','2026-01-15'),
  (15,15,3,'CRC','CR12016100000000000015',359865.00,'ACTIVA','2026-01-16'),
  (16,16,4,'CRC','CR12010200000000000016',433856.00,'ACTIVA','2026-01-17'),
  (17,17,1,'CRC','CR12015200000000000017',507847.00,'ACTIVA','2026-01-18'),
  (18,18,2,'CRC','CR12015100000000000018',581838.00,'ACTIVA','2026-01-19'),
  (19,19,3,'CRC','CR12016100000000000019',655829.00,'ACTIVA','2026-01-20'),
  (20,20,4,'CRC','CR12010200000000000020',729820.00,'ACTIVA','2026-01-21'),
  (21,21,1,'CRC','CR12015200000000000021',803811.00,'ACTIVA','2026-01-22'),
  (22,22,2,'CRC','CR12015100000000000022',77802.00,'ACTIVA','2026-01-23'),
  (23,23,3,'CRC','CR12016100000000000023',151793.00,'ACTIVA','2026-01-24'),
  (24,24,4,'CRC','CR12010200000000000024',225784.00,'ACTIVA','2026-01-25'),
  (25,1,3,'USD','CR12016100000000000025',377.00,'ACTIVA','2026-01-26'),
  (26,3,1,'USD','CR12015200000000000026',631.00,'ACTIVA','2026-01-27'),
  (27,6,4,'USD','CR12010200000000000027',1012.00,'ACTIVA','2026-01-28'),
  (28,9,3,'USD','CR12016100000000000028',1393.00,'ACTIVA','2026-01-01'),
  (29,12,2,'USD','CR12015100000000000029',1774.00,'ACTIVA','2026-01-02'),
  (30,15,1,'USD','CR12015200000000000030',2155.00,'ACTIVA','2026-01-03'),
  (31,18,4,'USD','CR12010200000000000031',2536.00,'ACTIVA','2026-01-04'),
  (32,21,3,'USD','CR12016100000000000032',2917.00,'ACTIVA','2026-01-05'),
  (33,2,1,'CRC','CR12015200000000000033',45806.00,'ACTIVA','2026-01-06'),
  (34,7,2,'CRC','CR12015100000000000034',135321.00,'BLOQUEADA','2026-01-07'),
  (35,14,1,'CRC','CR12015200000000000035',40642.00,'ACTIVA','2026-01-08'),
  (36,22,1,'CRC','CR12015200000000000036',183866.00,'ACTIVA','2026-01-09');

INSERT INTO `telefono_cliente` (`id_telefono`, `id_cliente`, `numero`, `fecha_registro`) VALUES
  (1,1,'80000001','2026-11-04 11:02:19'),
  (2,2,'80000002','2026-11-04 11:02:19'),
  (3,3,'80000003','2026-11-04 11:02:19'),
  (4,4,'80000004','2026-11-04 11:02:19'),
  (5,5,'80000005','2026-11-04 11:02:19'),
  (6,6,'80000006','2026-11-04 11:02:19'),
  (7,7,'80000007','2026-11-04 11:02:19'),
  (8,8,'80000008','2026-11-04 11:02:19'),
  (9,9,'80000009','2026-11-04 11:02:19'),
  (10,10,'80000010','2026-11-04 11:02:19'),
  (11,11,'80000011','2026-11-04 11:02:19'),
  (12,12,'80000012','2026-11-04 11:02:19'),
  (13,13,'80000013','2026-11-04 11:02:19'),
  (14,14,'80000014','2026-11-04 11:02:19'),
  (15,15,'80000015','2026-11-04 11:02:19'),
  (16,16,'80000016','2026-11-04 11:02:19'),
  (17,17,'80000017','2026-11-04 11:02:19'),
  (18,18,'80000018','2026-11-04 11:02:19'),
  (19,19,'80000019','2026-11-04 11:02:19'),
  (20,20,'80000020','2026-11-04 11:02:19'),
  (21,21,'80000021','2026-11-04 11:02:19'),
  (22,22,'80000022','2026-11-04 11:02:19'),
  (23,23,'80000023','2026-11-04 11:02:19'),
  (24,24,'80000024','2026-11-04 11:02:19'),
  (25,1,'70000001','2026-11-04 11:02:19'),
  (26,2,'70000002','2026-11-04 11:02:19'),
  (27,3,'70000003','2026-11-04 11:02:19'),
  (28,5,'70000005','2026-11-04 11:02:19'),
  (29,6,'70000006','2026-11-04 11:02:19'),
  (30,8,'70000008','2026-11-04 11:02:19'),
  (31,10,'70000010','2026-11-04 11:02:19'),
  (32,12,'70000012','2026-11-04 11:02:19'),
  (33,14,'70000014','2026-11-04 11:02:19'),
  (34,16,'70000016','2026-11-04 11:02:19'),
  (35,18,'70000018','2026-11-04 11:02:19'),
  (36,20,'70000020','2026-11-04 11:02:19'),
  (37,22,'70000022','2026-11-04 11:02:19'),
  (38,24,'70000024','2026-11-04 11:02:19');

INSERT INTO `afiliacion_sinpe` (`id_afiliacion`, `id_telefono`, `id_cuenta`, `fecha_afiliacion`) VALUES
  (1,1,1,'2026-11-04 11:02:19'),
  (2,2,2,'2026-11-04 11:02:19'),
  (3,3,3,'2026-11-04 11:02:19'),
  (4,4,4,'2026-11-04 11:02:19'),
  (5,5,5,'2026-11-04 11:02:19'),
  (6,6,6,'2026-11-04 11:02:19'),
  (7,7,7,'2026-11-04 11:02:19'),
  (8,8,8,'2026-11-04 11:02:19'),
  (9,9,9,'2026-11-04 11:02:19'),
  (10,10,10,'2026-11-04 11:02:19'),
  (11,11,11,'2026-11-04 11:02:19'),
  (12,12,12,'2026-11-04 11:02:19'),
  (13,13,13,'2026-11-04 11:02:19'),
  (14,14,14,'2026-11-04 11:02:19'),
  (15,15,15,'2026-11-04 11:02:19'),
  (16,16,16,'2026-11-04 11:02:19'),
  (17,17,17,'2026-11-04 11:02:19'),
  (18,18,18,'2026-11-04 11:02:19'),
  (19,19,19,'2026-11-04 11:02:19'),
  (20,25,1,'2026-11-04 11:02:19'),
  (21,27,3,'2026-11-04 11:02:19'),
  (22,29,6,'2026-11-04 11:02:19'),
  (23,31,10,'2026-11-04 11:02:19'),
  (24,33,14,'2026-11-04 11:02:19');

INSERT INTO `cliente_entidad` (`id_cliente`, `id_entidad`, `usuario`, `password_hash`, `fecha_registro`) VALUES
  (1,1,'leonardo.aguilar','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (1,3,'leonardo.aguilar','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (2,1,'ivan.altamirano','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (2,2,'ivan.altamirano','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (3,1,'hugo.arauz','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (3,3,'hugo.arauz','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (4,4,'hairon.azofeifa','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (5,1,'cristopher.buso','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (6,2,'keity.chavarria','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (6,4,'keity.chavarria','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (7,2,'darlin.chaves','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (7,3,'darlin.chaves','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (8,4,'mariela.chinchilla','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (9,1,'dilan.gonzalez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (9,3,'dilan.gonzalez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (10,2,'reiko.gonzalez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (11,3,'jefferson.granados','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (12,2,'hugo.gurdian','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (12,4,'hugo.gurdian','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (13,1,'john.marin','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (14,1,'kendall.montero','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (14,2,'kendall.montero','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (15,1,'cristopher.mora','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (15,3,'cristopher.mora','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (16,4,'camila.mora','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (17,1,'jandany.moya','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (18,2,'astrid.munguia','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (18,4,'astrid.munguia','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (19,3,'lucia.palacio','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (20,4,'diego.pastran','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (21,1,'steven.ramirez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (21,3,'steven.ramirez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (22,1,'scarlette.rosales','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (22,2,'scarlette.rosales','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (23,3,'bayron.sanchez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19'),
  (24,4,'diego.sanchez','d91c214431b4901a094a503ea26831ce:247d1b52a4d7484fd38d700c55e8a9dcc7281003c6266294c99d09b2e3fee5cd9b8164a7c1b6184cbd4916ca87c56e5473acdc2a7786e9c836c82b9176c35793','2026-11-04 11:02:19');

INSERT INTO `historial_afiliacion` (`id_historial`, `id_telefono`, `id_cuenta`, `accion`, `fecha_evento`) VALUES
  (1,1,1,'AFILIACION','2026-11-04 11:02:19'),
  (2,2,2,'AFILIACION','2026-11-04 11:02:19'),
  (3,3,3,'AFILIACION','2026-11-04 11:02:19'),
  (4,4,4,'AFILIACION','2026-11-04 11:02:19'),
  (5,5,5,'AFILIACION','2026-11-04 11:02:19'),
  (6,6,6,'AFILIACION','2026-11-04 11:02:19'),
  (7,7,7,'AFILIACION','2026-11-04 11:02:19'),
  (8,8,8,'AFILIACION','2026-11-04 11:02:19'),
  (9,9,9,'AFILIACION','2026-11-04 11:02:19'),
  (10,10,10,'AFILIACION','2026-11-04 11:02:19'),
  (11,11,11,'AFILIACION','2026-11-04 11:02:19'),
  (12,12,12,'AFILIACION','2026-11-04 11:02:19'),
  (13,13,13,'AFILIACION','2026-11-04 11:02:19'),
  (14,14,14,'AFILIACION','2026-11-04 11:02:19'),
  (15,15,15,'AFILIACION','2026-11-04 11:02:19'),
  (16,16,16,'AFILIACION','2026-11-04 11:02:19'),
  (17,17,17,'AFILIACION','2026-11-04 11:02:19'),
  (18,18,18,'AFILIACION','2026-11-04 11:02:19'),
  (19,19,19,'AFILIACION','2026-11-04 11:02:19'),
  (20,25,1,'AFILIACION','2026-11-04 11:02:19'),
  (21,27,3,'AFILIACION','2026-11-04 11:02:19'),
  (22,29,6,'AFILIACION','2026-11-04 11:02:19'),
  (23,31,10,'AFILIACION','2026-11-04 11:02:19'),
  (24,33,14,'AFILIACION','2026-11-04 11:02:19');

INSERT INTO `transferencia` (`id_transferencia`, `id_cuenta_origen`, `id_cuenta_destino`, `monto`, `tipo`, `fecha`, `detalle`) VALUES
  (1,1,2,5000.00,'IBAN','2026-11-04 11:29:25','prueba');


-- ======================================================================
-- Triggers (created after the data so loading it does not fire them)
-- ======================================================================

DELIMITER $$

CREATE TRIGGER `trg_validar_afiliacion` BEFORE INSERT ON `afiliacion_sinpe` FOR EACH ROW begin
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
        signal sqlstate '45000' set message_text = 'La cuenta no está activa';
    end if;

    if v_moneda <> 'CRC' then
        signal sqlstate '45000' set message_text = 'La cuenta no es en colones';
    end if;

    if v_dueno_cuenta <> v_dueno_telefono then
        signal sqlstate '45000' set message_text = 'El teléfono y la cuenta son de clientes distintos';
    end if;
end$$

CREATE TRIGGER `trg_historial_afiliacion` AFTER INSERT ON `afiliacion_sinpe` FOR EACH ROW begin
    insert into historial_afiliacion (id_telefono, id_cuenta, accion)
    values (new.id_telefono, new.id_cuenta, 'AFILIACION');
end$$

CREATE TRIGGER `trg_afiliacion_auditar_delete` BEFORE DELETE ON `afiliacion_sinpe` FOR EACH ROW begin
    insert into historial_afiliacion (id_telefono, id_cuenta, accion)
    values (old.id_telefono, old.id_cuenta, 'DESAFILIACION');
end$$

CREATE TRIGGER `trg_telefono_validar_insert` BEFORE INSERT ON `telefono_cliente` FOR EACH ROW begin
    declare v_estado varchar(10);

    select estado into v_estado
    from cliente where id_cliente = new.id_cliente;

    if v_estado = 'INACTIVO' then
        signal sqlstate '45000' set message_text = 'Este cliente está inactivo';
    end if;
end$$

CREATE TRIGGER `trg_telefono_validar_update` BEFORE UPDATE ON `telefono_cliente` FOR EACH ROW begin
    declare v_afiliacion int;

    select id_afiliacion into v_afiliacion
    from afiliacion_sinpe
    where id_telefono = old.id_telefono;

    if old.id_cliente != new.id_cliente and v_afiliacion is not null then
        signal sqlstate '45000' set message_text = 'No se puede cambiar el titular de un teléfono afiliado';
    end if;
end$$

CREATE TRIGGER `trg_transferencia_validar` BEFORE INSERT ON `transferencia` FOR EACH ROW begin
    if new.monto <= 0 then
        signal sqlstate '45000' set message_text = 'El monto debe ser positivo';
    end if;

    if new.id_cuenta_origen = new.id_cuenta_destino then
        signal sqlstate '45000' set message_text = 'No se puede transferir a la misma cuenta';
    end if;
end$$

DELIMITER ;

-- ======================================================================
-- Stored procedures
-- ======================================================================

DELIMITER $$

CREATE PROCEDURE `sp_afiliar_sinpe`(in p_id_entidad int, in p_id_telefono int, in p_id_cuenta int)
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
end$$

CREATE PROCEDURE `sp_cambiar_cuenta_sinpe`(
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
end$$

CREATE PROCEDURE `sp_cambiar_estado_cuenta`(
    in p_id_entidad int,
    in p_iban       varchar(30),
    in p_estado     varchar(10)
)
begin
    declare v_id_cuenta int;
    declare v_estado    varchar(10);
    declare v_saldo     decimal(15,2);

    declare exit handler for sqlexception
    begin
        rollback;
        resignal;
    end;

    if p_estado is null or p_estado not in ('ACTIVA', 'INACTIVA', 'BLOQUEADA') then
        signal sqlstate '45000' set message_text = 'El estado no es válido';
    end if;

    start transaction;

    -- se bloquea la cuenta para que una transferencia no cambie el saldo mientras se revisa
    select id_cuenta, estado, saldo into v_id_cuenta, v_estado, v_saldo
    from cuenta_iban
    where iban = p_iban and id_entidad = p_id_entidad
    for update;

    if v_id_cuenta is null then
        signal sqlstate '45000' set message_text = 'La cuenta no pertenece a esta entidad';
    end if;

    if v_estado = p_estado then
        signal sqlstate '45000' set message_text = 'La cuenta ya está en ese estado';
    end if;

    if p_estado = 'INACTIVA' and v_saldo <> 0 then
        signal sqlstate '45000' set message_text = 'La cuenta debe tener saldo cero para inactivarse';
    end if;

    update cuenta_iban set estado = p_estado where id_cuenta = v_id_cuenta;

    commit;
end$$

CREATE PROCEDURE `sp_cambiar_titular_telefono`(
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
end$$

CREATE PROCEDURE `sp_consultar_movimientos`(
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
end$$

CREATE PROCEDURE `sp_desafiliar_sinpe`(in p_id_entidad int, in p_numero varchar(20))
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
end$$

CREATE PROCEDURE `sp_registrar_cliente`(
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
end$$

CREATE PROCEDURE `sp_registrar_cuenta`(
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
end$$

CREATE PROCEDURE `sp_registrar_telefono`(in p_id_entidad int, in p_id_cliente int, in p_numero varchar(8))
begin
    declare v_dueno int;

    if not exists (select 1 from cliente where id_cliente = p_id_cliente) then
        signal sqlstate '45000' set message_text = 'El cliente no está registrado';
    end if;

    if not exists (select 1 from cliente_entidad
                   where id_cliente = p_id_cliente and id_entidad = p_id_entidad) then
        signal sqlstate '45000' set message_text = 'El cliente no pertenece a esta entidad';
    end if;

    if p_numero not regexp '^[0-9]{8}$' then
        signal sqlstate '45000' set message_text = 'El número tiene que ser 8 dígitos';
    end if;

    select id_cliente into v_dueno
    from telefono_cliente
    where numero = p_numero;

    if v_dueno = p_id_cliente then
        signal sqlstate '45000' set message_text = 'El teléfono ya está registrado a este cliente';
    end if;

    if v_dueno is not null then
        signal sqlstate '45000' set message_text = 'Este número ya está registrado';
    end if;

    insert into telefono_cliente (id_cliente, numero) values (p_id_cliente, p_numero);
end$$

CREATE PROCEDURE `sp_transferir_iban`(
    in p_id_entidad              int,
    in p_id_cliente              int,
    in p_iban_origen             varchar(30),
    in p_iban_destino            varchar(30),
    in p_monto                   decimal(15,2),
    in p_detalle                 varchar(100),
    in p_identificacion_destino  varchar(20)
)
begin
    declare v_id_origen      int;
    declare v_id_destino     int;
    declare v_entidad_destino int;
    declare v_dueno_destino  int;
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

        select id_cuenta, estado, moneda, id_entidad, id_cliente
        into v_id_destino, v_estado_destino, v_moneda_destino, v_entidad_destino, v_dueno_destino
        from cuenta_iban
        where iban = p_iban_destino
        for update;

        if v_id_destino is null then
            signal sqlstate '45000' set message_text = 'La cuenta destino no existe';
        end if;

        if v_entidad_destino <> p_id_entidad then
            if p_identificacion_destino is null or trim(p_identificacion_destino) = '' then
                signal sqlstate '45000' set message_text = 'Indique la identificación del titular de la cuenta destino';
            end if;

            if not exists (select 1 from cliente
                           where id_cliente = v_dueno_destino
                             and identificacion = trim(p_identificacion_destino)) then
                signal sqlstate '45000' set message_text = 'La identificación no corresponde al titular de la cuenta destino';
            end if;
        end if;

        if v_id_origen = v_id_destino then
            signal sqlstate '45000' set message_text = 'No se puede transferir a la misma cuenta';
        end if;

        if p_monto is null or p_monto <= 0 then
            signal sqlstate '45000' set message_text = 'El monto debe ser positivo';
        end if;

        if v_estado_origen <> 'ACTIVA' then
           signal sqlstate '45000' set message_text = 'La cuenta de origen no está activa';
        end if;

        if v_estado_destino <> 'ACTIVA' then
           signal sqlstate '45000' set message_text = 'La cuenta de destino no está activa';
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
end$$

CREATE PROCEDURE `sp_transferir_sinpe`(
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
end$$

DELIMITER ;
