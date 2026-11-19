import { Component, HostListener, OnDestroy } from '@angular/core';
import { OsSimShellComponent } from 'src/app/ui/sim-shell/sim-shell.component';
import { OsButtonGroupComponent } from 'src/app/ui/button-group/button-group.component';
import { CicloCpuService } from 'src/app/features/assembly/services/ciclo-cpu.service';
import { LateralCicloComponent } from '../lateral-ciclo/lateral-ciclo.component';
import { AreaCicloComponent } from '../area-ciclo/area-ciclo.component';

@Component({
  selector: 'app-home-ciclo',
  standalone: true,
  imports: [OsSimShellComponent, OsButtonGroupComponent, LateralCicloComponent, AreaCicloComponent],
  providers: [CicloCpuService],
  templateUrl: './home-ciclo.component.html',
})
export class HomeCicloComponent implements OnDestroy {
  constructor(public sim: CicloCpuService) {}

  /** Teclado para o projetor: ← → passo, espaço reproduz, ↓ próxima instrução. */
  @HostListener('document:keydown', ['$event'])
  tecla(e: KeyboardEvent): void {
    const alvo = e.target as HTMLElement | null;
    if (alvo && /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(alvo.tagName)) return;
    if (e.key === 'ArrowRight') this.sim.avancar(1);
    else if (e.key === 'ArrowLeft') this.sim.avancar(-1);
    else if (e.key === 'ArrowDown') this.sim.proximaInstrucao();
    else if (e.key === ' ') this.sim.alternar();
    else return;
    e.preventDefault();
  }

  ngOnDestroy(): void { this.sim.pausar(); }
}
