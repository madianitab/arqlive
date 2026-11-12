import { Component, Input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

export type BadgeVariant = 'n' | 'a' | 's' | 'w' | 'd' | 'i';

@Component({
  selector: 'os-badge',
  standalone: true,
  imports: [NgClass, NgIf],
  styleUrls: ['./badge.component.css'],
  template: `
    <span class="os-badge" [ngClass]="'os-b-' + variant">
      <span *ngIf="live" class="os-bdot live"></span>
      <span *ngIf="dot && !live" class="os-bdot"></span>
      <ng-content></ng-content>
    </span>
  `,
})
export class OsBadgeComponent {
  @Input() variant: BadgeVariant = 'n';
  @Input() dot = false;
  @Input() live = false;
}
