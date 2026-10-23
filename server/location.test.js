import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.js';
import { openDb } from './db.js';

const db=openDb(':memory:');
const originalFetch=globalThis.fetch;
let server,base,lastDestination,geocodeCalls=0,roadDistance=18400,roadDuration=1200;
before(async()=>{
  process.env.PROVIDER_LAT='-25.67';process.env.PROVIDER_LNG='28.52';process.env.BOOKING_ENABLED='true';process.env.ORS_API_KEY='test-only-key';
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://api.openrouteservice.org/geocode/')){
      geocodeCalls++;
      return Response.json({features:[{geometry:{coordinates:[28.09,-26.15]}}]});
    }
    if(String(url).startsWith('https://api.openrouteservice.org/v2/')){
      lastDestination=JSON.parse(options.body).coordinates[1];
      return Response.json({routes:[{summary:{distance:roadDistance,duration:roadDuration}}]});
    }
    return originalFetch(url,options);
  };
  server=createApp(db).listen(0);await new Promise(r=>server.once('listening',r));
  base=`http://localhost:${server.address().port}`;
});
after(()=>{globalThis.fetch=originalFetch;server.close();db.close();});
const quote=async(body)=>{
  const response=await originalFetch(base+'/api/quote',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({serviceId:3,address:'Synthetic address, Johannesburg',...body})});
  return {status:response.status,data:await response.json()};
};
test('typed address wins over unrelated device coordinates by default',async()=>{
  const r=await quote({lat:-25.69,lng:28.20});
  assert.equal(r.status,200);assert.deepEqual(lastDestination,[28.09,-26.15]);assert.equal(geocodeCalls,1);
  assert.equal(r.data.total,54200);assert.equal(r.data.travelFee,9200);
  assert.equal(db.prepare('SELECT lat FROM quotes WHERE id=?').get(r.data.id).lat,-26.15);
});
test('GPS is used only when explicitly selected',async()=>{
  const r=await quote({locationSource:'gps',lat:-25.69,lng:28.20});
  assert.equal(r.status,200);assert.deepEqual(lastDestination,[28.20,-25.69]);assert.equal(geocodeCalls,1);
});
test('GPS mode requires both coordinates',async()=>{
  assert.equal((await quote({locationSource:'gps',lat:-25.69})).status,400);
});
test('GPS works without a typed address and retains coordinates for the visit',async()=>{
  const r=await quote({locationSource:'gps',address:undefined,lat:-25.69,lng:28.20});
  assert.equal(r.status,200);assert.equal(geocodeCalls,1);
  assert.match(r.data.address,/GPS location: -25.690000, 28.200000/);
  assert.equal(db.prepare('SELECT address FROM quotes WHERE id=?').get(r.data.id).address,r.data.address);
});
test('GPS accepts optional directions without geocoding them',async()=>{
  const r=await quote({locationSource:'gps',address:'Unit 4, side gate',lat:-25.69,lng:28.20});
  assert.equal(r.status,200);assert.match(r.data.address,/Unit 4, side gate/);assert.equal(geocodeCalls,1);
});
test('typed address mode requires an address',async()=>{
  assert.equal((await quote({address:''})).status,400);
});
test('routing network failures return an actionable service error',async()=>{
  const workingFetch=globalThis.fetch;
  globalThis.fetch=async()=>{throw new TypeError('fetch failed');};
  try{const r=await quote({locationSource:'gps',address:'',lat:-25.69,lng:28.20});assert.equal(r.status,503);assert.match(r.data.error,/temporarily unavailable/);}finally{globalThis.fetch=workingFetch;}
});

test('Gauteng quotes accept travel beyond 60 km and one hour',async()=>{
  roadDistance=180000;roadDuration=9000;
  try{const r=await quote({locationSource:'gps',address:'',lat:-26.7,lng:27.8});assert.equal(r.status,200);assert.equal(r.data.distance,180);assert.equal(r.data.travelFee,90000);}finally{roadDistance=18400;roadDuration=1200;}
});
test('out-of-province GPS locations are rejected',async()=>{
 const r=await quote({locationSource:'gps',address:'',lat:-33.925,lng:18.424});assert.equal(r.status,422);assert.match(r.data.error,/Gauteng/);
});
