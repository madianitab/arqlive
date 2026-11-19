import { Component, computed } from '@angular/core';
import { OsSimPlayerComponent } from 'src/app/ui/sim-player/sim-player.component';
import { CicloCpuService } from 'src/app/features/assembly/services/ciclo-cpu.service';
import { Componente, Fluxo, MicroOp } from 'src/app/features/assembly/models/ciclo';
import { Valor, textoValor } from 'src/app/features/assembly/models/assembly';
import { Registrador } from 'src/app/features/assembly/models/instrucoes';

interface Caixa { x: number; y: number; w: number; h: number; }

/** Posições fixas do diagrama (viewBox 900 de largura). */
const CAIXAS: Record<'PC' | 'IR' | 'MAR' | 'MDR' | 'UC' | 'ULA' | 'FLAGS', Caixa> = {
  PC: { x: 30, y: 50, w: 130, h: 54 },
  MAR: { x: 400, y: 50, w: 170, h: 54 },
  IR: { x: 30, y: 140, w: 230, h: 54 },
  MDR: { x: 400, y: 140, w: 170, h: 54 },
  UC: { x: 30, y: 230, w: 230, h: 64 },
  ULA: { x: 30, y: 330, w: 230, h: 64 },
  FLAGS: { x: 30, y: 414, w: 230, h: 44 },
};
const REG_Y = 240;
const REG_PASSO = 44;
const MEM_X = 640;
const MEM_Y = 50;
const MEM_PASSO = 28;

const FASES: Record<string, string> = {
  carga: 'Programa na memória',
  busca: 'Busca',
  decodificacao: 'Decodificação',
  execucao: 'Execução',
  fim: 'Fim',
  erro: 'Erro',
};

/** Explicação de cada fase (modo "uma fase por passo"). */
const RESUMO_FASE: Record<string, string> = {
  busca: 'A instrução apontada pelo PC sai da memória e vai para o IR; o PC avança.',
  decodificacao: 'A unidade de controle lê o IR e descobre o que fazer e com quais operandos.',
  execucao: 'A instrução é realizada: memória, registradores, ULA ou desvio.',
};

@Component({
  selector: 'app-area-ciclo',
  templateUrl: './area-ciclo.component.html',
  styleUrls: ['../../../../../ui/styles/sim-viz.css', './area-ciclo.component.css'],
  standalone: true,
  imports: [OsSimPlayerComponent],
})
export class AreaCicloComponent {
  readonly cx = CAIXAS;
  readonly nomesFase = FASES;
  readonly resumoFase = RESUMO_FASE;
  readonly memX = MEM_X;

  constructor(public sim: CicloCpuService) {}

  readonly regs = computed(() => this.sim.registradores().map((r, i) => ({ r, y: REG_Y + i * REG_PASSO })));

  readonly linhasMem = computed(() => this.sim.celulas().map((c, i) => ({ ...c, y: MEM_Y + i * MEM_PASSO })));

  readonly altura = computed(() => {
    const cpu = Math.max(CAIXAS.FLAGS.y + CAIXAS.FLAGS.h, REG_Y + this.regs().length * REG_PASSO) + 20;
    const mem = MEM_Y + this.linhasMem().length * MEM_PASSO + 10;
    return Math.max(cpu, mem);
  });

  /** Caminhos das setas da micro-operação atual. */
  readonly setas = computed(() => {
    const a = this.sim.atual();
    if (!a) return [];
    return a.fluxos.map(f => this.caminho(f, a)).filter((d): d is string => !!d);
  });

  /** Última micro-operação da execução: o ciclo vai recomeçar. */
  voltaAtiva(): boolean {
    const a = this.sim.atual();
    const exec = this.sim.fasesDaInstrucao().execucao;
    return a?.fase === 'execucao' && !!exec.length && this.sim.estadoMicro(exec[exec.length - 1]) === 'atual';
  }

  ativo(c: Componente): boolean {
    return !!this.sim.atual()?.ativos.includes(c);
  }

  mudou(k: string): boolean {
    return !!this.sim.atual()?.mudou.includes(k);
  }

  valor(v: Valor | undefined): string {
    return v === null || v === undefined || v === '' ? '—' : typeof v === 'string' ? v : String(v);
  }

  valorMem(end: number): string {
    const a = this.sim.atual();
    const p = this.sim.programa();
    if (end < p.inicioDados) return p.instrucoes[end]?.texto ?? '';
    return a ? textoValor(a.estado.dados[end - p.inicioDados] ?? null) : '';
  }

  valorReg(r: Registrador): string {
    const a = this.sim.atual();
    if (!a || !this.sim.regsComValor().has(r)) return 'vazio';
    return String(a.estado.regs[r]);
  }

  /** Texto da caixa da UC. */
  textoUc(a: MicroOp): string {
    const op = a.instrucao.split(' ')[0];
    switch (a.fase) {
      case 'busca': return 'busca a instrução';
      case 'decodificacao': return `decodifica: ${op}`;
      case 'execucao': return `executa: ${op}`;
      case 'fim': return 'parada';
      case 'erro': return 'erro';
      default: return 'pronta';
    }
  }

  private yReg(r: Componente): number {
    return (this.regs().find(x => x.r === r)?.y ?? REG_Y) + 18;
  }

  private yMem(a: MicroOp): number {
    const end = a.memoria?.end ?? 0;
    return (this.linhasMem().find(l => l.end === end)?.y ?? MEM_Y) + 13;
  }

  private caminho(f: Fluxo, a: MicroOp): string | null {
    const reg = (c: Componente) => /^R[0-7]$/.test(c);
    const idx = (c: Componente) => Math.max(0, this.regs().findIndex(x => x.r === c));
    const k = `${f.de}>${f.para}`;
    switch (k) {
      case 'PC>MAR': return 'M160 77 H400';
      case 'MDR>IR': return 'M400 167 H260';
      case 'IR>UC': return 'M145 194 V230';
      case 'IR>PC': return 'M95 140 V104';
      case 'IR>MAR': return 'M260 152 H330 V90 H400';
      case 'IR>ULA': return 'M260 184 H285 V350 H260';
      case 'ULA>FLAGS': return 'M145 394 V414';
      case 'FLAGS>UC': return 'M30 436 H18 V262 H30';
      case 'MAR>MEM': return `M570 72 H605 V${this.yMem(a) - 5} H${MEM_X}`;
      case 'MEM>MDR': return `M${MEM_X} ${this.yMem(a) + 5} H620 V172 H570`;
      case 'MDR>MEM': return `M570 172 H620 V${this.yMem(a) + 5} H${MEM_X}`;
    }
    if (f.de === 'MDR' && reg(f.para)) return `M570 186 H585 V${this.yReg(f.para)} H570`;
    if (reg(f.de) && f.para === 'MDR') return `M570 ${this.yReg(f.de)} H585 V186 H570`;
    if (reg(f.de) && f.para === 'ULA') return `M400 ${this.yReg(f.de)} H${310 - idx(f.de) * 12} V${346 + idx(f.de) * 14} H260`;
    if (f.de === 'ULA' && reg(f.para)) return `M260 380 H${350 + idx(f.para) * 8} V${this.yReg(f.para)} H400`;
    if (f.de === 'IR' && reg(f.para)) return `M260 176 H372 V${this.yReg(f.para)} H400`;
    if (reg(f.de) && reg(f.para)) return `M570 ${this.yReg(f.de)} H582 V${this.yReg(f.para)} H570`;
    return null;
  }
}
