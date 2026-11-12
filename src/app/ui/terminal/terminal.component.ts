import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'os-terminal',
  standalone: true,
  imports: [NgIf],
  styleUrls: ['./terminal.component.css'],
  template: `
    <div class="terminal">
      <div class="term-bar">
        <div class="tdot" style="background:#ff5f57"></div>
        <div class="tdot" style="background:#febc2e"></div>
        <div class="tdot" style="background:#28c840"></div>
        <span *ngIf="label" class="term-label">{{ label }}</span>
      </div>
      <div class="term-body">
        <ng-content></ng-content>
      </div>
    </div>
  `,
})
export class OsTerminalComponent {
  @Input() label = '';
}
