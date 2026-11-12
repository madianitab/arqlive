import { Component, Input, signal } from '@angular/core';
import { NgIf } from '@angular/common';

/**
 * Seção de configuração titulada (usada na sidebar dos simuladores).
 * Pode ser recolhível.
 *
 *   <os-panel title="Processos" [collapsible]="true">
 *     <span slot="meta">4</span>
 *     ...conteúdo...
 *   </os-panel>
 */
@Component({
  selector: 'os-panel',
  standalone: true,
  imports: [NgIf],
  styleUrls: ['./panel.component.css'],
  template: `
    <div class="os-panel">
      <div
        class="os-panel-head"
        [class.clickable]="collapsible"
        (click)="collapsible && toggle()"
      >
        <span class="os-panel-title">{{ title }}</span>
        <span class="os-panel-meta"><ng-content select="[slot=meta]"></ng-content></span>
        <svg *ngIf="collapsible" class="os-panel-chevron" [class.open]="open()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>
      <div class="os-panel-body" *ngIf="open()">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class OsPanelComponent {
  @Input() title = '';
  @Input() collapsible = false;
  @Input() set openInit(v: boolean) { this.open.set(v); }

  readonly open = signal(true);

  toggle(): void {
    this.open.set(!this.open());
  }
}
