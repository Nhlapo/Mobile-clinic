import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openDb,bookingReference} from './db.js';

test('references use booking day in South Africa and a shared daily sequence',()=>{
  const db=openDb(':memory:');
  try {
    const now=new Date('2026-09-16T22:30:00Z');
    assert.equal(bookingReference(db,'Zoe Smith',now),'Zoe-9/17/2026-001');
    assert.equal(bookingReference(db,'Zoe Jones',now),'Zoe-9/17/2026-002');
    assert.equal(bookingReference(db,'John Smith',now),'John-9/17/2026-003');
    assert.equal(bookingReference(db,'Zoe',new Date('2026-09-17T22:01:00Z')),'Zoe-9/18/2026-001');
    db.exec('BEGIN IMMEDIATE');bookingReference(db,'Zoe',now);db.exec('ROLLBACK');
    assert.equal(bookingReference(db,'Zoe',now),'Zoe-9/17/2026-004');
    db.prepare('UPDATE booking_sequences SET value=999 WHERE day=?').run('2026-09-17');
    assert.equal(bookingReference(db,'Zoe',now),'Zoe-9/17/2026-1000');
  } finally {db.close();}
});
