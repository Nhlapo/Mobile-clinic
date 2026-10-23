import { Component, ElementRef, ViewChild, input, output, signal } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { CareService, SiteConfig, formatRand } from './models';
import { ServiceCardComponent } from './service-card.component';
import { SectionHeadingComponent } from './section-heading.component';
import { RevealDirective } from './reveal.directive';

@Component({selector:'app-home', standalone:true, imports:[ServiceCardComponent,SectionHeadingComponent,RevealDirective], templateUrl:'./home.component.html'})
export class HomeComponent {
  services = input<CareService[]>([]);
  config = input<SiteConfig>({});
  book = output<CareService | undefined>();
  navigateSection = output<string>();
  selectedService = signal<CareService | null>(null);
  @ViewChild('serviceDialog') serviceDialog!: ElementRef<HTMLDialogElement>;
  money = formatRand;
  areaMap;
  constructor(sanitizer:DomSanitizer) {
    this.areaMap = sanitizer.bypassSecurityTrustResourceUrl('https://www.openstreetmap.org/export/embed.html?bbox=27.1%2C-27.0%2C29.1%2C-25.0&layer=mapnik');
  }
  showService(service:CareService) { this.selectedService.set(service); this.serviceDialog.nativeElement.showModal(); }
  closeService() { this.serviceDialog.nativeElement.close(); }
  bookSelected() { const service=this.selectedService();this.closeService();if(service)this.book.emit(service); }
  features = [
    {icon:'shield',title:'Professional expertise',text:'Qualified healthcare professionals who bring thoughtful, attentive care to every visit.'},
    {icon:'heart',title:'Personalised support',text:'Time to listen, understand your needs and support what matters most to you.'},
    {icon:'home',title:'The comfort of home',text:'Less travelling. Familiar surroundings. Essential care brought to your door.'},
    {icon:'leaf',title:'Compassion, always',text:'Respect for your dignity, independence and the people you call family.'},
  ];
  steps = [
    {title:'Choose your care',text:'Explore our services and select the support you need.'},
    {title:'Share your location',text:'Enter your address and see your road-distance travel fee upfront.'},
    {title:'Make it your visit',text:'Choose an available time, add patient details and review your total.'},
    {title:'We come to you',text:'Confirm your booking. An available provider is assigned to your home visit.'},
  ];
  values = ['Compassion','Professionalism','Integrity','Quality care','Accessibility','Respect'];
}
