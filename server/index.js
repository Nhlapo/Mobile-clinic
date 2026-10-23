import {inGauteng} from './coverage.js';
import {slotList,slotTimes,validSlotDate} from './slots.js';
import { bookingReference } from './db.js';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { openDb, hash, verify, available, today } from './db.js';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { providerCoordinates } from './provider-location.js';

const text = (max=200) => z.string().trim().min(1).max(max);
const email = z.email().max(254).transform(v=>v.toLowerCase());
const phone = z.string().regex(/^\+?[\d ()-]{8,20}$/);
const digest = v => createHash('sha256').update(v).digest('hex');
export function createApp(db = openDb()) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'",'data:','https://images.unsplash.com'], 'style-src':["'self'","'unsafe-inline'",'https://fonts.googleapis.com'], 'font-src':["'self'",'https://fonts.gstatic.com'], 'script-src':["'self'"], 'frame-src':['https://www.openstreetmap.org'], 'upgrade-insecure-requests':process.env.NODE_ENV==='production'?[]:null } } }));
  app.use('/api',rateLimit({windowMs:60000,limit:120}));
  app.use(express.json({limit:'4mb'}), cookieParser());
  app.use('/api', (req,res,next)=>{res.set('Cache-Control','no-store'); if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') && req.get('origin') !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({error:'Request origin is not allowed.'}); next();});
  app.use((req,res,next)=>{ const session = req.cookies.session && db.prepare('SELECT users.* FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(digest(req.cookies.session),Date.now()); req.user = session; next(); });
  const auth = (req,res,next)=> req.user ? next() : res.status(401).json({error:'Please log in to continue.'});
  const admin = (req,res,next)=> req.user?.role === 'admin' ? next() : res.status(403).json({error:'Administrator access required.'});
  const publicUser = u => ({id:u.id,name:u.name,email:u.email,role:u.role,phone:u.phone,medical:u.medical});
  const signIn = (res,user)=>{const token=randomBytes(32).toString('hex'); db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+86400000); res.cookie('session',token,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',maxAge:86400000,path:'/'}); res.json(publicUser(user));};
  app.get('/api/config', (req,res)=>res.json({bookingEnabled:process.env.BOOKING_ENABLED==='true' && !!process.env.ORS_API_KEY,phone:process.env.CONTACT_PHONE||'',email:process.env.CONTACT_EMAIL||'',whatsapp:process.env.WHATSAPP_NUMBER||'',hours:'Monday–Saturday · 07:00–17:00', timezone:'Africa/Johannesburg'}));
  app.get('/api/services',(req,res)=>res.json(db.prepare('SELECT * FROM services WHERE active=1 AND removed=0').all()));
  const loginLimit=rateLimit({windowMs:15*60000,limit:15});
  app.post('/api/register',loginLimit,(req,res)=>{const b=z.object({name:text(100),email,password:z.string().min(12).max(128)}).parse(req.body); if(db.prepare('SELECT id FROM users WHERE email=?').get(b.email)) return res.status(409).json({error:'This email cannot be registered. Try logging in.'}); const id=db.prepare('INSERT INTO users(name,email,password) VALUES(?,?,?)').run(b.name,b.email,hash(b.password)).lastInsertRowid; signIn(res,db.prepare('SELECT * FROM users WHERE id=?').get(id));});
  app.post('/api/login',loginLimit,(req,res)=>{const b=z.object({email,password:z.string().min(1).max(128)}).parse(req.body); const user=db.prepare('SELECT * FROM users WHERE email=?').get(b.email); if(!user||!verify(b.password,user.password)) return res.status(401).json({error:'Email or password is incorrect.'}); signIn(res,user);});
  app.post('/api/logout',(req,res)=>{if(req.cookies.session) db.prepare('DELETE FROM sessions WHERE token=?').run(digest(req.cookies.session));res.clearCookie('session');res.json({ok:true});});
  app.get('/api/me',auth,(req,res)=>res.json(publicUser(req.user)));
  app.put('/api/me',auth,(req,res)=>{const b=z.object({name:text(100),phone:z.string().max(20),medical:z.string().max(4000)}).parse(req.body);db.prepare('UPDATE users SET name=?,phone=?,medical=? WHERE id=?').run(b.name,b.phone,b.medical,req.user.id);res.json(publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)));});
  app.get('/api/availability',(req,res)=>res.json(available(db,String(req.query.date||''))));
  app.get('/api/slots',(req,res)=>res.json(slotList(db,String(req.query.date||''),String(req.query.quoteId||''))));
  app.get('/api/admin/slots',admin,(req,res)=>res.json(slotList(db,String(req.query.date||''))));
  app.put('/api/admin/slots',admin,(req,res)=>{
    const b=z.object({date:z.string().refine(validSlotDate),time:z.enum(slotTimes),busy:z.boolean()}).parse(req.body);
    db.exec('BEGIN IMMEDIATE');try{
      const slot=slotList(db,b.date).find(s=>s.time===b.time);
      if(['booked','held','past'].includes(slot.status)){db.exec('ROLLBACK');return res.status(409).json({error:'This time is booked, held, or already past. Refresh the schedule.'});}
      db.prepare('INSERT INTO slot_settings(date,time,busy) VALUES(?,?,?) ON CONFLICT(date,time) DO UPDATE SET busy=excluded.busy').run(b.date,b.time,b.busy?1:0);
      db.exec('COMMIT');res.json(slotList(db,b.date));
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.post('/api/slot-holds',rateLimit({windowMs:60000,limit:30}),(req,res)=>{
    const b=z.object({quoteId:z.uuid(),date:z.string().refine(validSlotDate),time:z.enum(slotTimes)}).parse(req.body);
    if(process.env.BOOKING_ENABLED!=='true')return res.status(503).json({error:'Online booking is not enabled.'});
    db.exec('BEGIN IMMEDIATE');try{
      db.prepare('DELETE FROM slot_holds WHERE expires<=?').run(Date.now());
      const quote=db.prepare('SELECT expires FROM quotes WHERE id=? AND expires>?').get(b.quoteId,Date.now());
      if(!quote){db.exec('ROLLBACK');return res.status(409).json({error:'Your travel quote expired. Please calculate it again.'});}
      if(!available(db,b.date,b.quoteId).includes(b.time)){db.exec('ROLLBACK');return res.status(409).json({error:'This time is no longer available. Please choose another slot.'});}
      const existing=db.prepare('SELECT * FROM slot_holds WHERE quote_id=?').get(b.quoteId);
      const expires=existing?.date===b.date&&existing?.time===b.time?existing.expires:Math.min(Date.now()+600000,quote.expires);
      db.prepare('DELETE FROM slot_holds WHERE quote_id=?').run(b.quoteId);
      db.prepare('INSERT INTO slot_holds VALUES(?,?,?,?)').run(b.date,b.time,b.quoteId,expires);
      db.exec('COMMIT');res.json({expires});
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.post('/api/quote',rateLimit({windowMs:60000,limit:12}),async(req,res)=>{
    if(process.env.BOOKING_ENABLED!=='true'||!process.env.ORS_API_KEY) return res.status(503).json({error:'Online booking is being set up. Please contact the care team to arrange a visit.'});
    const b=z.object({serviceId:z.number().int(),address:z.string().trim().max(500).optional().default(''),locationSource:z.enum(['address','gps']).default('address'),lat:z.number().min(-90).max(90).optional(),lng:z.number().min(-180).max(180).optional()}).refine(b=>b.locationSource!=='address'||b.address.length>=8,{message:'Enter a complete street address.',path:['address']}).refine(b=>b.locationSource!=='gps'||(b.lat!==undefined&&b.lng!==undefined),{message:'GPS coordinates are required.',path:['locationSource']}).parse(req.body);
    const service=db.prepare('SELECT * FROM services WHERE id=? AND active=1 AND removed=0').get(b.serviceId);if(!service)return res.status(404).json({error:'Service unavailable.'});
    try {
    let lat=b.locationSource==='gps'?b.lat:undefined,lng=b.locationSource==='gps'?b.lng:undefined;
    if(lat===undefined||lng===undefined){const url=new URL('https://api.openrouteservice.org/geocode/search');url.search=new URLSearchParams({text:b.address,'boundary.country':'ZA',size:'1'}).toString();const r=await fetch(url,{headers:{Authorization:process.env.ORS_API_KEY.trim()},signal:AbortSignal.timeout(10000)});if(!r.ok){const unavailable=r.status===429?'Travel calculations are temporarily busy. Please try again in a few minutes.':r.status===401||r.status===403?'Travel calculation service is unavailable. Please contact the care team.':'We could not find a driving route for this location. Please check the address or map pin and try again.';return res.status(503).json({error:unavailable});}const data=await r.json();if(!data.features?.length)return res.status(422).json({error:'Address not found. Please include your suburb, city and postcode.'});[lng,lat]=data.features[0].geometry.coordinates;}
    if(!inGauteng(lat,lng))return res.status(422).json({error:'We currently provide home visits within Gauteng. Please check your address or map pin. For locations near the provincial border, contact the care team.'});
    const origin=await providerCoordinates();
    const r=await fetch('https://api.openrouteservice.org/v2/directions/driving-car',{method:'POST',headers:{Authorization:process.env.ORS_API_KEY.trim(),'Content-Type':'application/json'},body:JSON.stringify({coordinates:[origin,[lng,lat]]}),signal:AbortSignal.timeout(15000)});
    if(!r.ok){const unavailable=r.status===429?'Travel calculations are temporarily busy. Please try again in a few minutes.':r.status===401||r.status===403?'Travel calculation service is unavailable. Please contact the care team.':'We could not find a driving route for this location. Please check the address or map pin and try again.';return res.status(503).json({error:unavailable});}const route=(await r.json()).routes?.[0]?.summary;if(!route)throw Error('Routing unavailable');
    const distance=Math.ceil(route.distance/100)/10;
    const id=randomUUID(),travel=Math.round(distance*Number(process.env.TRAVEL_RATE_CENTS_PER_KM||500));const expires=Date.now()+30*60000;
    const address=b.locationSource==='gps'?`GPS location: ${lat.toFixed(6)}, ${lng.toFixed(6)}${b.address?' - '+b.address:''}`:b.address;
    db.prepare('INSERT INTO quotes VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,b.serviceId,address,lat,lng,distance,Math.ceil(route.duration),service.price,travel,expires);
    res.json({id,address,lat,lng,distance,serviceFee:service.price,travelFee:travel,total:service.price+travel,expires});
    }catch(error){console.error('Travel calculation failed:',error.name);return res.status(503).json({error:'Travel calculation is temporarily unavailable. Please try again shortly. You can use either a typed address or your current location.'});}
  });
  app.post('/api/appointments',rateLimit({windowMs:60000,limit:10}),(req,res)=>{
    if(process.env.BOOKING_ENABLED!=='true')return res.status(503).json({error:'Online booking is not enabled.'});
    const b=z.object({quoteId:z.uuid(),date:z.iso.date(),time:text(5),name:text(100),dob:z.iso.date().refine(v=>v<=today()&&v>'1900-01-01'),phone,email,emergency:text(200),notes:z.string().max(3000),consent:z.literal(true),document:z.object({name:text(120),base64:z.string().max(2800000)}).optional()}).parse(req.body);
    const q=db.prepare('SELECT * FROM quotes WHERE id=? AND expires>?').get(b.quoteId,Date.now());if(!q)return res.status(409).json({error:'Your quote expired or was used. Please calculate a new quote.'});
    let pdf;if(b.document){pdf=Buffer.from(b.document.base64,'base64');if(pdf.length>2*1024*1024||pdf.subarray(0,5).toString()!=='%PDF-')return res.status(422).json({error:'Please upload a PDF smaller than 2 MB.'});}
    db.exec('BEGIN IMMEDIATE');try {
      if(!available(db,b.date,b.quoteId).includes(b.time)){db.exec('ROLLBACK');return res.status(409).json({error:'That appointment is no longer available. Please choose another time.'});}
      const provider=db.prepare("SELECT id FROM providers WHERE active=1 AND id NOT IN(SELECT provider_id FROM appointments WHERE date=? AND time=? AND status!='cancelled') ORDER BY id LIMIT 1").get(b.date,b.time);
      const id=randomUUID();db.prepare('INSERT INTO appointments(id,user_id,provider_id,service_id,date,time,name,dob,phone,email,emergency,notes,address,distance,service_fee,travel_fee) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id,req.user?.id||null,provider.id,q.service_id,b.date,b.time,b.name,b.dob,b.phone,b.email,b.emergency,b.notes,q.address,q.distance,q.service_fee,q.travel_fee);
      const reference=bookingReference(db,b.name);db.prepare('UPDATE appointments SET reference=? WHERE id=?').run(reference,id);
      if(pdf)db.prepare('INSERT INTO documents VALUES(?,?,?,?)').run(randomUUID(),id,b.document.name,pdf);
      if(req.user)db.prepare('INSERT INTO notifications(user_id,message) VALUES(?,?)').run(req.user.id,`Your home visit is confirmed for ${b.date} at ${b.time}.`);
      db.prepare('DELETE FROM quotes WHERE id=?').run(q.id);db.exec('COMMIT');res.status(201).json({id,reference,date:b.date,time:b.time,total:q.service_fee+q.travel_fee});
    }catch(e){db.exec('ROLLBACK');throw e;}
  });
  app.get('/api/appointments',auth,(req,res)=>res.json(db.prepare('SELECT a.*,s.name AS service,p.name AS provider FROM appointments a JOIN services s ON a.service_id=s.id JOIN providers p ON p.id=a.provider_id WHERE a.user_id=? ORDER BY date,time').all(req.user.id)));
  app.patch('/api/appointments/:id/cancel',auth,(req,res)=>{const a=db.prepare('SELECT * FROM appointments WHERE id=? AND user_id=?').get(req.params.id,req.user.id);if(!a)return res.status(404).json({error:'Appointment not found.'});if(a.status!=='confirmed'||new Date(`${a.date}T${a.time}:00+02:00`).getTime()<Date.now())return res.status(409).json({error:'This appointment can no longer be cancelled online.'});db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(a.id);res.json({ok:true});});
  app.get('/api/notifications',auth,(req,res)=>res.json(db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC').all(req.user.id)));
  app.get('/api/documents',auth,(req,res)=>res.json(db.prepare('SELECT d.id,d.name,a.date FROM documents d JOIN appointments a ON a.id=d.appointment_id WHERE a.user_id=?').all(req.user.id)));
  app.get('/api/documents/:id',auth,(req,res)=>{const d=db.prepare('SELECT d.* FROM documents d JOIN appointments a ON a.id=d.appointment_id WHERE d.id=? AND (a.user_id=? OR ?=\'admin\')').get(req.params.id,req.user.id,req.user.role);if(!d)return res.status(404).json({error:'Document not found.'});res.set({'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="patient-document.pdf"'}).send(Buffer.from(d.content));});
  app.get('/api/admin',admin,(req,res)=>res.json({appointments:db.prepare('SELECT a.*,s.name AS service,p.name AS provider FROM appointments a JOIN services s ON s.id=a.service_id JOIN providers p ON p.id=a.provider_id ORDER BY a.created DESC,a.rowid DESC').all(),services:db.prepare('SELECT * FROM services WHERE removed=0').all(),providers:db.prepare('SELECT * FROM providers').all(),documents:db.prepare('SELECT id,appointment_id,name FROM documents').all()}));
  app.patch('/api/admin/appointments/:id',admin,(req,res)=>{const b=z.object({status:z.enum(['confirmed','completed','cancelled'])}).parse(req.body);const a=db.prepare('SELECT * FROM appointments WHERE id=?').get(req.params.id);if(!a)return res.status(404).json({error:'Appointment not found.'});if(a.status==='cancelled')return res.status(409).json({error:'Cancelled appointments cannot be reopened.'});db.prepare('UPDATE appointments SET status=? WHERE id=?').run(b.status,a.id);if(a.user_id)db.prepare('INSERT INTO notifications(user_id,message) VALUES(?,?)').run(a.user_id,`Your visit on ${a.date} is now ${b.status}.`);res.json({ok:true});});
  app.post('/api/admin/services',admin,(req,res)=>{
    const b=z.object({name:text(100),description:text(1000),price:z.number().int().min(0).max(10000000),icon:z.enum(['baby','heart','bandage','activity','shield','home']),active:z.number().int().min(0).max(1).default(1)}).parse(req.body);
    const result=db.prepare('INSERT INTO services(name,description,price,icon,active) VALUES(?,?,?,?,?)').run(b.name,b.description,b.price,b.icon,b.active);
    res.status(201).json(db.prepare('SELECT * FROM services WHERE id=?').get(result.lastInsertRowid));
  });
  app.delete('/api/admin/services/:id',admin,(req,res)=>{
    db.exec('BEGIN IMMEDIATE');try {
      const result=db.prepare('UPDATE services SET removed=1,active=0 WHERE id=? AND removed=0').run(req.params.id);
      if(!result.changes){db.exec('ROLLBACK');return res.status(404).json({error:'Service not found.'});}
      db.prepare('DELETE FROM quotes WHERE service_id=?').run(req.params.id);
      db.exec('COMMIT');res.json({ok:true});
    }catch(error){db.exec('ROLLBACK');throw error;}
  });
  app.put('/api/admin/services/:id',admin,(req,res)=>{if(!db.prepare('SELECT id FROM services WHERE id=? AND removed=0').get(req.params.id))return res.status(404).json({error:'Service not found.'});const b=z.object({price:z.number().int().min(0).max(10000000),active:z.number().int().min(0).max(1)}).parse(req.body);db.prepare('UPDATE services SET price=?,active=? WHERE id=?').run(b.price,b.active,req.params.id);res.json({ok:true});});
  app.post('/api/admin/providers',admin,(req,res)=>{const b=z.object({name:text(100)}).parse(req.body);db.prepare('INSERT INTO providers(name) VALUES(?)').run(b.name);res.status(201).json({ok:true});});
  app.use(express.static(resolve('dist/morjud/browser')));
  app.get('/{*path}',(req,res)=>{if(req.path.startsWith('/api/'))return res.status(404).json({error:'Endpoint not found.'});res.sendFile(resolve('dist/morjud/browser/index.html'));});
  app.use((err,req,res,next)=>{if(err instanceof z.ZodError)return res.status(400).json({error:'Please check the required fields.',fields:err.issues.map(i=>i.path.join('.'))});if(err.type==='entity.too.large')return res.status(413).json({error:'The uploaded file is too large.'});console.error(err.message);res.status(500).json({error:'We could not complete this request. Please try again shortly.'});});
  return app;
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href)createApp().listen(Number(process.env.PORT||3000),()=>console.log(`Morjud is ready at http://localhost:${process.env.PORT||3000}`));
