const router = require('express').Router();
const bcrypt = require('bcryptjs');
const dbPromise = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const db = await dbPromise;
    res.json(await db.all('SELECT id, name, email, role, department, created_at FROM users ORDER BY name'));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { name, email, password, role, department } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
    const db = await dbPromise;
    const hash = bcrypt.hashSync(password, 10);
    try {
      const result = await db.run(
        'INSERT INTO users (name, email, password_hash, role, department) VALUES (?, ?, ?, ?, ?)',
        name, email.trim(), hash, role || 'member', department || null
      );
      res.status(201).json(await db.get('SELECT id, name, email, role, department FROM users WHERE id = ?', result.lastID));
    } catch (e) {
      if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Email already exists' });
      throw e;
    }
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (req.user.role !== 'admin' && req.user.id !== id) return res.status(403).json({ error: 'Forbidden' });
    const db = await dbPromise;
    const user = await db.get('SELECT * FROM users WHERE id = ?', id);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { name, email, password, role, department } = req.body;
    await db.run('UPDATE users SET name=?, email=?, password_hash=?, role=?, department=? WHERE id=?',
      name ?? user.name,
      email ?? user.email,
      password ? bcrypt.hashSync(password, 10) : user.password_hash,
      req.user.role === 'admin' ? (role ?? user.role) : user.role,
      department !== undefined ? department : user.department,
      id
    );
    res.json(await db.get('SELECT id, name, email, role, department FROM users WHERE id = ?', id));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'Cannot delete yourself' });
    const db = await dbPromise;
    await db.run('DELETE FROM users WHERE id = ?', parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
