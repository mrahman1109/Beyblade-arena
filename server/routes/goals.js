const router = require('express').Router();
const dbPromise = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

async function withKRs(db, goal) {
  goal.keyResults = await db.all('SELECT * FROM key_results WHERE goal_id = ? ORDER BY id', goal.id);
  return goal;
}

const GOAL_SELECT = 'SELECT g.*, u.name as owner_name FROM strategic_goals g LEFT JOIN users u ON g.owner_id = u.id';

router.get('/', async (req, res, next) => {
  try {
    const db = await dbPromise;
    const goals = await db.all(GOAL_SELECT + ' ORDER BY g.created_at DESC');
    res.json(await Promise.all(goals.map(g => withKRs(db, g))));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, owner_id, status, progress, target_date } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO strategic_goals (title, description, owner_id, status, progress, target_date) VALUES (?, ?, ?, ?, ?, ?)',
      title, description || null, owner_id || null, status || 'on_track', progress || 0, target_date || null
    );
    const goal = await db.get(GOAL_SELECT + ' WHERE g.id = ?', result.lastID);
    res.status(201).json(await withKRs(db, goal));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const db = await dbPromise;
    const g = await db.get('SELECT * FROM strategic_goals WHERE id = ?', id);
    if (!g) return res.status(404).json({ error: 'Not found' });
    const { title, description, owner_id, status, progress, target_date } = req.body;
    await db.run(
      'UPDATE strategic_goals SET title=?, description=?, owner_id=?, status=?, progress=?, target_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      title ?? g.title, description ?? g.description,
      owner_id !== undefined ? owner_id : g.owner_id,
      status ?? g.status, progress ?? g.progress,
      target_date !== undefined ? target_date : g.target_date, id
    );
    const updated = await db.get(GOAL_SELECT + ' WHERE g.id = ?', id);
    res.json(await withKRs(db, updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM strategic_goals WHERE id = ?', parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

router.post('/:id/key-results', async (req, res, next) => {
  try {
    const { title, current_value, target_value, unit } = req.body;
    if (!title || target_value == null) return res.status(400).json({ error: 'title and target_value required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO key_results (goal_id, title, current_value, target_value, unit) VALUES (?, ?, ?, ?, ?)',
      parseInt(req.params.id), title, current_value || 0, target_value, unit || null
    );
    res.status(201).json(await db.get('SELECT * FROM key_results WHERE id = ?', result.lastID));
  } catch (err) { next(err); }
});

router.put('/:id/key-results/:krId', async (req, res, next) => {
  try {
    const db = await dbPromise;
    const kr = await db.get('SELECT * FROM key_results WHERE id = ?', parseInt(req.params.krId));
    if (!kr) return res.status(404).json({ error: 'Not found' });
    const { title, current_value, target_value, unit } = req.body;
    await db.run('UPDATE key_results SET title=?, current_value=?, target_value=?, unit=? WHERE id=?',
      title ?? kr.title, current_value ?? kr.current_value, target_value ?? kr.target_value, unit ?? kr.unit, kr.id);
    res.json(await db.get('SELECT * FROM key_results WHERE id = ?', kr.id));
  } catch (err) { next(err); }
});

router.delete('/:id/key-results/:krId', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM key_results WHERE id = ?', parseInt(req.params.krId));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
