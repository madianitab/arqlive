import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

/**
 * Métrica compacta (label + valor) para faixas de estatísticas.
 *
 *   <os-stat label="Tempo médio de espera" value="4.2" unit="ms"></os-stat>
 */
@Component({
  selector: 'os-stat',
  standalone: true,
  imports: [NgIf],
  styleUrls: ['./stat.component.css'],
  template: `
    <div class="os-stat" [class.accent]="accent">
      <div class="os-stat-label">{{ label }}</div>
      <div class="os-stat-value">{{ value }}<sup *ngIf="unit">{{ unit }}</sup></div>
      <div *ngIf="hint" class="os-stat-hint">{{ hint }}</div>
    </div>
  `,
})
export class OsStatComponent {
  @Input() label = '';
  @Input() value: string | number = '';
  @Input() unit = '';
  @Input() hint = '';
  @Input() accent = false;
}
