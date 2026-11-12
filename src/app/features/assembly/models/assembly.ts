/**
 * Montador e executor do assembly didático (lógica pura, sem Angular).
 *
 * Modelo de memória: as instruções ocupam os endereços 0, 1, 2… (uma palavra cada),
 * na ordem do programa, e as variáveis vêm logo depois, na ordem em que foram declaradas.
 *
 * Cada instrução executada gera três passos, seguindo o ciclo de instrução:
 * busca → decodificação → execução.
 */
import {
  DefInstrucao, LIMITE_INSTRUCOES, REGISTRADORES, Registrador, TipoOperando,
  buscarInstrucao, ehRegistrador, ehReservada,
} from './instrucoes';

// ─────────────────────────── tipos ───────────────────────────

export type Indice = { t: 'reg'; r: Registrador } | { t: 'num'; v: number };

export type Operando =
  | { t: 'reg'; r: Registrador }
  | { t: 'num'; v: number }
  | { t: 'var'; nome: string; end: number; tamanho: number; indice?: Indice }
  | { t: 'texto'; s: string }
  | { t: 'rotulo'; nome: string; end: number };

export interface Instrucao {
  end: number;
  linha: number;
  def: DefInstrucao;
  operandos: Operando[];
  /** Texto da instrução como fica na memória e no IR (ex.: "ADD A, Y"). */
  texto: string;
}

export interface Variavel {
  nome: string;
  end: number;
  valores: number[];
  linha: number;
}

export interface ErroMontagem { linha: number; msg: string; }

export interface Programa {
  instrucoes: Instrucao[];
  variaveis: Variavel[];
  rotulos: { nome: string; end: number }[];
  /** Primeiro endereço da área de dados (= número de instruções). */
  inicioDados: number;
  tamanhoMemoria: number;
  erros: ErroMontagem[];
}

export type Fase = 'carga' | 'busca' | 'decodificacao' | 'execucao' | 'fim' | 'erro';

export interface Acesso { end: number; tipo: 'leitura' | 'escrita'; }

export interface Passo {
  fase: Fase;
  /** Número da instrução executada (1, 2, 3…); 0 na carga. */
  ciclo: number;
  /** Linha do código-fonte (1…) da instrução em andamento. */
  linha: number | null;
  /** Endereço da instrução em andamento. */
  end: number | null;
  titulo: string;
  micro: string[];
  regs: Record<Registrador, number>;
  pc: number;
  ir: string;
  mar: number | null;
  mdr: number | string | null;
  z: 0 | 1;
  n: 0 | 1;
  /** Valores da área de dados (índice 0 = endereço inicioDados). */
  dados: number[];
  saida: string[];
  acessos: Acesso[];
  /** O que mudou em relação ao passo anterior: 'A', 'PC', 'IR', 'MAR', 'MDR', 'Z', 'N', 'SAIDA' ou 'M<end>'. */
  mudou: string[];
}

export interface Execucao {
  programa: Programa;
  passos: Passo[];
  /** Erro de execução (divisão por zero, falta de entrada…), se houver. */
  erro: { linha: number | null; msg: string } | null;
  /** Quantos valores da entrada foram lidos. */
  entradaUsada: number;
}

// ─────────────────────────── montagem ───────────────────────────

const NOME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const SECAO = /^\.?(dados|data|codigo|código|code|text|texto)\s*:?$/i;

/** Remove o comentário (; ou //), respeitando textos entre aspas. */
function semComentario(linha: string): string {
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') aspas = !aspas;
    if (!aspas && (c === ';' || (c === '/' && linha[i + 1] === '/'))) return linha.slice(0, i);
  }
  return linha;
}

/** Separa operandos por vírgula, sem quebrar textos entre aspas. */
function separarOperandos(s: string): string[] {
  const r: string[] = [];
  let atual = '';
  let aspas = false;
  for (const c of s) {
    if (c === '"') aspas = !aspas;
    if (c === ',' && !aspas) { r.push(atual.trim()); atual = ''; } else atual += c;
  }
  if (atual.trim() !== '' || r.length) r.push(atual.trim());
  return r;
}

export function lerNumero(s: string): number | null {
  const t = s.trim();
  if (/^[+-]?\d+$/.test(t)) return parseInt(t, 10);
  if (/^[+-]?0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^[+-]?0b[01]+$/i.test(t)) return (t.startsWith('-') ? -1 : 1) * parseInt(t.replace(/^[+-]?0b/i, ''), 2);
  return null;
}

interface LinhaCodigo { linha: number; mnem: string; resto: string; def: DefInstrucao; }
interface LinhaDado { linha: number; nome: string; valores: number[]; }

/** Monta o programa: valida, posiciona instruções e variáveis na memória e resolve os rótulos. */
export function montar(codigo: string): Programa {
  const erros: ErroMontagem[] = [];
  const codigoLinhas: LinhaCodigo[] = [];
  const dadosLinhas: LinhaDado[] = [];
  const rotulos = new Map<string, { nome: string; end: number; linha: number }>();
  const nomesDados = new Set<string>();

  codigo.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1;
    let s = semComentario(bruta).trim();
    if (!s || SECAO.test(s)) return;

    // declaração de variável: NOME = 1, 2, 3   ou   NOME DB 5
    const dec = s.match(/^([A-Za-z_]\w*)\s*(?:=|\s(?:DB|DW|WORD)\s)\s*(.*)$/i);
    if (dec) {
      const [, nome, vals] = dec;
      const chave = nome.toUpperCase();
      if (ehReservada(nome)) { erros.push({ linha, msg: `"${nome}" é uma palavra reservada e não pode ser nome de variável.` }); return; }
      if (nomesDados.has(chave) || rotulos.has(chave)) { erros.push({ linha, msg: `O nome "${nome}" já foi usado.` }); return; }
      const partes = vals.trim() === '' ? [] : vals.split(',').map(v => v.trim());
      if (!partes.length) { erros.push({ linha, msg: `Falta o valor inicial de "${nome}" (use ? para começar com 0).` }); return; }
      const valores: number[] = [];
      for (const p of partes) {
        const n = p === '?' ? 0 : lerNumero(p);
        if (n === null) { erros.push({ linha, msg: `Valor inválido para "${nome}": ${p}` }); return; }
        valores.push(n);
      }
      nomesDados.add(chave);
      dadosLinhas.push({ linha, nome, valores });
      return;
    }

    // rótulos no início da linha (pode haver instrução depois)
    let m: RegExpMatchArray | null;
    while ((m = s.match(/^([A-Za-z_]\w*)\s*:(.*)$/))) {
      const nome = m[1];
      const chave = nome.toUpperCase();
      if (ehReservada(nome)) erros.push({ linha, msg: `"${nome}" é uma palavra reservada e não pode ser rótulo.` });
      else if (rotulos.has(chave) || nomesDados.has(chave)) erros.push({ linha, msg: `O nome "${nome}" já foi usado.` });
      else rotulos.set(chave, { nome, end: codigoLinhas.length, linha });
      s = m[2].trim();
    }
    if (!s) return;

    const im = s.match(/^(\S+)\s*(.*)$/)!;
    const def = buscarInstrucao(im[1]);
    if (!def) { erros.push({ linha, msg: `Instrução desconhecida: ${im[1]}` }); return; }
    codigoLinhas.push({ linha, mnem: def.op, resto: im[2].trim(), def });
  });

  // variáveis depois do código
  const inicioDados = codigoLinhas.length;
  const variaveis: Variavel[] = [];
  const porNome = new Map<string, Variavel>();
  let end = inicioDados;
  for (const d of dadosLinhas) {
    const v: Variavel = { nome: d.nome, end, valores: d.valores, linha: d.linha };
    variaveis.push(v);
    porNome.set(d.nome.toUpperCase(), v);
    end += d.valores.length;
  }

  // operandos
  const instrucoes: Instrucao[] = [];
  codigoLinhas.forEach((c, idx) => {
    const partes = c.resto === '' ? [] : separarOperandos(c.resto);
    const esperados = c.def.operandos;
    if (partes.length !== esperados.length) {
      const q = esperados.length;
      erros.push({ linha: c.linha, msg: `${c.mnem} precisa de ${q === 0 ? 'nenhum operando' : q === 1 ? '1 operando' : q + ' operandos'} (uso: ${c.def.uso}).` });
      return;
    }
    const ops: Operando[] = [];
    for (let k = 0; k < partes.length; k++) {
      const r = lerOperando(partes[k], esperados[k], porNome, rotulos);
      if (typeof r === 'string') { erros.push({ linha: c.linha, msg: r }); return; }
      ops.push(r);
    }
    instrucoes.push({ end: idx, linha: c.linha, def: c.def, operandos: ops, texto: textoInstrucao(c.mnem, ops) });
  });

  if (!erros.length && !codigoLinhas.length) erros.push({ linha: 1, msg: 'O programa não tem nenhuma instrução.' });
  erros.sort((a, b) => a.linha - b.linha);
  return {
    instrucoes, variaveis,
    rotulos: [...rotulos.values()].map(r => ({ nome: r.nome, end: r.end })),
    inicioDados, tamanhoMemoria: end, erros,
  };
}

function lerOperando(
  s: string, tipo: TipoOperando,
  vars: Map<string, Variavel>, rotulos: Map<string, { nome: string; end: number }>,
): Operando | string {
  if (tipo === 'rotulo') {
    const r = rotulos.get(s.toUpperCase());
    if (!NOME.test(s)) return `Rótulo inválido: ${s}`;
    if (!r) return `Rótulo não encontrado: ${s}`;
    return { t: 'rotulo', nome: r.nome, end: r.end };
  }
  if (s.startsWith('"')) {
    if (tipo !== 'saida') return `Texto entre aspas só pode ser usado no ESCREVER.`;
    if (s.length < 2 || !s.endsWith('"')) return `Falta fechar as aspas: ${s}`;
    return { t: 'texto', s: s.slice(1, -1) };
  }
  const n = lerNumero(s);
  if (n !== null) {
    if (tipo === 'destino') return `O destino não pode ser um número (${s}): use um registrador ou uma variável.`;
    return { t: 'num', v: n };
  }
  if (ehRegistrador(s)) return { t: 'reg', r: s.toUpperCase() as Registrador };

  const iv = s.match(/^([A-Za-z_]\w*)\s*\[\s*([^\]]+?)\s*\]$/);
  const nome = iv ? iv[1] : s;
  if (!NOME.test(nome)) return `Operando inválido: ${s}`;
  const v = vars.get(nome.toUpperCase());
  if (!v) return rotulos.has(nome.toUpperCase()) ? `"${nome}" é um rótulo, não uma variável.` : `Variável não declarada: ${nome}`;
  const op: Operando = { t: 'var', nome: v.nome, end: v.end, tamanho: v.valores.length };
  if (iv) {
    const idx = iv[2];
    const ni = lerNumero(idx);
    if (ni !== null) {
      if (ni < 0 || ni >= v.valores.length) return `Índice fora do vetor: ${s} (o vetor ${v.nome} vai de 0 a ${v.valores.length - 1}).`;
      op.indice = { t: 'num', v: ni };
    } else if (ehRegistrador(idx)) {
      op.indice = { t: 'reg', r: idx.toUpperCase() as Registrador };
    } else {
      return `O índice do vetor deve ser um número ou um registrador: ${s}`;
    }
  }
  return op;
}

export function textoOperando(o: Operando): string {
  switch (o.t) {
    case 'reg': return o.r;
    case 'num': return String(o.v);
    case 'texto': return `"${o.s}"`;
    case 'rotulo': return o.nome;
    case 'var': return o.indice ? `${o.nome}[${o.indice.t === 'reg' ? o.indice.r : o.indice.v}]` : o.nome;
  }
}

function textoInstrucao(op: string, ops: Operando[]): string {
  return ops.length ? `${op} ${ops.map(textoOperando).join(', ')}` : op;
}

// ─────────────────────────── execução ───────────────────────────

interface Estado {
  regs: Record<Registrador, number>;
  pc: number; ir: string; mar: number | null; mdr: number | string | null;
  z: 0 | 1; n: 0 | 1;
  dados: number[]; saida: string[];
}

class ErroExecucao extends Error {}

/** Executa o programa montado. `entrada` são os valores lidos pelas instruções LER, em ordem. */
export function executar(programa: Programa, entrada: number[] = []): Execucao {
  const passos: Passo[] = [];
  if (programa.erros.length) return { programa, passos, erro: null, entradaUsada: 0 };

  const regs = {} as Record<Registrador, number>;
  REGISTRADORES.forEach(r => regs[r] = 0);
  const est: Estado = {
    regs, pc: 0, ir: '', mar: null, mdr: null, z: 0, n: 0,
    dados: programa.variaveis.flatMap(v => v.valores), saida: [],
  };
  const ini = programa.inicioDados;
  let entradaUsada = 0;
  let ciclo = 0;
  let anterior: Passo | null = null;

  const registrar = (fase: Fase, titulo: string, micro: string[], instr: Instrucao | null, acessos: Acesso[] = []) => {
    const p: Passo = {
      fase, ciclo, linha: instr?.linha ?? null, end: instr?.end ?? null, titulo, micro,
      regs: { ...est.regs }, pc: est.pc, ir: est.ir, mar: est.mar, mdr: est.mdr, z: est.z, n: est.n,
      dados: [...est.dados], saida: [...est.saida], acessos, mudou: [],
    };
    p.mudou = diferencas(anterior, p, ini);
    passos.push(p);
    anterior = p;
  };

  registrar('carga', 'Programa carregado na memória',
    [`Instruções nos endereços 0 a ${programa.instrucoes.length - 1}` +
      (programa.variaveis.length ? `; variáveis a partir do endereço ${ini}` : ''), 'PC ← 0'], null);

  let erro: Execucao['erro'] = null;
  while (true) {
    if (est.pc >= programa.instrucoes.length) {
      registrar('fim', 'Fim do programa', ['O PC passou da última instrução (o programa não tem HLT).'], null);
      break;
    }
    if (ciclo >= LIMITE_INSTRUCOES) {
      erro = { linha: null, msg: `Mais de ${LIMITE_INSTRUCOES} instruções executadas: provável laço infinito.` };
      registrar('erro', 'Execução interrompida', [erro.msg], null);
      break;
    }
    const instr = programa.instrucoes[est.pc];
    ciclo++;

    // 1) busca
    est.mar = est.pc;
    est.mdr = instr.texto;
    est.ir = instr.texto;
    est.pc = est.pc + 1;
    registrar('busca', 'Busca', [
      `MAR ← PC (${instr.end})`,
      `MDR ← M[${instr.end}] = ${instr.texto}`,
      'IR ← MDR',
      `PC ← PC + 1 = ${est.pc}`,
    ], instr, [{ end: instr.end, tipo: 'leitura' }]);

    // 2) decodificação
    registrar('decodificacao', 'Decodificação',
      [`${instr.def.op}: ${instr.def.descricao}`, ...instr.operandos.map(o => descreverOperando(o, ini))], instr);

    // 3) execução
    const micro: string[] = [];
    const acessos: Acesso[] = [];
    try {
      const fim = executarInstrucao(instr, est, micro, acessos, ini, () => {
        if (entradaUsada >= entrada.length) throw new ErroExecucao('Faltou valor na entrada para o LER.');
        return entrada[entradaUsada++];
      });
      registrar(fim ? 'fim' : 'execucao', fim ? 'Execução — fim do programa' : 'Execução', micro, instr, acessos);
      if (fim) break;
    } catch (e) {
      if (!(e instanceof ErroExecucao)) throw e;
      erro = { linha: instr.linha, msg: e.message };
      registrar('erro', 'Erro na execução', [...micro, e.message], instr, acessos);
      break;
    }
  }
  return { programa, passos, erro, entradaUsada };
}

function descreverOperando(o: Operando, ini: number): string {
  switch (o.t) {
    case 'reg': return `${o.r}: registrador`;
    case 'num': return `${o.v}: valor imediato`;
    case 'texto': return `"${o.s}": texto`;
    case 'rotulo': return `${o.nome}: rótulo, endereço ${o.end}`;
    case 'var': return o.indice
      ? `${textoOperando(o)}: posição ${o.indice.t === 'reg' ? o.indice.r : o.indice.v} do vetor ${o.nome} (início no endereço ${o.end})`
      : `${o.nome}: variável no endereço ${o.end}`;
  }
}

/** Executa uma instrução. Devolve true no HLT. */
function executarInstrucao(
  instr: Instrucao, est: Estado, micro: string[], acessos: Acesso[], ini: number, ler: () => number,
): boolean {
  const [a, b] = instr.operandos;

  const endereco = (o: Extract<Operando, { t: 'var' }>): number => {
    if (!o.indice) return o.end;
    const i = o.indice.t === 'num' ? o.indice.v : est.regs[o.indice.r];
    if (i < 0 || i >= o.tamanho) throw new ErroExecucao(`Índice fora do vetor ${o.nome}: ${i} (vai de 0 a ${o.tamanho - 1}).`);
    return o.end + i;
  };

  const valor = (o: Operando): number => {
    switch (o.t) {
      case 'reg': return est.regs[o.r];
      case 'num': return o.v;
      case 'var': {
        const e = endereco(o);
        est.mar = e;
        est.mdr = est.dados[e - ini];
        micro.push(o.indice
          ? `MAR ← ${o.end} + ${o.indice.t === 'reg' ? o.indice.r : o.indice.v} = ${e} (${o.nome}[${e - o.end}])`
          : `MAR ← ${e} (${o.nome})`);
        micro.push(`MDR ← M[${e}] = ${est.mdr}`);
        acessos.push({ end: e, tipo: 'leitura' });
        return est.mdr;
      }
      default: throw new Error('operando sem valor');
    }
  };

  const gravar = (o: Operando, v: number) => {
    if (o.t === 'reg') { est.regs[o.r] = v; micro.push(`${o.r} ← ${v}`); return; }
    if (o.t === 'var') {
      const e = endereco(o);
      est.mar = e;
      est.mdr = v;
      est.dados[e - ini] = v;
      micro.push(`MAR ← ${e} (${textoOperando(o).replace(/\[.*\]/, `[${e - o.end}]`)})`, `MDR ← ${v}`, `M[${e}] ← MDR`);
      acessos.push({ end: e, tipo: 'escrita' });
      return;
    }
    throw new Error('destino inválido');
  };

  const flags = (r: number) => {
    est.z = r === 0 ? 1 : 0;
    est.n = r < 0 ? 1 : 0;
  };

  const desviar = (cond: boolean, explic: string) => {
    const alvo = (a as Extract<Operando, { t: 'rotulo' }>);
    if (cond) {
      est.pc = alvo.end;
      micro.push(`${explic}: desvia`, `PC ← ${alvo.end} (${alvo.nome})`);
    } else {
      micro.push(`${explic}: não desvia (PC continua ${est.pc})`);
    }
  };

  const aritmetica = (f: (x: number, y: number) => number, simb: string) => {
    const x = valor(a);
    const y = valor(b);
    const r = f(x, y);
    micro.push(`${textoOperando(a)} ${simb} ${textoOperando(b)} = ${x} ${simb} ${y} = ${r}`);
    gravar(a, r);
    flags(r);
  };

  const fz = `Z = ${est.z}`;
  const fn = `N = ${est.n}`;
  switch (instr.def.op) {
    case 'MOV': gravar(a, valor(b)); break;
    case 'ADD': aritmetica((x, y) => x + y, '+'); break;
    case 'SUB': aritmetica((x, y) => x - y, '−'); break;
    case 'MUL': aritmetica((x, y) => x * y, '×'); break;
    case 'DIV':
    case 'MOD': {
      const y = valor(b);
      if (y === 0) throw new ErroExecucao('Divisão por zero.');
      const x = valor(a);
      const div = instr.def.op === 'DIV';
      const r = div ? Math.trunc(x / y) : x % y;
      micro.push(`${textoOperando(a)} ${div ? '÷' : 'mod'} ${textoOperando(b)} = ${x} ${div ? '÷' : 'mod'} ${y} = ${r}`);
      gravar(a, r);
      flags(r);
      break;
    }
    case 'INC':
    case 'DEC': {
      const x = valor(a);
      const inc = instr.def.op === 'INC';
      const r = inc ? x + 1 : x - 1;
      micro.push(`${textoOperando(a)} ${inc ? '+' : '−'} 1 = ${x} ${inc ? '+' : '−'} 1 = ${r}`);
      gravar(a, r);
      flags(r);
      break;
    }
    case 'CMP': {
      const x = valor(a);
      const y = valor(b);
      flags(x - y);
      micro.push(`${x} − ${y} = ${x - y} (resultado descartado)`, `Z ← ${est.z}, N ← ${est.n}`);
      break;
    }
    case 'JMP': desviar(true, 'Desvio incondicional'); break;
    case 'JE': desviar(est.z === 1, fz); break;
    case 'JNE': desviar(est.z === 0, fz); break;
    case 'JG': desviar(est.z === 0 && est.n === 0, `${fz}, ${fn}`); break;
    case 'JGE': desviar(est.n === 0, fn); break;
    case 'JL': desviar(est.n === 1, fn); break;
    case 'JLE': desviar(est.n === 1 || est.z === 1, `${fz}, ${fn}`); break;
    case 'LER': {
      const v = ler();
      micro.push(`Entrada: ${v}`);
      gravar(a, v);
      break;
    }
    case 'ESCREVER': {
      const txt = a.t === 'texto' ? a.s : String(valor(a));
      est.saida.push(txt);
      micro.push(`Saída ← ${txt}`);
      break;
    }
    case 'NOP': micro.push('Nada a fazer.'); break;
    case 'HLT': micro.push('A CPU para.'); return true;
  }
  return false;
}

function diferencas(ant: Passo | null, p: Passo, ini: number): string[] {
  if (!ant) return [];
  const m: string[] = [];
  REGISTRADORES.forEach(r => { if (ant.regs[r] !== p.regs[r]) m.push(r); });
  if (ant.pc !== p.pc) m.push('PC');
  if (ant.ir !== p.ir) m.push('IR');
  if (ant.mar !== p.mar) m.push('MAR');
  if (ant.mdr !== p.mdr) m.push('MDR');
  if (ant.z !== p.z) m.push('Z');
  if (ant.n !== p.n) m.push('N');
  if (ant.saida.length !== p.saida.length) m.push('SAIDA');
  p.dados.forEach((v, i) => { if (ant.dados[i] !== v) m.push('M' + (i + ini)); });
  return m;
}

/** Monta e executa de uma vez. */
export function simular(codigo: string, entrada: number[] = []): Execucao {
  return executar(montar(codigo), entrada);
}

/** Lê a entrada digitada pelo aluno (números separados por espaço, vírgula ou linha). */
export function lerEntrada(texto: string): { valores: number[]; invalidos: string[] } {
  const valores: number[] = [];
  const invalidos: string[] = [];
  texto.split(/[\s,;]+/).filter(Boolean).forEach(t => {
    const n = lerNumero(t);
    if (n === null) invalidos.push(t); else valores.push(n);
  });
  return { valores, invalidos };
}
