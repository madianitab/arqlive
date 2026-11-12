import { AfterViewInit, Component, ElementRef, Input, OnDestroy, ViewChild, signal } from '@angular/core';
import { NgIf } from '@angular/common';

/**
 * Casca padrão dos simuladores: cabeçalho (título + ações),
 * sidebar de config colapsável e área principal de visualização.
 *
 * Uso:
 *   <os-sim-shell title="Escalonamento de Processos" subtitle="...">
 *     <ng-container slot="actions"> ...botões... </ng-container>
 *     <ng-container slot="config"> ...painéis de configuração... </ng-container>
 *     ...visualização (conteúdo padrão)...
 *   </os-sim-shell>
 */
@Component({
  selector: 'os-sim-shell',
  standalone: true,
  imports: [NgIf],
  styleUrls: ['./sim-shell.component.css'],
  template: `
    <section #root class="os-sim" [class.collapsed]="collapsed()">
      <header #head class="os-sim-head">
        <div class="os-sim-head-left">
          <button
            type="button"
            class="os-sim-burger"
            (click)="toggle()"
            [attr.aria-label]="collapsed() ? 'Abrir configuração' : 'Recolher configuração'"
            [attr.aria-expanded]="!collapsed()"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <div class="os-sim-head-titles">
            <h1 class="os-sim-title">{{ title }}</h1>
            <p *ngIf="subtitle" class="os-sim-subtitle" [title]="subtitle">{{ subtitle }}</p>
          </div>
        </div>
        <div class="os-sim-head-center">
          <ng-content select="[slot=actions]"></ng-content>
        </div>
        <div class="os-sim-head-right"></div>
      </header>

      <div class="os-sim-body">
        <aside class="os-sim-side" [attr.inert]="collapsed() ? '' : null">
          <div class="os-sim-side-scroll">
            <ng-content select="[slot=config]"></ng-content>
          </div>
        </aside>
        <div class="os-sim-scrim" (click)="toggle()"></div>
        <main class="os-sim-main">
          <ng-content></ng-content>
        </main>
      </div>
    </section>
  `,
})
export class OsSimShellComponent implements AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() subtitle = '';

  @ViewChild('root') private root?: ElementRef<HTMLElement>;
  @ViewChild('head') private head?: ElementRef<HTMLElement>;
  private observador?: ResizeObserver;

  /** Mede o cabeçalho (a altura muda se o subtítulo quebrar linha) para posicionar a lateral fixa. */
  ngAfterViewInit(): void {
    const head = this.head?.nativeElement;
    const root = this.root?.nativeElement;
    if (!head || !root || typeof ResizeObserver === 'undefined') return;
    this.observador = new ResizeObserver(() => root.style.setProperty('--os-head-h', `${head.offsetHeight}px`));
    this.observador.observe(head);
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  /** estado do painel de config (recolhido?); no celular a lateral (drawer) começa fechada para não cobrir a simulação */
  readonly collapsed = signal(typeof matchMedia !== 'undefined' && matchMedia('(max-width: 880px)').matches);

  toggle(): void {
    this.collapsed.set(!this.collapsed());
  }
}
