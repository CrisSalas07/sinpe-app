/** Rejects requests without a logged-in session. */
export function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Sesión no iniciada o expirada' });
  }
  next();
}
