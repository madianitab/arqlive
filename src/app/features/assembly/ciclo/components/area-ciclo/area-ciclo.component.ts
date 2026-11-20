import { Component, ElementRef, OnDestroy, computed, signal } from '@angular/core';
import { OsSimPlayerComponent } from 'src/app/ui/sim-player/sim-player.component';
import { CicloCpuService } from 'src/app/features/assembly/services/ciclo-cpu.service';
import { Componente, EtapaFluxo, Fluxo, MicroOp, caminhoFluxo } from 'src/app/features/assembly/models/ciclo';
import { Valor, textoValor } from 'src/app/features/assembly/models/assembly';
import { Registrador } from 'src/app/features/assembly/models/instrucoes';

// ─────────────────────────── fluxograma (viewBox 520 × 476) ───────────────────────────

interface NoFluxo {
  id: EtapaFluxo;
  forma: 'caixa' | 'losango';
  x: number; y: number; w: number; h: number;
  linhas: string[];
  /** Fase do ciclo (cor). */
  fase: 'busca' | 'decodificacao' | 'execucao';
}

const CX = 222;   // centro da coluna principal
const NOS: NoFluxo[] = [
  { id: 'buscar', forma: 'caixa', x: 112, y: 24, w: 220, h: 44, linhas: ['Buscar a próxima instrução'], fase: 'busca' },
  { id: 'incrementar', forma: 'caixa', x: 112, y: 90, w: 220, h: 44, linhas: ['Incrementar o PC'], fase: 'busca' },
  { id: 'decodificar', forma: 'caixa', x: 112, y: 156, w: 220, h: 44, linhas: ['Decodificar o código da operação'], fase: 'decodificacao' },
  { id: 'decisao', forma: 'losango', x: 122, y: 224, w: 200, h: 76, linhas: ['Tem operando?'], fase: 'execucao' },
  { id: 'endereco', forma: 'caixa', x: 352, y: 236, w: 150, h: 52, linhas: ['Cálculo do endereço', 'do operando'], fase: 'execucao' },
  { id: 'buscarOperando', forma: 'caixa', x: 352, y: 312, w: 150, h: 52, linhas: ['Buscar e armazenar', 'operando'], fase: 'execucao' },
  { id: 'executar', forma: 'caixa', x: 112, y: 336, w: 220, h: 44, linhas: ['Executar a operação'], fase: 'execucao' },
  { id: 'escrever', forma: 'caixa', x: 112, y: 402, w: 220, h: 44, linhas: ['Escrever o resultado'], fase: 'execucao' },
];

/** Desenho de cada ligação do fluxograma. */
const LIGACOES: Record<string, string> = {
  'buscar>incrementar': `M${CX} 68 V90`,
  'incrementar>decodificar': `M${CX} 134 V156`,
  'decodificar>decisao': `M${CX} 200 V224`,
  'decisao>endereco': 'M322 262 H352',
  'endereco>buscarOperando': 'M427 288 V312',
  'buscarOperando>decisao': `M502 338 H512 V212 H${CX + 6}`,
  'decisao>executar': `M${CX} 300 V336`,
  'executar>escrever': `M${CX} 380 V402`,
  'escrever>buscar': `M${CX} 446 V466 H6 V10 H${CX} V24`,
};

/** Chaves "[" com o nome da fase, à esquerda dos blocos. */
const GRUPOS = [
  { nome: 'Busca', fase: 'busca', y1: 24, y2: 134 },
  { nome: 'Decodificação', fase: 'decodificacao', y1: 156, y2: 200 },
  { nome: 'Execução', fase: 'execucao', y1: 224, y2: 446 },
];

// ─────────────────────────── CPU e memória ───────────────────────────
// Largo (viewBox 680): registradores/ULA | barramento | MDR…IR | memória e UC.
// Compacto (viewBox 412, celular): a memória vai para baixo da CPU e a UC fica ao lado do decodificador.

interface Caixa { x: number; y: number; w: number; h: number; }

const COL_A = 16;     // registradores, ULA e flags
const COL_B = 218;    // MDR, MAR, PC, IR e decodificador
const COL_C = 404;    // memória e unidade de controle
const BARRA = 202;    // barramento interno
const LARG = 170;
const ALT = 60;
const LINHA_MEM = 24;
// no compacto, os caminhos até a memória descem pela direita da CPU
const LANE_MAR_C = 400;
const LANE_MDR_C = 406;

const NOMES: Record<string, string> = {
  MDR: 'MDR (RDM)', MAR: 'MAR (REM)', PC: 'PC (CI)', IR: 'IR (RI)', ULA: 'ULA (UAL)', FLAGS: 'Flags',
  DEC: 'Decodificador', UC: 'Unidade de controle',
};

const FASES: Record<string, string> = {
  carga: 'Programa na memória', busca: 'Busca', decodificacao: 'Decodificação', execucao: 'Execução', fim: 'Fim', erro: 'Erro',
};

@Component({
  selector: 'app-area-ciclo',
  templateUrl: './area-ciclo.component.html',
  styleUrls: ['../../../../../ui/styles/sim-viz.css', './area-ciclo.component.css'],
  standalone: true,
  imports: [OsSimPlayerComponent],
})
export class AreaCicloComponent implements OnDestroy {
  readonly nos = NOS;
  readonly ligacoes = Object.entries(LIGACOES).map(([id, d]) => ({ id, d }));
  readonly grupos = GRUPOS;
  readonly nomes = NOMES;
  readonly nomesFase = FASES;
  readonly cx = CX;
  readonly caixasFixas = ['MDR', 'MAR', 'PC', 'IR', 'DEC', 'UC', 'ULA', 'FLAGS'];

  /** Área estreita (celular): CPU e memória em layout compacto. */
  readonly compacto = signal(false);
  private observador?: ResizeObserver;

  constructor(public sim: CicloCpuService, host: ElementRef<HTMLElement>) {
    if (typeof ResizeObserver !== 'undefined') {
      this.observador = new ResizeObserver(([e]) => { if (e.contentRect.width > 0) this.compacto.set(e.contentRect.width < 620); });
      this.observador.observe(host.nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observador?.disconnect();
  }

  // ─── fluxograma ───

  /** Índices (na lista de micro-operações) do passo atual: um só, ou a fase inteira. */
  private readonly faixaAtual = computed(() => {
    const a = this.sim.atual();
    const fim = this.sim.indiceMicro();
    if (!a || fim < 0) return { ini: 0, fim: -1 };
    const micros = this.sim.ciclo().micros;
    const ini = this.sim.modo() === 'micro' ? fim : micros.findIndex(m => m.ciclo === a.ciclo && m.fase === a.fase);
    return { ini, fim };
  });

  /** Caixas e ligações já percorridas na instrução, e as do passo atual (animadas). */
  readonly trilha = computed(() => {
    const micros = this.sim.ciclo().micros;
    const a = this.sim.atual();
    const { ini, fim } = this.faixaAtual();
    const vazio = { feitos: new Set<string>(), atuais: new Set<string>(), arestasFeitas: new Set<string>(), arestasAtuais: [] as string[] };
    if (!a || a.ciclo === 0 || fim < 0) return vazio;

    const daInstrucao = (i: number) => micros[i]?.ciclo === a.ciclo;
    const feitos = new Set<string>();
    const arestasFeitas = new Set<string>();
    let anterior: EtapaFluxo | null = null;
    let primeiro = ini;
    while (primeiro > 0 && daInstrucao(primeiro - 1)) primeiro--;
    for (let i = primeiro; i < ini; i++) {
      const e = micros[i].etapa;
      feitos.add(e);
      if (anterior) caminhoFluxo(anterior, e).forEach(x => arestasFeitas.add(x));
      anterior = e;
    }
    // ligação até o passo atual; no início da instrução, a volta desde a instrução anterior
    if (!anterior && primeiro > 0 && micros[primeiro - 1].ciclo > 0) anterior = micros[primeiro - 1].etapa;
    const atuais = new Set<string>();
    const arestasAtuais: string[] = [];
    for (let i = ini; i <= fim; i++) {
      const e = micros[i].etapa;
      if (e === 'fim' || e === 'carga') continue;
      atuais.add(e);
      if (anterior && anterior !== 'fim' && anterior !== 'carga') arestasAtuais.push(...caminhoFluxo(anterior, e));
      anterior = e;
    }
    return { feitos, atuais, arestasFeitas, arestasAtuais };
  });

  estadoNo(id: string): 'atual' | 'feito' | '' {
    const t = this.trilha();
    return t.atuais.has(id) ? 'atual' : t.feitos.has(id) ? 'feito' : '';
  }

  /** Ligações animadas do passo atual (a chave muda a cada passo, para a animação recomeçar). */
  readonly arestasAnimadas = computed(() => {
    const pos = this.sim.posicao();
    return this.trilha().arestasAtuais.map(id => ({ chave: `${pos}:${id}`, d: LIGACOES[id], fase: this.faseDaAresta(id) }));
  });

  faseDaAresta(id: string): string {
    const destino = id.split('>')[1];
    return NOS.find(n => n.id === destino)?.fase ?? 'execucao';
  }

  /** Resposta da pergunta "Tem operando?" no passo atual. */
  readonly resposta = computed(() => {
    const a = this.sim.atual();
    if (!a || !this.trilha().atuais.has('decisao')) return null;
    const dec = this.sim.ciclo().micros.slice(0, this.sim.indiceMicro() + 1).filter(m => m.ciclo === a.ciclo && m.etapa === 'decisao');
    const ult = dec[dec.length - 1];
    return ult && /^Sim/.test(ult.detalhe) ? 'sim' : 'nao';
  });

  pontosLosango(n: NoFluxo): string {
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    return `${cx},${n.y} ${n.x + n.w},${cy} ${cx},${n.y + n.h} ${n.x},${cy}`;
  }

  // ─── CPU e memória ───

  readonly regs = computed(() => this.sim.registradores().map((r, i) => ({ r, y: 16 + i * (ALT + 12) })));

  readonly geo = computed(() => {
    const compacto = this.compacto();
    const nRegs = Math.max(2, this.regs().length);
    const ula = 16 + nRegs * (ALT + 12) + 8;
    const flags = ula + ALT + 12;
    const memAlt = 66 + this.sim.celulas().length * LINHA_MEM;
    const dec = compacto ? Math.max(304, flags + ALT + 12) : Math.max(304, 16 + memAlt + 14);
    const caixas: Record<string, Caixa> = {
      MDR: { x: COL_B, y: 16, w: LARG, h: ALT },
      MAR: { x: COL_B, y: 88, w: LARG, h: ALT },
      PC: { x: COL_B, y: 160, w: LARG, h: ALT },
      IR: { x: COL_B, y: 232, w: LARG, h: ALT },
      DEC: { x: COL_B, y: dec, w: LARG, h: ALT },
      UC: compacto ? { x: COL_A, y: dec, w: LARG, h: ALT } : { x: COL_C, y: dec, w: 260, h: ALT },
      ULA: { x: COL_A, y: ula, w: LARG, h: ALT },
      FLAGS: { x: COL_A, y: flags, w: LARG, h: ALT },
    };
    this.regs().forEach(g => caixas[g.r] = { x: COL_A, y: g.y, w: LARG, h: ALT });
    const mem: Caixa = compacto
      ? { x: COL_A, y: dec + ALT + 22, w: COL_B + LARG - COL_A, h: memAlt }
      : { x: COL_C, y: 16, w: 260, h: memAlt };
    const largura = compacto ? 412 : 680;
    const altura = compacto ? mem.y + mem.h + 26 : Math.max(dec + ALT, flags + ALT) + 26;
    return { compacto, caixas, mem, largura, altura };
  });

  readonly linhasMem = computed(() => {
    const m = this.geo().mem;
    return this.sim.celulas().map((c, i) => ({ ...c, y: m.y + 56 + i * LINHA_MEM }));
  });

  /** Ligações fixas ao barramento (desenhadas em cinza). */
  readonly ligacoesCpu = computed(() => {
    const { caixas: g, compacto, mem } = this.geo();
    const ys = (cs: string[]) => cs.filter(c => g[c]).map(c => g[c].y + ALT / 2);
    const todas = [...ys(['ULA', 'FLAGS', ...this.regs().map(r => r.r)]).map(y => `M${COL_A + LARG} ${y} H${BARRA}`),
      ...ys(['MDR', 'MAR', 'PC', 'IR']).map(y => `M${COL_B} ${y} H${BARRA}`)];
    const fundo = Math.max(...['MDR', 'MAR', 'PC', 'IR', 'ULA', 'FLAGS', ...this.regs().map(r => r.r)].map(c => g[c].y + ALT / 2));
    todas.push(`M${BARRA} ${16 + ALT / 2} V${fundo}`);
    todas.push(`M303 ${g['IR'].y + ALT} V${g['DEC'].y}`);
    if (compacto) {
      todas.push(`M${COL_B} ${g['DEC'].y + ALT / 2} H${COL_A + LARG}`);
      todas.push(`M${COL_B + LARG} ${g['MAR'].y + ALT / 2} H${LANE_MAR_C} V${mem.y + 30}`, `M${COL_B + LARG} ${g['MDR'].y + ALT / 2} H${LANE_MDR_C} V${mem.y + 30}`);
    } else {
      todas.push(`M${COL_B + LARG} ${g['DEC'].y + ALT / 2} H${COL_C}`);
      todas.push(`M${COL_B + LARG} ${g['MAR'].y + ALT / 2} H${COL_C}`, `M${COL_B + LARG} ${g['MDR'].y + ALT / 2} H${COL_C}`);
    }
    return todas;
  });

  readonly setas = computed(() => {
    const a = this.sim.atual();
    if (!a) return [];
    const pos = this.sim.posicao();
    return a.fluxos.flatMap(f => this.caminho(f, a)).map((d, i) => ({ chave: `${pos}:${i}`, d }));
  });

  caixa(c: string): Caixa {
    return this.geo().caixas[c];
  }

  ativo(c: string): boolean {
    const a = this.sim.atual();
    if (!a) return false;
    if (c === 'DEC') return a.fase === 'decodificacao';
    return a.ativos.includes(c as Componente);
  }

  mudou(k: string): boolean {
    return !!this.sim.atual()?.mudou.includes(k);
  }

  /** Valor mostrado em cada caixa da CPU. */
  valorCaixa(c: string, a: MicroOp): string {
    const e = a.estado;
    const v = (x: Valor) => x === null || x === '' ? 'vazio' : String(x);
    switch (c) {
      case 'PC': return String(e.pc);
      case 'MAR': return v(e.mar);
      case 'MDR': return v(e.mdr);
      case 'IR': return v(e.ir);
      case 'ULA': return e.ula ?? 'parada';
      case 'FLAGS': return `Z ${e.z}  N ${e.n}  C ${e.c}`;
      case 'DEC': return a.fase === 'decodificacao' || a.fase === 'execucao' ? a.instrucao.split(' ')[0] : 'parado';
      case 'UC': return { carga: 'aguardando', busca: 'busca', decodificacao: 'decodifica', execucao: 'executa', fim: 'parada', erro: 'erro' }[a.fase];
      default: return this.valorReg(c as Registrador);
    }
  }

  valorReg(r: Registrador): string {
    const a = this.sim.atual();
    if (!a || !this.sim.regsComValor().has(r)) return 'vazio';
    return String(a.estado.regs[r]);
  }

  valorMem(end: number): string {
    const a = this.sim.atual();
    const p = this.sim.programa();
    if (end < p.inicioDados) return p.instrucoes[end]?.texto ?? '';
    return a ? textoValor(a.estado.dados[end - p.inicioDados] ?? null) : '';
  }

  private centroY(c: string): number {
    const k = this.geo().caixas[c];
    return k ? k.y + k.h / 2 : 0;
  }

  private ladoBarra(c: string): number {
    const k = this.geo().caixas[c];
    return k && k.x === COL_A ? COL_A + LARG : COL_B;
  }

  private yMem(a: MicroOp): number {
    const end = a.memoria?.end ?? 0;
    return (this.linhasMem().find(l => l.end === end)?.y ?? this.geo().mem.y + 56) + LINHA_MEM / 2;
  }

  private caminho(f: Fluxo, a: MicroOp): string[] {
    const { caixas: g, compacto, mem, altura } = this.geo();
    const dir = COL_B + LARG;
    const ym = this.yMem(a);
    switch (`${f.de}>${f.para}`) {
      case 'MAR>MEM': return compacto
        ? [`M${dir} ${this.centroY('MAR')} H${LANE_MAR_C} V${ym - 4} H${mem.x + mem.w - 8}`]
        : [`M${dir} ${this.centroY('MAR')} H392 V${ym - 4} H${COL_C + 10}`];
      case 'MEM>MDR': return compacto
        ? [`M${mem.x + mem.w - 8} ${ym + 4} H${LANE_MDR_C} V${this.centroY('MDR')} H${dir}`]
        : [`M${COL_C + 10} ${ym + 4} H398 V${this.centroY('MDR')} H${dir}`];
      case 'MDR>MEM': return compacto
        ? [`M${dir} ${this.centroY('MDR')} H${LANE_MDR_C} V${ym + 4} H${mem.x + mem.w - 8}`]
        : [`M${dir} ${this.centroY('MDR')} H398 V${ym + 4} H${COL_C + 10}`];
      case 'IR>UC': return compacto
        ? [`M303 ${g['IR'].y + ALT} V${g['DEC'].y}`, `M${COL_B} ${this.centroY('DEC')} H${COL_A + LARG}`]
        : [`M303 ${g['IR'].y + ALT} V${g['DEC'].y}`, `M${dir} ${this.centroY('DEC')} H${COL_C}`];
      case 'ULA>FLAGS': return [`M101 ${g['ULA'].y + ALT} V${g['FLAGS'].y}`];
      case 'FLAGS>UC': return compacto
        ? [`M101 ${g['FLAGS'].y + ALT} V${g['UC'].y}`]
        : [`M101 ${g['FLAGS'].y + ALT} V${altura - 10} H534 V${g['UC'].y + ALT}`];
    }
    if (!g[f.de] || !g[f.para]) return [];
    return [`M${this.ladoBarra(f.de)} ${this.centroY(f.de)} H${BARRA} V${this.centroY(f.para)} H${this.ladoBarra(f.para)}`];
  }
}
