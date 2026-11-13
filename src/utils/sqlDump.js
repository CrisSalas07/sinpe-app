// Checks on the text of a backup file before it is restored.

// mysqldump and Workbench both write this header near the top of the file.
const DUMP_SIGNATURE = '-- MySQL dump';
const HEADER_BYTES = 4096;

// Statements that would make mysql work on another database: USE x, CREATE/DROP DATABASE x.
const DATABASE_STATEMENT =
  /^\s*(?:use|(?:create|drop)\s+(?:database|schema)(?:\s+if\s+(?:not\s+)?exists)?)\s+`?([\w$]+)`?/gim;

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
