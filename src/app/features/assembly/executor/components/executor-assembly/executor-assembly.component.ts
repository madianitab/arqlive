import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Execucao, Valor, montar, simular, textoValor } from 'src/app/features/assembly/models/assembly';
import { gerarCpp, ehArduino } from 'src/app/features/assembly/models/cpp';
import { EXEMPLOS_ASSEMBLY } from 'src/app/features/assembly/models/exemplos';
import { PINO_LED, PORTAS_ENTRADA } from 'src/app/features/assembly/models/instrucoes';
import { EditorAssemblyComponent } from 'src/app/features/assembly/simulador/components/editor-assembly/editor-assembly.component';

const INICIAL = `; escreva o programa e clique em Executar (Ctrl + Enter)

X: 5
D

LOAD R1, X
ADD R1, 2
STORE D, R1
OUT TELA, R1
HALT
`;

/** Tela limpa para escrever o código, executar e ver o resultado (sem passo a passo). */
@Component({
  selector: 'app-executor-assembly',
  templateUrl: './executor-assembly.component.html',
  styleUrls: ['./executor-assembly.component.css'],
  standalone: true,
  imports: [FormsModule, EditorAssemblyComponent],
})
export class ExecutorAssemblyComponent {
  readonly exemplos = EXEMPLOS_ASSEMBLY;
  readonly exemplo = signal('');
  readonly codigo = signal(INICIAL);
  readonly entradas = signal<Record<string, number>>({});
  readonly resultado = signal<Execucao | null>(null);
  /** O código mudou depois da última execução. */
  readonly alterado = signal(false);

  /** Portas lidas pelo programa (montado na hora, para pedir os valores antes de executar). */
  readonly entradasUsadas = computed(() => montar(this.codigo()).entradasUsadas);

  readonly erros = computed(() => this.resultado()?.programa.erros ?? []);
  readonly linhasErro = computed(() => {
    const r = this.resultado();
    if (!r) return [];
    const l = r.programa.erros.map(e => e.linha);
    if (r.erro?.linha) l.push(r.erro.linha);
    return l;
  });
  readonly final = computed(() => {
    const r = this.resultado();
    return r && r.passos.length ? r.passos[r.passos.length - 1] : null;
  });
  readonly instrucoesExecutadas = computed(() => this.final()?.ciclo ?? 0);
  readonly saida = computed(() => this.final()?.saida ?? '');
  readonly memoria = computed(() => {
    const r = this.resultado();
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
  readonly cpp = computed(() => {
    const r = this.resultado();
    return r ? gerarCpp(r.programa) : '';
  });
  readonly arduino = computed(() => {
    const r = this.resultado();
    return r ? ehArduino(r.programa) : false;
  });

  executar(): void {
    this.resultado.set(simular(this.codigo(), this.entradas()));
    this.alterado.set(false);
  }

  editar(c: string): void {
    this.codigo.set(c);
    this.exemplo.set('');
    this.alterado.set(true);
  }

  carregarExemplo(id: string): void {
    const ex = this.exemplos.find(e => e.id === id);
    if (!ex) return;
    this.exemplo.set(id);
    this.codigo.set(ex.codigo);
    this.entradas.set({ ...(ex.entradas ?? {}) });
    this.resultado.set(null);
    this.alterado.set(false);
  }

  limpar(): void {
    this.exemplo.set('');
    this.codigo.set('');
    this.entradas.set({});
    this.resultado.set(null);
    this.alterado.set(false);
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

  copiarCpp(): void {
    navigator.clipboard?.writeText(this.cpp()).catch(() => undefined);
  }
}
