import {readFileSync} from 'node:fs';
const geometry=JSON.parse(readFileSync(new URL('./gauteng.geojson',import.meta.url),'utf8')).geometry;
function inRing(x,y,ring){
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const [ax,ay]=ring[j],[bx,by]=ring[i];
    const cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);
    if(Math.abs(cross)<1e-10&&x>=Math.min(ax,bx)&&x<=Math.max(ax,bx)&&y>=Math.min(ay,by)&&y<=Math.max(ay,by))return true;
    if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;
  }
  return inside;
}
export function inGauteng(lat,lng){
  if(!Number.isFinite(lat)||!Number.isFinite(lng))return false;
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
  return polygons.some(rings=>inRing(lng,lat,rings[0])&&!rings.slice(1).some(r=>inRing(lng,lat,r)));
}
