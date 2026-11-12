import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

export type CardIconVariant = 'default' | 'warn' | 'ok' | 'err' | 'info';

@Component({
  selector: 'os-card-icon',
  standalone: true,
  imports: [NgClass],
  styleUrls: ['./card-icon.component.css'],
  template: `
    <div class="card-icon" [ngClass]="variant !== 'default' ? variant : ''">
      <ng-content></ng-content>
    </div>
  `,
})
export class OsCardIconComponent {
  @Input() variant: CardIconVariant = 'default';
}
