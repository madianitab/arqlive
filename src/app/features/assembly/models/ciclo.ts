/**
 * Ciclo de instrução em micro-operações (lógica pura, sem Angular).
 *
 * Parte da execução do simulador (assembly.ts), em que cada instrução tem três passos
 * (busca, decodificação e execução), e quebra cada passo nas micro-operações da CPU:
 *   busca:          MAR ← PC · MDR ← M[MAR] · IR ← MDR · PC ← PC + 1
 *   decodificação:  a UC lê o IR
 *   execução:       depende da instrução (ex.: LOAD → MAR ← endereço de X · MDR ← M[MAR] · R1 ← MDR)
 *
 * Cada micro-operação diz quais componentes participam, por onde o dado passa (fluxos)
 * e o estado da CPU logo depois dela, para a tela destacar o caminho.
 */
import { Execucao, Passo, Programa, Valor, executar, montar, textoValor } from './assembly';
import { REGISTRADORES, Registrador } from './instrucoes';

// ─────────────────────────── tipos ───────────────────────────

export type FaseCiclo = 'carga' | 'busca' | 'decodificacao' | 'execucao' | 'fim' | 'erro';

/** Partes da CPU (e a memória) que aparecem no diagrama. */
export type Componente = 'PC' | 'IR' | 'MAR' | 'MDR' | 'UC' | 'ULA' | 'FLAGS' | 'MEM' | Registrador;

/**
 * Caixa do fluxograma do ciclo de instrução:
 * buscar → incrementar → decodificar → tem operando? (sim: endereço → buscar operando → volta) → executar → escrever → buscar…
 */
export type EtapaFluxo =
  | 'buscar' | 'incrementar' | 'decodificar' | 'decisao'
  | 'endereco' | 'buscarOperando' | 'executar' | 'escrever'
  | 'carga' | 'fim';

/** Ligações do fluxograma (de → para). */
export const LIGACOES_FLUXO: [EtapaFluxo, EtapaFluxo][] = [
  ['buscar', 'incrementar'], ['incrementar', 'decodificar'], ['decodificar', 'decisao'],
  ['decisao', 'endereco'], ['endereco', 'buscarOperando'], ['buscarOperando', 'decisao'],
  ['decisao', 'executar'], ['executar', 'escrever'], ['escrever', 'buscar'],
];

/** Caminho mais curto no fluxograma entre duas caixas (lista de ligações "de>para"). */
export function caminhoFluxo(de: EtapaFluxo, para: EtapaFluxo): string[] {
  if (de === para) return [];
  const anterior = new Map<EtapaFluxo, EtapaFluxo>();
  const fila: EtapaFluxo[] = [de];
  const vistos = new Set<EtapaFluxo>([de]);
  while (fila.length) {
    const x = fila.shift()!;
    if (x === para) break;
    for (const [a, b] of LIGACOES_FLUXO) {
      if (a === x && !vistos.has(b)) { vistos.add(b); anterior.set(b, x); fila.push(b); }
    }
  }
  if (!vistos.has(para)) return [];
  const res: string[] = [];
  for (let x = para; x !== de; x = anterior.get(x)!) res.unshift(`${anterior.get(x)}>${x}`);
  return res;
}

/** Caminho do dado numa micro-operação (seta no diagrama). */
export interface Fluxo { de: Componente; para: Componente; }

export interface EstadoCpu {
  pc: number;
  ir: string;
  mar: number | null;
  mdr: Valor;
  regs: Record<Registrador, number>;
  z: 0 | 1;
  n: 0 | 1;
  c: 0 | 1;
  /** Conta da ULA nesta fase (ex.: "5 + 2 = 7"), ou null. */
  ula: string | null;
  /** Memória de dados, a partir de inicioDados. */
  dados: Valor[];
}

export interface MicroOp {
  fase: FaseCiclo;
  /** Caixa do fluxograma em que a micro-operação acontece. */
  etapa: EtapaFluxo;
  /** Número da instrução executada (1, 2, 3…); 0 na carga. */
  ciclo: number;
  /** Endereço e linha da instrução em andamento. */
  end: number | null;
  linha: number | null;
  /** Instrução em andamento (texto do IR), ou ''. */
  instrucao: string;
  /** Micro-operação em notação de transferência, sem valores (ex.: "MAR ← PC"). */
  texto: string;
  /** Explicação com os valores (ex.: "O endereço da instrução (0) vai para o MAR."). */
  detalhe: string;
  ativos: Componente[];
  fluxos: Fluxo[];
  /** Acesso à memória nesta micro-operação. */
  memoria: { end: number; tipo: 'leitura' | 'escrita' } | null;
  /** Estado logo depois da micro-operação. */
  estado: EstadoCpu;
  /** O que mudou: 'PC', 'IR', 'MAR', 'MDR', 'R1'…, 'FLAGS', 'ULA' ou 'M<end>'. */
  mudou: string[];
}

export interface CicloCpu {
  programa: Programa;
  micros: MicroOp[];
  erro: Execucao['erro'];
}

/** Célula da memória mostrada no diagrama. */
export interface CelulaMemoria {
  end: number;
  tipo: 'instrucao' | 'dado';
  /** Rótulo (instrução) ou nome da variável (dado). */
  nome: string;
}

// ─────────────────────────── estado ───────────────────────────

function estadoDe(p: Passo): EstadoCpu {
  return {
    pc: p.pc, ir: p.ir, mar: p.mar, mdr: p.mdr, regs: { ...p.regs },
    z: p.z, n: p.n, c: p.c, ula: p.ula, dados: [...p.dados],
  };
}

function copiar(e: EstadoCpu): EstadoCpu {
  return { ...e, regs: { ...e.regs }, dados: [...e.dados] };
}

/** Aplica ao estado os valores de `p` (fim do passo) nas partes indicadas. */
function aplicar(e: EstadoCpu, chaves: string[], p: Passo, ini: number): EstadoCpu {
  const r = copiar(e);
  for (const k of chaves) {
    if (k === 'PC') r.pc = p.pc;
    else if (k === 'IR') r.ir = p.ir;
    else if (k === 'MAR') r.mar = p.mar;
    else if (k === 'MDR') r.mdr = p.mdr;
    else if (k === 'ULA') r.ula = p.ula;
    else if (k === 'FLAGS') { r.z = p.z; r.n = p.n; r.c = p.c; }
    else if ((REGISTRADORES as readonly string[]).includes(k)) r.regs[k as Registrador] = p.regs[k as Registrador];
    else if (/^M\d+$/.test(k)) { const i = +k.slice(1) - ini; r.dados[i] = p.dados[i]; }
  }
  return r;
}

// ─────────────────────────── micro-operações da execução ───────────────────────────

interface Parcial {
  etapa?: EtapaFluxo;
  texto: string;
  detalhe: string;
  ativos: Componente[];
  fluxos: Fluxo[];
  memoria: MicroOp['memoria'];
  /** Partes que a micro-operação grava. */
  grava: string[];
}

const REG = /^R[0-7]$/;

/**
 * Converte as linhas de micro-operação da execução (geradas pelo assembly.ts)
 * em micro-operações com componentes, fluxos e valores separados do texto.
 */
function microsExecucao(p: Passo): Parcial[] {
  const res: Parcial[] = [];
  let anteriorUla = false;
  for (const linha of p.micro) {
    let m: RegExpMatchArray | null;
    const nova = (x: Omit<Parcial, 'memoria' | 'grava'> & Partial<Pick<Parcial, 'memoria' | 'grava'>>) =>
      res.push({ memoria: null, grava: [], ...x });
    const eraUla = anteriorUla;
    anteriorUla = false;

    // observação entre parênteses: complementa a micro-operação anterior
    if (/^\(.*\)$/.test(linha) && res.length) {
      const ult = res[res.length - 1];
      ult.detalhe = [ult.detalhe, linha.slice(1, -1)].filter(Boolean).join(' — ');
      continue;
    }

    if ((m = linha.match(/^MAR ← SP \((\d+)\)$/))) {
      nova({ texto: 'MAR ← SP', detalhe: `Topo da pilha: endereço ${m[1]}.`, ativos: ['MAR'], fluxos: [], grava: ['MAR'] });
    } else if ((m = linha.match(/^MAR ← (\d+) \((\w+)\)$/))) {
      nova({ texto: `MAR ← endereço de ${m[2]}`, detalhe: `${m[2]} fica no endereço ${m[1]}.`,
        ativos: ['IR', 'MAR'], fluxos: [{ de: 'IR', para: 'MAR' }], grava: ['MAR'] });
    } else if ((m = linha.match(/^MAR ← (\w+) \+ (R[0-7]|\d+)(?: \((-?\d+)\))? = (\d+)$/))) {
      const idx = m[2];
      nova({ texto: `MAR ← endereço de ${m[1]} + ${idx}`, detalhe: `Vetor ${m[1]}: endereço ${m[4]}.`,
        ativos: REG.test(idx) ? ['IR', idx as Registrador, 'MAR'] : ['IR', 'MAR'],
        fluxos: [{ de: 'IR', para: 'MAR' }], grava: ['MAR'] });
    } else if ((m = linha.match(/^MDR ← M\[(\d+)\] = (.*)$/))) {
      nova({ texto: 'MDR ← M[MAR]', detalhe: `A memória devolve o conteúdo do endereço ${m[1]}: ${m[2]}.`,
        ativos: ['MAR', 'MEM', 'MDR'], fluxos: [{ de: 'MAR', para: 'MEM' }, { de: 'MEM', para: 'MDR' }],
        memoria: { end: +m[1], tipo: 'leitura' }, grava: ['MDR'] });
    } else if ((m = linha.match(/^MDR ← (R[0-7]) = (-?\d+)$/))) {
      nova({ texto: `MDR ← ${m[1]}`, detalhe: `O valor de ${m[1]} (${m[2]}) vai para o MDR.`,
        ativos: [m[1] as Registrador, 'MDR'], fluxos: [{ de: m[1] as Registrador, para: 'MDR' }], grava: ['MDR'] });
    } else if ((m = linha.match(/^MDR ← PC \((\d+)/))) {
      nova({ texto: 'MDR ← PC', detalhe: `Endereço de retorno: ${m[1]}.`, ativos: ['PC', 'MDR'], fluxos: [{ de: 'PC', para: 'MDR' }], grava: ['MDR'] });
    } else if ((m = linha.match(/^M\[(\d+)\] ← MDR$/))) {
      nova({ texto: 'M[MAR] ← MDR', detalhe: `O endereço ${m[1]} recebe ${textoValor(p.mdr)}.`,
        ativos: ['MAR', 'MDR', 'MEM'], fluxos: [{ de: 'MAR', para: 'MEM' }, { de: 'MDR', para: 'MEM' }],
        memoria: { end: +m[1], tipo: 'escrita' }, grava: ['M' + m[1]] });
    } else if ((m = linha.match(/^ULA: (R[0-7]) (\S) (\S+) = (.*)$/))) {
      const r = m[1] as Registrador;
      const b = m[3];
      const ativos: Componente[] = REG.test(b) ? [r, b as Registrador, 'ULA'] : ['IR', r, 'ULA'];
      const fluxos: Fluxo[] = [{ de: r, para: 'ULA' }, REG.test(b) ? { de: b as Registrador, para: 'ULA' } : { de: 'IR', para: 'ULA' }];
      nova({ texto: `ULA: ${r} ${m[2]} ${b}`, detalhe: m[4], ativos, fluxos, grava: ['ULA'] });
      anteriorUla = true;
    } else if ((m = linha.match(/^(R[0-7]) ← MDR = (-?\d+)$/))) {
      const r = m[1] as Registrador;
      nova({ texto: `${r} ← MDR`, detalhe: `${r} recebe ${m[2]}.`, ativos: ['MDR', r], fluxos: [{ de: 'MDR', para: r }], grava: [r] });
    } else if ((m = linha.match(/^(R[0-7]) ← (R[0-7]) = (-?\d+)$/))) {
      const [d, o] = [m[1] as Registrador, m[2] as Registrador];
      nova({ texto: `${d} ← ${o}`, detalhe: `${d} recebe ${m[3]}.`, ativos: [o, d], fluxos: [{ de: o, para: d }], grava: [d] });
    } else if ((m = linha.match(/^(R[0-7]) ← (-?\d+)$/))) {
      const r = m[1] as Registrador;
      if (eraUla) {
        nova({ texto: `${r} ← resultado da ULA`, detalhe: `${r} recebe ${m[2]}.`, ativos: ['ULA', r], fluxos: [{ de: 'ULA', para: r }], grava: [r] });
      } else if (p.porta?.tipo === 'entrada') {
        nova({ texto: `${r} ← porta ${p.porta.nome}`, detalhe: `${r} recebe ${m[2]}.`, ativos: [r], fluxos: [], grava: [r] });
      } else {
        nova({ texto: `${r} ← ${m[2]}`, detalhe: 'Constante da própria instrução: não acessa a memória.',
          ativos: ['IR', r], fluxos: [{ de: 'IR', para: r }], grava: [r] });
      }
    } else if ((m = linha.match(/^Flags: (.*)$/))) {
      nova({ texto: 'Flags ← resultado da ULA', detalhe: m[1], ativos: ['ULA', 'FLAGS'], fluxos: [{ de: 'ULA', para: 'FLAGS' }], grava: ['FLAGS'] });
    } else if ((m = linha.match(/^Desvio incondicional: desvia$/))) {
      nova({ texto: 'UC: desvio sempre', detalhe: 'JMP não testa as flags.', ativos: ['UC'], fluxos: [] });
    } else if ((m = linha.match(/^(.+): desvia$/))) {
      nova({ texto: 'UC testa as flags', detalhe: `${m[1]}: a condição é verdadeira, desvia.`,
        ativos: ['FLAGS', 'UC'], fluxos: [{ de: 'FLAGS', para: 'UC' }] });
    } else if ((m = linha.match(/^(.+): não desvia \(PC continua (\d+)\)$/))) {
      nova({ texto: 'UC testa as flags', detalhe: `${m[1]}: a condição é falsa, não desvia. O PC continua ${m[2]}.`,
        ativos: ['FLAGS', 'UC', 'PC'], fluxos: [{ de: 'FLAGS', para: 'UC' }] });
    } else if ((m = linha.match(/^PC ← (\d+) \((\w+)\)$/))) {
      nova({ texto: `PC ← ${m[2]}`, detalhe: `O PC recebe ${m[1]}: a próxima busca será no endereço ${m[1]}.`,
        ativos: ['IR', 'PC'], fluxos: [{ de: 'IR', para: 'PC' }], grava: ['PC'] });
    } else if ((m = linha.match(/^PC ← MDR = (\d+)$/))) {
      nova({ texto: 'PC ← MDR', detalhe: `Volta para o endereço ${m[1]}.`, ativos: ['MDR', 'PC'], fluxos: [{ de: 'MDR', para: 'PC' }], grava: ['PC'] });
    } else if (linha === 'A CPU para.') {
      nova({ texto: 'HALT: a CPU para', detalhe: 'Não há mais busca.', ativos: ['UC'], fluxos: [] });
    } else if (linha === 'Nada a fazer.') {
      nova({ texto: 'Nada a fazer', detalhe: '', ativos: ['UC'], fluxos: [] });
    } else {
      // demais casos (portas, DELAY, pilha…): mostra a linha como está
      nova({ texto: linha, detalhe: '', ativos: ['UC'], fluxos: [], grava: [] });
    }
  }
  if (!res.length) res.push({ texto: 'Nada a fazer', detalhe: '', ativos: ['UC'], fluxos: [], memoria: null, grava: [] });
  return res;
}

/** Caixa do fluxograma de cada micro-operação da execução. */
function etapaExecucao(x: Parcial, op: string): EtapaFluxo {
  const t = x.texto;
  if (op === 'LOAD' && /^MAR ← endereço/.test(t)) return 'endereco';
  if (op === 'LOAD' && (t === 'MDR ← M[MAR]' || /^R[0-7] ← MDR$/.test(t))) return 'buscarOperando';
  if (/resultado da ULA$/.test(t) || /^PC ← /.test(t) || t === 'M[MAR] ← MDR' || /^R[0-7] ← (R[0-7]|-?\d+)$/.test(t)) return 'escrever';
  return 'executar';
}

/** O operando da instrução precisa ser buscado na memória? (só o LOAD de variável) */
function decisaoOperando(p: Passo, op: string): { sim: boolean; detalhe: string } {
  const mem = p.micro.some(l => /^MDR ← M\[/.test(l));
  if (op === 'LOAD' && mem) return { sim: true, detalhe: 'Sim: o LOAD precisa ler o valor da memória.' };
  const motivo = op === 'LOAD' ? 'a constante vem na própria instrução.'
    : op === 'STORE' ? 'o dado já está no registrador; a memória só é escrita no fim.'
    : op === 'MOV' ? 'a cópia é entre registradores.'
    : ['ADD', 'SUB', 'MUL', 'DIV', 'CMP'].includes(op) ? 'a ULA trabalha com registradores e constantes.'
    : /^J/.test(op) ? 'o endereço do desvio vem na própria instrução.'
    : 'nada a buscar na memória.';
  return { sim: false, detalhe: `Não: ${motivo}` };
}

// ─────────────────────────── geração ───────────────────────────

/** Gera as micro-operações de uma execução. */
export function gerarMicros(exec: Execucao): CicloCpu {
  const { programa, passos } = exec;
  const micros: MicroOp[] = [];
  if (!passos.length) return { programa, micros, erro: exec.erro };
  const ini = programa.inicioDados;

  let est = estadoDe(passos[0]);
  micros.push({
    fase: 'carga', etapa: 'carga', ciclo: 0, end: null, linha: null, instrucao: '',
    texto: 'Programa carregado na memória',
    detalhe: `Instruções a partir do endereço 0${programa.variaveis.length ? `, variáveis a partir do ${ini}` : ''}. PC ← 0.`,
    ativos: ['PC', 'MEM'], fluxos: [], memoria: null, estado: copiar(est), mudou: [],
  });

  for (let i = 1; i < passos.length; i++) {
    const p = passos[i];
    const base = { ciclo: p.ciclo, end: p.end, linha: p.linha, instrucao: p.end !== null ? p.ir : '' };
    const add = (fase: FaseCiclo, etapa: EtapaFluxo, x: Parcial) => {
      est = aplicar(est, x.grava, p, ini);
      micros.push({ ...base, fase, etapa, texto: x.texto, detalhe: x.detalhe, ativos: x.ativos, fluxos: x.fluxos,
        memoria: x.memoria, estado: copiar(est), mudou: [...x.grava] });
    };

    if (p.fase === 'busca') {
      const end = p.end!;
      est.ula = null;   // a conta da ULA vale só para a instrução anterior
      add('busca', 'buscar', { texto: 'MAR ← PC', detalhe: `O endereço da instrução (${end}) vai para o MAR.`,
        ativos: ['PC', 'MAR'], fluxos: [{ de: 'PC', para: 'MAR' }], memoria: null, grava: ['MAR'] });
      add('busca', 'buscar', { texto: 'MDR ← M[MAR]', detalhe: `A memória devolve o conteúdo do endereço ${end}: ${p.ir}.`,
        ativos: ['MAR', 'MEM', 'MDR'], fluxos: [{ de: 'MAR', para: 'MEM' }, { de: 'MEM', para: 'MDR' }],
        memoria: { end, tipo: 'leitura' }, grava: ['MDR'] });
      add('busca', 'buscar', { texto: 'IR ← MDR', detalhe: `A instrução ${p.ir} vai para o IR.`,
        ativos: ['MDR', 'IR'], fluxos: [{ de: 'MDR', para: 'IR' }], memoria: null, grava: ['IR'] });
      add('busca', 'incrementar', { texto: 'PC ← PC + 1', detalhe: `O PC passa a apontar para a próxima instrução (${p.pc}).`,
        ativos: ['PC'], fluxos: [], memoria: null, grava: ['PC'] });
    } else if (p.fase === 'decodificacao') {
      const [uc, ...resto] = p.micro;
      add('decodificacao', 'decodificar', { texto: 'UC decodifica o IR', detalhe: [uc.replace(/^UC: /, ''), ...resto].join(' · '),
        ativos: ['IR', 'UC'], fluxos: [{ de: 'IR', para: 'UC' }], memoria: null, grava: [] });
    } else if (p.end !== null && (p.fase === 'execucao' || p.fase === 'fim' || p.fase === 'erro')) {
      const parciais = microsExecucao(p);
      // no erro, a última linha é a mensagem: vira a micro-operação de erro
      const msgErro = p.fase === 'erro' ? parciais.pop() : undefined;
      const op = p.ir.split(' ')[0];
      const dec = decisaoOperando(p, op);
      const decisao = (detalhe: string): Parcial => ({ texto: 'Tem operando?', detalhe,
        ativos: ['IR', 'UC'], fluxos: [], memoria: null, grava: [] });
      add('execucao', 'decisao', decisao(dec.detalhe));
      parciais.forEach(x => add('execucao', etapaExecucao(x, op), x));
      // depois de buscar o operando, o fluxo volta à pergunta (agora não há mais operando)
      if (dec.sim && !msgErro) add('execucao', 'decisao', decisao('Não: o operando já está no registrador e o LOAD termina aqui.'));
      est = estadoDe(p);   // garante o estado exato do fim da execução
      if (p.fase === 'fim') {
        micros.push({ ...base, fase: 'fim', etapa: 'fim', texto: 'Fim do programa', detalhe: 'O HALT encerrou a execução.',
          ativos: [], fluxos: [], memoria: null, estado: copiar(est), mudou: [] });
      }
      if (msgErro) {
        micros.push({ ...base, fase: 'erro', etapa: 'fim', texto: 'Erro na execução', detalhe: exec.erro?.msg ?? msgErro.texto,
          ativos: ['UC'], fluxos: [], memoria: null, estado: copiar(est), mudou: [] });
      }
    } else {
      // fim (PC passou da última instrução) ou erro sem instrução (laço infinito)
      est = estadoDe(p);
      micros.push({ ...base, fase: p.fase === 'erro' ? 'erro' : 'fim', etapa: 'fim',
        texto: p.fase === 'erro' ? 'Execução interrompida' : 'Fim do programa',
        detalhe: p.micro.join(' '), ativos: [], fluxos: [], memoria: null, estado: copiar(est), mudou: [] });
    }
  }
  return { programa, micros, erro: exec.erro };
}

/** Monta, executa e gera as micro-operações. */
export function cicloDoCodigo(codigo: string, entradas: Record<string, number> = {}): CicloCpu {
  return gerarMicros(executar(montar(codigo), entradas));
}

/**
 * Junta as micro-operações de cada fase numa só (modo "uma fase por passo"):
 * componentes e fluxos somados, estado do fim da fase.
 */
export function agruparPorFase(micros: MicroOp[]): MicroOp[] {
  const res: MicroOp[] = [];
  for (const m of micros) {
    const ult = res[res.length - 1];
    if (ult && ult.fase === m.fase && ult.ciclo === m.ciclo && m.fase !== 'fim' && m.fase !== 'erro' && m.fase !== 'carga') {
      res[res.length - 1] = {
        ...m,
        texto: `${ult.texto} · ${m.texto}`,
        detalhe: '',
        ativos: [...new Set([...ult.ativos, ...m.ativos])],
        fluxos: [...ult.fluxos, ...m.fluxos.filter(f => !ult.fluxos.some(u => u.de === f.de && u.para === f.para))],
        memoria: m.memoria ?? ult.memoria,
        mudou: [...new Set([...ult.mudou, ...m.mudou])],
      };
    } else res.push(m);
  }
  return res;
}

/** Registradores de uso geral que o programa usa (ao menos R1). */
export function registradoresUsados(programa: Programa): Registrador[] {
  const usados = new Set<Registrador>();
  for (const i of programa.instrucoes) {
    for (const o of i.operandos) {
      if (o.t === 'reg') usados.add(o.r);
      if (o.t === 'mem' && o.indice?.t === 'reg') usados.add(o.indice.r);
    }
  }
  const r = REGISTRADORES.filter(x => usados.has(x));
  return r.length ? r : ['R1'];
}

/** Células da memória: instruções (com o rótulo, se houver) e depois as variáveis. */
export function celulasMemoria(programa: Programa): CelulaMemoria[] {
  const cel: CelulaMemoria[] = programa.instrucoes.map(i => ({
    end: i.end, tipo: 'instrucao' as const,
    nome: programa.rotulos.filter(r => r.end === i.end).map(r => r.nome).join(', '),
  }));
  for (const v of programa.variaveis) {
    v.valores.forEach((_, k) => cel.push({ end: v.end + k, tipo: 'dado', nome: v.valores.length > 1 ? `${v.nome}[${k}]` : v.nome }));
  }
  return cel;
}
