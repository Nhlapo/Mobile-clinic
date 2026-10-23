import { Component, input, output } from '@angular/core';
import { CareService, serviceImage } from './models';

@Component({
  selector: 'app-service-card', standalone: true,
  template: `<article class="service-card">
    <div class="service-photo"><img [src]="image(service()).src" [alt]="image(service()).alt" width="640" height="400" loading="lazy" decoding="async"></div>
    <div class="service-body"><span class="service-icon"><svg aria-hidden="true"><use [attr.href]="'#'+service().icon"/></svg></span>
      <h3>{{service().name}}</h3><p>{{service().description}}</p>
      <button class="card-link" (click)="learnMore.emit(service())" [attr.aria-label]="'Learn more about '+service().name">Learn more <span aria-hidden="true">↗</span></button>
    </div>
  </article>`,
})
export class ServiceCardComponent {
  service = input.required<CareService>();
  learnMore = output<CareService>();
  image = serviceImage;
}
