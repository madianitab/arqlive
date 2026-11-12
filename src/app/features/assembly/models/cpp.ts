/**
 * Gera o código C++ (PC ou Arduino) que corresponde a um programa em Assembly simplificado,
 * no estilo das aulas: sem registradores, com expressões, if e for.
 *
 *   LOAD R1, X / ADD R1, 2 / STORE D, R1     →   D = X + 2;
 *   IN R1, BOTAO / CMP R1, 1 / JNE FIM …     →   if (digitalRead(botao) == HIGH) { … }
 *   LOAD R1, 0 / LOOP: CMP R1, 3 / JE FIM …  →   for (int i = 0; i < 3; i++) { … }
 *
 * Como funciona: os registradores guardam EXPRESSÕES (não valores). Um STORE grava a
 * expressão na variável; IN/OUT/DELAY viram as funções do Arduino; CMP + desvio viram
 * if/if-else/for/while quando seguem esses padrões. Se o programa tiver um desvio fora
 * desses padrões (ou CALL de sub-rotina), usa a tradução direta (cpp-direto.ts).
 */
import { Instrucao, Operando, Programa } from './assembly';
import { gerarCppDireto } from './cpp-direto';
import { PINO_LED, REGISTRADORES, Registrador, VARIAVEL_TEXTO } from './instrucoes';

// ─────────────────────────── expressões ───────────────────────────

type Expr =
  | { k: 'num'; v: number; txt: string }
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

class NaoEstruturado extends Error {}

// ─────────────────────────── tradução ───────────────────────────

type Estado = Record<Registrador, Expr>;

const NEGA: Record<string, string> = { JE: '!=', JNE: '==', JG: '<=', JGE: '<', JL: '>=', JLE: '>' };
const DESVIOS = new Set(['JE', 'JNE', 'JG', 'JGE', 'JL', 'JLE']);

export interface ResultadoCpp {
  codigo: string;
  /** 'alto': no estilo das aulas; 'direto': instrução por instrução (estrutura não reconhecida). */
  nivel: 'alto' | 'direto';
}

export function ehArduino(p: Programa): boolean {
  return p.instrucoes.some(i =>
    i.def.op === 'IN' || i.def.op === 'DELAY' ||
    (i.def.op === 'OUT' && !(i.operandos[0].t === 'porta' && i.operandos[0].nome === 'TELA')));
}

export function traduzirCpp(p: Programa): ResultadoCpp {
  if (p.erros.length) return { codigo: '', nivel: 'alto' };
  try {
    return { codigo: new Tradutor(p).gerar(), nivel: 'alto' };
  } catch (e) {
    if (!(e instanceof NaoEstruturado)) throw e;
    return { codigo: gerarCppDireto(p), nivel: 'direto' };
  }
}

/** Só o texto do C++. */
export function gerarCpp(p: Programa): string {
  return traduzirCpp(p).codigo;
}

class Tradutor {
  private readonly ins: Instrucao[];
  private readonly arduino: boolean;
  private readonly rotuloEm = new Map<number, string>();
  private readonly texto: string | null;
  private textoPendente: string | null = null;
  private contadores = ['i', 'j', 'k'];
  private usaLed = false;
  private usaBotao = false;
  private usaTela = false;
  private pinosConstantes = new Set<number>();

  constructor(private readonly p: Programa) {
    this.ins = p.instrucoes;
    this.arduino = ehArduino(p);
    p.rotulos.forEach(r => this.rotuloEm.set(r.end, r.nome));
    const t = p.variaveis.find(v => v.nome.toUpperCase() === VARIAVEL_TEXTO);
    this.texto = t && typeof t.valores[0] === 'string' ? t.valores[0] : null;
  }

  gerar(): string {
    const st = {} as Estado;
    REGISTRADORES.forEach(r => st[r] = { k: 'num', v: 0, txt: '0' });
    const corpo = this.bloco(0, this.ins.length, st, 1, true);
    this.fecharTexto(corpo, 1);

    const out: string[] = [];
    const vars = this.p.variaveis.filter(v => !(v.nome.toUpperCase() === VARIAVEL_TEXTO && typeof v.valores[0] === 'string'));
    const escalares = vars.filter(v => v.valores.length === 1 && typeof v.valores[0] !== 'string')
      .map(v => (v.valores[0] === null ? v.nome : `${v.nome} = ${v.valores[0]}`));
    const outras = vars.filter(v => v.valores.length > 1 || typeof v.valores[0] === 'string')
      .map(v => (typeof v.valores[0] === 'string'
        ? `const char ${v.nome}[] = "${v.valores[0]}";`
        : `int ${v.nome}[] = {${v.valores.map(x => x ?? 0).join(', ')}};`));
    const decl = [...(escalares.length ? [`int ${escalares.join(', ')};`] : []), ...outras];

    if (this.arduino) {
      if (this.usaLed) out.push(`int led = ${PINO_LED};`);
      if (this.usaBotao) out.push('int botao = 2;');
      out.push(...decl);
      if (out.length) out.push('');
      out.push('void setup() {');
      if (this.usaTela) out.push('  Serial.begin(9600);');
      if (this.usaLed) out.push('  pinMode(led, OUTPUT);');
      [...this.pinosConstantes].sort((a, b) => a - b).forEach(n => out.push(`  pinMode(${n}, OUTPUT);`));
      this.p.variaveis.filter(v => this.vetorDePinos(v.nome)).forEach(v =>
        out.push(`  for (int p = 0; p < ${v.valores.length}; p++) pinMode(${v.nome}[p], OUTPUT);`));
      if (this.usaBotao) out.push('  pinMode(botao, INPUT);');
      out.push('}', '', 'void loop() {', ...corpo, '}');
    } else {
      if (this.usaTela) out.push('#include <stdio.h>', '');
      out.push('int main() {', ...decl.map(d => '  ' + d), ...corpo, '}');
    }
    return out.join('\n');
  }

  private vetoresPino = new Set<string>();
  private vetorDePinos(n: string): boolean { return this.vetoresPino.has(n); }

  /** Traduz as instruções [s, e). */
  private bloco(s: number, e: number, st: Estado, nivel: number, topo = false): string[] {
    const ind = '  '.repeat(nivel);
    const out: string[] = [];
    const emitir = (l: string) => { this.fecharTexto(out, nivel); out.push(ind + l); };
    let i = s;
    while (i < e) {
      const it = this.ins[i];
      const op = it.def.op;

      // laço: ROTULO: CMP a, b / Jcc FIM / … / JMP ROTULO / FIM:
      const laco = this.laco(i, e);
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
      if (op === 'JMP' || DESVIOS.has(op) || op === 'RET') throw new NaoEstruturado();

      const [a, b] = it.operandos;
      switch (op) {
        case 'LOAD': st[this.reg(a)] = this.expr(b, st); break;
        case 'MOV': st[this.reg(a)] = valido(st[this.reg(b)]); break;
        case 'ADD': case 'SUB': case 'MUL': case 'DIV': {
          const r = this.reg(a);
          const simb = ({ ADD: '+', SUB: '-', MUL: '*', DIV: '/' } as const)[op];
          st[r] = { k: 'bin', op: simb, l: valido(st[r]), r: valido(this.expr(b, st)) };
          break;
        }
        case 'CMP': case 'NOP': break;
        case 'STORE': emitir(this.store(a, this.reg(b), st)); break;
        case 'IN': {
          const nome = b.t === 'porta' ? b.nome : b.t === 'pino' ? String(b.v) : mostrar(st[this.reg(b)]);
          const analog = /^A\d$/.test(nome);
          if (nome === 'BOTAO') this.usaBotao = true;
          st[this.reg(a)] = { k: 'call', txt: `${analog ? 'analogRead' : 'digitalRead'}(${nome === 'BOTAO' ? 'botao' : nome})`, digital: !analog };
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
          if (!(a.t === 'rotulo' && a.sistema) || this.texto === null) throw new NaoEstruturado();
          this.fecharTexto(out, nivel);
          this.usaTela = true;
          this.textoPendente = this.texto;
          break;
        }
        case 'HALT':
          if (!(topo && i === this.ins.length - 1)) emitir(this.arduino ? 'while (true) { }' : 'return 0;');
          break;
      }
      i++;
    }
    return out;
  }

  /** Texto do CALL imprime que não foi seguido de OUT TELA. */
  private fecharTexto(out: string[], nivel: number): void {
    if (this.textoPendente === null) return;
    const ind = '  '.repeat(nivel);
    out.push(this.arduino ? `${ind}Serial.print("${this.textoPendente}");` : `${ind}printf("${this.textoPendente}");`);
    this.textoPendente = null;
  }

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
      novo = { k: 'var', n: a.nome };
      const um = (x: Expr) => x.k === 'num' && x.v === 1;
      if (e.k === 'bin' && e.l.k === 'var' && e.l.n === a.nome && um(e.r) && (e.op === '+' || e.op === '-')) linha = `${a.nome}${e.op}${e.op};`;
      else linha = `${a.nome} = ${mostrar(e)};`;
      // a variável mudou: o que dependia do valor antigo passa a usar o novo, se der
      // (ex.: R2 = B + A * B e STORE A com A * B  →  R2 = B + A); senão fica inválido
      const marca: Expr = { k: 'var', n: '\u0000novo' };
      REGISTRADORES.forEach(k => {
        if (k === r || !usaVar(st[k], a.nome)) return;
        const t = trocar(st[k], e, marca);
        st[k] = usaVar(t, a.nome) ? { k: 'inval' } : trocar(t, marca, novo);
      });
    }
    st[r] = novo;
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

  /** Registradores escritos em [s, e). */
  private escritos(s: number, e: number): Set<Registrador> {
    const w = new Set<Registrador>();
    for (let k = s; k < e; k++) {
      const it = this.ins[k];
      const a = it.operandos[0];
      if (['LOAD', 'MOV', 'ADD', 'SUB', 'MUL', 'DIV', 'IN'].includes(it.def.op) && a?.t === 'reg') w.add(a.r);
    }
    return w;
  }

  /** Variáveis gravadas (STORE) em [s, e). */
  private gravadas(s: number, e: number): Set<string> {
    const g = new Set<string>();
    for (let k = s; k < e; k++) {
      const a = this.ins[k].operandos[0];
      if (this.ins[k].def.op === 'STORE' && a.t === 'mem') g.add(a.nome);
    }
    return g;
  }

  /** Invalida os registradores cujas expressões leem alguma dessas variáveis. */
  private invalidarLeituras(st: Estado, vars: Set<string>): void {
    REGISTRADORES.forEach(k => { if ([...vars].some(v => usaVar(st[k], v))) st[k] = { k: 'inval' }; });
  }

  private condicao(cmp: Instrucao, jcc: Instrucao, st: Estado): string {
    const [a, b] = cmp.operandos;
    const A = valido(st[this.reg(a)]);
    const B = this.expr(b, st);
    let bs = mostrar(B);
    if (A.k === 'call' && A.digital && B.k === 'num' && (B.v === 0 || B.v === 1)) bs = B.v ? 'HIGH' : 'LOW';
    return `${mostrar(A)} ${NEGA[jcc.def.op]} ${bs}`;
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
    mudaram.forEach(r => st[r] = { k: 'inval' });
    this.invalidarLeituras(st, this.gravadas(i + 2, fim));
    return fim;
  }

  /** Reconhece ROTULO: CMP / Jcc FIM / corpo / JMP ROTULO / FIM: começando em i. */
  private laco(i: number, e: number): { ini: number; fim: number } | null {
    if (!this.rotuloEm.has(i) || this.ins[i].def.op !== 'CMP' || i + 1 >= e || !DESVIOS.has(this.ins[i + 1].def.op)) return null;
    const fim = this.alvo(this.ins[i + 1]);
    if (fim <= i + 2 || fim > e) return null;
    const volta = this.ins[fim - 1];
    if (volta.def.op !== 'JMP' || this.alvo(volta) !== i) return null;
    return { ini: i, fim };
  }

  private traduzirLaco(l: { ini: number; fim: number }, st: Estado, out: string[], nivel: number): number {
    const ind = '  '.repeat(nivel);
    this.fecharTexto(out, nivel);
    const cmp = this.ins[l.ini];
    const jcc = this.ins[l.ini + 1];
    const corpoIni = l.ini + 2;
    const corpoFim = l.fim - 1;          // sem o JMP
    const mudam = this.escritos(corpoIni, corpoFim);
    const [ca, cb] = cmp.operandos;
    const r = this.reg(ca);

    // for: contador começa numa constante, só muda no ADD R, 1 do fim do corpo
    const ultimo = this.ins[corpoFim - 1];
    const ehFor = st[r].k === 'num' && corpoFim > corpoIni && ultimo.def.op === 'ADD'
      && ultimo.operandos[0].t === 'reg' && ultimo.operandos[0].r === r
      && ultimo.operandos[1].t === 'num' && ultimo.operandos[1].v === 1
      && !this.escritos(corpoIni, corpoFim - 1).has(r)
      && (cb.t === 'num' || (cb.t === 'reg' && !mudam.has(cb.r)));

    const stCorpo = { ...st };
    mudam.forEach(k => { if (k !== r) stCorpo[k] = { k: 'inval' }; });
    const gravadas = this.gravadas(corpoIni, corpoFim);
    this.invalidarLeituras(stCorpo, gravadas);
    let cabecalho: string;
    let linhas: string[];
    if (ehFor) {
      const nome = this.contadores.shift() ?? `c${l.ini}`;
      const ini = mostrar(st[r]);
      const lim = mostrar(this.expr(cb, st));
      const opJ = jcc.def.op;
      const cond = opJ === 'JE' || opJ === 'JGE' ? '<' : opJ === 'JG' ? '<=' : NEGA[opJ];
      cabecalho = `for (int ${nome} = ${ini}; ${nome} ${cond} ${lim}; ${nome}++) {`;
      stCorpo[r] = { k: 'var', n: nome };
      linhas = this.bloco(corpoIni, corpoFim - 1, stCorpo, nivel + 1);
    } else {
      if (mudam.has(r)) throw new NaoEstruturado();
      cabecalho = `while (${this.condicao(cmp, jcc, st)}) {`;
      linhas = this.bloco(corpoIni, corpoFim, stCorpo, nivel + 1);
    }
    this.fecharTexto(linhas, nivel + 1);
    out.push(ind + cabecalho, ...linhas, `${ind}}`);
    mudam.forEach(k => st[k] = { k: 'inval' });
    st[r] = { k: 'inval' };
    this.invalidarLeituras(st, gravadas);
    return l.fim;
  }
}
