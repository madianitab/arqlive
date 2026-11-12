import { Component, Input } from '@angular/core';
import { NgClass } from '@angular/common';

export type ButtonVariant = 'p' | 's' | 'g' | 'd';
export type ButtonSize = 'sm' | 'lg' | 'md';

@Component({
  selector: 'os-button',
  standalone: true,
  imports: [NgClass],
  styleUrls: ['./button.component.css'],
  template: `
    <button
      class="os-btn"
      [ngClass]="classes"
      [disabled]="disabled || null"
      [type]="type"
    >
      <ng-content></ng-content>
    </button>
  `,
})
export class OsButtonComponent {
  @Input() variant: ButtonVariant = 'p';
  @Input() size: ButtonSize = 'md';
  @Input() disabled = false;
  @Input() glow = false;
  @Input() type: 'button' | 'submit' | 'reset' = 'button';

  get classes(): Record<string, boolean> {
    return {
      [`os-btn-${this.variant}`]: true,
      'os-btn-sm': this.size === 'sm',
      'os-btn-lg': this.size === 'lg',
      'os-btn-glow': this.glow,
    };
  }
}
