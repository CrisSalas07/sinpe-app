/** Rejects requests without a logged-in session. */
export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Sesión no iniciada o expirada' });
  }
  next();
}

/** Rejects a logged-in user of another role. Must run after requireAuth. */
export function requireRole(role) {
  return (req, res, next) => {
    if (req.session.user.role !== role) {
      return res.status(403).json({ error: 'No tiene permiso para esta acción' });
    }
    next();
  };
}
