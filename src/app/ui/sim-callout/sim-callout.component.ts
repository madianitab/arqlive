import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';

@Component({
  selector: 'os-sim-callout',
  standalone: true,
  imports: [NgIf],
  styleUrls: ['./sim-callout.component.css'],
  template: `
    <div class="os-callout" *ngIf="visivel">
      <span class="os-callout-arrow" aria-hidden="true"></span>
      <span class="os-callout-txt">{{ texto }}</span>
      <ng-content></ng-content>
    </div>
  `,
})
export class OsSimCalloutComponent {
  @Input() texto = '';
  @Input() visivel = false;
}
