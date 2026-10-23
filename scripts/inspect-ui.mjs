import { chromium } from '@playwright/test';
import { createApp } from '../server/index.js';
import { openDb } from '../server/db.js';
const db=openDb(':memory:');const server=createApp(db).listen(0);await new Promise(r=>server.once('listening',r));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
const page=await browser.newPage({viewport:{width:768,height:1000},reducedMotion:'reduce'});
await page.goto(`http://localhost:${server.address().port}`);await page.locator('app-service-card').last().waitFor();
console.log(await page.locator('body *').evaluateAll(els=>els.map(el=>({tag:el.tagName,cls:el.className,x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,width:el.getBoundingClientRect().width})).filter(el=>el.width>0&&(el.right>innerWidth+.5||el.x<-.5)).slice(0,30)));
for(const width of [375,768,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`test-results/hero-${width}.png`});}
}finally{await browser.close();server.closeAllConnections();server.close();db.close();}
