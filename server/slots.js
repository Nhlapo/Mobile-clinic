export const slotTimes=Array.from({length:11},(_,i)=>`${String(i+7).padStart(2,'0')}:00`);
export const localDay=(now=Date.now())=>new Date(now).toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'});
export function validSlotDate(date){return /^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date&&date>=localDay()&&date<=localDay(Date.now()+90*86400000);}
export function slotList(db,date,quoteId=''){
  if(!validSlotDate(date))return [];
  const overrides=db.prepare('SELECT time,busy FROM slot_settings WHERE date=?').all(date);
  const appointments=db.prepare("SELECT time FROM appointments WHERE date=? AND status!='cancelled'").all(date);
  const holds=db.prepare('SELECT time,quote_id,expires FROM slot_holds WHERE date=? AND expires>?').all(date,Date.now());
  const provider=db.prepare('SELECT id FROM providers WHERE active=1 LIMIT 1').get();
  return slotTimes.map(time=>{
    const hold=holds.find(h=>h.time===time);
    const busy=overrides.find(s=>s.time===time)?.busy??(new Date(date+'T12:00:00+02:00').getUTCDay()===0?1:0);
    const status=appointments.some(a=>a.time===time)?'booked':new Date(`${date}T${time}:00+02:00`).getTime()<=Date.now()+3600000?'past':busy?'busy':!provider?'unavailable':hold?(hold.quote_id===quoteId?'selected':'held'):'available';
    return {time,status,...(hold?.quote_id===quoteId?{expires:hold.expires}:{})};
  });
}
