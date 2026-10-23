import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inGauteng} from './coverage.js';
test('covers Gauteng cities beyond the previous Cullinan radius',()=>{
 for(const [lat,lng] of [[-25.681098,28.523261],[-26.2041,28.0473],[-26.7,27.8],[-26.25,28.45],[-26.1,27.75],[-25.75,28.2]])assert.equal(inGauteng(lat,lng),true,`${lat},${lng}`);
 for(const [lat,lng] of [[-33.925,18.424],[-25.87,29.23],[-26.71,27.1],[NaN,28]])assert.equal(inGauteng(lat,lng),false);
});
