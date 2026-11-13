import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findForeignDatabase, isMysqlDump, stripDefiners } from '../src/utils/sqlDump.js';

const header = '-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)\n--\n';

test('only mysqldump and Workbench exports are accepted', () => {
  assert.equal(isMysqlDump(`${header}CREATE TABLE a (id int);`), true);
  assert.equal(isMysqlDump('CREATE DATABASE x;\nUSE `x`;\n' + header), true);
  assert.equal(isMysqlDump('DROP DATABASE sinpe_movil;'), false);
});

test('statements on the same database are allowed', () => {
  const workbench =
    'CREATE DATABASE  IF NOT EXISTS `sinpe_movil` /*!40100 DEFAULT CHARACTER SET utf8mb4 */;\n' +
    'USE `sinpe_movil`;\n' +
    header;
  assert.equal(findForeignDatabase(workbench, 'sinpe_movil'), null);
  assert.equal(
    findForeignDatabase(`${header}INSERT INTO a VALUES ('use otra');`, 'sinpe_movil'),
    null,
  );
});

test('another database is reported with its line', () => {
  const edited = `${header}INSERT INTO a VALUES (1);\ncreate database respaldo_juntaucr;\nuse respaldo_juntaucr;\n`;
  assert.deepEqual(findForeignDatabase(edited, 'sinpe_movil'), {
    name: 'respaldo_juntaucr',
    line: 4,
  });
  assert.deepEqual(findForeignDatabase('USE `juntaucr`;\n', 'sinpe_movil'), {
    name: 'juntaucr',
    line: 1,
  });
  assert.deepEqual(findForeignDatabase('\n  DROP SCHEMA IF EXISTS otra;', 'sinpe_movil'), {
    name: 'otra',
    line: 2,
  });
});

test('DEFINER clauses are removed from procedures, triggers, views and events', () => {
  const dump = [
    'CREATE DEFINER=`root`@`localhost` PROCEDURE `sp_afiliar_sinpe`(in p_id int)',
    '/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `trg_x` BEFORE INSERT',
    '/*!50013 DEFINER=`root`@`%` SQL SECURITY DEFINER */',
    "/*!50001 CREATE ALGORITHM=UNDEFINED DEFINER='admin'@'10.0.0.1' VIEW v AS SELECT 1 */;",
    '/*!50106 CREATE*/ /*!50117 DEFINER=CURRENT_USER*/ /*!50106 EVENT `e` ON SCHEDULE EVERY 1 DAY',
    'create definer = root@localhost function f() returns int return 1;',
  ].join('\n');
  assert.equal(
    stripDefiners(dump),
    [
      'CREATE PROCEDURE `sp_afiliar_sinpe`(in p_id int)',
      '/*!50003 CREATE*/ /*!50017 */ /*!50003 TRIGGER `trg_x` BEFORE INSERT',
      '/*!50013 SQL SECURITY DEFINER */',
      '/*!50001 CREATE ALGORITHM=UNDEFINED VIEW v AS SELECT 1 */;',
      '/*!50106 CREATE*/ /*!50117 */ /*!50106 EVENT `e` ON SCHEDULE EVERY 1 DAY',
      'create function f() returns int return 1;',
    ].join('\n'),
  );
});

test('the data and the procedure bodies are not changed', () => {
  const sql =
    "INSERT INTO nota VALUES ('DEFINER=`root`@`localhost`'),('create x');\n" +
    'SELECT definer FROM information_schema.routines;';
  assert.equal(stripDefiners(sql), sql);
});
