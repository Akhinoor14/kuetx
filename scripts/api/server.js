const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '2mb' }));

const PUBLIC = path.join(__dirname, '..', '..', 'public');
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.get('/api/schedule', (req, res) => {
  const gen = path.join(PUBLIC, 'generated_schedule.json');
  if (fs.existsSync(gen)) {
    res.sendFile(gen);
  } else {
    res.status(404).json({ error: 'generated_schedule.json not found' });
  }
});

app.post('/api/schedule', (req, res) => {
  // persist posted schedule overrides/full schedule
  const outPath = path.join(DATA_DIR, 'saved_schedule.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify(req.body, null, 2), 'utf8');
    return res.json({ ok: true, path: outPath });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
});

app.post('/api/publish', (req, res) => {
  // simulate publish: save to published.json and return a summary
  const outPath = path.join(DATA_DIR, 'published_schedule.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify({ publishedAt: new Date().toISOString(), payload: req.body }, null, 2), 'utf8');
    return res.json({ ok: true, publishedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: String(e) });
  }
});

const port = process.env.PORT || 4002;
app.listen(port, () => console.log(`Scheduler API listening on http://localhost:${port}`));
