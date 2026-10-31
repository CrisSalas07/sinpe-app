import { BusinessError, NotFoundError, ValidationError } from '../utils/errors.js';

const MYSQL_MESSAGES = {
  1062: 'El registro ya existe',
  3819: 'Los datos no cumplen las reglas de la base de datos',
  1452: 'Un dato relacionado no existe',
};

// Maps any error to a safe JSON response. Never sends stacks, SQL or internal messages.
// eslint-disable-next-line no-unused-vars -- Express needs the 4-argument signature.
export function errorHandler(err, req, res, next) {
  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message, field: err.field });
  }
  if (err instanceof BusinessError) {
    return res.status(400).json({ error: err.message });
  }
  if (err instanceof NotFoundError) {
    return res.status(404).json({ error: err.message });
  }
  // SIGNAL from a stored procedure or trigger: its message is meant for the user.
  if (err.sqlState === '45000') {
    return res.status(400).json({ error: err.sqlMessage });
  }
  if (MYSQL_MESSAGES[err.errno]) {
    return res.status(400).json({ error: MYSQL_MESSAGES[err.errno] });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  }

  console.error(`[${req.method} ${req.path}]`, err);
  res.status(500).json({ error: 'Error interno' });
}
