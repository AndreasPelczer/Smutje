// Auth-Middleware: Token-Prüfung über X-Token Header

const { stmts } = require('./db');

// Express-Middleware: prüft X-Token Header und hängt user an req
function authMiddleware(req, res, next) {
  const token = req.headers['x-token'];
  if (!token) {
    return res.status(401).json({ error: 'Kein Token angegeben' });
  }

  const user = stmts.getUserByToken.get(token);
  if (!user) {
    return res.status(401).json({ error: 'Ungültiges Token' });
  }

  req.user = user;
  next();
}

// Token-Prüfung für WebSocket-Verbindungen (gibt User oder null zurück)
function authenticateToken(token) {
  if (!token) return null;
  return stmts.getUserByToken.get(token) || null;
}

module.exports = { authMiddleware, authenticateToken };
