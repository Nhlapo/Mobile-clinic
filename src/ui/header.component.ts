import { Component, HostListener, input, output, signal } from '@angular/core';
import { SiteConfig } from './models';

@Component({ selector: 'app-header', standalone: true, templateUrl: './header.component.html' })
export class HeaderComponent {
  config = input<SiteConfig>({});
  signedIn = input(false);
  activeView = input('home');
  navigate = output<string>();
  navigateSection = output<string>();
  book = output<void>();
  account = output<void>();
  menuOpen = signal(false);
  scrolled = signal(false);

  @HostListener('window:scroll') onScroll() { this.scrolled.set(window.scrollY > 24); }
  @HostListener('document:keydown.escape') onEscape() { if(this.menuOpen()){ this.menuOpen.set(false); document.getElementById('navigation-toggle')?.focus(); } }
  go(view: string) { this.menuOpen.set(false); this.navigate.emit(view); }
  section(id: string) { this.menuOpen.set(false); this.navigateSection.emit(id); }
  requestCare() { this.menuOpen.set(false); this.book.emit(); }
  openAccount() { this.menuOpen.set(false); this.account.emit(); }
}
