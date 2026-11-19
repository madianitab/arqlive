import { Component, computed } from '@angular/core';
import { OsButtonGroupComponent } from 'src/app/ui/button-group/button-group.component';
import { LIMITE_EXERCICIO, LIMITE_RASTREAMENTO, SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { ColunaRastreamento, LinhaRastreamento } from 'src/app/features/assembly/models/rastreamento';

/**
 * Tabela de rastreamento: uma linha por instrução.
 * "Acompanhar" preenche a tabela junto com a execução; "Exercício" deixa o aluno preencher e conferir.
 */
@Component({
  selector: 'app-rastreamento-assembly',
  templateUrl: './rastreamento-assembly.component.html',
  styleUrls: ['../../../../../ui/styles/sim-viz.css', './rastreamento-assembly.component.css'],
  standalone: true,
  imports: [OsButtonGroupComponent],
})
export class RastreamentoAssemblyComponent {
  readonly limiteExercicio = LIMITE_EXERCICIO;

  readonly rast = computed(() => this.sim.rastreamento());
  readonly exercicio = computed(() => this.sim.modoRastreamento() === 'exercicio');

  /** No modo acompanhar, só as instruções já executadas até o passo atual. */
  readonly linhas = computed<LinhaRastreamento[]>(() => {
    if (this.exercicio()) return this.sim.linhasExercicio();
    return this.rast().linhas.slice(0, Math.min(this.sim.instrucoesExecutadas(), LIMITE_RASTREAMENTO));
  });
  readonly cortada = computed(() => {
    const total = this.rast().linhas.length;
    return this.exercicio() ? total > LIMITE_EXERCICIO : this.sim.instrucoesExecutadas() > LIMITE_RASTREAMENTO;
  });
  /** Instrução em andamento (destacada no modo acompanhar). */
  readonly cicloAtual = computed(() => this.sim.passo()?.ciclo ?? 0);

  constructor(public sim: SimuladorAssemblyService) {}

  estado(l: LinhaRastreamento, c: ColunaRastreamento): 'ok' | 'err' | null {
    if (!this.sim.conferido()) return null;
    return this.sim.celulaCerta(l.ciclo, c.id) ? 'ok' : 'err';
  }

  digitar(l: LinhaRastreamento, c: ColunaRastreamento, ev: Event): void {
    this.sim.responder(l.ciclo, c.id, (ev.target as HTMLInputElement | HTMLSelectElement).value);
  }

  mostrar(v: string): string {
    return v === '' ? 'vazio' : v;
  }
}
