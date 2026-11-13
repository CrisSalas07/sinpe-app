// Checks on the text of a backup file before it is restored.

// mysqldump and Workbench both write this header near the top of the file.
const DUMP_SIGNATURE = '-- MySQL dump';
const HEADER_BYTES = 4096;

// Statements that would make mysql work on another database: USE x, CREATE/DROP DATABASE x.
const DATABASE_STATEMENT =
  /^\s*(?:use|(?:create|drop)\s+(?:database|schema)(?:\s+if\s+(?:not\s+)?exists)?)\s+`?([\w$]+)`?/gim;

// DEFINER=`user`@`host` (or CURRENT_USER) as mysqldump writes it: right after CREATE (procedures,
// functions, views), after ALGORITHM=x (views) or at the start of a versioned comment such as
// /*!50017 DEFINER=...*/ (triggers, events). Text inside the data is not touched.
const ACCOUNT_PART = String.raw`(?:\x60[^\x60]*\x60|'[^']*'|"[^"]*"|[\w.$%-]+)`;
const DEFINER_CLAUSE = new RegExp(
  String.raw`(?<=\bCREATE\s+|\bALGORITHM\s*=\s*\w+\s+|\/\*!\d{5}\s+)` +
    String.raw`DEFINER\s*=\s*(?:CURRENT_USER(?:\s*\(\s*\))?|${ACCOUNT_PART}\s*@\s*${ACCOUNT_PART})\s*`,
  'gi',
);

/**
 * The same SQL without its DEFINER clauses, so every procedure, trigger, view and event belongs to
 * the account that restores it. A limited account cannot create objects in root's name (MySQL asks
 * for SET_USER_ID), so a clause this misses makes the restore fail; it never runs as someone else.
 */
export function stripDefiners(sql) {
  return sql.replace(DEFINER_CLAUSE, '');
}

/** True when the text starts like a mysqldump or Workbench export. */
export function isMysqlDump(sql) {
  return sql.slice(0, HEADER_BYTES).includes(DUMP_SIGNATURE);
}

/**
 * First statement that points to a database other than `database`, as { name, line }, or null.
 * Examples: a Workbench export with "Include Create Schema" of another database, or a
 * "use otra_base;" added by hand at the end of the file.
 */
export function findForeignDatabase(sql, database) {
  for (const match of sql.matchAll(DATABASE_STATEMENT)) {
    if (match[1].toLowerCase() !== database.toLowerCase()) {
      const start = match.index + match[0].search(/\S/);
      return { name: match[1], line: sql.slice(0, start).split('\n').length };
    }
  }
  return null;
}
