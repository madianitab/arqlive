import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { OsPanelComponent } from 'src/app/ui/panel/panel.component';
import { SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { DefInstrucao, INSTRUCOES, PORTAS_ENTRADA } from 'src/app/features/assembly/models/instrucoes';

@Component({
  selector: 'app-lateral-assembly',
  templateUrl: './lateral-assembly.component.html',
  styleUrls: ['../../../../../ui/styles/sim-config.css', './lateral-assembly.component.css'],
  standalone: true,
  imports: [FormsModule, OsPanelComponent],
})
export class LateralAssemblyComponent {
  readonly grupos: { nome: string; itens: DefInstrucao[] }[] = [];

  constructor(public sim: SimuladorAssemblyService) {
    for (const d of INSTRUCOES) {
      let g = this.grupos.find(x => x.nome === d.grupo);
      if (!g) this.grupos.push(g = { nome: d.grupo, itens: [] });
      g.itens.push(d);
    }
  }

  /** Porta analógica (0 a 1023) ou digital (0/1). */
  analogica(nome: string): boolean {
    return (PORTAS_ENTRADA.find(p => p.nome === nome)?.max ?? 1) > 1;
  }

  rotulo(nome: string): string {
    return /^\d+$/.test(nome) ? `Pino ${nome}` : nome === 'BOTAO' ? 'BOTAO' : `${nome} (sensor)`;
  }
}
