import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

export type ProgressVariant = 'default' | 'ok' | 'warn' | 'err';

@Component({
  selector: 'os-progress',
  standalone: true,
  imports: [NgClass],
  styleUrls: ['./progress.component.css'],
  template: `
    <div class="prog-track">
      <div class="prog-fill" [ngClass]="variant !== 'default' ? variant : ''" [style.width.%]="value"></div>
    </div>
  `,
})
export class OsProgressComponent {
  @Input() value = 0;
  @Input() variant: ProgressVariant = 'default';
}
