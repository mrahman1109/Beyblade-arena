const router = require('express').Router();
const dbPromise = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

const SELECT = `
  SELECT a.*, u.name as owner_name, u2.name as created_by_name, g.title as goal_title
  FROM actions a
  LEFT JOIN users u ON a.owner_id = u.id
  LEFT JOIN users u2 ON a.created_by = u2.id
  LEFT JOIN strategic_goals g ON a.goal_id = g.id
`;

router.get('/', async (req, res, next) => {
  try {
    const { status, owner_id, goal_id } = req.query;
    let sql = SELECT + ' WHERE 1=1';
    const params = [];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    if (owner_id) { sql += ' AND a.owner_id = ?'; params.push(owner_id); }
    if (goal_id) { sql += ' AND a.goal_id = ?'; params.push(goal_id); }
    sql += ' ORDER BY CASE a.status WHEN "todo" THEN 1 WHEN "in_progress" THEN 2 ELSE 3 END, a.due_date ASC, a.created_at DESC';
    const db = await dbPromise;
    res.json(await db.all(sql, ...params));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, owner_id, goal_id, due_date, status, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO actions (title, description, owner_id, goal_id, due_date, status, priority, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      title, description || null, owner_id || null, goal_id || null, due_date || null, status || 'todo', priority || 'medium', req.user.id
    );
    res.status(201).json(await db.get(SELECT + ' WHERE a.id = ?', result.lastID));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const db = await dbPromise;
    const a = await db.get('SELECT * FROM actions WHERE id = ?', id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    const { title, description, owner_id, goal_id, due_date, status, priority } = req.body;
    await db.run(
      'UPDATE actions SET title=?, description=?, owner_id=?, goal_id=?, due_date=?, status=?, priority=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      title ?? a.title, description ?? a.description,
      owner_id !== undefined ? owner_id : a.owner_id,
      goal_id !== undefined ? goal_id : a.goal_id,
      due_date !== undefined ? due_date : a.due_date,
      status ?? a.status, priority ?? a.priority, id
    );
    res.json(await db.get(SELECT + ' WHERE a.id = ?', id));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM actions WHERE id = ?', parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
