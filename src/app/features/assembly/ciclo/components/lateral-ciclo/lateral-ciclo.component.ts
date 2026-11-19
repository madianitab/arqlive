import { Component, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OsPanelComponent } from 'src/app/ui/panel/panel.component';
import { CicloCpuService } from 'src/app/features/assembly/services/ciclo-cpu.service';

@Component({
  selector: 'app-lateral-ciclo',
  templateUrl: './lateral-ciclo.component.html',
  styleUrls: ['../../../../../ui/styles/sim-config.css', './lateral-ciclo.component.css'],
  standalone: true,
  imports: [FormsModule, OsPanelComponent],
})
export class LateralCicloComponent {
  constructor(public sim: CicloCpuService) {}

  /** Linhas do código, separando o comentário para destacar. */
  readonly linhas = computed(() => this.sim.codigo().replace(/\n+$/, '').split('\n').map((t, i) => {
    const k = t.indexOf(';');
    return { n: i + 1, cod: k < 0 ? t : t.slice(0, k), com: k < 0 ? '' : t.slice(k) };
  }));

  exemplosDo(grupo: string) {
    return this.sim.exemplos.filter(e => e.grupo === grupo);
  }
}
