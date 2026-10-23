import { HeaderComponent } from './ui/header.component';
import { HomeComponent } from './ui/home.component';
import { FooterComponent } from './ui/footer.component';
import { bootstrapApplication } from '@angular/platform-browser';
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({selector:'app-root',standalone:true,imports:[CommonModule,FormsModule,HeaderComponent,HomeComponent,FooterComponent],templateUrl:'./app.html'})
export class App implements OnInit {
  constructor(private sanitizer:DomSanitizer){}
  view=signal('home'); menu=false; services=signal<any[]>([]); config=signal<any>({}); user=signal<any>(null); busy=signal(false); error=signal(''); notice=signal('');
  step=signal(1); selected=signal<any>(null); quote=signal<any>(null); slots=signal<any[]>([]); confirmed=signal<any>(null); appointments=signal<any[]>([]); documents=signal<any[]>([]); notifications=signal<any[]>([]); adminData=signal<any>({appointments:[],services:[],providers:[],documents:[]});
  address=''; lat:number|undefined; lng:number|undefined; map:SafeResourceUrl|null=null; date=''; time=''; minDate=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'}); maxDate=new Date(Date.now()+90*86400000).toLocaleDateString('en-CA',{timeZone:'Africa/Johannesburg'});
  patient={name:'',dob:'',phone:'',email:'',emergency:'',notes:'',consent:false}; forWhom='myself'; document:any; account={name:'',email:'',password:''}; register=false; tab='Home'; providerName=''; filter=''; adminDate=this.minDate;
  steps=['Your care','Your location','Date & time','Patient details','Review & confirm'];
  async api(path:string,method='GET',body?:any){const r=await fetch('/api'+path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Something went wrong. Please try again.');return d;}
  async run(fn:()=>Promise<void>){if(this.busy())return;this.busy.set(true);this.error.set('');this.notice.set('');try{await fn();}catch(e:any){this.error.set(e.message);}finally{this.busy.set(false);}}
  async ngOnInit(){setInterval(()=>{if(this.view()==='admin'&&this.tab==='Services')void this.refreshAdminSlots();if(this.view()==='book'&&this.step()>=3&&this.step()<=5&&this.date)void this.refreshSlots();},10000);window.addEventListener('popstate',()=>this.restoreView());await this.run(async()=>{this.services.set(await this.api('/services'));this.config.set(await this.api('/config'));try{this.user.set(await this.api('/me'));}catch{}if(location.pathname==='/admin'||location.pathname==='/account'){if(this.user())await this.dashboard();else this.go('login');}else this.restoreView();});}
  restoreView(){
    const path=location.pathname;
    const hash=location.hash.slice(1);
    if(path==='/admin'||path==='/account')this.view.set(this.user()?(this.user().role==='admin'?'admin':'account'):'login');
    else if(['book','login','privacy','terms'].includes(hash))this.view.set(hash);
    else {this.view.set('home');if(hash)setTimeout(()=>document.getElementById(hash)?.scrollIntoView(),30);}
    this.error.set('');this.notice.set('');
  }
  go(v:string){this.view.set(v);this.menu=false;this.error.set('');this.notice.set('');history.pushState({},'',v==='home'?'/':v==='account'||v==='admin'?'/'+v:'/#'+v);window.scrollTo({top:0,behavior:'smooth'});}
  section(id:string){this.go('home');setTimeout(()=>document.getElementById(id)?.scrollIntoView({behavior:'smooth'}),30);}
  book(service?:any){this.useGps=false;this.locating.set(false);this.locationRevision++;this.lat=undefined;this.lng=undefined;this.map=null;this.gpsDetails='';this.selected.set(service||null);this.step.set(1);this.confirmed.set(null);this.quote.set(null);this.time='';this.document=undefined;this.patient.consent=false;if(this.user()){this.patient.name=this.user().name;this.patient.email=this.user().email;this.patient.phone=this.user().phone;}this.go('book');}
  money(cents:number){return new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',minimumFractionDigits:cents%100?2:0,maximumFractionDigits:2}).format(cents/100);}
  longDate(date:string){return date?new Date(date+'T12:00:00+02:00').toLocaleDateString('en-ZA',{weekday:'long',day:'numeric',month:'long',year:'numeric'}):'';}
  selectService(s:any){this.selected.set(s);this.quote.set(null);}
  useGps=false; gpsDetails=''; locating=signal(false); locationRevision=0;
  setLocationSource(gps:boolean){this.useGps=gps;this.locating.set(false);this.locationSourceChanged();this.error.set('');this.notice.set('');}
  addressChanged(){this.map=null;this.quote.set(null);this.locationRevision++;}
  locationSourceChanged(){this.quote.set(null);this.locationRevision++;if(this.useGps&&this.lat!==undefined&&this.lng!==undefined)this.showMap(this.lat,this.lng);else this.map=null;}
  locate(){this.error.set('');const revision=++this.locationRevision;this.quote.set(null);this.lat=undefined;this.lng=undefined;this.map=null;if(!navigator.geolocation){this.error.set('Your browser does not support location. Choose Type an address instead.');return;}this.locating.set(true);navigator.geolocation.getCurrentPosition(p=>{if(revision!==this.locationRevision)return;this.locating.set(false);this.lat=p.coords.latitude;this.lng=p.coords.longitude;this.showMap(this.lat,this.lng);this.notice.set('Current location found. Check the map pin, then calculate your travel fee.');},()=>{if(revision!==this.locationRevision)return;this.locating.set(false);this.error.set('Location could not be accessed. Allow location access or choose Type an address.');},{timeout:12000});}
  showMap(lat:number,lng:number){this.map=this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${lng-.015},${lat-.01},${lng+.015},${lat+.01}&layer=mapnik&marker=${lat},${lng}`);}
  async getQuote(){await this.run(async()=>{this.quote.set(null);const revision=this.locationRevision;const serviceId=this.selected().id;const q=await this.api('/quote','POST',{serviceId,address:this.useGps?this.gpsDetails:this.address,locationSource:this.useGps?'gps':'address',...(this.useGps?{lat:this.lat,lng:this.lng}:{})});if(revision!==this.locationRevision||serviceId!==this.selected()?.id){this.notice.set('Your location changed. Please calculate a new quote.');return;}this.quote.set(q);this.showMap(q.lat,q.lng);});}
  slotDate=this.minDate; adminSlots=signal<any[]>([]); holdExpires=signal(0);
  async refreshSlots(){const date=this.date;const quoteId=this.quote()?.id;const selectedTime=this.time;try{const slots=await this.api('/slots?date='+date+'&quoteId='+(quoteId||''));if(this.date!==date||this.quote()?.id!==quoteId||this.time!==selectedTime)return;this.slots.set(slots);if(this.time&&!slots.some((s:any)=>s.time===this.time&&s.status==='selected')){this.time='';this.holdExpires.set(0);this.step.set(3);this.error.set('Your time hold expired or is unavailable. Please select a time again.');}}catch{}}
  async loadSlots(){this.time='';this.holdExpires.set(0);this.slots.set([]);await this.run(()=>this.refreshSlots());}
  async selectTime(time:string){await this.run(async()=>{const date=this.date,quoteId=this.quote().id;const result=await this.api('/slot-holds','POST',{quoteId,date,time});if(this.date!==date||this.quote()?.id!==quoteId)return;this.time=time;this.holdExpires.set(result.expires);await this.refreshSlots();});}
  async refreshAdminSlots(){const date=this.slotDate;try{const rows=await this.api('/admin/slots?date='+date);if(this.slotDate===date)this.adminSlots.set(rows);}catch{}}
  async setSlotBusy(time:string,busy:boolean){await this.run(async()=>{const date=this.slotDate;const rows=await this.api('/admin/slots','PUT',{date,time,busy});if(this.slotDate===date)this.adminSlots.set(rows);});}
  next(){this.error.set('');if(this.step()===1&&!this.selected()){this.error.set('Please select a service.');return;}if(this.step()===2&&!this.quote()){this.error.set('Please calculate your travel quote first.');return;}if(this.step()===3&&!this.time){this.error.set('Please select an available appointment.');return;}this.step.update(s=>s+1);window.scrollTo({top:100,behavior:'smooth'});}
  async upload(event:Event){const file=(event.target as HTMLInputElement).files?.[0];this.document=undefined;if(!file)return;if(file.size>2*1024*1024||file.type!=='application/pdf'){this.error.set('Choose a PDF smaller than 2 MB.');return;}const buffer=await file.arrayBuffer();if(new TextDecoder().decode(buffer.slice(0,5))!=='%PDF-'){this.error.set('This file is not a valid PDF.');return;}const reader=new FileReader();reader.onload=()=>{this.document={name:file.name,base64:String(reader.result).split(',')[1]};this.notice.set('Document attached.');};reader.readAsDataURL(file);}
  async confirm(){await this.run(async()=>{this.confirmed.set(await this.api('/appointments','POST',{quoteId:this.quote().id,date:this.date,time:this.time,...this.patient,document:this.document}));this.step.set(6);});}
  async login(){await this.run(async()=>{this.user.set(await this.api(this.register?'/register':'/login','POST',this.account));this.account.password='';await this.dashboard();});}
  async dashboard(){if(this.user()?.role==='admin'){this.adminData.set(await this.api('/admin'));this.go('admin');}else{this.appointments.set(await this.api('/appointments'));this.documents.set(await this.api('/documents'));this.notifications.set(await this.api('/notifications'));this.go('account');}this.tab='Home';}
  async openDashboard(){await this.run(()=>this.dashboard());}
  async logout(){await this.run(async()=>{await this.api('/logout','POST');this.user.set(null);this.appointments.set([]);this.documents.set([]);this.adminData.set({appointments:[],services:[],providers:[],documents:[]});this.go('home');});}
  async saveProfile(){await this.run(async()=>{this.user.set(await this.api('/me','PUT',this.user()));this.notice.set('Your information has been saved.');});}
  async cancel(id:string){await this.run(async()=>{await this.api('/appointments/'+id+'/cancel','PATCH');this.appointments.set(await this.api('/appointments'));this.notice.set('Your appointment has been cancelled.');});}
  nextAppointment(){return this.appointments().find(a=>a.status==='confirmed'&&new Date(`${a.date}T${a.time}:00+02:00`).getTime()>Date.now());}
  adminAppointments(){const rows=this.adminData().appointments.filter((a:any)=>(this.tab!=='Calendar'||a.date===this.adminDate)&&(`${a.name} ${a.service} ${a.id} ${a.reference || ""}`.toLowerCase().includes(this.filter.toLowerCase())));return this.tab==='Calendar'?rows.sort((a:any,b:any)=>a.time.localeCompare(b.time)):rows;}
  todayAppointments(){return this.adminData().appointments.filter((a:any)=>a.date===this.minDate).sort((a:any,b:any)=>a.time.localeCompare(b.time));}
  completed(){return this.todayAppointments().filter((a:any)=>a.status==='completed').length;}
  remaining(){return this.todayAppointments().filter((a:any)=>a.status==='confirmed').length;}
  revenue(){return this.adminData().appointments.filter((a:any)=>a.status==='completed').reduce((n:number,a:any)=>n+a.service_fee+a.travel_fee,0);}
  patients(){return this.adminData().appointments.filter((a:any,i:number,all:any[])=>all.findIndex(x=>x.email===a.email&&x.name===a.name)===i);}
  async status(id:string,status:string){await this.run(async()=>{await this.api('/admin/appointments/'+id,'PATCH',{status});this.adminData.set(await this.api('/admin'));});}
  managedServiceId:number|null=null;
  managedService(){return this.adminData().services.find((s:any)=>s.id===this.managedServiceId)||this.adminData().services[0]||null;}
  newService={name:'',description:'',price:0,icon:'home',active:1};
  removingService=signal<number|null>(null);
  async refreshServices(){this.adminData.set(await this.api('/admin'));this.services.set(await this.api('/services'));}
  async addService(){await this.run(async()=>{const added=await this.api('/admin/services','POST',{...this.newService,price:Number(this.newService.price)});this.managedServiceId=added.id;this.newService={name:'',description:'',price:0,icon:'home',active:1};await this.refreshServices();this.notice.set('Service added. It is now available for booking.');});}
  async removeService(id:number){await this.run(async()=>{await this.api('/admin/services/'+id,'DELETE');this.removingService.set(null);await this.refreshServices();this.notice.set('Service removed. Existing bookings have been kept.');});}
  async saveService(s:any){await this.run(async()=>{await this.api('/admin/services/'+s.id,'PUT',{price:Number(s.price),active:Number(s.active)});this.services.set(await this.api('/services'));this.notice.set('Service updated. Existing booking prices are unchanged.');});}
  async addProvider(){await this.run(async()=>{await this.api('/admin/providers','POST',{name:this.providerName});this.providerName='';this.adminData.set(await this.api('/admin'));});}
  print(){window.print();}
}
bootstrapApplication(App).catch(console.error);
