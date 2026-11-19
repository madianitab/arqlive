import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Conferencia, EXERCICIOS, Exercicio, codigoInicial, conferirExercicio } from 'src/app/features/assembly/models/exercicios';
import { TabelaInstrucoesComponent } from 'src/app/features/assembly/components/tabela-instrucoes/tabela-instrucoes.component';
import { EditorAssemblyComponent } from 'src/app/features/assembly/simulador/components/editor-assembly/editor-assembly.component';

/**
 * Exercícios das Aulas 14 e 15: o aluno escreve o assembly (ou o C) e responde às perguntas;
 * a conferência executa a resposta dele e a do slide e compara o resultado.
 */
@Component({
  selector: 'app-exercicios-assembly',
  templateUrl: './exercicios-assembly.component.html',
  styleUrls: ['../../../executor/components/executor-assembly/executor-assembly.component.css', './exercicios-assembly.component.css'],
  standalone: true,
  imports: [FormsModule, EditorAssemblyComponent, TabelaInstrucoesComponent],
})
export class ExerciciosAssemblyComponent {
  readonly exercicios = EXERCICIOS;
  readonly indice = signal(0);
  /** Código do aluno em cada exercício (trocar de exercício não apaga). */
  private readonly codigos = signal<Record<string, string>>({});
  private readonly respostas = signal<Record<string, Record<string, string>>>({});
  private readonly conferencias = signal<Record<string, Conferencia>>({});
  readonly mostrarResposta = signal(false);
  readonly mostrarDica = signal(false);
  readonly feitos = signal<Set<string>>(new Set());

  readonly ex = computed<Exercicio>(() => this.exercicios[this.indice()]);
  readonly codigo = computed(() => this.codigos()[this.ex().id] ?? codigoInicial(this.ex()));
  readonly conferencia = computed<Conferencia | null>(() => this.conferencias()[this.ex().id] ?? null);
  readonly linhasErro = computed(() => (this.conferencia()?.erros ?? []).map(e => e.linha).filter(l => l > 0));
  readonly linguagemDada = computed(() => (this.ex().tipo === 'c-para-asm' ? 'c' : 'assembly'));
  readonly linguagemResposta = computed(() => (this.ex().tipo === 'asm-para-c' ? 'c' : 'assembly'));
  readonly grupos = computed(() => {
    const g = new Map<string, { i: number; e: Exercicio }[]>();
    this.exercicios.forEach((e, i) => {
      const aula = e.origem.split(' · ')[0];
      if (!g.has(aula)) g.set(aula, []);
      g.get(aula)!.push({ i, e });
    });
    return [...g.entries()].map(([aula, itens]) => ({ aula, itens }));
  });

  escolher(i: number | string): void {
    this.indice.set(Math.max(0, Math.min(this.exercicios.length - 1, +i)));
    this.mostrarResposta.set(false);
    this.mostrarDica.set(false);
  }

  editar(c: string): void {
    const id = this.ex().id;
    this.codigos.update(m => ({ ...m, [id]: c }));
    this.esquecerConferencia();
  }

  resposta(pergunta: string): string {
    return this.respostas()[this.ex().id]?.[pergunta] ?? '';
  }

  responder(pergunta: string, valor: string): void {
    const id = this.ex().id;
    this.respostas.update(m => ({ ...m, [id]: { ...(m[id] ?? {}), [pergunta]: valor } }));
    this.esquecerConferencia();
  }

  conferir(): void {
    const e = this.ex();
    const c = conferirExercicio(e, this.codigo(), this.respostas()[e.id] ?? {});
    this.conferencias.update(m => ({ ...m, [e.id]: c }));
    if (c.ok) this.feitos.update(s => new Set(s).add(e.id));
  }

  recomecar(): void {
    const id = this.ex().id;
    this.codigos.update(m => { const n = { ...m }; delete n[id]; return n; });
    this.respostas.update(m => { const n = { ...m }; delete n[id]; return n; });
    this.esquecerConferencia();
    this.mostrarResposta.set(false);
  }

  perguntaCerta(id: string): boolean | null {
    const c = this.conferencia();
    return c ? c.perguntas[id] ?? null : null;
  }

  acertos(c: Conferencia): number {
    return Object.values(c.perguntas).filter(Boolean).length;
  }

  private esquecerConferencia(): void {
    const id = this.ex().id;
    if (!this.conferencias()[id]) return;
    this.conferencias.update(m => { const n = { ...m }; delete n[id]; return n; });
  }
}
