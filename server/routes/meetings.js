const router = require('express').Router();
const dbPromise = require('../db');
const requireAuth = require('../middleware/auth');

router.use(requireAuth);

const MTG_SELECT = 'SELECT m.*, u.name as facilitator_name FROM meetings m LEFT JOIN users u ON m.facilitator_id = u.id';

async function withDetails(db, meeting) {
  meeting.attendees = await db.all(
    'SELECT u.id, u.name, u.email FROM meeting_attendees ma JOIN users u ON ma.user_id = u.id WHERE ma.meeting_id = ?',
    meeting.id
  );
  meeting.agendaItems = await db.all(
    'SELECT * FROM meeting_agenda_items WHERE meeting_id = ? ORDER BY sort_order, id',
    meeting.id
  );
  return meeting;
}

router.get('/', async (req, res, next) => {
  try {
    const { type, status } = req.query;
    let sql = MTG_SELECT + ' WHERE 1=1';
    const params = [];
    if (type) { sql += ' AND m.type = ?'; params.push(type); }
    if (status) { sql += ' AND m.status = ?'; params.push(status); }
    sql += ' ORDER BY m.date DESC';
    const db = await dbPromise;
    const meetings = await db.all(sql, ...params);
    res.json(await Promise.all(meetings.map(m => withDetails(db, m))));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const db = await dbPromise;
    const meeting = await db.get(MTG_SELECT + ' WHERE m.id = ?', parseInt(req.params.id));
    if (!meeting) return res.status(404).json({ error: 'Not found' });
    res.json(await withDetails(db, meeting));
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, type, date, duration_minutes, facilitator_id, attendees, agendaItems } = req.body;
    if (!title || !date) return res.status(400).json({ error: 'title and date required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO meetings (title, type, date, duration_minutes, facilitator_id) VALUES (?, ?, ?, ?, ?)',
      title, type || 'team', date, duration_minutes || 60, facilitator_id || req.user.id
    );
    const id = result.lastID;
    for (const uid of (attendees || [])) {
      await db.run('INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)', id, uid);
    }
    for (let i = 0; i < (agendaItems || []).length; i++) {
      const item = agendaItems[i];
      await db.run(
        'INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, sort_order) VALUES (?, ?, ?, ?, ?)',
        id, item.title, item.description || null, item.duration_minutes || null, i
      );
    }
    const meeting = await db.get(MTG_SELECT + ' WHERE m.id = ?', id);
    res.status(201).json(await withDetails(db, meeting));
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    const db = await dbPromise;
    const m = await db.get('SELECT * FROM meetings WHERE id = ?', id);
    if (!m) return res.status(404).json({ error: 'Not found' });
    const { title, date, duration_minutes, facilitator_id, status, notes, attendees } = req.body;
    await db.run(
      'UPDATE meetings SET title=?, date=?, duration_minutes=?, facilitator_id=?, status=?, notes=? WHERE id=?',
      title ?? m.title, date ?? m.date, duration_minutes ?? m.duration_minutes,
      facilitator_id ?? m.facilitator_id, status ?? m.status,
      notes !== undefined ? notes : m.notes, id
    );
    if (attendees) {
      await db.run('DELETE FROM meeting_attendees WHERE meeting_id = ?', id);
      for (const uid of attendees) {
        await db.run('INSERT OR IGNORE INTO meeting_attendees (meeting_id, user_id) VALUES (?, ?)', id, uid);
      }
    }
    const updated = await db.get(MTG_SELECT + ' WHERE m.id = ?', id);
    res.json(await withDetails(db, updated));
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM meetings WHERE id = ?', parseInt(req.params.id));
    res.status(204).end();
  } catch (err) { next(err); }
});

router.post('/:id/agenda', async (req, res, next) => {
  try {
    const { title, description, duration_minutes, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    const db = await dbPromise;
    const result = await db.run(
      'INSERT INTO meeting_agenda_items (meeting_id, title, description, duration_minutes, sort_order) VALUES (?, ?, ?, ?, ?)',
      parseInt(req.params.id), title, description || null, duration_minutes || null, sort_order || 0
    );
    res.status(201).json(await db.get('SELECT * FROM meeting_agenda_items WHERE id = ?', result.lastID));
  } catch (err) { next(err); }
});

router.put('/:id/agenda/:itemId', async (req, res, next) => {
  try {
    const db = await dbPromise;
    const item = await db.get('SELECT * FROM meeting_agenda_items WHERE id = ?', parseInt(req.params.itemId));
    if (!item) return res.status(404).json({ error: 'Not found' });
    const { title, description, duration_minutes, notes, decisions, sort_order } = req.body;
    await db.run(
      'UPDATE meeting_agenda_items SET title=?, description=?, duration_minutes=?, notes=?, decisions=?, sort_order=? WHERE id=?',
      title ?? item.title, description ?? item.description, duration_minutes ?? item.duration_minutes,
      notes !== undefined ? notes : item.notes, decisions !== undefined ? decisions : item.decisions,
      sort_order ?? item.sort_order, item.id
    );
    res.json(await db.get('SELECT * FROM meeting_agenda_items WHERE id = ?', item.id));
  } catch (err) { next(err); }
});

router.delete('/:id/agenda/:itemId', async (req, res, next) => {
  try {
    const db = await dbPromise;
    await db.run('DELETE FROM meeting_agenda_items WHERE id = ?', parseInt(req.params.itemId));
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;
