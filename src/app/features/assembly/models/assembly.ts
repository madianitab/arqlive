/**
 * Montador e executor do "Assembly simplificado" (lógica pura, sem Angular).
 *
 * Modelo de memória: as instruções ocupam os endereços 0, 1, 2… (uma palavra cada),
 * na ordem do programa; as variáveis vêm logo depois, na ordem em que foram declaradas
 * (vetor = palavras seguidas; texto = uma palavra). Se o programa usa sub-rotinas
 * próprias (CALL rótulo / RET), a pilha fica depois das variáveis.
 *
 * Cada instrução executada gera três passos, seguindo o ciclo de instrução:
 * busca → decodificação → execução.
 */
import {
  DefInstrucao, LIMITE_INSTRUCOES, PINO_LED, PINO_MAX, PORTAS_ENTRADA, REGISTRADORES, ROTINA_IMPRIME,
  Registrador, TAMANHO_PILHA, TipoOperando, VARIAVEL_TEXTO,
  buscarInstrucao, ehRegistrador, ehReservada, pareceRegistrador,
} from './instrucoes';

// ─────────────────────────── tipos ───────────────────────────

export type Indice = { t: 'reg'; r: Registrador } | { t: 'num'; v: number };

export type Operando =
  | { t: 'reg'; r: Registrador }
  | { t: 'num'; v: number; txt: string }
  | { t: 'mem'; nome: string; end: number; tamanho: number; indice?: Indice }
  | { t: 'porta'; nome: string }          // LED, TELA, BOTAO, A0…
  | { t: 'pino'; v: number }              // pino pelo número
  | { t: 'rotulo'; nome: string; end: number; sistema?: boolean };

export interface Instrucao {
  end: number;
  linha: number;
  def: DefInstrucao;
  operandos: Operando[];
  /** Texto da instrução como fica na memória e no IR (ex.: "ADD R1, 2"). */
  texto: string;
}

export type Valor = number | string | null;

export interface Variavel {
  nome: string;
  end: number;
  /** Valores iniciais (null = vazio). Texto ocupa uma palavra. */
  valores: Valor[];
  linha: number;
}

export interface ErroMontagem { linha: number; msg: string; }

export interface Programa {
  instrucoes: Instrucao[];
  variaveis: Variavel[];
  rotulos: { nome: string; end: number }[];
  /** Primeiro endereço da área de dados (= número de instruções). */
  inicioDados: number;
  /** Primeiro endereço da pilha, ou null se o programa não usa pilha. */
  inicioPilha: number | null;
  tamanhoMemoria: number;
  /** Portas de entrada lidas pelo programa (BOTAO, A0, "7"…), para a tela pedir os valores. */
  entradasUsadas: string[];
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
  mdr: Valor;
  sp: number | null;
  z: 0 | 1;
  n: 0 | 1;
  c: 0 | 1;
  /** Conta feita pela ULA neste passo (ex.: "5 + 2 = 7"), ou null. */
  ula: string | null;
  /** Conteúdo da memória a partir de inicioDados (variáveis e pilha). */
  dados: Valor[];
  /** Texto exibido na TELA. */
  saida: string;
  /** Valor atual de cada pino de saída já usado (o LED é o pino 13). */
  pinos: Record<number, number>;
  /** Porta acessada neste passo (para destacar). */
  porta: { tipo: 'entrada' | 'saida'; nome: string } | null;
  /** Tempo acumulado pelos DELAY, em ms. */
  tempo: number;
  acessos: Acesso[];
  /** O que mudou em relação ao passo anterior: 'R1', 'PC', 'IR', 'MAR', 'MDR', 'SP', 'Z', 'N', 'C', 'SAIDA', 'TEMPO', 'P<pino>' ou 'M<end>'. */
  mudou: string[];
}

export interface Execucao {
  programa: Programa;
  passos: Passo[];
  /** Erro de execução (divisão por zero, memória vazia…), se houver. */
  erro: { linha: number | null; msg: string } | null;
}

// ─────────────────────────── montagem ───────────────────────────

const NOME = /^[A-Za-z_][A-Za-z0-9_]*$/;
/** Linhas de seção (opcionais, ignoradas). */
const SECAO = /^\.?(dados|data|codigo|código|code|text|texto|mem[oó]ria)\s*:?$/i;

/** Remove o comentário (;), respeitando textos entre aspas. */
function semComentario(linha: string): string {
  let aspas: string | null = null;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if ((c === '"' || c === "'") && (aspas === null || aspas === c)) aspas = aspas ? null : c;
    if (!aspas && c === ';') return linha.slice(0, i);
  }
  return linha;
}

/** Separa por vírgula, sem quebrar textos entre aspas. */
function separar(s: string): string[] {
  const r: string[] = [];
  let atual = '';
  let aspas: string | null = null;
  for (const c of s) {
    if ((c === '"' || c === "'") && (aspas === null || aspas === c)) aspas = aspas ? null : c;
    if (c === ',' && !aspas) { r.push(atual.trim()); atual = ''; } else atual += c;
  }
  if (atual.trim() !== '' || r.length) r.push(atual.trim());
  return r;
}

/** Constante: decimal, 0x…, 0b…, caractere ('0' = 48), HIGH (1) ou LOW (0). */
export function lerNumero(s: string): number | null {
  const t = s.trim();
  if (/^[+-]?\d+$/.test(t)) return parseInt(t, 10);
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16);
  if (/^0b[01]+$/i.test(t)) return parseInt(t.slice(2), 2);
  if (/^'.'$/.test(t)) return t.charCodeAt(1);
  if (/^HIGH$/i.test(t)) return 1;
  if (/^LOW$/i.test(t)) return 0;
  return null;
}

const VALOR_DADO = /^(vazio|\?|"[^"]*"|'.'|[+-]?\d+|0x[0-9a-f]+|0b[01]+|HIGH|LOW)(\s*,\s*([+-]?\d+|'.'|0x[0-9a-f]+|0b[01]+|HIGH|LOW))*$/i;

interface LinhaCodigo { linha: number; resto: string; def: DefInstrucao; }

/** Monta o programa: valida, posiciona instruções e variáveis na memória e resolve os rótulos. */
export function montar(codigo: string): Programa {
  const erros: ErroMontagem[] = [];
  const codigoLinhas: LinhaCodigo[] = [];
  const dadosLinhas: { linha: number; nome: string; valores: Valor[] }[] = [];
  const rotulos = new Map<string, { nome: string; end: number }>();
  const nomesDados = new Set<string>();

  const declarar = (linha: number, nome: string, resto: string): void => {
    const chave = nome.toUpperCase();
    if (ehReservada(nome)) { erros.push({ linha, msg: `"${nome}" é uma palavra reservada e não pode ser nome de variável.` }); return; }
    if (nomesDados.has(chave) || rotulos.has(chave)) { erros.push({ linha, msg: `O nome "${nome}" já foi usado.` }); return; }
    const r = resto.trim();
    let valores: Valor[];
    if (/^(vazio|\?)$/i.test(r)) valores = [null];
    else if (r.startsWith('"')) valores = [r.slice(1, -1)];
    else valores = separar(r).map(v => lerNumero(v));
    nomesDados.add(chave);
    dadosLinhas.push({ linha, nome, valores });
  };

  codigo.split(/\r?\n/).forEach((bruta, i) => {
    const linha = i + 1;
    let s = semComentario(bruta).trim();
    if (!s || SECAO.test(s)) return;

    // declaração de variável: X: 5   X: vazio   TEXTO: "X = "   LED: 8, 9, 10   X: 10 e Y: 20   (ou só D)
    const partes = s.split(/\s+e\s+(?=[A-Za-z_]\w*\s*:)/i);
    const decl = partes.map(p => p.match(/^([A-Za-z_]\w*)\s*:\s*(.+)$/));
    if (decl.every(d => d && VALOR_DADO.test(d[2].trim()))) {
      decl.forEach(d => declarar(linha, d![1], d![2]));
      return;
    }

    // declaração só com o nome (D): variável vazia
    if (/^[A-Za-z_]\w*$/.test(s) && !buscarInstrucao(s)) {
      declarar(linha, s, 'vazio');
      return;
    }

    // rótulos no início da linha (pode haver instrução depois)
    let m: RegExpMatchArray | null;
    while ((m = s.match(/^([A-Za-z_]\w*)\s*:(.*)$/))) {
      const nome = m[1];
      const chave = nome.toUpperCase();
      if (ehReservada(nome)) erros.push({ linha, msg: `"${nome}" é uma palavra reservada e não pode ser rótulo.` });
      else if (rotulos.has(chave) || nomesDados.has(chave)) erros.push({ linha, msg: `O nome "${nome}" já foi usado.` });
      else rotulos.set(chave, { nome, end: codigoLinhas.length });
      s = m[2].trim();
    }
    if (!s) return;

    const im = s.match(/^(\S+)\s*(.*)$/)!;
    const def = buscarInstrucao(im[1]);
    if (!def) {
      erros.push({ linha, msg: /:\s*$/.test(s) || s.includes(':')
        ? `Linha não reconhecida: ${s}. Variável: NOME: valor (ex.: X: 5). Rótulo: NOME:`
        : `Instrução desconhecida: ${im[1]}` });
      return;
    }
    codigoLinhas.push({ linha, resto: im[2].trim(), def });
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
  const entradas = new Set<string>();
  let usaPilha = false;
  codigoLinhas.forEach((c, idx) => {
    const partes = c.resto === '' ? [] : separar(c.resto);
    const esperados = c.def.operandos;
    if (partes.length !== esperados.length) {
      const q = esperados.length;
      erros.push({ linha: c.linha, msg: `${c.def.op} precisa de ${q === 0 ? 'nenhum operando' : q === 1 ? '1 operando' : q + ' operandos'} (ex.: ${c.def.uso}).` });
      return;
    }
    const ops: Operando[] = [];
    for (let k = 0; k < partes.length; k++) {
      const r = lerOperando(partes[k], esperados[k], c.def, porNome, rotulos);
      if (typeof r === 'string') { erros.push({ linha: c.linha, msg: r }); return; }
      ops.push(r);
    }
    if (c.def.op === 'IN') {
      const p = ops[1];
      if (p.t === 'porta') entradas.add(p.nome);
      if (p.t === 'pino') entradas.add(String(p.v));
    }
    if (c.def.op === 'RET' || (c.def.op === 'CALL' && ops[0].t === 'rotulo' && !ops[0].sistema)) usaPilha = true;
    if (c.def.op === 'CALL' && ops[0].t === 'rotulo' && ops[0].sistema && !porNome.has(VARIAVEL_TEXTO)) {
      erros.push({ linha: c.linha, msg: `CALL imprime exibe a variável TEXTO da memória: declare, por exemplo, TEXTO: "X = "` });
      return;
    }
    instrucoes.push({ end: idx, linha: c.linha, def: c.def, operandos: ops, texto: textoInstrucao(c.def.op, ops) });
  });

  const inicioPilha = usaPilha ? end : null;
  if (usaPilha) end += TAMANHO_PILHA;

  if (!erros.length && !codigoLinhas.length) erros.push({ linha: 1, msg: 'O programa não tem nenhuma instrução.' });
  erros.sort((a, b) => a.linha - b.linha);
  const ordemEntradas = PORTAS_ENTRADA.map(p => p.nome);
  return {
    instrucoes, variaveis,
    rotulos: [...rotulos.values()],
    inicioDados, inicioPilha, tamanhoMemoria: end,
    entradasUsadas: [...entradas].sort((a, b) => {
      const ia = ordemEntradas.indexOf(a), ib = ordemEntradas.indexOf(b);
      return (ia < 0 ? 99 + +a : ia) - (ib < 0 ? 99 + +b : ib);
    }),
    erros,
  };
}

function lerOperando(
  s: string, tipo: TipoOperando, def: DefInstrucao,
  vars: Map<string, Variavel>, rotulos: Map<string, { nome: string; end: number }>,
): Operando | string {
  const op = def.op;
  const U = s.toUpperCase();

  if (tipo === 'rotulo') {
    if (!NOME.test(s)) return `Rótulo inválido: ${s}`;
    const r = rotulos.get(U);
    if (r) return { t: 'rotulo', nome: r.nome, end: r.end };
    if (op === 'CALL' && U === ROTINA_IMPRIME) return { t: 'rotulo', nome: s, end: -1, sistema: true };
    return `Rótulo não encontrado: ${s}`;
  }

  // registrador
  if (pareceRegistrador(s)) {
    if (!ehRegistrador(s)) return `O simulador tem os registradores R0 a R7 (${s} não existe).`;
    const reg: Operando = { t: 'reg', r: U as Registrador };
    if (tipo === 'mem') return op === 'STORE'
      ? `No STORE, o destino é a variável da memória: STORE X, ${s}.`
      : `Esperava uma variável da memória, não o registrador ${s}.`;
    if (tipo === 'memOuConst' && op === 'LOAD') return `Para copiar entre registradores use MOV: MOV R?, ${s}.`;
    return reg;   // reg, regOuConst e portas (registrador com o número do pino)
  }

  // portas com nome
  if (tipo === 'portaEntrada' || tipo === 'portaSaida') {
    const n = lerNumero(s);
    if (n !== null) {
      if (n < 0 || n > PINO_MAX || !/^\d+$/.test(s)) return `Pino inválido: ${s} (use 0 a ${PINO_MAX}).`;
      return { t: 'pino', v: n };
    }
    if (tipo === 'portaEntrada') {
      if (PORTAS_ENTRADA.some(p => p.nome === U)) return { t: 'porta', nome: U };
      return `Porta de entrada desconhecida: ${s} (use ${PORTAS_ENTRADA.map(p => p.nome).join(', ')}, o número do pino ou um registrador).`;
    }
    if (U === 'LED' || U === 'TELA') return { t: 'porta', nome: U };
    return `Porta de saída desconhecida: ${s} (use LED, TELA, o número do pino ou um registrador).`;
  }

  // constante
  const n = lerNumero(s);
  if (n !== null) {
    if (tipo === 'reg') return op === 'MOV'
      ? `MOV copia entre registradores. Para carregar uma constante use LOAD: LOAD R?, ${s}.`
      : op === 'OUT' ? `O OUT envia o valor de um registrador: LOAD R1, ${s} e depois OUT porta, R1.`
      : op === 'STORE' ? `O STORE grava um registrador: LOAD R1, ${s} e depois STORE X, R1.`
      : `Esperava um registrador (R0 a R7), não a constante ${s}.`;
    if (tipo === 'mem') return `Esperava uma variável da memória, não a constante ${s}.`;
    return { t: 'num', v: n, txt: s };
  }
  if (s.startsWith('"')) return `Texto entre aspas só pode ser valor de variável (ex.: TEXTO: "X = ").`;

  // variável (ou vetor)
  const iv = s.match(/^([A-Za-z_]\w*)\s*\[\s*([^\]]+?)\s*\]$/);
  const nome = iv ? iv[1] : s;
  if (!NOME.test(nome)) return `Operando inválido: ${s}`;
  const v = vars.get(nome.toUpperCase());
  if (!v) {
    if (rotulos.has(nome.toUpperCase())) return `"${nome}" é um rótulo, não uma variável.`;
    return `Variável não declarada: ${nome} (declare na memória, ex.: ${nome}: vazio).`;
  }
  if (tipo === 'reg' || tipo === 'regOuConst') {
    return def.ula
      ? `A ULA só trabalha com registradores e constantes: primeiro LOAD R?, ${s}.`
      : op === 'OUT' ? `O OUT envia o valor de um registrador: primeiro LOAD R?, ${s}.`
      : `Esperava um registrador, não a variável ${s}: primeiro LOAD R?, ${s}.`;
  }
  if (typeof v.valores[0] === 'string') return `${v.nome} guarda um texto; textos só são usados pelo CALL imprime.`;
  const res: Operando = { t: 'mem', nome: v.nome, end: v.end, tamanho: v.valores.length };
  if (iv) {
    const idx = iv[2];
    const ni = lerNumero(idx);
    if (ni !== null) {
      if (ni < 0 || ni >= v.valores.length) return `Índice fora do vetor: ${s} (o vetor ${v.nome} vai de 0 a ${v.valores.length - 1}).`;
      res.indice = { t: 'num', v: ni };
    } else if (ehRegistrador(idx)) {
      res.indice = { t: 'reg', r: idx.toUpperCase() as Registrador };
    } else {
      return `O índice do vetor deve ser um número ou um registrador: ${s}`;
    }
  }
  return res;
}

export function textoOperando(o: Operando): string {
  switch (o.t) {
    case 'reg': return o.r;
    case 'num': return o.txt;
    case 'porta': return o.nome;
    case 'pino': return String(o.v);
    case 'rotulo': return o.nome;
    case 'mem': return o.indice ? `${o.nome}[${o.indice.t === 'reg' ? o.indice.r : o.indice.v}]` : o.nome;
  }
}

function textoInstrucao(op: string, ops: Operando[]): string {
  return ops.length ? `${op} ${ops.map(textoOperando).join(', ')}` : op;
}

export function textoValor(v: Valor): string {
  if (v === null) return 'vazio';
  if (typeof v === 'string') return `"${v}"`;
  return String(v);
}

// ─────────────────────────── execução ───────────────────────────

interface Estado {
  regs: Record<Registrador, number>;
  pc: number; ir: string; mar: number | null; mdr: Valor; sp: number | null;
  z: 0 | 1; n: 0 | 1; c: 0 | 1;
  ula: string | null;
  dados: Valor[]; saida: string; pinos: Record<number, number>; tempo: number;
  porta: Passo['porta'];
}

class ErroExecucao extends Error {}

/**
 * Executa o programa montado.
 * `entradas`: valor de cada porta de entrada (BOTAO, A0…, ou o número do pino); o que faltar vale 0.
 */
export function executar(programa: Programa, entradas: Record<string, number> = {}): Execucao {
  const passos: Passo[] = [];
  if (programa.erros.length) return { programa, passos, erro: null };

  const regs = {} as Record<Registrador, number>;
  REGISTRADORES.forEach(r => regs[r] = 0);
  const ini = programa.inicioDados;
  const dados: Valor[] = programa.variaveis.flatMap(v => v.valores);
  if (programa.inicioPilha !== null) for (let i = 0; i < TAMANHO_PILHA; i++) dados.push(null);
  const est: Estado = {
    regs, pc: 0, ir: '', mar: null, mdr: null,
    sp: programa.inicioPilha !== null ? programa.inicioPilha + TAMANHO_PILHA : null,
    z: 0, n: 0, c: 0, ula: null, dados, saida: '', pinos: {}, tempo: 0, porta: null,
  };
  let ciclo = 0;
  let anterior: Passo | null = null;
  const endTexto = programa.variaveis.find(v => v.nome.toUpperCase() === VARIAVEL_TEXTO)?.end;

  const registrar = (fase: Fase, titulo: string, micro: string[], instr: Instrucao | null, acessos: Acesso[] = []) => {
    const p: Passo = {
      fase, ciclo, linha: instr?.linha ?? null, end: instr?.end ?? null, titulo, micro,
      regs: { ...est.regs }, pc: est.pc, ir: est.ir, mar: est.mar, mdr: est.mdr, sp: est.sp,
      z: est.z, n: est.n, c: est.c, ula: est.ula,
      dados: [...est.dados], saida: est.saida, pinos: { ...est.pinos }, porta: est.porta, tempo: est.tempo,
      acessos, mudou: [],
    };
    p.mudou = diferencas(anterior, p, ini);
    passos.push(p);
    anterior = p;
  };

  const n = programa.instrucoes.length;
  registrar('carga', 'Programa carregado na memória', [
    `Instruções nos endereços 0 a ${n - 1}` + (programa.variaveis.length ? `; variáveis a partir do endereço ${ini}` : ''),
    ...(programa.inicioPilha !== null ? [`Pilha nos endereços ${programa.inicioPilha} a ${programa.inicioPilha + TAMANHO_PILHA - 1}; SP ← ${est.sp}`] : []),
    'PC ← 0',
  ], null);

  let erro: Execucao['erro'] = null;
  while (true) {
    est.ula = null;
    est.porta = null;
    if (est.pc >= n) {
      registrar('fim', 'Fim do programa', ['O PC passou da última instrução: o programa terminou.'], null);
      break;
    }
    if (ciclo >= LIMITE_INSTRUCOES) {
      erro = { linha: null, msg: `Mais de ${LIMITE_INSTRUCOES} instruções executadas: provável laço infinito.` };
      registrar('erro', 'Execução interrompida', [erro.msg], null);
      break;
    }
    const instr = programa.instrucoes[est.pc];
    ciclo++;

    // 1) busca: PC → MAR → memória → MDR → IR; depois PC++
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

    // 2) decodificação: a UC lê o IR e descobre a operação
    registrar('decodificacao', 'Decodificação', [
      `UC: ${instr.def.op} — ${instr.def.descricao}`,
      ...instr.operandos.map((o, k) => descreverOperando(o, instr.def.operandos[k])),
      instr.def.ula ? 'Vai usar a ULA.' : 'Não usa a ULA.',
    ], instr);

    // 3) execução
    const micro: string[] = [];
    const acessos: Acesso[] = [];
    try {
      const fim = executarInstrucao(instr, est, micro, acessos, ini, entradas, endTexto);
      registrar(fim ? 'fim' : 'execucao', fim ? 'Execução — fim do programa' : 'Execução', micro, instr, acessos);
      if (fim) break;
    } catch (e) {
      if (!(e instanceof ErroExecucao)) throw e;
      erro = { linha: instr.linha, msg: e.message };
      registrar('erro', 'Erro na execução', [...micro, e.message], instr, acessos);
      break;
    }
  }
  return { programa, passos, erro };
}

function descreverOperando(o: Operando, tipo: TipoOperando): string {
  switch (o.t) {
    case 'reg':
      return tipo === 'portaEntrada' || tipo === 'portaSaida' ? `${o.r}: registrador com o número do pino` : `${o.r}: registrador`;
    case 'num': return `${o.txt}: constante${/^'/.test(o.txt) ? ` (código ${o.v})` : ''}`;
    case 'porta':
      return o.nome === 'LED' ? `LED: porta de saída (pino ${PINO_LED})`
        : o.nome === 'TELA' ? 'TELA: porta de saída para exibir texto'
        : `${o.nome}: porta de entrada`;
    case 'pino': return `${o.v}: pino ${o.v}`;
    case 'rotulo': return o.sistema ? `${o.nome}: rotina do sistema (exibe o TEXTO)` : `${o.nome}: rótulo, endereço ${o.end}`;
    case 'mem': return o.indice
      ? `${textoOperando(o)}: endereço ${o.nome} + ${o.indice.t === 'reg' ? o.indice.r : o.indice.v} (vetor ${o.nome} começa no endereço ${o.end})`
      : `${o.nome}: variável no endereço ${o.end}`;
  }
}

const U16 = (x: number) => ((x % 65536) + 65536) % 65536;

/** Executa uma instrução. Devolve true no HALT. */
function executarInstrucao(
  instr: Instrucao, est: Estado, micro: string[], acessos: Acesso[], ini: number,
  entradas: Record<string, number>, endTexto: number | undefined,
): boolean {
  const [a, b] = instr.operandos;

  const endereco = (o: Extract<Operando, { t: 'mem' }>): number => {
    if (!o.indice) return o.end;
    const i = o.indice.t === 'num' ? o.indice.v : est.regs[o.indice.r];
    if (i < 0 || i >= o.tamanho) throw new ErroExecucao(`Índice fora do vetor ${o.nome}: ${i} (vai de 0 a ${o.tamanho - 1}).`);
    return o.end + i;
  };

  /** Valor de registrador ou constante. */
  const valor = (o: Operando): number => {
    if (o.t === 'reg') return est.regs[o.r];
    if (o.t === 'num') return o.v;
    throw new Error('operando sem valor');
  };

  /** Pino indicado pelo operando (número ou registrador). */
  const pino = (o: Operando): number => {
    const p = o.t === 'pino' ? o.v : o.t === 'reg' ? est.regs[o.r] : -1;
    if (o.t === 'reg') micro.push(`${o.r} = ${p}: pino ${p}`);
    if (p < 0 || p > PINO_MAX) throw new ErroExecucao(`Pino inválido: ${p} (use 0 a ${PINO_MAX}).`);
    return p;
  };

  const gravarReg = (r: Registrador, v: number, origem = '') => {
    est.regs[r] = v;
    micro.push(`${r} ← ${origem || v}${origem ? ` = ${v}` : ''}`);
  };

  const flags = (r: number, c: 0 | 1) => {
    est.z = r === 0 ? 1 : 0;
    est.n = r < 0 ? 1 : 0;
    est.c = c;
    micro.push(`Flags: Z = ${est.z}, N = ${est.n}, C = ${est.c}`);
  };

  const desviar = (cond: boolean, explic: string) => {
    const alvo = a as Extract<Operando, { t: 'rotulo' }>;
    if (cond) {
      est.pc = alvo.end;
      micro.push(`${explic}: desvia`, `PC ← ${alvo.end} (${alvo.nome})`);
    } else {
      micro.push(`${explic}: não desvia (PC continua ${est.pc})`);
    }
  };

  const fz = `Z = ${est.z}`;
  const fn = `N = ${est.n}`;
  switch (instr.def.op) {
    case 'LOAD': {
      const r = (a as Extract<Operando, { t: 'reg' }>).r;
      if (b.t === 'num') { gravarReg(r, b.v); micro.push('(constante: não acessa a memória)'); break; }
      const m = b as Extract<Operando, { t: 'mem' }>;
      const e = endereco(m);
      est.mar = e;
      micro.push(m.indice
        ? `MAR ← ${m.nome} + ${m.indice.t === 'reg' ? `${m.indice.r} (${est.regs[m.indice.r]})` : m.indice.v} = ${e}`
        : `MAR ← ${e} (${m.nome})`);
      const v = est.dados[e - ini];
      acessos.push({ end: e, tipo: 'leitura' });
      if (v === null) throw new ErroExecucao(`${m.indice ? `${m.nome}[${e - m.end}]` : m.nome} está vazio: nenhum valor foi gravado nele ainda.`);
      est.mdr = v;
      micro.push(`MDR ← M[${e}] = ${v}`);
      gravarReg(r, v as number, 'MDR');
      break;
    }
    case 'STORE': {
      const m = a as Extract<Operando, { t: 'mem' }>;
      const r = (b as Extract<Operando, { t: 'reg' }>).r;
      const e = endereco(m);
      const v = est.regs[r];
      est.mar = e;
      est.mdr = v;
      est.dados[e - ini] = v;
      micro.push(m.indice
        ? `MAR ← ${m.nome} + ${m.indice.t === 'reg' ? `${m.indice.r} (${est.regs[m.indice.r]})` : m.indice.v} = ${e}`
        : `MAR ← ${e} (${m.nome})`, `MDR ← ${r} = ${v}`, `M[${e}] ← MDR`);
      acessos.push({ end: e, tipo: 'escrita' });
      break;
    }
    case 'MOV': {
      const d = (a as Extract<Operando, { t: 'reg' }>).r;
      const o = (b as Extract<Operando, { t: 'reg' }>).r;
      gravarReg(d, est.regs[o], o);
      break;
    }
    case 'ADD': case 'SUB': case 'MUL': case 'DIV': case 'CMP': {
      const r = (a as Extract<Operando, { t: 'reg' }>).r;
      const x = est.regs[r];
      const y = valor(b);
      const op = instr.def.op;
      if (op === 'DIV' && y === 0) throw new ErroExecucao('Divisão por zero.');
      const simb = { ADD: '+', SUB: '−', CMP: '−', MUL: '×', DIV: '÷' }[op];
      const res = op === 'ADD' ? x + y : op === 'MUL' ? x * y : op === 'DIV' ? Math.trunc(x / y) : x - y;
      const carry: 0 | 1 = op === 'ADD' ? (U16(x) + U16(y) > 0xFFFF ? 1 : 0)
        : op === 'SUB' || op === 'CMP' ? (U16(x) < U16(y) ? 1 : 0) : 0;
      est.ula = `${x} ${simb} ${y} = ${res}`;
      micro.push(`ULA: ${r} ${simb} ${textoOperando(b)} = ${x} ${simb} ${y} = ${res}`);
      if (op === 'CMP') micro.push('(resultado descartado: só as flags mudam)');
      else gravarReg(r, res);
      flags(res, carry);
      break;
    }
    case 'JMP': desviar(true, 'Desvio incondicional'); break;
    case 'JE': desviar(est.z === 1, fz); break;
    case 'JNE': desviar(est.z === 0, fz); break;
    case 'JG': desviar(est.z === 0 && est.n === 0, `${fz}, ${fn}`); break;
    case 'JGE': desviar(est.n === 0, fn); break;
    case 'JL': desviar(est.n === 1, fn); break;
    case 'JLE': desviar(est.n === 1 || est.z === 1, `${fz}, ${fn}`); break;
    case 'IN': {
      const r = (a as Extract<Operando, { t: 'reg' }>).r;
      const nome = b.t === 'porta' ? b.nome : String(pino(b));
      const v = entradas[nome] ?? 0;
      est.porta = { tipo: 'entrada', nome };
      micro.push(/^A\d$/.test(nome) ? `ADC: ${nome} → ${v} (0–5 V vira 0 a 1023)` : `Porta ${/^\d+$/.test(nome) ? 'pino ' + nome : nome} = ${v}`);
      gravarReg(r, v);
      break;
    }
    case 'OUT': {
      const r = (b as Extract<Operando, { t: 'reg' }>).r;
      const v = est.regs[r];
      if (a.t === 'porta' && a.nome === 'TELA') {
        est.saida += `${v}\n`;
        est.porta = { tipo: 'saida', nome: 'TELA' };
        micro.push(`TELA ← ${r} = ${v}`);
        break;
      }
      const p = a.t === 'porta' ? PINO_LED : pino(a);
      est.pinos[p] = v;
      est.porta = { tipo: 'saida', nome: String(p) };
      micro.push(`Pino ${p}${p === PINO_LED ? ' (LED)' : ''} ← ${r} = ${v} (${v ? 'HIGH: liga' : 'LOW: desliga'})`);
      break;
    }
    case 'DELAY': {
      const ms = valor(a);
      if (ms < 0) throw new ErroExecucao(`DELAY não aceita tempo negativo (${ms}).`);
      est.tempo += ms;
      micro.push(`Pausa de ${ms} ms (tempo total: ${est.tempo} ms)`);
      break;
    }
    case 'CALL': {
      const alvo = a as Extract<Operando, { t: 'rotulo' }>;
      if (alvo.sistema) {
        // rotina do sistema (como o printf): exibe na TELA o conteúdo de TEXTO
        const e = endTexto!;
        const v = est.dados[e - ini];
        est.mar = e;
        micro.push('Rotina do sistema: imprime', `MAR ← ${e} (${VARIAVEL_TEXTO})`);
        acessos.push({ end: e, tipo: 'leitura' });
        if (v === null) throw new ErroExecucao(`${VARIAVEL_TEXTO} está vazio: nada para imprimir.`);
        est.mdr = v;
        est.saida += String(v);
        est.porta = { tipo: 'saida', nome: 'TELA' };
        micro.push(`MDR ← M[${e}] = ${textoValor(v)}`, `TELA ← MDR`, 'Volta para a instrução seguinte.');
        break;
      }
      if (est.sp === null || est.sp - 1 < ini) throw new ErroExecucao('Pilha cheia.');
      est.sp--;
      est.mar = est.sp;
      est.mdr = est.pc;
      est.dados[est.sp - ini] = est.pc;
      micro.push(`SP ← SP − 1 = ${est.sp}`, `MAR ← SP (${est.sp})`, `MDR ← PC (${est.pc}: endereço de retorno)`, `M[${est.sp}] ← MDR`, `PC ← ${alvo.end} (${alvo.nome})`);
      acessos.push({ end: est.sp, tipo: 'escrita' });
      est.pc = alvo.end;
      break;
    }
    case 'RET': {
      if (est.sp === null || est.sp >= ini + est.dados.length) throw new ErroExecucao('RET sem CALL: a pilha está vazia.');
      const e = est.sp;
      const v = est.dados[e - ini] as number;
      est.mar = e;
      est.mdr = v;
      micro.push(`MAR ← SP (${e})`, `MDR ← M[${e}] = ${v}`, `PC ← MDR = ${v}`);
      acessos.push({ end: e, tipo: 'leitura' });
      est.pc = v;
      est.sp++;
      micro.push(`SP ← SP + 1 = ${est.sp}`);
      break;
    }
    case 'NOP': micro.push('Nada a fazer.'); break;
    case 'HALT': micro.push('A CPU para.'); return true;
  }
  return false;
}

function diferencas(ant: Passo | null, p: Passo, ini: number): string[] {
  if (!ant) return [];
  const m: string[] = [];
  REGISTRADORES.forEach(r => { if (ant.regs[r] !== p.regs[r]) m.push(r); });
  const simples: [string, keyof Passo][] = [['PC', 'pc'], ['IR', 'ir'], ['MAR', 'mar'], ['MDR', 'mdr'], ['SP', 'sp'], ['Z', 'z'], ['N', 'n'], ['C', 'c'], ['SAIDA', 'saida'], ['TEMPO', 'tempo']];
  simples.forEach(([k, c]) => { if (ant[c] !== p[c]) m.push(k); });
  Object.keys(p.pinos).forEach(k => { if (ant.pinos[+k] !== p.pinos[+k]) m.push('P' + k); });
  p.dados.forEach((v, i) => { if (ant.dados[i] !== v) m.push('M' + (i + ini)); });
  return m;
}

/** Monta e executa de uma vez. */
export function simular(codigo: string, entradas: Record<string, number> = {}): Execucao {
  return executar(montar(codigo), entradas);
}
