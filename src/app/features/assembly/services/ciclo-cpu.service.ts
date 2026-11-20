import { Injectable, computed, signal } from '@angular/core';
import { MicroOp, agruparPorFase, celulasMemoria, cicloDoCodigo, registradoresUsados } from '../models/ciclo';
import { EXEMPLOS_CICLO, GRUPOS_CICLO } from '../models/exemplos-ciclo';

/** Como o passo avança: uma micro-operação ou uma fase inteira. */
export type ModoCiclo = 'micro' | 'fase';

/** Estado da tela do ciclo de instrução (uma instância por visita). */
@Injectable()
export class CicloCpuService {
  readonly exemplos = EXEMPLOS_CICLO;
  readonly grupos = GRUPOS_CICLO;
  readonly exemplo = signal(EXEMPLOS_CICLO[0].id);
  readonly modo = signal<ModoCiclo>('micro');
  readonly posicao = signal(0);
  readonly tocando = signal(false);
  readonly velocidade = signal(1);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly codigo = computed(() => this.exemplos.find(e => e.id === this.exemplo())?.codigo ?? '');
  readonly ciclo = computed(() => cicloDoCodigo(this.codigo()));
  readonly programa = computed(() => this.ciclo().programa);
  readonly registradores = computed(() => registradoresUsados(this.programa()));
  readonly celulas = computed(() => celulasMemoria(this.programa()));

  /** Passos visíveis no modo atual. */
  readonly passos = computed<MicroOp[]>(() => this.modo() === 'micro' ? this.ciclo().micros : agruparPorFase(this.ciclo().micros));
  readonly total = computed(() => this.passos().length);
  readonly atual = computed<MicroOp | null>(() => this.passos()[this.posicao()] ?? null);
  readonly terminou = computed(() => this.posicao() >= this.total() - 1);

  /** Posição, na lista de micro-operações, da última micro-operação já mostrada. */
  readonly indiceMicro = computed(() => {
    const a = this.atual();
    const micros = this.ciclo().micros;
    if (!a) return -1;
    if (this.modo() === 'micro') return this.posicao();
    let ult = -1;
    micros.forEach((m, i) => { if (m.ciclo === a.ciclo && m.fase === a.fase) ult = i; });
    return ult;
  });

  /** Registradores que já receberam valor até o passo atual (os outros aparecem vazios). */
  readonly regsComValor = computed(() => {
    const s = new Set<string>();
    this.ciclo().micros.slice(0, this.indiceMicro() + 1).forEach(m => m.mudou.forEach(k => s.add(k)));
    return s;
  });

  /** Quantas instruções a execução tem ao todo. */
  readonly totalInstrucoes = computed(() => Math.max(0, ...this.ciclo().micros.map(m => m.ciclo)));

  // ─── ações ───
  carregar(id: string): void {
    this.pausar();
    this.exemplo.set(id);
    this.posicao.set(0);
  }

  definirModo(m: ModoCiclo): void {
    const a = this.atual();
    this.modo.set(m);
    // mantém o ponto da execução: mesma instrução e mesma fase
    const i = a ? this.passos().findIndex(p => p.ciclo === a.ciclo && p.fase === a.fase) : 0;
    this.posicao.set(Math.max(0, i));
  }

  irPara(i: number): void {
    this.pausar();
    this.posicao.set(Math.max(0, Math.min(i, this.total() - 1)));
  }

  avancar(d: number): void {
    this.irPara(this.posicao() + d);
  }

  reiniciar(): void {
    this.irPara(0);
  }

  /** Vai para o início da busca da próxima instrução. */
  proximaInstrucao(): void {
    const a = this.atual();
    const ciclo = a?.ciclo ?? 0;
    const i = this.passos().findIndex((p, k) => k > this.posicao() && p.ciclo > ciclo);
    this.irPara(i < 0 ? this.total() - 1 : i);
  }

  tocar(): void {
    if (!this.total()) return;
    if (this.terminou()) this.posicao.set(0);
    this.tocando.set(true);
    this.agendar();
  }

  pausar(): void {
    this.tocando.set(false);
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  alternar(): void {
    this.tocando() ? this.pausar() : this.tocar();
  }

  private agendar(): void {
    const ms = (this.modo() === 'fase' ? 2000 : 1300) / this.velocidade();
    this.timer = setTimeout(() => {
      if (!this.tocando()) return;
      if (this.terminou()) { this.pausar(); return; }
      this.posicao.update(i => i + 1);
      this.agendar();
    }, ms);
  }
}
