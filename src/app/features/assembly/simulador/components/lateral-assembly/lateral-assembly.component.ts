import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OsPanelComponent } from 'src/app/ui/panel/panel.component';
import { SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { DefInstrucao, INSTRUCOES, REGISTRADORES } from 'src/app/features/assembly/models/instrucoes';

@Component({
  selector: 'app-lateral-assembly',
  templateUrl: './lateral-assembly.component.html',
  styleUrls: ['../../../../../ui/styles/sim-config.css', './lateral-assembly.component.css'],
  standalone: true,
  imports: [FormsModule, OsPanelComponent],
})
export class LateralAssemblyComponent {
  readonly registradores = REGISTRADORES.join(', ');
  readonly grupos: { nome: string; itens: DefInstrucao[] }[] = [];

  constructor(public sim: SimuladorAssemblyService) {
    for (const d of INSTRUCOES) {
      let g = this.grupos.find(x => x.nome === d.grupo);
      if (!g) this.grupos.push(g = { nome: d.grupo, itens: [] });
      g.itens.push(d);
    }
  }
}
