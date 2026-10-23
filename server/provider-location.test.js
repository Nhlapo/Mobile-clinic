import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerCoordinates} from './provider-location.js';

test('dispatch address is geocoded, cached and never falls back to Centurion',async()=>{
  process.env.PROVIDER_ADDRESS='52 Ross Road, Cullinan, South Africa';
  process.env.PROVIDER_LAT='';process.env.PROVIDER_LNG='';process.env.ORS_API_KEY='test-provider-key';
  let requests=0;
  const fake=async(url,options)=>{
    requests++;
    assert.equal(url.searchParams.get('text'),process.env.PROVIDER_ADDRESS);
    assert.equal(options.headers.Authorization,'test-provider-key');
    return Response.json({features:[{geometry:{coordinates:[28.5,-25.6]},properties:{housenumber:'52'}}]});
  };
  assert.deepEqual(await providerCoordinates(fake),[28.5,-25.6]);
  assert.deepEqual(await providerCoordinates(fake),[28.5,-25.6]);assert.equal(requests,1);
  process.env.PROVIDER_ADDRESS='53 Ross Road, Cullinan, South Africa';
  await assert.rejects(()=>providerCoordinates(async()=>Response.json({features:[{geometry:{coordinates:[28.5,-25.6]},properties:{layer:'locality'}}]})),/street number/);
  process.env.PROVIDER_LAT='-25.65';process.env.PROVIDER_LNG='28.55';
  assert.deepEqual(await providerCoordinates(async()=>{throw Error('Should not geocode verified coordinates');}),[28.55,-25.65]);
  process.env.PROVIDER_LNG='';await assert.rejects(()=>providerCoordinates(fake),/both latitude and longitude/);
});
