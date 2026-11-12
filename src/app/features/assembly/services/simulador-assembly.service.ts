import { Injectable, computed, signal } from '@angular/core';
import { Execucao, Passo, simular } from '../models/assembly';
import { PORTAS_ENTRADA } from '../models/instrucoes';
import { EXEMPLOS_ASSEMBLY } from '../models/exemplos';

/** Como o botão de passo avança. */
export type ModoPasso = 'ciclo' | 'instrucao';

const MODELO_VAZIO = '; valores na memória\nX: 5\n\n; código\nLOAD R1, X\n\nHALT\n';

/** Estado da tela do simulador de assembly (uma instância por visita). */
@Injectable()
export class SimuladorAssemblyService {
  readonly exemplos = EXEMPLOS_ASSEMBLY;
  readonly exemplo = signal(EXEMPLOS_ASSEMBLY[0].id);
  readonly codigo = signal(EXEMPLOS_ASSEMBLY[0].codigo);
  /** Valores das portas de entrada (BOTAO, A0…, ou o número do pino). */
  readonly entradas = signal<Record<string, number>>({ ...(EXEMPLOS_ASSEMBLY[0].entradas ?? {}) });
  readonly modo = signal<ModoPasso>('ciclo');
  readonly execucao = signal<Execucao>(this.rodar());
  /** O código ou a entrada mudaram depois da última execução. */
  readonly alterado = signal(false);
  /** Posição na lista de passos visíveis. */
  readonly posicao = signal(0);
  readonly tocando = signal(false);
  readonly velocidade = signal(1);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly programa = computed(() => this.execucao().programa);
  readonly erros = computed(() => this.programa().erros);

  /** Índices dos passos mostrados no modo atual (no modo "instrução", só o fim de cada instrução). */
  readonly visiveis = computed(() => {
    const passos = this.execucao().passos;
    const idx = passos.map((_, i) => i);
    return this.modo() === 'ciclo' ? idx : idx.filter(i => passos[i].fase !== 'busca' && passos[i].fase !== 'decodificacao');
  });
  readonly total = computed(() => this.visiveis().length);
  readonly passo = computed<Passo | null>(() => this.execucao().passos[this.visiveis()[this.posicao()]] ?? null);
  /** Instruções executadas até o passo atual. */
  readonly instrucoesExecutadas = computed(() => {
    const p = this.passo();
    if (!p) return 0;
    return p.fase === 'busca' || p.fase === 'decodificacao' ? p.ciclo - 1 : p.ciclo;
  });
  readonly terminou = computed(() => this.posicao() >= this.total() - 1);

  // ─── ações ───
  executar(): void {
    this.pausar();
    this.execucao.set(this.rodar());
    this.alterado.set(false);
    this.posicao.set(0);
    if (!this.erros().length) this.tocar();
  }

  /** Monta de novo e mostra direto o resultado final. */
  irAoFim(): void {
    if (this.alterado()) {
      this.execucao.set(this.rodar());
      this.alterado.set(false);
    }
    this.irPara(this.total() - 1);
  }

  reiniciar(): void {
    this.irPara(0);
  }

  editar(codigo: string): void {
    this.codigo.set(codigo);
    this.exemplo.set('');
    this.alterado.set(true);
  }

  /** Muda o valor de uma porta de entrada e executa de novo, mantendo o ponto da execução. */
  definirEntrada(nome: string, valor: number): void {
    const def = PORTAS_ENTRADA.find(p => p.nome === nome);
    const max = def ? def.max : 1;
    const v = Math.max(0, Math.min(max, Math.round(Number(valor) || 0)));
    this.entradas.update(e => ({ ...e, [nome]: v }));
    if (this.alterado()) return;
    const pos = this.posicao();
    this.pausar();
    this.execucao.set(this.rodar());
    this.posicao.set(Math.min(pos, this.total() - 1));
  }

  valorEntrada(nome: string): number {
    return this.entradas()[nome] ?? 0;
  }

  carregarExemplo(id: string): void {
    const ex = this.exemplos.find(e => e.id === id);
    if (!ex) return;
    this.pausar();
    this.exemplo.set(id);
    this.codigo.set(ex.codigo);
    this.entradas.set({ ...(ex.entradas ?? {}) });
    this.execucao.set(this.rodar());
    this.alterado.set(false);
    this.posicao.set(0);
  }

  limpar(): void {
    this.pausar();
    this.exemplo.set('');
    this.codigo.set(MODELO_VAZIO);
    this.entradas.set({});
    this.execucao.set(this.rodar());
    this.alterado.set(true);
    this.posicao.set(0);
  }

  definirModo(m: ModoPasso): void {
    const atual = this.visiveis()[this.posicao()] ?? 0;
    this.modo.set(m);
    // mantém o ponto da execução: vai para o passo visível mais próximo (sem passar do atual)
    const vis = this.visiveis();
    let pos = 0;
    vis.forEach((v, i) => { if (v <= atual) pos = i; });
    this.posicao.set(pos);
  }

  // ─── reprodução passo a passo ───
  irPara(i: number): void {
    this.pausar();
    this.posicao.set(Math.max(0, Math.min(i, this.total() - 1)));
  }

  avancar(d: number): void {
    this.irPara(this.posicao() + d);
  }

  tocar(): void {
    if (this.total() === 0) return;
    if (this.terminou()) this.posicao.set(0);
    this.tocando.set(true);
    this.agendar();
  }

  pausar(): void {
    this.tocando.set(false);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private agendar(): void {
    this.timer = setTimeout(() => {
      if (!this.tocando()) return;
      if (this.terminou()) { this.pausar(); return; }
      this.posicao.update(i => i + 1);
      this.agendar();
    }, 1100 / this.velocidade());
  }

  private rodar(): Execucao {
    return simular(this.codigo(), this.entradas());
  }
}
