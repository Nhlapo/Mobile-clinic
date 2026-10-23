import { Component, input, output } from '@angular/core';
import { CareService, SiteConfig } from './models';

@Component({selector:'app-footer',standalone:true,templateUrl:'./footer.component.html'})
export class FooterComponent {
  config = input<SiteConfig>({});
  services = input<CareService[]>([]);
  signedIn = input(false);
  navigate = output<string>();
  navigateSection = output<string>();
  book = output<CareService | undefined>();
  account = output<void>();
  year = new Date().getFullYear();
}
