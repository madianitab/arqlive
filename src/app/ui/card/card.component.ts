import { Component, Input } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';

@Component({
  selector: 'os-card',
  standalone: true,
  imports: [NgClass, NgIf],
  styleUrls: ['./card.component.css'],
  template: `
    <div class="os-card" [ngClass]="{ accent }">
      <div class="os-card-top">
        <ng-content select="[slot=icon]"></ng-content>
        <ng-content select="[slot=badge]"></ng-content>
      </div>
      <div *ngIf="title" class="os-card-title">{{ title }}</div>
      <div class="os-card-body"><ng-content></ng-content></div>
      <div class="os-card-footer"><ng-content select="[slot=footer]"></ng-content></div>
    </div>
  `,
})
export class OsCardComponent {
  @Input() title = '';
  @Input() accent = false;
}
