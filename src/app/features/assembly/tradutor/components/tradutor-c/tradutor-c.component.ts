import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Valor, simular, textoValor } from 'src/app/features/assembly/models/assembly';
import { traduzirParaAssembly } from 'src/app/features/assembly/models/c-assembly';
import { EXEMPLOS_C } from 'src/app/features/assembly/models/exemplos-c';
import { PINO_LED, PORTAS_ENTRADA } from 'src/app/features/assembly/models/instrucoes';
import { TabelaInstrucoesComponent } from 'src/app/features/assembly/components/tabela-instrucoes/tabela-instrucoes.component';
import { EditorAssemblyComponent } from 'src/app/features/assembly/simulador/components/editor-assembly/editor-assembly.component';

const INICIAL = `// escreva em C (PC ou Arduino): o assembly aparece ao lado

main(){
  int X = 5;
  X = X + 2;
  printf("X = %d", X);
}
`;

/** Tradutor C → Assembly simplificado: escreve em C e vê o assembly das aulas (e o resultado). */
@Component({
  selector: 'app-tradutor-c',
  templateUrl: './tradutor-c.component.html',
  styleUrls: ['../../../executor/components/executor-assembly/executor-assembly.component.css', './tradutor-c.component.css'],
  standalone: true,
  imports: [FormsModule, EditorAssemblyComponent, TabelaInstrucoesComponent],
})
export class TradutorCComponent {
  private readonly router = inject(Router);

  readonly exemplos = EXEMPLOS_C;
  readonly exemplo = signal('');
  readonly codigo = signal(INICIAL);
  readonly comentarios = signal(true);
  readonly entradas = signal<Record<string, number>>({});
  readonly copiado = signal(false);

  /** A tradução é refeita a cada alteração do código. */
  readonly traducao = computed(() => traduzirParaAssembly(this.codigo(), { comentarios: this.comentarios() }));
  readonly erros = computed(() => this.traducao().erros);
  readonly avisos = computed(() => this.traducao().avisos);
  readonly linhasErro = computed(() => this.erros().map(e => e.linha).filter(l => l > 0));
  readonly assembly = computed(() => this.traducao().codigo);

  /** O assembly gerado é executado no simulador, para conferir o resultado. */
  readonly execucao = computed(() => (this.assembly() ? simular(this.assembly(), this.entradas()) : null));
  readonly errosMontagem = computed(() => this.execucao()?.programa.erros ?? []);
  readonly entradasUsadas = computed(() => this.execucao()?.programa.entradasUsadas ?? []);
  readonly numInstrucoes = computed(() => this.execucao()?.programa.instrucoes.length ?? 0);
  readonly final = computed(() => {
    const r = this.execucao();
    return r && r.passos.length ? r.passos[r.passos.length - 1] : null;
  });
  readonly executadas = computed(() => this.final()?.ciclo ?? 0);
  readonly saida = computed(() => this.final()?.saida ?? '');
  readonly memoria = computed(() => {
    const r = this.execucao();
    const f = this.final();
    if (!r || !f) return [];
    return r.programa.variaveis
      .filter(v => typeof v.valores[0] !== 'string')
      .map(v => {
        const vals: Valor[] = v.valores.map((_, k) => f.dados[v.end + k - r.programa.inicioDados]);
        return { nome: v.nome, valor: vals.length > 1 ? `{${vals.map(textoValor).join(', ')}}` : textoValor(vals[0]), vazio: vals.every(x => x === null) };
      });
  });
  readonly pinos = computed(() => {
    const f = this.final();
    if (!f) return [];
    return Object.entries(f.pinos).map(([p, v]) => ({ nome: +p === PINO_LED ? 'LED' : `Pino ${p}`, ligado: v !== 0 }));
  });

  editar(c: string): void {
    this.codigo.set(c);
    this.exemplo.set('');
  }

  carregarExemplo(id: string): void {
    const ex = this.exemplos.find(e => e.id === id);
    if (!ex) return;
    this.exemplo.set(id);
    this.codigo.set(ex.codigo);
    this.entradas.set({ ...(ex.entradas ?? {}) });
  }

  limpar(): void {
    this.exemplo.set('');
    this.codigo.set('');
    this.entradas.set({});
  }

  alternarComentarios(): void {
    this.comentarios.update(v => !v);
  }

  analogica(nome: string): boolean {
    return (PORTAS_ENTRADA.find(p => p.nome === nome)?.max ?? 1) > 1;
  }

  valorEntrada(nome: string): number {
    return this.entradas()[nome] ?? 0;
  }

  definirEntrada(nome: string, valor: number): void {
    const max = this.analogica(nome) ? 1023 : 1;
    const v = Math.max(0, Math.min(max, Math.round(Number(valor) || 0)));
    this.entradas.update(e => ({ ...e, [nome]: v }));
  }

  copiarAssembly(): void {
    navigator.clipboard?.writeText(this.assembly()).then(() => {
      this.copiado.set(true);
      setTimeout(() => this.copiado.set(false), 1500);
    }).catch(() => undefined);
  }

  /** Leva o assembly para o Executor Assembly (que mostra também o C++ equivalente). */
  abrirNoExecutor(): void {
    if (!this.assembly()) return;
    this.router.navigate(['/assembly/executor'], { state: { codigo: this.assembly(), entradas: this.entradas() } });
  }
}
