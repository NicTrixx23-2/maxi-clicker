const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const app = express();
const dbPath = './users.db';
const gameDbPath = './gamedata.db';

// Create and connect to users.db
const db = new sqlite3.Database(dbPath);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  )`);
});

// Create and connect to gamedata.db
const gameDb = new sqlite3.Database(gameDbPath);
gameDb.serialize(() => {
  gameDb.run(`CREATE TABLE IF NOT EXISTS game_data (
    username TEXT PRIMARY KEY,
    cookieCount INTEGER,
    starCount INTEGER,
    autoMaxis INTEGER,
    grandMaxis INTEGER,
    maxiplantage INTEGER,
    maxitaxis INTEGER,
    maxibus INTEGER,
    wins INTEGER,
    globalMultiplier REAL,
    itemMultipliers TEXT,
    pets TEXT,
    selectedPets TEXT
  )`);
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(session({
  secret: 'supersecret',
  resave: false,
  saveUninitialized: false
}));

app.post('/register', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (row) return res.status(400).json({ error: 'User exists' });

    const hash = bcrypt.hashSync(password, 10);
    db.run(`INSERT INTO users (username, password) VALUES (?, ?)`, [username, hash], (err) => {
      if (err) return res.status(500).json({ error: 'Error registering user' });
      req.session.user = username;
      res.json({ success: true });
    });
  });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, row) => {
    if (!row || !bcrypt.compareSync(password, row.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    req.session.user = username;
    res.json({ success: true });
  });
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/me', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.json({ user: null });
  }
});

app.post('/save', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).json({ error: 'Not logged in' });

  const {
    cookieCount, starCount, autoMaxis, grandMaxis, maxiplantage, maxitaxis, maxibus, wins,
    globalMultiplier, itemMultipliers, pets, selectedPets
  } = req.body;

  const query = `
    INSERT INTO game_data (
      username, cookieCount, starCount, autoMaxis, grandMaxis, maxiplantage, maxitaxis,
      maxibus, wins, globalMultiplier, itemMultipliers, pets, selectedPets
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(username) DO UPDATE SET
      cookieCount=excluded.cookieCount,
      starCount=excluded.starCount,
      autoMaxis=excluded.autoMaxis,
      grandMaxis=excluded.grandMaxis,
      maxiplantage=excluded.maxiplantage,
      maxitaxis=excluded.maxitaxis,
      maxibus=excluded.maxibus,
      wins=excluded.wins,
      globalMultiplier=excluded.globalMultiplier,
      itemMultipliers=excluded.itemMultipliers,
      pets=excluded.pets,
      selectedPets=excluded.selectedPets
  `;

  const values = [
    user,
    cookieCount,
    starCount,
    autoMaxis,
    grandMaxis,
    maxiplantage,
    maxitaxis,
    maxibus,
    wins,
    globalMultiplier,
    JSON.stringify(itemMultipliers),
    JSON.stringify(pets),
    JSON.stringify(selectedPets)
  ];

  gameDb.run(query, values, (err) => {
    if (err) return res.status(500).json({ error: 'Failed to save data' });
    res.json({ success: true });
  });
});

app.get('/load', (req, res) => {
  const user = req.session.user;
  if (!user) return res.status(403).json({ error: 'Not logged in' });

  gameDb.get(`SELECT * FROM game_data WHERE username = ?`, [user], (err, row) => {
    if (err) return res.status(500).json({ error: 'Failed to load data' });
    if (!row) return res.json({}); // no data yet

    res.json({
      cookieCount: row.cookieCount,
      starCount: row.starCount,
      autoMaxis: row.autoMaxis,
      grandMaxis: row.grandMaxis,
      maxiplantage: row.maxiplantage,
      maxitaxis: row.maxitaxis,
      maxibus: row.maxibus,
      wins: row.wins,
      globalMultiplier: row.globalMultiplier,
      itemMultipliers: JSON.parse(row.itemMultipliers || '{}'),
      pets: JSON.parse(row.pets || '[]'),
      selectedPets: JSON.parse(row.selectedPets || '[]')
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
