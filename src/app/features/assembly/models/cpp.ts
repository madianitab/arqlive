/**
 * Gera o código C++ (PC ou Arduino) que corresponde a um programa em Assembly simplificado,
 * legível: sem registradores e sem goto, só com expressões, if, for, while e funções.
 *
 *   LOAD R1, X / ADD R1, 2 / STORE D, R1     →   D = X + 2;
 *   IN R1, BOTAO / CMP R1, 1 / JNE FIM …     →   if (digitalRead(botao) == HIGH) { … }
 *   LOAD R1, 0 / LOOP: CMP R1, 3 / JE FIM …  →   for (int i = 0; i < 3; i++) { … }
 *
 * Como funciona: os registradores guardam EXPRESSÕES (não valores). Um STORE grava a
 * expressão na variável; IN/OUT/DELAY viram as funções do Arduino; CMP + desvio viram
 * if/if-else/for/while/break/continue; CALL rótulo vira uma função. Um registrador que leva
 * valor de uma volta do laço para a outra vira uma variável: o contador do laço (i, j, k…),
 * a própria variável da memória que ele copia (LOAD R1, soma … STORE soma, R1 → soma) ou
 * valor, valor2… O zero que o registrador tem antes de receber valor não aparece nas somas.
 * Quando há for, também é gerada a versão com while (codigoWhile). Laço com o teste no fim
 * vira while/for (nunca do-while). Se um desvio não corresponder a if/for/while (ex.: entra
 * no meio de um laço), não há C++: o resultado traz o aviso.
 */
import { Instrucao, Operando, Programa } from './assembly';
import { PINO_LED, REGISTRADORES, Registrador, VARIAVEL_TEXTO } from './instrucoes';

// ─────────────────────────── expressões ───────────────────────────

type Expr =
  /** imp: o 0 que o registrador tem antes de receber valor (zero implícito). */
  | { k: 'num'; v: number; txt: string; imp?: boolean }
  | { k: 'var'; n: string }
  | { k: 'idx'; n: string; i: Expr }
  | { k: 'bin'; op: '+' | '-' | '*' | '/'; l: Expr; r: Expr }
  | { k: 'call'; txt: string; digital: boolean }
  | { k: 'inval' };

const PREC = { '+': 1, '-': 1, '*': 2, '/': 2 } as const;
const prec = (e: Expr) => (e.k === 'bin' ? PREC[e.op] : 3);

function mostrar(e: Expr): string {
  switch (e.k) {
    case 'num': return e.txt;
    case 'var': return e.n;
    case 'idx': return `${e.n}[${mostrar(e.i)}]`;
    case 'call': return e.txt;
    case 'inval': throw new NaoEstruturado();
    case 'bin': {
      const p = PREC[e.op];
      const l = prec(e.l) < p ? `(${mostrar(e.l)})` : mostrar(e.l);
      const dirParen = prec(e.r) < p || (prec(e.r) === p && (e.op === '-' || e.op === '/'));
      const r = dirParen ? `(${mostrar(e.r)})` : mostrar(e.r);
      return `${l} ${e.op} ${r}`;
    }
  }
}

const igual = (a: Expr, b: Expr) => JSON.stringify(a) === JSON.stringify(b);

function usaVar(e: Expr, n: string): boolean {
  switch (e.k) {
    case 'var': return e.n === n;
    case 'idx': return e.n === n || usaVar(e.i, n);
    case 'bin': return usaVar(e.l, n) || usaVar(e.r, n);
    default: return false;
  }
}

/** Troca, em `e`, as ocorrências da expressão `de` pela variável `para`. */
function trocar(e: Expr, de: Expr, para: Expr): Expr {
  if (igual(e, de)) return para;
  if (e.k === 'bin') return { ...e, l: trocar(e.l, de, para), r: trocar(e.r, de, para) };
  if (e.k === 'idx') return { ...e, i: trocar(e.i, de, para) };
  return e;
}

const valido = (e: Expr) => { mostrar(e); return e; };

/** Soma com o zero implícito do registrador: o zero some (0 + 12 → 12). */
function somar(l: Expr, r: Expr): Expr {
  if (l.k === 'num' && l.imp) return r;
  return { k: 'bin', op: '+', l, r };
}

/** Linha de atribuição, com ++/-- quando for o caso (Y++;). */
function atribuicao(nome: string, e: Expr): string {
  const um = (x: Expr) => x.k === 'num' && x.v === 1;
  if (e.k === 'bin' && e.l.k === 'var' && e.l.n === nome && um(e.r) && (e.op === '+' || e.op === '-')) return `${nome}${e.op}${e.op};`;
  return `${nome} = ${mostrar(e)};`;
}

const AVISO_PADRAO = 'Este programa tem desvios que não correspondem a if, for ou while em C.';

class NaoEstruturado extends Error {
  constructor(msg = AVISO_PADRAO) { super(msg); }
}

function temChamada(e: Expr): boolean {
  if (e.k === 'call') return true;
  if (e.k === 'bin') return temChamada(e.l) || temChamada(e.r);
  if (e.k === 'idx') return temChamada(e.i);
  return false;
}

// ─────────────────────────── tradução ───────────────────────────

type Estado = Record<Registrador, Expr>;

const COMPARA: Record<string, string> = { JE: '==', JNE: '!=', JG: '>', JGE: '>=', JL: '<', JLE: '<=' };
const NEGA: Record<string, string> = { JE: '!=', JNE: '==', JG: '<=', JGE: '<', JL: '>=', JLE: '>' };
const DESVIOS = new Set(['JE', 'JNE', 'JG', 'JGE', 'JL', 'JLE']);
/** Instruções sem efeito visível (só mudam registradores): podem ficar antes do teste do laço. */
const PUROS = new Set(['LOAD', 'MOV', 'IN', 'ADD', 'SUB', 'MUL', 'DIV', 'NOP']);
const ESCREVEM = new Set(['LOAD', 'MOV', 'IN', 'ADD', 'SUB', 'MUL', 'DIV']);

export interface ResultadoCpp {
  /** C++ (com for, quando houver laço com contador). Vazio quando há aviso. */
  codigo: string;
  /** Mesma tradução com while no lugar de cada for (só existe quando o código tem for). */
  codigoWhile?: string;
  /** Motivo de não haver C++ (desvio que não corresponde a if/for/while). */
  aviso?: string;
}

export function ehArduino(p: Programa): boolean {
  return p.instrucoes.some(i =>
    i.def.op === 'IN' || i.def.op === 'DELAY' ||
    (i.def.op === 'OUT' && !(i.operandos[0].t === 'porta' && i.operandos[0].nome === 'TELA')));
}

export function traduzirCpp(p: Programa): ResultadoCpp {
  if (p.erros.length) return { codigo: '' };
  try {
    const t = new Tradutor(p, false);
    const codigo = t.gerar();
    return t.usouFor ? { codigo, codigoWhile: new Tradutor(p, true).gerar() } : { codigo };
  } catch (e) {
    if (!(e instanceof NaoEstruturado)) throw e;
    return { codigo: '', aviso: e.message };
  }
}

/** Só o texto do C++ (com for). */
export function gerarCpp(p: Programa): string {
  return traduzirCpp(p).codigo;
}

/** Um laço reconhecido no assembly. Índices de instruções; intervalos [início, fim). */
interface Laco {
  /** Rótulo do início (para onde o desvio de volta pula). */
  h: number;
  /** Desvio que volta para h (JMP ou Jcc). */
  t: number;
  /** Onde o código continua depois do laço. */
  fim: number;
  /** topo: teste antes do corpo; fim: teste depois do corpo; infinito: sem teste. */
  tipo: 'topo' | 'fim' | 'infinito';
  /** Instruções antes do teste, repetidas a cada volta (LOAD R1, X / CMP R1, 3 …). */
  prefixo: [number, number];
  /** sai: o Jcc sai do laço quando a condição vale; senão, volta para o início. */
  teste: { cmp: number; jcc: number; sai: boolean } | null;
  corpo: [number, number];
  /** Alvo dos break. */
  saida: number;
  /** Bloco depois do laço que só o break executa (ACHOU: … antes de FIM:). */
  extra: [number, number] | null;
  /** Alvo dos continue (-1: não há). */
  continua: number;
  /** JMP para o meio do laço: trecho executado uma vez antes dele. */
  antes: [number, number] | null;
}

interface Contexto { continua: number; saida: number; extra: [number, number] | null }

class Tradutor {
  private readonly ins: Instrucao[];
  private readonly arduino: boolean;
  private readonly rotuloEm = new Map<number, string>();
  private readonly texto: string | null;
  private textoPendente: string | null = null;
  /** Nomes dos contadores dos laços (os já usados por variáveis são tirados no construtor). */
  private contadores = ['i', 'j', 'k', 'm', 'n'];
  private usaLed = false;
  private usaBotao = false;
  private usaTela = false;
  private pinosConstantes = new Set<number>();
  /** Registradores ligados a uma variável do C++ (contador, variável local ou global). */
  private locais = new Map<Registrador, string>();
  /** Último nome que cada registrador teve como variável (para reaproveitar no laço seguinte). */
  private ultimoLocal = new Map<Registrador, string>();
  private nomesUsados = new Set<string>();
  /** Variáveis da memória que viraram o contador do for (não são declaradas). */
  private ocultas = new Set<string>();
  /** Sub-rotinas (CALL rótulo / RET) → funções. Chave: índice do rótulo. */
  private funcoes = new Map<number, { ini: number; fim: number; nome: string }>();
  /** Registradores usados nas sub-rotinas: viram variáveis globais. */
  private globais: string[] = [];
  private regsFuncao = new Set<Registrador>();
  private emFuncao = false;
  private fimPrincipal: number;
  private contexto: Contexto[] = [];
  usouFor = false;

  constructor(private readonly p: Programa, private readonly modoWhile: boolean) {
    this.ins = p.instrucoes;
    this.fimPrincipal = this.ins.length;
    this.arduino = ehArduino(p);
    p.rotulos.forEach(r => this.rotuloEm.set(r.end, r.nome));
    const t = p.variaveis.find(v => v.nome.toUpperCase() === VARIAVEL_TEXTO);
    this.texto = t && typeof t.valores[0] === 'string' ? t.valores[0] : null;
    p.variaveis.forEach(v => this.nomesUsados.add(v.nome.toLowerCase()));
    this.contadores = this.contadores.filter(n => !this.nomesUsados.has(n));
    ['i', 'j', 'k', 'm', 'n', 'p', 'led', 'botao'].forEach(n => this.nomesUsados.add(n));
  }

  gerar(): string {
    this.detectarFuncoes();
    const st = this.estadoInicial();
    let setup: string[] = [];
    let corpo: string[];
    const continuo = this.arduino && !this.funcoes.size ? this.lacoDoLoop() : null;
    if (continuo) {
      // o laço infinito do fim vira o próprio loop() do Arduino; o que vem antes vai para o setup()
      setup = this.bloco(0, continuo.h, st, 1, true);
      this.fecharTexto(setup, 1);
      this.escritos(continuo.h, continuo.t).forEach(r => { if (!this.locais.has(r)) st[r] = { k: 'inval' }; });
      this.invalidarLeituras(st, this.gravadas(continuo.h, continuo.t));
      corpo = this.bloco(continuo.h, continuo.t, st, 1, true);
    } else {
      corpo = this.bloco(0, this.fimPrincipal, st, 1, true);
    }
    this.fecharTexto(corpo, 1);

    const funcs: string[] = [];
    for (const f of this.funcoes.values()) {
      this.emFuncao = true;
      const linhas = this.bloco(f.ini, f.fim, this.estadoInicial(), 1);
      this.fecharTexto(linhas, 1);
      this.emFuncao = false;
      funcs.push(`void ${f.nome}() {`, ...linhas, '}', '');
    }

    const out: string[] = [];
    const vars = this.p.variaveis.filter(v => !this.ocultas.has(v.nome)
      && !(v.nome.toUpperCase() === VARIAVEL_TEXTO && typeof v.valores[0] === 'string'));
    const escalares = vars.filter(v => v.valores.length === 1 && typeof v.valores[0] !== 'string')
      .map(v => (v.valores[0] === null ? v.nome : `${v.nome} = ${v.valores[0]}`));
    const outras = vars.filter(v => v.valores.length > 1 || typeof v.valores[0] === 'string')
      .map(v => (typeof v.valores[0] === 'string'
        ? `const char ${v.nome}[] = "${v.valores[0]}";`
        : `int ${v.nome}[] = {${v.valores.map(x => x ?? 0).join(', ')}};`));
    const decl = [...(escalares.length ? [`int ${escalares.join(', ')};`] : []), ...outras];
    if (this.globais.length) decl.push(`int ${this.globais.join(', ')};`);

    if (this.arduino) {
      if (this.usaLed) out.push(`int led = ${PINO_LED};`);
      if (this.usaBotao) out.push('int botao = 2;');
      out.push(...decl);
      if (out.length) out.push('');
      out.push(...funcs);
      out.push('void setup() {');
      if (this.usaTela) out.push('  Serial.begin(9600);');
      if (this.usaLed) out.push('  pinMode(led, OUTPUT);');
      [...this.pinosConstantes].sort((a, b) => a - b).forEach(n => out.push(`  pinMode(${n}, OUTPUT);`));
      this.p.variaveis.filter(v => this.vetoresPino.has(v.nome)).forEach(v =>
        out.push(`  for (int p = 0; p < ${v.valores.length}; p++) pinMode(${v.nome}[p], OUTPUT);`));
      if (this.usaBotao) out.push('  pinMode(botao, INPUT);');
      out.push(...setup, '}', '', 'void loop() {', ...corpo, '}');
    } else {
      if (this.usaTela) out.push('#include <stdio.h>', '');
      if (this.funcoes.size) {
        // as funções usam as variáveis: elas ficam globais
        out.push(...decl, '', ...funcs, 'int main() {', ...corpo, '}');
      } else {
        out.push('int main() {', ...decl.map(d => '  ' + d), ...corpo, '}');
      }
    }
    return out.join('\n');
  }

  private vetoresPino = new Set<string>();

  private estadoInicial(): Estado {
    const st = {} as Estado;
    REGISTRADORES.forEach(r => {
      const g = this.regsFuncao.has(r) ? this.locais.get(r) : undefined;
      st[r] = g ? { k: 'var', n: g } : { k: 'num', v: 0, txt: '0', imp: true };
    });
    return st;
  }

  // ─────────── sub-rotinas e loop() do Arduino ───────────

  /** CALL rótulo / RET → funções. As sub-rotinas ficam depois do HALT do programa principal. */
  private detectarFuncoes(): void {
    const alvos = new Set<number>();
    this.ins.forEach(it => {
      const a = it.operandos[0];
      if (it.def.op === 'CALL' && a.t === 'rotulo' && !a.sistema) alvos.add(a.end);
    });
    if (!alvos.size) {
      if (this.ins.some(it => it.def.op === 'RET')) throw new NaoEstruturado('O RET só pode aparecer no fim de uma sub-rotina chamada com CALL.');
      return;
    }
    const ord = [...alvos].sort((a, b) => a - b);
    if (this.ins[ord[0] - 1]?.def.op !== 'HALT') {
      throw new NaoEstruturado('Para virar função em C, a sub-rotina precisa ficar depois do HALT do programa principal.');
    }
    this.fimPrincipal = ord[0];
    let k = ord[0];
    for (const a of ord) {
      if (a !== k) throw new NaoEstruturado('Uma sub-rotina chamada com CALL entra no meio de outra: isso não corresponde a uma função em C.');
      let r = a;
      while (r < this.ins.length && this.ins[r].def.op !== 'RET') r++;
      if (r >= this.ins.length) throw new NaoEstruturado(`A sub-rotina ${this.rotuloEm.get(a)} precisa terminar com RET.`);
      let nome = (this.rotuloEm.get(a) ?? `rotina${a}`).toLowerCase();
      while (this.nomesUsados.has(nome)) nome += '_';
      this.nomesUsados.add(nome);
      this.funcoes.set(a, { ini: a, fim: r, nome });
      k = r + 1;
    }
    if (k !== this.ins.length) throw new NaoEstruturado('Há instruções depois do RET que não pertencem a nenhuma sub-rotina.');
    // registradores usados nas sub-rotinas viram variáveis globais
    const regs = new Set<Registrador>();
    for (let i = this.fimPrincipal; i < this.ins.length; i++) {
      this.ins[i].operandos.forEach(o => {
        if (o.t === 'reg') regs.add(o.r);
        if (o.t === 'mem' && o.indice?.t === 'reg') regs.add(o.indice.r);
      });
    }
    REGISTRADORES.filter(r => regs.has(r)).forEach(r => {
      const nome = this.novoLocal();
      this.locais.set(r, nome);
      this.globais.push(nome);
      this.regsFuncao.add(r);
    });
  }

  /** Laço infinito no fim do programa do Arduino, sem break e sem valor de uma volta para a outra. */
  private lacoDoLoop(): { h: number; t: number } | null {
    const t = this.fimPrincipal - 1;
    const v = this.ins[t];
    if (!v || v.def.op !== 'JMP') return null;
    const h = this.alvo(v);
    if (!this.rotuloEm.has(h) || h > t) return null;
    const l = this.detectarLaco(h, t + 1);
    if (!l || l.tipo !== 'infinito' || l.t !== t) return null;
    for (let k = 0; k < this.ins.length; k++) {
      const it = this.ins[k];
      if (k === t || !(it.def.op === 'JMP' || DESVIOS.has(it.def.op))) continue;
      const a = this.alvo(it);
      if (k >= h ? (a <= h || a > t) : a > h) return null;
    }
    const mudam = this.escritos(h, t);
    if ([...this.vivos(h, t)].some(r => mudam.has(r))) return null;
    return { h, t };
  }

  // ─────────── blocos ───────────

  /** Traduz as instruções [s, e). */
  private bloco(s: number, e: number, st: Estado, nivel: number, topo = false): string[] {
    const ind = '  '.repeat(nivel);
    const out: string[] = [];
    const emitir = (l: string) => { this.fecharTexto(out, nivel); out.push(ind + l); };
    let i = s;
    while (i < e) {
      const it = this.ins[i];
      const op = it.def.op;

      // break / continue do laço atual
      const prox = this.controleLaco(i, e, st, out, nivel);
      if (prox >= 0) { i = prox; continue; }
      const laco = this.detectarLaco(i, e);
      if (laco) {
        i = this.traduzirLaco(laco, st, out, nivel);
        continue;
      }
      // if / if-else: CMP a, b / Jcc SENAO / … [JMP FIM / SENAO: …] / FIM:
      if (op === 'CMP' && i + 1 < e && DESVIOS.has(this.ins[i + 1].def.op)) {
        const alvo = this.alvo(this.ins[i + 1]);
        if (alvo > i + 1 && alvo <= e) {
          i = this.traduzirIf(i, alvo, e, st, out, nivel);
          continue;
        }
      }
      if (op === 'JMP' || DESVIOS.has(op) || op === 'RET') throw new NaoEstruturado(this.avisoDesvio(i));

      const [a, b] = it.operandos;
      switch (op) {
        case 'LOAD': this.definir(this.reg(a), this.expr(b, st), st, emitir, i); break;
        case 'MOV': this.definir(this.reg(a), valido(st[this.reg(b)]), st, emitir, i); break;
        case 'ADD': case 'SUB': case 'MUL': case 'DIV': {
          const r = this.reg(a);
          const l = valido(st[r]);
          const d = valido(this.expr(b, st));
          const simb = ({ ADD: '+', SUB: '-', MUL: '*', DIV: '/' } as const)[op];
          this.definir(r, simb === '+' ? somar(l, d) : { k: 'bin', op: simb, l, r: d }, st, emitir, i);
          break;
        }
        case 'CMP': case 'NOP': break;
        case 'STORE': { const l = this.store(a, this.reg(b), st); if (l) emitir(l); break; }
        case 'IN': {
          const nome = b.t === 'porta' ? b.nome : b.t === 'pino' ? String(b.v) : mostrar(st[this.reg(b)]);
          const analog = /^A\d$/.test(nome);
          if (nome === 'BOTAO') this.usaBotao = true;
          this.definir(this.reg(a), { k: 'call', txt: `${analog ? 'analogRead' : 'digitalRead'}(${nome === 'BOTAO' ? 'botao' : nome})`, digital: !analog }, st, emitir, i);
          break;
        }
        case 'OUT': {
          const v = valido(st[this.reg(b)]);
          if (a.t === 'porta' && a.nome === 'TELA') {
            this.usaTela = true;
            const txt = this.textoPendente;
            this.textoPendente = null;
            if (this.arduino) {
              if (txt !== null) out.push(`${ind}Serial.print("${txt}");`);
              out.push(`${ind}Serial.println(${mostrar(v)});`);
            } else {
              out.push(`${ind}printf("${txt ?? ''}%d", ${mostrar(v)});`);
            }
            break;
          }
          let pino: string;
          if (a.t === 'porta') { this.usaLed = true; pino = 'led'; }
          else if (a.t === 'pino') { this.pinosConstantes.add(a.v); pino = String(a.v); }
          else {
            const pe = valido(st[this.reg(a)]);
            if (pe.k === 'num') this.pinosConstantes.add(pe.v);
            if (pe.k === 'idx') this.vetoresPino.add(pe.n);
            pino = mostrar(pe);
          }
          emitir(`digitalWrite(${pino}, ${this.nivelLogico(v)});`);
          break;
        }
        case 'DELAY': emitir(`delay(${mostrar(this.expr(a, st))});`); break;
        case 'CALL': {
          if (a.t === 'rotulo' && !a.sistema) {
            const f = this.funcoes.get(a.end);
            if (!f) throw new NaoEstruturado();
            emitir(`${f.nome}();`);
            // a função pode ter mudado as variáveis globais e a memória
            this.invalidarLeituras(st, new Set([...this.gravadas(f.ini, f.fim), ...this.globais]));
            break;
          }
          if (this.texto === null) throw new NaoEstruturado();
          this.fecharTexto(out, nivel);
          this.usaTela = true;
          this.textoPendente = this.texto;
          break;
        }
        case 'HALT':
          if (this.emFuncao) throw new NaoEstruturado('HALT dentro de uma sub-rotina não corresponde a uma função em C.');
          if (!(topo && i === this.fimPrincipal - 1)) emitir(this.arduino ? 'while (true) { }' : 'return 0;');
          break;
      }
      i++;
    }
    return out;
  }

  /** Desvio para o fim (break), para o teste (continue) ou para o bloco do break do laço atual. */
  private controleLaco(i: number, e: number, st: Estado, out: string[], nivel: number): number {
    const ctx = this.contexto[this.contexto.length - 1];
    if (!ctx) return -1;
    const it = this.ins[i];
    const tipo = (alvo: number) => alvo === ctx.continua ? 'continue'
      : alvo === ctx.saida ? 'break'
      : ctx.extra && alvo === ctx.extra[0] ? 'extra' : null;
    let cond: string | null = null;
    let jcc: Instrucao;
    let prox: number;
    if (it.def.op === 'JMP') { jcc = it; prox = i + 1; }
    else if (it.def.op === 'CMP' && i + 1 < e && DESVIOS.has(this.ins[i + 1].def.op)) { jcc = this.ins[i + 1]; prox = i + 2; }
    else return -1;
    const t = tipo(this.alvo(jcc));
    if (!t) return -1;
    if (jcc !== it) cond = this.condicao(it, jcc, st, false);
    const ind = '  '.repeat(nivel);
    this.fecharTexto(out, nivel);
    if (t === 'extra') {
      const linhas = this.bloco(ctx.extra![0], ctx.extra![1], { ...st }, nivel + 1);
      this.fecharTexto(linhas, nivel + 1);
      out.push(cond ? `${ind}if (${cond}) {` : `${ind}{`, ...linhas, `${ind}  break;`, `${ind}}`);
    } else {
      out.push(cond ? `${ind}if (${cond}) ${t};` : `${ind}${t};`);
    }
    return prox;
  }

  /**
   * Novo valor do registrador. Se ele está ligado a uma variável do C++, a atribuição vai
   * para o código na hora; senão, ele só guarda a expressão.
   */
  private definir(r: Registrador, novo: Expr, st: Estado, emitir: (l: string) => void, idx: number): void {
    const nome = this.locais.get(r);
    if (!nome) { st[r] = novo; return; }
    const v: Expr = { k: 'var', n: nome };
    if (igual(novo, v)) return;
    const linha = atribuicao(nome, valido(novo));
    // outro registrador que depende do valor antigo e ainda vai ser usado ganha uma variável
    REGISTRADORES.forEach(k => {
      if (k === r || this.locais.has(k) || !usaVar(st[k], nome)) return;
      if (this.vivo(k, idx + 1)) {
        const n = this.novoLocal();
        emitir(`int ${n} = ${mostrar(st[k])};`);
        st[k] = { k: 'var', n };
      } else {
        st[k] = { k: 'inval' };
      }
    });
    emitir(linha);
    st[r] = v;
  }

  /** Valor do registrador depois de um bloco que o alterou. */
  private aposMudanca(r: Registrador): Expr {
    const nome = this.locais.get(r);
    return nome ? { k: 'var', n: nome } : { k: 'inval' };
  }

  private novoLocal(): string {
    for (let n = 1; ; n++) {
      const nome = n === 1 ? 'valor' : `valor${n}`;
      if (!this.nomesUsados.has(nome)) { this.nomesUsados.add(nome); return nome; }
    }
  }

  private novoContador(): string {
    const n = this.contadores.shift();
    if (n) return n;
    for (let k = 2; ; k++) {
      const nome = `i${k}`;
      if (!this.nomesUsados.has(nome)) { this.nomesUsados.add(nome); return nome; }
    }
  }

  /** Registradores lidos pela instrução. */
  private lidos(it: Instrucao): Registrador[] {
    const so = ['LOAD', 'MOV', 'IN'].includes(it.def.op);
    const r: Registrador[] = [];
    it.operandos.forEach((o, k) => {
      if (o.t === 'reg' && !(so && k === 0)) r.push(o.r);
      if (o.t === 'mem' && o.indice?.t === 'reg') r.push(o.indice.r);
    });
    return r;
  }

  /**
   * Registradores lidos em [s, e) antes de receberem valor novo:
   * guardam o valor da volta anterior. Escrita depois de um desvio não conta como certa.
   */
  private vivos(s: number, e: number, pular = -1, teste = -1): Set<Registrador> {
    const vivos = new Set<Registrador>();
    const definidos = new Set<Registrador>();
    let condicional = false;
    for (let k = s; k < e; k++) {
      if (k === pular) continue;
      const it = this.ins[k];
      this.lidos(it).forEach(r => { if (!definidos.has(r)) vivos.add(r); });
      if (k !== teste && (it.def.op === 'JMP' || DESVIOS.has(it.def.op))) { condicional = true; continue; }
      const a = it.operandos[0];
      if (!condicional && a?.t === 'reg' && ESCREVEM.has(it.def.op)) definidos.add(a.r);
    }
    return vivos;
  }

  /** O valor do registrador, a partir da instrução `ini`, ainda é lido (seguindo os desvios)? */
  private vivo(r: Registrador, ini: number): boolean {
    const visto = new Set<number>();
    const pilha = [ini];
    while (pilha.length) {
      let k = pilha.pop()!;
      while (k >= 0 && k < this.ins.length && !visto.has(k)) {
        visto.add(k);
        const it = this.ins[k];
        const op = it.def.op;
        if (this.lidos(it).includes(r)) return true;
        if (op === 'HALT' || op === 'RET') break;
        if (op === 'CALL' && it.operandos[0].t === 'rotulo' && !it.operandos[0].sistema && this.regsFuncao.has(r)) return true;
        if (op === 'JMP') { k = this.alvo(it); continue; }
        if (DESVIOS.has(op)) { pilha.push(this.alvo(it)); k++; continue; }
        const a = it.operandos[0];
        if (['LOAD', 'MOV', 'IN'].includes(op) && a.t === 'reg' && a.r === r) break;
        k++;
      }
    }
    return false;
  }

  /** Texto do CALL imprime que não foi seguido de OUT TELA. */
  private fecharTexto(out: string[], nivel: number): void {
    if (this.textoPendente === null) return;
    const ind = '  '.repeat(nivel);
    out.push(this.arduino ? `${ind}Serial.print("${this.textoPendente}");` : `${ind}printf("${this.textoPendente}");`);
    this.textoPendente = null;
  }

  /** Linha do STORE ('' quando a variável já tem esse valor: o registrador é a própria variável). */
  private store(a: Operando, r: Registrador, st: Estado): string {
    const e = valido(st[r]);
    if (a.t !== 'mem') throw new NaoEstruturado();
    let linha: string;
    let novo: Expr;
    if (a.indice) {
      const idx = a.indice.t === 'num' ? { k: 'num', v: a.indice.v, txt: String(a.indice.v) } as Expr : valido(st[a.indice.r]);
      novo = { k: 'idx', n: a.nome, i: idx };
      linha = `${a.nome}[${mostrar(idx)}] = ${mostrar(e)};`;
      // qualquer expressão que leia o vetor fica desatualizada
      REGISTRADORES.forEach(k => { if (k !== r && usaVar(st[k], a.nome)) st[k] = { k: 'inval' }; });
    } else {
      if (e.k === 'var' && e.n === a.nome) return '';
      novo = { k: 'var', n: a.nome };
      linha = atribuicao(a.nome, e);
      // a variável mudou: o que dependia do valor antigo passa a usar o novo, se der
      // (ex.: R2 = B + A * B e STORE A com A * B  →  R2 = B + A); senão fica inválido
      const marca: Expr = { k: 'var', n: '\u0000novo' };
      REGISTRADORES.forEach(k => {
        if (k === r || !usaVar(st[k], a.nome)) return;
        const t = trocar(st[k], e, marca);
        st[k] = usaVar(t, a.nome) ? { k: 'inval' } : trocar(t, marca, novo);
      });
    }
    if (!this.locais.has(r)) st[r] = novo;
    return linha;
  }

  private nivelLogico(v: Expr): string {
    if (v.k === 'num' && (v.v === 0 || v.v === 1) && /^\d+$/.test(v.txt)) return v.v ? 'HIGH' : 'LOW';
    return mostrar(v);
  }

  private reg(o: Operando): Registrador {
    if (o.t !== 'reg') throw new NaoEstruturado();
    return o.r;
  }

  private expr(o: Operando, st: Estado): Expr {
    switch (o.t) {
      case 'reg': return valido(st[o.r]);
      case 'num': return { k: 'num', v: o.v, txt: o.txt };
      case 'mem':
        if (!o.indice) return { k: 'var', n: o.nome };
        return { k: 'idx', n: o.nome, i: o.indice.t === 'num' ? { k: 'num', v: o.indice.v, txt: String(o.indice.v) } : valido(st[o.indice.r]) };
      default: throw new NaoEstruturado();
    }
  }

  private alvo(it: Instrucao): number {
    const a = it.operandos[0];
    if (a.t !== 'rotulo' || a.sistema) throw new NaoEstruturado();
    return a.end;
  }

  private ehDesvio(it: Instrucao): boolean {
    return it.def.op === 'JMP' || DESVIOS.has(it.def.op);
  }

  private avisoDesvio(i: number): string {
    const it = this.ins[i];
    return `O desvio ${it.texto} (linha ${it.linha}) não corresponde a if, for ou while em C.`;
  }

  /** Registradores escritos em [s, e). */
  private escritos(s: number, e: number): Set<Registrador> {
    const w = new Set<Registrador>();
    for (let k = s; k < e; k++) {
      const it = this.ins[k];
      const a = it.operandos[0];
      if (ESCREVEM.has(it.def.op) && a?.t === 'reg') w.add(a.r);
      if (it.def.op === 'CALL' && a?.t === 'rotulo' && !a.sistema) this.regsFuncao.forEach(r => w.add(r));
    }
    return w;
  }

  /** Variáveis gravadas (STORE) em [s, e), incluindo as das funções chamadas. */
  private gravadas(s: number, e: number): Set<string> {
    const g = new Set<string>();
    for (let k = s; k < e; k++) {
      const it = this.ins[k];
      const a = it.operandos[0];
      if (it.def.op === 'STORE' && a.t === 'mem') g.add(a.nome);
      if (it.def.op === 'CALL' && a.t === 'rotulo' && !a.sistema) {
        const f = this.funcoes.get(a.end);
        if (f) this.gravadas(f.ini, f.fim).forEach(n => g.add(n));
      }
    }
    return g;
  }

  /** Invalida os registradores cujas expressões leem alguma dessas variáveis. */
  private invalidarLeituras(st: Estado, vars: Set<string>): void {
    REGISTRADORES.forEach(k => {
      if (!this.locais.has(k) && [...vars].some(v => usaVar(st[k], v))) st[k] = { k: 'inval' };
    });
  }

  /** Instruções que leem ou gravam a variável da memória. */
  private acessa(it: Instrucao, nome: string): boolean {
    return it.operandos.some(o => o.t === 'mem' && o.nome === nome);
  }

  private ehVariavelSimples(nome: string): boolean {
    const v = this.p.variaveis.find(x => x.nome === nome);
    return !!v && v.valores.length === 1 && typeof v.valores[0] !== 'string';
  }

  /** Valor da variável quando ela nunca é gravada (STORE) no programa. */
  private valorFixo(nome: string): number | null {
    const v = this.p.variaveis.find(x => x.nome === nome);
    if (!v || v.valores.length !== 1 || typeof v.valores[0] !== 'number') return null;
    if (this.ins.some(it => it.def.op === 'STORE' && it.operandos[0].t === 'mem' && it.operandos[0].nome === nome)) return null;
    return v.valores[0];
  }

  private valorConhecido(e: Expr): number | null {
    if (e.k === 'num') return e.v;
    if (e.k === 'var') return this.valorFixo(e.n);
    return null;
  }

  private condicao(cmp: Instrucao, jcc: Instrucao, st: Estado, negar = true): string {
    const [a, b] = cmp.operandos;
    const A = valido(st[this.reg(a)]);
    const B = this.expr(b, st);
    let bs = mostrar(B);
    if (A.k === 'call' && A.digital && B.k === 'num' && (B.v === 0 || B.v === 1)) bs = B.v ? 'HIGH' : 'LOW';
    return `${mostrar(A)} ${(negar ? NEGA : COMPARA)[jcc.def.op]} ${bs}`;
  }

  private traduzirIf(i: number, alvo: number, e: number, st: Estado, out: string[], nivel: number): number {
    const ind = '  '.repeat(nivel);
    this.fecharTexto(out, nivel);
    const cond = this.condicao(this.ins[i], this.ins[i + 1], st);
    // if-else: o bloco "então" termina com JMP FIM (FIM depois do SENAO)
    const ult = this.ins[alvo - 1];
    let fim = alvo;
    let senao: [number, number] | null = null;
    if (alvo - 1 > i + 1 && ult.def.op === 'JMP') {
      const f = this.alvo(ult);
      if (f > alvo && f <= e) { senao = [alvo, f]; fim = f; }
    }
    const fimEntao = senao ? alvo - 1 : alvo;
    const stEntao = { ...st };
    const linhasEntao = this.bloco(i + 2, fimEntao, stEntao, nivel + 1);
    this.fecharTexto(linhasEntao, nivel + 1);
    out.push(`${ind}if (${cond}) {`, ...linhasEntao);
    const mudaram = this.escritos(i + 2, fimEntao);
    if (senao) {
      const stSenao = { ...st };
      const linhasSenao = this.bloco(senao[0], senao[1], stSenao, nivel + 1);
      this.fecharTexto(linhasSenao, nivel + 1);
      out.push(`${ind}} else {`, ...linhasSenao);
      this.escritos(senao[0], senao[1]).forEach(r => mudaram.add(r));
    }
    out.push(`${ind}}`);
    mudaram.forEach(r => st[r] = this.aposMudanca(r));
    this.invalidarVariaveis(st, mudaram);
    this.invalidarLeituras(st, this.gravadas(i + 2, fim));
    return fim;
  }

  /** Expressões que usam variáveis do C++ (de registradores) que mudaram ficam inválidas. */
  private invalidarVariaveis(st: Estado, mudaram: Set<Registrador>): void {
    const nomes = new Set([...mudaram].map(r => this.locais.get(r)).filter((n): n is string => !!n));
    if (nomes.size) this.invalidarLeituras(st, nomes);
  }

  // ─────────── laços ───────────

  /** Último desvio em (h, e) que volta para h. */
  private ultimaVolta(h: number, e: number): number {
    for (let k = e - 1; k > h - 1; k--) {
      const it = this.ins[k];
      if (this.ehDesvio(it) && this.alvo(it) === h) return k;
    }
    return -1;
  }

  /**
   * Reconhece um laço começando em i:
   *   ROTULO: [LOAD…] CMP / Jcc FIM / … / JMP ROTULO / FIM:   teste no início (while, for)
   *   ROTULO: … / CMP / Jcc ROTULO                           teste no fim
   *   ROTULO: … / JMP ROTULO                                 laço infinito
   *   JMP TESTE / ROTULO: … / TESTE: … CMP / Jcc ROTULO      entra pelo teste
   */
  private detectarLaco(i: number, e: number): Laco | null {
    const it = this.ins[i];
    if (it.def.op === 'JMP' && this.rotuloEm.has(i + 1)) {
      const h = i + 1;
      const m = this.alvo(it);
      const t = this.ultimaVolta(h, e);
      if (t > h && DESVIOS.has(this.ins[t].def.op) && this.ins[t - 1].def.op === 'CMP' && m > h && m <= t - 1) {
        return this.validarLaco({
          h, t, fim: t + 1, tipo: 'topo', prefixo: [h, h], teste: { cmp: t - 1, jcc: t, sai: false },
          corpo: [h, t - 1], saida: t + 1, extra: null, continua: -1, antes: m < t - 1 ? [m, t - 1] : null,
        }, i);
      }
      return null;
    }
    if (!this.rotuloEm.has(i)) return null;
    const h = i;
    const t = this.ultimaVolta(h, e);
    if (t < 0) return null;
    const volta = this.ins[t];
    if (volta.def.op === 'JMP') {
      let k = h;
      while (k < t && PUROS.has(this.ins[k].def.op) && (k === h || !this.rotuloEm.has(k))) k++;
      const ok = k + 1 < t && this.ins[k].def.op === 'CMP' && (k === h || !this.rotuloEm.has(k))
        && DESVIOS.has(this.ins[k + 1].def.op) && !this.rotuloEm.has(k + 1);
      const saida = ok ? this.alvo(this.ins[k + 1]) : -1;
      if (ok && saida > t && saida <= e) {
        return this.validarLaco({
          h, t, fim: saida, tipo: 'topo', prefixo: [h, k], teste: { cmp: k, jcc: k + 1, sai: true },
          corpo: [k + 2, t], saida, extra: saida > t + 1 ? [t + 1, saida] : null, continua: h, antes: null,
        }, h);
      }
      return this.validarLaco({
        h, t, fim: t + 1, tipo: 'infinito', prefixo: [h, h], teste: null,
        corpo: [h, t], saida: t + 1, extra: null, continua: h, antes: null,
      }, h);
    }
    if (t - 1 >= h && this.ins[t - 1].def.op === 'CMP') {
      return this.validarLaco({
        h, t, fim: t + 1, tipo: 'fim', prefixo: [h, h], teste: { cmp: t - 1, jcc: t, sai: false },
        corpo: [h, t - 1], saida: t + 1, extra: null, continua: this.rotuloEm.has(t - 1) ? t - 1 : -1, antes: null,
      }, h);
    }
    return null;
  }

  /** Confere as entradas e saídas do laço (desvios para o meio dele ou para fora). */
  private validarLaco(l: Laco, ini: number): Laco {
    for (let k = 0; k < this.ins.length; k++) {
      const it = this.ins[k];
      if (!this.ehDesvio(it)) continue;
      const a = this.alvo(it);
      const dentro = k >= ini && k <= l.t;
      if (!dentro) {
        if (a > l.h && a <= l.t) {
          throw new NaoEstruturado(`O desvio ${it.texto} (linha ${it.linha}) entra no meio de um laço. Isso não corresponde a if, for ou while em C.`);
        }
        if (a === l.h && k > l.t) throw new NaoEstruturado(this.avisoDesvio(k));
        continue;
      }
      if (k === l.t || (l.teste && k === l.teste.jcc)) continue;
      if (a < l.h || (a > l.t && a !== l.saida && !(l.extra && a === l.extra[0]))) {
        throw new NaoEstruturado(`O desvio ${it.texto} (linha ${it.linha}) sai do laço para um ponto que não corresponde a break em C.`);
      }
    }
    if (l.extra) {
      const alvo = l.extra[0];
      const entradas = this.ins.filter(it => this.ehDesvio(it) && this.alvo(it) === alvo).length;
      let limpo = entradas === 1;
      for (let k = l.extra[0]; k < l.extra[1] && limpo; k++) {
        if (this.ehDesvio(this.ins[k]) || this.ins[k].def.op === 'HALT' || (k > alvo && this.rotuloEm.has(k))) limpo = false;
      }
      if (!limpo) throw new NaoEstruturado(`O trecho do rótulo ${this.rotuloEm.get(alvo)} fica entre o laço e o seu fim: isso não corresponde a break em C.`);
    }
    return l;
  }

  /** Algum desvio em [s, e) vai para `alvo`? */
  private temDesvioPara(s: number, e: number, alvo: number): boolean {
    for (let k = s; k < e; k++) if (this.ehDesvio(this.ins[k]) && this.alvo(this.ins[k]) === alvo) return true;
    return false;
  }

  /** O registrador só muda, em [s, e), com ADD/SUB de constante? */
  private soContaComConstante(r: Registrador, s: number, e: number): boolean {
    let muda = false;
    for (let k = s; k < e; k++) {
      const it = this.ins[k];
      const [a, b] = it.operandos;
      if (!(ESCREVEM.has(it.def.op) && a?.t === 'reg' && a.r === r)) continue;
      if (!((it.def.op === 'ADD' || it.def.op === 'SUB') && b.t === 'num')) return false;
      muda = true;
    }
    return muda;
  }

  /**
   * O registrador k, que começa com o valor da variável X, pode ser a própria X no C++?
   * Sim quando o laço não usa X da memória e, logo depois do laço, o registrador é gravado em X.
   */
  private podeSerVariavel(k: Registrador, x: string, l: Laco, st: Estado): boolean {
    if (!this.ehVariavelSimples(x)) return false;
    for (let q = l.h; q <= l.t; q++) if (this.acessa(this.ins[q], x)) return false;
    if (REGISTRADORES.some(j => j !== k && usaVar(st[j], x))) return false;
    if (l.extra) {
      for (let q = l.extra[0]; q < l.extra[1]; q++) {
        const it = this.ins[q];
        if (this.acessa(it, x) || (ESCREVEM.has(it.def.op) && it.operandos[0].t === 'reg' && it.operandos[0].r === k)) return false;
      }
    }
    for (let q = l.fim; q < this.ins.length; q++) {
      const it = this.ins[q];
      if (q > l.fim && this.rotuloEm.has(q)) return false;
      if (this.acessa(it, x)) {
        const [a, b] = it.operandos;
        return it.def.op === 'STORE' && a.t === 'mem' && !a.indice && b.t === 'reg' && b.r === k;
      }
      if (this.ehDesvio(it) || ['HALT', 'RET', 'CALL'].includes(it.def.op)) return false;
      if (ESCREVEM.has(it.def.op) && it.operandos[0].t === 'reg' && it.operandos[0].r === k) return false;
    }
    return false;
  }

  private traduzirLaco(l: Laco, st: Estado, out: string[], nivel: number): number {
    const ind = '  '.repeat(nivel);
    this.fecharTexto(out, nivel);
    const [ci, cf] = l.corpo;
    const temPrefixo = l.prefixo[1] > l.prefixo[0];
    const mudam = this.escritos(l.h, l.t);
    const gravadas = this.gravadas(l.h, l.t);
    const cmp = l.teste ? this.ins[l.teste.cmp] : null;
    const jcc = l.teste ? this.ins[l.teste.jcc] : null;
    const r = cmp ? this.reg(cmp.operandos[0]) : null;
    const cb = cmp ? cmp.operandos[1] : null;
    /** Operador da condição para continuar no laço. */
    const opContinua = l.teste ? (l.teste.sai ? NEGA : COMPARA)[jcc!.def.op] : '';

    // teste no fim: dá para começar pelo teste quando ele é verdadeiro na primeira vez
    let primeiraVerdadeira = false;
    if (l.tipo === 'fim' && r && cb) {
      const a = this.valorConhecido(st[r]);
      const b = cb.t === 'num' ? cb.v : cb.t === 'reg' ? this.valorConhecido(st[cb.r]) : null;
      if (a !== null && b !== null) {
        primeiraVerdadeira = ({ '==': a === b, '!=': a !== b, '>': a > b, '>=': a >= b, '<': a < b, '<=': a <= b } as Record<string, boolean>)[opContinua];
      }
    }

    // for: contador começa num valor conhecido e só muda no ADD R, 1 do fim do corpo
    let ehFor = false;
    let vIni: number | null = null;
    if (r && cb && !temPrefixo && !l.antes && (l.tipo === 'topo' || primeiraVerdadeira) && cf > ci && !this.locais.has(r)) {
      const ult = this.ins[cf - 1];
      vIni = this.valorConhecido(st[r]);
      ehFor = vIni !== null && ult.def.op === 'ADD'
        && ult.operandos[0].t === 'reg' && ult.operandos[0].r === r
        && ult.operandos[1].t === 'num' && ult.operandos[1].v === 1
        && !this.escritos(ci, cf - 1).has(r)
        && (cb.t === 'num' || (cb.t === 'reg' && !mudam.has(cb.r)))
        && (l.continua < 0 || !this.temDesvioPara(ci, cf, l.continua));
    }

    // registradores que levam valor de uma volta para a outra viram variáveis do C++
    const vivos = this.vivos(l.h, l.t, ehFor ? cf - 1 : -1, l.teste?.sai ? l.teste.jcc : -1);
    const doPrefixo = this.escritos(l.prefixo[0], l.prefixo[1]);
    const novos: Registrador[] = [];
    const declarar = (k: Registrador, nome: string, ini: string | null) => {
      if (ini !== null) out.push(`${ind}int ${nome}${ini === '' ? '' : ` = ${ini}`};`);
      this.locais.set(k, nome);
      st[k] = { k: 'var', n: nome };
      novos.push(k);
    };
    REGISTRADORES.forEach(k => {
      if (!mudam.has(k) || !vivos.has(k) || (ehFor && k === r) || this.locais.has(k)) return;
      const atual = st[k];
      if (atual.k === 'var' && this.podeSerVariavel(k, atual.n, l, st)) return declarar(k, atual.n, null);
      if (atual.k === 'var' && this.ultimoLocal.get(k) === atual.n && !this.ehVariavelSimples(atual.n)) return declarar(k, atual.n, null);
      const nome = k === r && this.soContaComConstante(k, l.h, l.t) ? this.novoContador() : this.novoLocal();
      declarar(k, nome, mostrar(valido(atual)));
    });

    // JMP para o meio do laço: o trecho entre o alvo e o teste roda uma vez antes
    if (l.antes) {
      const linhas = this.bloco(l.antes[0], l.antes[1], st, nivel);
      out.push(...linhas);
    }

    const stLaco = { ...st };
    mudam.forEach(k => { if (!this.locais.has(k)) stLaco[k] = { k: 'inval' }; });
    this.invalidarLeituras(stLaco, gravadas);

    // contador do for
    let nomeFor = '';
    let vivoDepois = false;
    if (ehFor) {
      const ini = st[r!];
      vivoDepois = this.vivo(r!, l.fim);
      const daMemoria = ini.k === 'var' && this.ins.filter(it => this.acessa(it, (ini as { n: string }).n)).length === 1;
      nomeFor = daMemoria ? (ini as { n: string }).n : this.novoContador();
      stLaco[r!] = { k: 'var', n: nomeFor };
    }

    // prefixo (LOAD/IN antes do teste): vira parte da condição, se der
    let stTeste = stLaco;
    let prefixoNaCondicao = !temPrefixo;
    if (temPrefixo) {
      const teste = { ...stLaco };
      const linhas = this.bloco(l.prefixo[0], l.prefixo[1], teste, nivel + 1);
      const leituraRepetida = [...this.escritos(l.prefixo[0], l.prefixo[1])].some(w =>
        temChamada(teste[w]) && this.vivos(ci, cf).has(w));
      if (!linhas.length && !leituraRepetida) { prefixoNaCondicao = true; stTeste = teste; }
      else {
        // a leitura (digitalRead…) fica numa variável, para não ser feita duas vezes
        this.escritos(l.prefixo[0], l.prefixo[1]).forEach(w => {
          if (this.locais.has(w) || !temChamada(teste[w]) || !this.vivos(ci, cf).has(w)) return;
          declarar(w, this.novoLocal(), '');
          stLaco[w] = { k: 'var', n: this.locais.get(w)! };
        });
      }
    }

    this.contexto.push({ continua: l.continua, saida: l.saida, extra: l.extra });
    const corpo = (s: number, e: number, est: Estado) => {
      const linhas = this.bloco(s, e, est, nivel + 1);
      this.fecharTexto(linhas, nivel + 1);
      return linhas;
    };
    let cabecalho: string;
    let linhas: string[];
    if (ehFor) {
      this.usouFor = true;
      const lim = mostrar(this.expr(cb!, st));
      const limNum = cb!.t === 'num' ? cb!.v : null;
      const op = opContinua === '!=' && (limNum === null || vIni! <= limNum) ? '<' : opContinua;
      const daMemoria = nomeFor === (st[r!] as { n?: string }).n;
      const cond = `${nomeFor} ${op} ${lim}`;
      if (this.modoWhile) {
        if (!daMemoria) out.push(`${ind}int ${nomeFor} = ${vIni};`);
        cabecalho = `while (${cond}) {`;
        linhas = [...corpo(ci, cf - 1, stLaco), `${ind}  ${nomeFor}++;`];
      } else {
        let decl = 'int ';
        if (vivoDepois) {
          if (!daMemoria) out.push(`${ind}int ${nomeFor};`);
          decl = '';
        } else if (daMemoria) {
          this.ocultas.add(nomeFor);
        }
        cabecalho = `for (${decl}${nomeFor} = ${vIni}; ${cond}; ${nomeFor}++) {`;
        linhas = corpo(ci, cf - 1, stLaco);
      }
    } else if (l.tipo === 'infinito') {
      cabecalho = 'while (true) {';
      linhas = corpo(ci, cf, stLaco);
    } else if (l.tipo === 'topo' && prefixoNaCondicao) {
      cabecalho = `while (${this.condicao(cmp!, jcc!, stTeste, l.teste!.sai)}) {`;
      linhas = corpo(ci, cf, { ...stTeste });
    } else if (l.tipo === 'topo') {
      const stP = { ...stLaco };
      const pre = this.bloco(l.prefixo[0], l.prefixo[1], stP, nivel + 1);
      const sair = this.condicao(cmp!, jcc!, stP, !l.teste!.sai);
      cabecalho = 'while (true) {';
      linhas = [...pre, `${ind}  if (${sair}) break;`, ...corpo(ci, cf, stP)];
    } else {
      // teste no fim
      let cond: string | null = null;
      if (primeiraVerdadeira) { try { cond = this.condicao(cmp!, jcc!, stLaco, false); } catch { cond = null; } }
      if (cond) {
        cabecalho = `while (${cond}) {`;
        linhas = corpo(ci, cf, { ...stLaco });
      } else {
        const stC = { ...stLaco };
        linhas = corpo(ci, cf, stC);
        linhas.push(`${ind}  if (${this.condicao(cmp!, jcc!, stC, true)}) break;`);
        cabecalho = 'while (true) {';
      }
    }
    this.contexto.pop();
    out.push(ind + cabecalho, ...linhas, `${ind}}`);

    // estado depois do laço
    const prefixo = temPrefixo && prefixoNaCondicao ? { ...stTeste } : null;
    mudam.forEach(k => st[k] = this.aposMudanca(k));
    this.invalidarVariaveis(st, mudam);
    this.invalidarLeituras(st, gravadas);
    if (prefixo) {
      // sem break, o laço termina logo depois do prefixo: os registradores têm os valores dele
      const temBreak = this.temDesvioPara(ci, cf, l.saida) || (!!l.extra && this.temDesvioPara(ci, cf, l.extra[0]));
      const doCorpo = this.escritos(ci, cf);
      doPrefixo.forEach(w => { if ((!temBreak || !doCorpo.has(w)) && !this.locais.has(w)) st[w] = prefixo[w]; });
    }
    if (ehFor) {
      if (vivoDepois) { this.locais.set(r!, nomeFor); st[r!] = { k: 'var', n: nomeFor }; }
      else st[r!] = { k: 'inval' };
    }
    // depois do laço, a variável não precisa mais receber cada mudança do registrador
    novos.forEach(k => { this.ultimoLocal.set(k, this.locais.get(k)!); this.locais.delete(k); });
    return l.fim;
  }
}
