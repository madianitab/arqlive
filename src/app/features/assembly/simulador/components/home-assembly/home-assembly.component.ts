import { Component, OnDestroy, ViewChild, effect, untracked } from '@angular/core';
import { OsSimShellComponent } from 'src/app/ui/sim-shell/sim-shell.component';
import { OsButtonGroupComponent } from 'src/app/ui/button-group/button-group.component';
import { SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { LateralAssemblyComponent } from '../lateral-assembly/lateral-assembly.component';
import { AreaAssemblyComponent } from '../area-assembly/area-assembly.component';
import { TabelaInstrucoesComponent } from 'src/app/features/assembly/components/tabela-instrucoes/tabela-instrucoes.component';

@Component({
  selector: 'app-home-assembly',
  templateUrl: './home-assembly.component.html',
  standalone: true,
  imports: [OsSimShellComponent, OsButtonGroupComponent, LateralAssemblyComponent, AreaAssemblyComponent, TabelaInstrucoesComponent],
  providers: [SimuladorAssemblyService],
})
export class HomeAssemblyComponent implements OnDestroy {
  @ViewChild(TabelaInstrucoesComponent) tabela?: TabelaInstrucoesComponent;

  constructor(public sim: SimuladorAssemblyService) {
    // a lateral também pode pedir a tabela de instruções
    effect(() => {
      if (this.sim.pedidoTabela() > 0) untracked(() => this.tabela?.abrir());
    });
  }
  ngOnDestroy(): void { this.sim.pausar(); }
}
