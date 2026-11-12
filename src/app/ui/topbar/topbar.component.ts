import { Component, HostListener, OnDestroy, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { NgIf } from '@angular/common';
import { ThemeService } from '../../core/theme.service';

@Component({
  selector: 'os-topbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, NgIf],
  styleUrls: ['./topbar.component.css'],
  template: `
    <header class="os-topbar" [class.scrolled]="scrolled()" [class.oculta]="oculta()" (focusin)="mostrar()">
      <a class="os-tb-brand" routerLink="/" aria-label="ArqLive — início"> 
        <span class="os-tb-name">Arq<b>Live</b></span>
      </a>

      <nav class="os-tb-nav">
        <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Início</a>
        <a routerLink="/simulacoes" routerLinkActive="active">Simulações</a>
        <a class="os-tb-ds" routerLink="/brandkit" routerLinkActive="active">Design System</a>
      </nav>

      <!-- conta do usuário (Entrar / menu), fornecida pelo app -->
      <ng-content select="[slot=conta]"></ng-content>

      <button
        type="button"
        class="os-tb-theme"
        (click)="theme.toggle()"
        [attr.aria-label]="theme.theme() === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'"
      >
        <svg *ngIf="theme.theme() === 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg *ngIf="theme.theme() !== 'dark'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
    </header>
  `,
})
export class OsTopbarComponent implements OnDestroy {
  readonly theme = inject(ThemeService);
  private readonly doc = inject(DOCUMENT);
  readonly scrolled = signal(false);
  /** Oculta ao rolar a página para baixo; volta ao rolar para cima ou perto do topo. */
  readonly oculta = signal(false);
  private ultimoY = 0;

  @HostListener('window:scroll')
  onScroll(): void {
    const y = Math.max(0, window.scrollY);
    const s = y > 12;
    if (s !== this.scrolled()) {
      this.scrolled.set(s);
    }
    const delta = y - this.ultimoY;
    if (y <= 60) {
      this.definirOculta(false);
    } else if (Math.abs(delta) > 6) {   // ignora pequenas oscilações (ex.: touchpad)
      this.definirOculta(delta > 0);
    } else {
      return;                           // mantém a referência até o movimento ser perceptível
    }
    this.ultimoY = y;
  }

  /** Foco pelo teclado (Tab) dentro da barra sempre a mostra. */
  mostrar(): void {
    this.definirOculta(false);
  }

  ngOnDestroy(): void {
    this.doc.documentElement.classList.remove('os-tb-oculta');
  }

  /** A classe no <html> faz o cabeçalho fixo das simulações subir junto (variável --os-tb-visivel). */
  private definirOculta(v: boolean): void {
    if (v === this.oculta()) return;
    this.oculta.set(v);
    this.doc.documentElement.classList.toggle('os-tb-oculta', v);
  }
}
