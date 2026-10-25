import jwt from 'jsonwebtoken';
import 'dotenv/config';

const secret = process.env.JWT_SECRET;
if (!secret || secret.length < 32) {
  throw new Error('JWT_SECRET must be configured with at least 32 characters');
}

export function signUser(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, name: user.full_name, email: user.email },
    secret,
    { expiresIn: '8h' },
  );
}

export function requireAuth(request, response, next) {
  const header = request.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return response.status(401).json({ error: 'Authentication required' });
  try {
    request.user = jwt.verify(token, secret);
    return next();
  } catch {
    return response.status(401).json({ error: 'Invalid or expired session' });
  }
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!request.user || !roles.includes(request.user.role)) {
      return response.status(403).json({ error: 'Insufficient permissions' });
    }
    return next();
  };
}
