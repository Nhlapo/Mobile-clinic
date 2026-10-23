import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createApp} from './index.js';
import {openDb,hash} from './db.js';
import {slotList,localDay} from './slots.js';
test('admin busy slots, exclusive holds, expiry and confirmed bookings',async()=>{
 const db=openDb(':memory:');process.env.BOOKING_ENABLED='true';
 db.prepare("INSERT INTO users(name,email,password,role) VALUES(?,?,?,'admin')").run('Admin','slots@example.test',hash('Long-password-test'));
 const server=createApp(db).listen(0);await new Promise(r=>server.once('listening',r));const base=`http://localhost:${server.address().port}/api`;
 const call=async(path,method='GET',body,cookie)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};};
 try{
 let d=new Date(Date.now()+2*86400000);while(d.getUTCDay()===0)d=new Date(+d+86400000);const date=localDay(+d);
 const login=await call('/login','POST',{email:'slots@example.test',password:'Long-password-test'});
 assert.equal((await call('/admin/slots','PUT',{date,time:'07:00',busy:true})).status,403);
 assert.equal((await call('/admin/slots','PUT',{date,time:'06:00',busy:true},login.cookie)).status,400);
 assert.equal((await call('/admin/slots','PUT',{date,time:'07:00',busy:true},login.cookie)).status,200);
 assert.equal(slotList(db,date)[0].status,'busy');assert.equal(slotList(db,date).at(-1).time,'17:00');
 const quote=()=>{const id=randomUUID();db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,3,'Test address',-25.8,28.2,10,1000,45000,5000,Date.now()+1800000);return id;};
 const q1=quote(),q2=quote();
 assert.equal((await call('/slot-holds','POST',{quoteId:q1,date,time:'07:00'})).status,409);
 await call('/admin/slots','PUT',{date,time:'07:00',busy:false},login.cookie);
 const results=await Promise.all([q1,q2].map(quoteId=>call('/slot-holds','POST',{quoteId,date,time:'07:00'})));
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const winner=results[0].status===200?q1:q2;
 assert.equal(slotList(db,date,winner)[0].status,'selected');assert.equal(slotList(db,date)[0].status,'held');
 assert.equal((await call('/admin/slots','PUT',{date,time:'07:00',busy:true},login.cookie)).status,409);
 db.prepare('UPDATE slot_holds SET expires=0').run();assert.equal(slotList(db,date)[0].status,'available');
 await call('/slot-holds','POST',{quoteId:winner,date,time:'07:00'});
 const booked=await call('/appointments','POST',{quoteId:winner,date,time:'07:00',name:'Slot Test',dob:'1990-01-01',phone:'0821234567',email:'slot@example.test',emergency:'Contact 0821234567',notes:'',consent:true});
 assert.equal(booked.status,201);assert.equal(slotList(db,date)[0].status,'booked');
 assert.equal((await call('/admin/slots','PUT',{date,time:'07:00',busy:false},login.cookie)).status,409);
 await call('/admin/appointments/'+booked.data.id,'PATCH',{status:'cancelled'},login.cookie);
 assert.equal(slotList(db,date)[0].status,'available');
 }finally{server.closeAllConnections();server.close();db.close();}
});
