import { Component, input } from '@angular/core';

@Component({
  selector: 'app-section-heading', standalone: true,
  template: `<div class="section-heading" [class.center]="centered()"><p class="eyebrow">{{eyebrow()}}</p><h2>{{heading()}}</h2>@if(description()){<p class="section-description">{{description()}}</p>}</div>`,
})
export class SectionHeadingComponent {
  eyebrow = input('');
  heading = input.required<string>();
  description = input('');
  centered = input(false);
}
