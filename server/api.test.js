import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './index.js';
import { openDb, hash } from './db.js';
const db=openDb(':memory:');let server,base,cookie,otherCookie,bookingId;
const date=new Date(Date.now()+2*86400000);while(date.getDay()===0)date.setDate(date.getDate()+1);const visitDate=date.toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'});
async function call(path,method='GET',body,session){const res=await fetch(base+path,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session}:{})},body:body?JSON.stringify(body):undefined});return {status:res.status,data:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]};}
function quote(){const id=randomUUID();db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,3,'10 Test Street, Centurion',-25.86,28.18,18.4,1200,45000,9200,Date.now()+600000);return id;}
function booking(){return {quoteId:quote(),date:visitDate,time:'08:00',name:'Test Patient',dob:'1990-01-01',phone:'0821234567',email:'patient@example.test',emergency:'Test Contact 0827654321',notes:'Test only',consent:true};}
before(async()=>{process.env.BOOKING_ENABLED='true';server=createApp(db).listen(0);await new Promise(r=>server.once('listening',r));base=`http://localhost:${server.address().port}/api`;});
after(()=>{server.close();db.close();});
test('services are seeded with separate prices',async()=>{const r=await call('/services');assert.equal(r.status,200);assert.equal(r.data.length,6);assert.equal(r.data[2].price,45000);});
test('private endpoints reject anonymous access',async()=>{assert.equal((await call('/appointments')).status,401);assert.equal((await call('/admin')).status,403);});
test('registration creates an HTTP-only session and hashes passwords',async()=>{const r=await call('/register','POST',{name:'Test Patient',email:'patient@example.test',password:'A-long-test-password'});assert.equal(r.status,200);cookie=r.cookie;assert.equal(r.data.role,'patient');assert.notEqual(db.prepare('SELECT password FROM users WHERE id=?').get(r.data.id).password,'A-long-test-password');assert.equal((await call('/me','GET',null,cookie)).status,200);});
test('patients cannot elevate privileges or access admin data',async()=>{assert.equal((await call('/admin','GET',null,cookie)).status,403);const r=await call('/register','POST',{name:'Other',email:'other@example.test',password:'Another-long-password',role:'admin'});otherCookie=r.cookie;assert.equal(r.data.role,'patient');});
test('server uses stored quote fees, consumes quote and protects document access',async()=>{const b=booking();b.total=1;b.document={name:'test.pdf',base64:Buffer.from('%PDF-1.4\nTest document').toString('base64')};const r=await call('/appointments','POST',b,cookie);assert.equal(r.status,201);assert.equal(r.data.total,54200);bookingId=r.data.id;assert.equal((await call('/appointments','POST',b,cookie)).status,409);const docs=await call('/documents','GET',null,cookie);assert.equal(docs.data.length,1);assert.equal((await call('/documents/'+docs.data[0].id,'GET',null,otherCookie)).status,404);assert.equal((await call('/appointments','GET',null,otherCookie)).data.length,0);});
test('occupied provider time disappears and double booking is rejected',async()=>{const r=await call('/availability?date='+visitDate);assert.ok(!r.data.includes('08:00'));assert.equal((await call('/appointments','POST',booking())).status,409);});
test('additional providers cannot double-book a time slot',async()=>{db.prepare('INSERT INTO providers(name) VALUES(?)').run('Second provider');assert.ok(!(await call('/availability?date='+visitDate)).data.includes('08:00'));assert.equal((await call('/appointments','POST',booking())).status,409);});
test('cancellation checks ownership and restores capacity',async()=>{assert.equal((await call('/appointments/'+bookingId+'/cancel','PATCH',{},otherCookie)).status,404);assert.equal((await call('/appointments/'+bookingId+'/cancel','PATCH',{},cookie)).status,200);assert.ok((await call('/availability?date='+visitDate)).data.includes('08:00'));});
test('booking rejects missing consent, past birth validation and invalid PDF',async()=>{const b=booking();b.consent=false;assert.equal((await call('/appointments','POST',b)).status,400);b.consent=true;b.document={name:'fake.pdf',base64:Buffer.from('not a pdf').toString('base64')};assert.equal((await call('/appointments','POST',b)).status,422);});
test('routing fails closed when credentials are absent',async()=>{delete process.env.ORS_API_KEY;assert.equal((await call('/quote','POST',{serviceId:3,address:'Test address'})).status,503);});
test('admin prices change new services but preserve historical booking fees',async()=>{db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run('Admin','admin@example.test',hash('Admin-long-password'));const login=await call('/login','POST',{email:'admin@example.test',password:'Admin-long-password'});assert.equal((await call('/admin/services/3','PUT',{price:60000,active:1},login.cookie)).status,200);assert.equal(db.prepare('SELECT service_fee FROM appointments WHERE id=?').get(bookingId).service_fee,45000);assert.equal((await call('/admin','GET',null,login.cookie)).status,200);});
test('cross-origin writes and logged-out sessions are rejected',async()=>{const r=await fetch(base+'/logout',{method:'POST',headers:{Origin:'https://untrusted.example',Cookie:cookie}});assert.equal(r.status,403);assert.equal((await call('/logout','POST',{},cookie)).status,200);assert.equal((await call('/me','GET',null,cookie)).status,401);});

test('only admins create and remove services; booking history survives removal',async()=>{
  const body={name:'New care',description:'Care at home',price:12300,icon:'home'};
  for(const session of [undefined,otherCookie]){
    assert.equal((await call('/admin/services','POST',body,session)).status,403);
    assert.equal((await call('/admin/services/3','DELETE',null,session)).status,403);
  }
  const login=await call('/login','POST',{email:'admin@example.test',password:'Admin-long-password'});
  assert.equal((await call('/admin/services','POST',{...body,price:-1},login.cookie)).status,400);
  const added=await call('/admin/services','POST',body,login.cookie);assert.equal(added.status,201);
  assert.ok((await call('/services')).data.some(s=>s.id===added.data.id));
  assert.equal((await call('/admin/services/'+added.data.id,'DELETE',null,login.cookie)).status,200);
  assert.ok(!(await call('/services')).data.some(s=>s.id===added.data.id));
  assert.ok(!(await call('/admin','GET',null,login.cookie)).data.services.some(s=>s.id===added.data.id));
  const pending=quote();
  assert.equal((await call('/admin/services/3','DELETE',null,login.cookie)).status,200);
  assert.equal(db.prepare('SELECT id FROM quotes WHERE id=?').get(pending),undefined);
  assert.equal(db.prepare('SELECT service_fee FROM appointments WHERE id=?').get(bookingId).service_fee,45000);
  assert.ok((await call('/admin','GET',null,login.cookie)).data.appointments.some(a=>a.id===bookingId&&a.service==='Wound care'));
  assert.equal((await call('/admin/services/3','PUT',{price:50000,active:1},login.cookie)).status,404);
});
