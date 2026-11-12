import { Component, Input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

export type AlertVariant = 'info' | 'ok' | 'warn' | 'err';

@Component({
  selector: 'os-alert',
  standalone: true,
  imports: [NgClass, NgIf],
  styleUrls: ['./alert.component.css'],
  template: `
    <div class="os-alert" [ngClass]="'os-a-' + variant">
      <span class="os-alert-ico">
        <ng-content select="[slot=icon]"></ng-content>
      </span>
      <div class="os-alert-body">
        <div *ngIf="title" class="os-alert-title">{{ title }}</div>
        <div class="os-alert-text"><ng-content></ng-content></div>
      </div>
    </div>
  `,
})
export class OsAlertComponent {
  @Input() variant: AlertVariant = 'info';
  @Input() title = '';
}
