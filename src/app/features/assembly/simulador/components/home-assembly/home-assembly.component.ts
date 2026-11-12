import { Component, OnDestroy } from '@angular/core';
import { OsSimShellComponent } from 'src/app/ui/sim-shell/sim-shell.component';
import { OsButtonGroupComponent } from 'src/app/ui/button-group/button-group.component';
import { SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { LateralAssemblyComponent } from '../lateral-assembly/lateral-assembly.component';
import { AreaAssemblyComponent } from '../area-assembly/area-assembly.component';

@Component({
  selector: 'app-home-assembly',
  templateUrl: './home-assembly.component.html',
  standalone: true,
  imports: [OsSimShellComponent, OsButtonGroupComponent, LateralAssemblyComponent, AreaAssemblyComponent],
  providers: [SimuladorAssemblyService],
})
export class HomeAssemblyComponent implements OnDestroy {
  constructor(public sim: SimuladorAssemblyService) {}
  ngOnDestroy(): void { this.sim.pausar(); }
}
