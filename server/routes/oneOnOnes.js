const router = require('express').Router();
const dbPromise = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

const SELECT = `
  SELECT oo.*, m.name as manager_name, r.name as report_name
  FROM one_on_ones oo
  JOIN users m ON oo.manager_id = m.id
  JOIN users r ON oo.report_id = r.id
`;

async function withItems(db, oo) {
  oo.items = await db.all('SELECT * FROM one_on_one_items WHERE one_on_one_id = ? ORDER BY sort_order, id', oo.id);
  return oo;
}

router.get('/', async (req, res, next) => {
  try {
    const uid = req.user.id;
    const db = await dbPromise;
    const records = await db.all(SELECT + ' WHERE oo.manager_id = ? OR oo.report_id = ? ORDER BY oo.date DESC', uid, uid);
    res.json(await Promise.all(records.map(r => withItems(db, r))));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = await dbPromise;
    const oo = await db.get(SELECT + ' WHERE oo.id = ?', parseInt(req.params.id));
    if (!oo) return res.status(404).json({ error: 'Not found' });
    res.json(await withItems(db, oo));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { manager_id, report_id, date, items } = req.body;
    if (!manager_id || !report_id || !date) return res.status(400).json({ error: 'manager_id, report_id, date required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO one_on_ones (manager_id, report_id, date) VALUES (?, ?, ?)',
      manager_id, report_id, date
    );
    const id = result.lastID;
    for (let i = 0; i < (items || []).length; i++) {
      const item = items[i];
      await db.run(
        'INSERT INTO one_on_one_items (one_on_one_id, title, notes, type, sort_order) VALUES (?, ?, ?, ?, ?)',
        id, item.title, item.notes || null, item.type || 'discussion', i
      );
    }
    const oo = await db.get(SELECT + ' WHERE oo.id = ?', id);
    res.status(201).json(await withItems(db, oo));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const db = await dbPromise;
    const oo = await db.get('SELECT * FROM one_on_ones WHERE id = ?', id);
    if (!oo) return res.status(404).json({ error: 'Not found' });
    const { date, status, notes } = req.body;
    await db.run('UPDATE one_on_ones SET date=?, status=?, notes=? WHERE id=?',
      date ?? oo.date, status ?? oo.status, notes !== undefined ? notes : oo.notes, id);
    const updated = await db.get(SELECT + ' WHERE oo.id = ?', id);
    res.json(await withItems(db, updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM one_on_ones WHERE id = ?', parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

router.post('/:id/items', async (req, res, next) => {
  try {
    const { title, notes, type, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO one_on_one_items (one_on_one_id, title, notes, type, sort_order) VALUES (?, ?, ?, ?, ?)',
      parseInt(req.params.id), title, notes || null, type || 'discussion', sort_order || 0
    );
    res.status(201).json(await db.get('SELECT * FROM one_on_one_items WHERE id = ?', result.lastID));
  } catch (err) { next(err); }
});

router.put('/:id/items/:itemId', async (req, res, next) => {
  try {
    const db = await dbPromise;
    const item = await db.get('SELECT * FROM one_on_one_items WHERE id = ?', parseInt(req.params.itemId));
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { title, notes, type, sort_order } = req.body;
    await db.run('UPDATE one_on_one_items SET title=?, notes=?, type=?, sort_order=? WHERE id=?',
      title ?? item.title, notes !== undefined ? notes : item.notes, type ?? item.type, sort_order ?? item.sort_order, item.id);
    res.json(await db.get('SELECT * FROM one_on_one_items WHERE id = ?', item.id));
  } catch (err) { next(err); }
});

router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM one_on_one_items WHERE id = ?', parseInt(req.params.itemId));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
