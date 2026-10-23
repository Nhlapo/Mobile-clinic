import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import {slotTimes,slotList} from './slots.js';
export function hash(password) { const salt = randomBytes(16).toString('hex'); return salt + ':' + scryptSync(password, salt, 64).toString('hex'); }
export function verify(password, stored) { const [salt, value] = stored.split(':'); return timingSafeEqual(Buffer.from(value, 'hex'), scryptSync(password, salt, 64)); }
export function openDb(path = process.env.DATABASE_PATH || 'data/morjud.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'patient', phone TEXT DEFAULT '', medical TEXT DEFAULT '');
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, price INTEGER NOT NULL, icon TEXT NOT NULL, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS providers(id INTEGER PRIMARY KEY, name TEXT NOT NULL, active INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY, service_id INTEGER NOT NULL REFERENCES services(id), address TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL, distance REAL NOT NULL, duration INTEGER NOT NULL, service_fee INTEGER NOT NULL, travel_fee INTEGER NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS appointments(id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), provider_id INTEGER NOT NULL REFERENCES providers(id), service_id INTEGER NOT NULL REFERENCES services(id), date TEXT NOT NULL, time TEXT NOT NULL, name TEXT NOT NULL, dob TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, emergency TEXT NOT NULL, notes TEXT NOT NULL, address TEXT NOT NULL, distance REAL NOT NULL, service_fee INTEGER NOT NULL, travel_fee INTEGER NOT NULL, status TEXT DEFAULT 'confirmed', created TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE UNIQUE INDEX IF NOT EXISTS provider_slot ON appointments(provider_id,date,time) WHERE status != 'cancelled';
    CREATE TABLE IF NOT EXISTS documents(id TEXT PRIMARY KEY, appointment_id TEXT NOT NULL REFERENCES appointments(id), name TEXT NOT NULL, content BLOB NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), message TEXT NOT NULL, created TEXT DEFAULT CURRENT_TIMESTAMP);
  `);
  if (!db.prepare('PRAGMA table_info(appointments)').all().some(column => column.name === 'reference')) {
    db.exec('ALTER TABLE appointments ADD COLUMN reference TEXT');
  }
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS appointment_reference ON appointments(reference);
    CREATE TABLE IF NOT EXISTS booking_sequences(day TEXT PRIMARY KEY, value INTEGER NOT NULL);`);
  db.exec(`CREATE TABLE IF NOT EXISTS slot_settings(date TEXT NOT NULL,time TEXT NOT NULL,busy INTEGER NOT NULL,PRIMARY KEY(date,time));
    CREATE TABLE IF NOT EXISTS slot_holds(date TEXT NOT NULL,time TEXT NOT NULL,quote_id TEXT NOT NULL UNIQUE REFERENCES quotes(id) ON DELETE CASCADE,expires INTEGER NOT NULL,PRIMARY KEY(date,time));`);
  if (!db.prepare('PRAGMA table_info(services)').all().some(column => column.name === 'removed')) {
    db.exec('ALTER TABLE services ADD COLUMN removed INTEGER NOT NULL DEFAULT 0');
  }
  if (!db.prepare('SELECT count(*) AS n FROM services').get().n) {
    const add = db.prepare('INSERT INTO services(name,description,price,icon) VALUES(?,?,?,?)');
    for (const row of [
      ['Maternal & infant care','A little support for life’s biggest new beginning. Caring guidance for mothers and little ones.',55000,'baby'],
      ['Chronic disease management','Consistent, personalised support to help you manage your health with confidence.',50000,'heart'],
      ['Wound care','Professional wound assessment, dressing and ongoing support, in the comfort of home.',45000,'bandage'],
      ['Health monitoring','Stay in touch with your wellbeing through routine checks and health assessments.',35000,'activity'],
      ['HIV/AIDS services','Confidential, respectful care and ongoing support, centred around your individual needs.',45000,'shield'],
      ['General home healthcare','Everyday nursing care that makes a meaningful difference to you and your family.',45000,'home']
    ]) add.run(...row);
    db.prepare('INSERT INTO providers(name) VALUES(?)').run('Morjud care team');
  }
  return db;
}
export const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
// Allocate inside the booking transaction so simultaneous bookings cannot share a number.
export function bookingReference(db, name, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {timeZone:'Africa/Johannesburg',year:'numeric',month:'numeric',day:'numeric'}).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  const day = `${part('year')}-${part('month').padStart(2,'0')}-${part('day').padStart(2,'0')}`;
  const {value} = db.prepare('INSERT INTO booking_sequences(day,value) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET value=value+1 RETURNING value').get(day);
  const firstName = name.trim().split(/\s+/)[0].replace(/[^\p{L}\p{N}'’-]/gu,'') || 'Patient';
  return `${firstName}-${part('month')}/${part('day')}/${part('year')}-${String(value).padStart(3,'0')}`;
}
export const times = slotTimes;
export function available(db,date,quoteId='') {return slotList(db,date,quoteId).filter(s=>s.status==='available'||s.status==='selected').map(s=>s.time);}
