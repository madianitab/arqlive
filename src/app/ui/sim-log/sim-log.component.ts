import { Component, Input } from '@angular/core';
import { NgFor, NgClass } from '@angular/common';

@Component({
  selector: 'os-sim-log',
  standalone: true,
  imports: [NgFor, NgClass],
  styleUrls: ['./sim-log.component.css'],
  template: `
    <div class="os-log">
      <h4 class="os-log-h">Diário</h4>
      <div class="os-log-scroll">
        <div class="e" *ngFor="let it of itens; let i = index" [ngClass]="{ now: i === ativo }">{{ it.rotulo }}</div>
      </div>
    </div>
  `,
})
export class OsSimLogComponent {
  @Input() itens: { rotulo: string }[] = [];
  @Input() ativo = -1;
}
