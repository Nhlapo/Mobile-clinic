import { AfterViewInit, Directive, ElementRef, OnDestroy, inject } from '@angular/core';

@Directive({selector:'[appReveal]', standalone:true})
export class RevealDirective implements AfterViewInit, OnDestroy {
  private element = inject(ElementRef<HTMLElement>);
  private observer?: IntersectionObserver;
  ngAfterViewInit() {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const el = this.element.nativeElement;
    // Keep text readable even before it is observed; reveal only changes position.
    el.classList.add('reveal-ready');
    this.observer = new IntersectionObserver(entries => {
      if(entries.some(entry => entry.isIntersecting)) { el.classList.add('revealed'); this.observer?.disconnect(); }
    }, {threshold:0.05});
    this.observer.observe(el);
  }
  ngOnDestroy() { this.observer?.disconnect(); }
}
