import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'os-sim-player',
  standalone: true,
  imports: [],
  styleUrls: ['./sim-player.component.css'],
  template: `
    <div class="os-player">
      <button type="button" class="btn" (click)="passo.emit(-1)" [disabled]="atual <= 0" aria-label="Passo anterior">◀◀</button>
      <button type="button" class="btn primary" (click)="alternarPlay()" [attr.aria-label]="tocando ? 'Pausar' : 'Reproduzir'">{{ tocando ? '❚❚' : '▶' }}</button>
      <button type="button" class="btn" (click)="passo.emit(1)" [disabled]="atual >= total - 1" aria-label="Próximo passo">▶▶</button>
      <input class="scrub" type="range" min="0" [max]="total - 1" [value]="atual"
             (input)="seek.emit(+$any($event.target).value)" aria-label="Posição na simulação" />
      <span class="pos">{{ atual + 1 }} / {{ total }}</span>
      <select class="vel" [value]="velocidade" (change)="velocidadeChange.emit(+$any($event.target).value)" aria-label="Velocidade">
        <option [value]="0.5" [selected]="velocidade == 0.5">0.5×</option><option [value]="1" [selected]="velocidade == 1">1×</option><option [value]="2" [selected]="velocidade == 2">2×</option>
      </select>
    </div>
  `,
})
export class OsSimPlayerComponent {
  @Input() total = 0;
  @Input() atual = 0;
  @Input() tocando = false;
  @Input() velocidade = 1;

  @Output() play = new EventEmitter<void>();
  @Output() pause = new EventEmitter<void>();
  @Output() passo = new EventEmitter<1 | -1>();
  @Output() seek = new EventEmitter<number>();
  @Output() velocidadeChange = new EventEmitter<number>();

  alternarPlay(): void {
    this.tocando ? this.pause.emit() : this.play.emit();
  }
  avancar(): void {
    this.passo.emit(1);
  }
}
