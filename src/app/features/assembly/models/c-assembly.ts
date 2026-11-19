/**
 * Tradutor C → Assembly simplificado (lógica pura, sem Angular).
 *
 * Recebe um trecho em C/C++ (PC ou Arduino), no estilo das aulas, e devolve o Assembly
 * simplificado correspondente, como nas respostas dos slides (Aulas 14 e 15 de ArqII):
 *
 *   int X = 5;  X = X + 2;          →   X: 5 / LOAD R1, X / ADD R1, 2 / STORE X, R1
 *   if (B == 2) { A = B; }          →   CMP R1, 2 / JNE FIM / STORE A, R1 / FIM:
 *   for (int i = 1; i <= 4; i++)    →   LOAD R2, i / LOOP: CMP R2, 4 / JG FIM / … / JMP LOOP / FIM:
 *   digitalWrite(led, HIGH);        →   LOAD R1, 1 / OUT LED, R1
 *
 * Como funciona:
 * - Variáveis vão para a memória (X: 5, Y: vazio, LEDS: 8, 9, 10). Valor inicial constante
 *   vai direto para a memória; sem valor, a variável fica vazia.
 * - Expressões são calculadas da esquerda para a direita num registrador (R1, R2…); constantes
 *   entram direto na instrução (ADD R1, 2). O resultado volta para a memória com STORE.
 * - O tradutor lembra qual variável está em cada registrador e reaproveita (como no slide:
 *   X = X + Y; Y++  →  o Y que já está em R2 é usado no Y++).
 * - Num laço, as variáveis usadas ficam presas em registradores: são lidas antes do laço e
 *   gravadas depois dele (como no slide do for com soma).
 * - O salto testa a condição contrária à do C (if com == → JNE; i <= 4 → JG FIM).
 * - printf("X = %d", X) → TEXTO: "X = " / CALL imprime / LOAD R1, X / OUT TELA, R1.
 */
import { ehReservada } from './instrucoes';

// ─────────────────────────── resultado ───────────────────────────

export interface ErroC { linha: number; msg: string; }

export interface ResultadoTraducao {
  /** Código em Assembly simplificado (vazio se houver erro). */
  codigo: string;
  erros: ErroC[];
  /** Observações sobre a tradução (ex.: variável renomeada). */
  avisos: string[];
  /** O código usa funções do Arduino (digitalWrite, delay…). */
  arduino: boolean;
}

export interface OpcoesTraducao {
  /** Comentar cada instrução e cada comando do C (padrão: sim). */
  comentarios?: boolean;
}

class ErroTraducao extends Error {
  constructor(readonly linha: number, msg: string) { super(msg); }
}

// ─────────────────────────── tokens ───────────────────────────

type TipoToken = 'num' | 'id' | 'str' | 'op' | 'fim';
interface Token {
  t: TipoToken;
  v: string;
  /** Valor numérico (num). */
  n?: number;
  /** Nome original de uma constante (#define, HIGH…), para os comentários. */
  nome?: string;
  linha: number;
  ini: number;
  fim: number;
}

const OPS = ['<<=', '>>=', '<<', '>>', '++', '--', '+=', '-=', '*=', '/=', '%=', '==', '!=', '<=', '>=', '&&', '||', '::', '->',
  '+', '-', '*', '/', '%', '=', '<', '>', '!', '(', ')', '{', '}', '[', ']', ';', ',', '.', '&', '|', '~', '?', ':', '^'];

const ESCAPES: Record<string, string> = { n: '\n', t: '\t', '0': '\0', '\\': '\\', '"': '"', "'": "'", r: '' };

function tokenizar(fonte: string): Token[] {
  const toks: Token[] = [];
  const defines = new Map<string, Token[]>();
  let i = 0;
  let linha = 1;
  let inicioLinha = true;
  const erro = (msg: string) => { throw new ErroTraducao(linha, msg); };

  while (i < fonte.length) {
    const c = fonte[i];
    if (c === '\n') { linha++; i++; inicioLinha = true; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (fonte.startsWith('//', i)) { while (i < fonte.length && fonte[i] !== '\n') i++; continue; }
    if (fonte.startsWith('/*', i)) {
      const f = fonte.indexOf('*/', i + 2);
      if (f < 0) erro('Comentário /* sem o */ de fechamento.');
      for (let k = i; k < f; k++) if (fonte[k] === '\n') linha++;
      i = f + 2;
      continue;
    }
    // diretivas: #include (ignorada) e #define NOME valor
    if (c === '#' && inicioLinha) {
      let f = fonte.indexOf('\n', i);
      if (f < 0) f = fonte.length;
      const dir = fonte.slice(i, f).trim();
      const m = dir.match(/^#\s*define\s+([A-Za-z_]\w*)\s+(.+)$/);
      if (m) {
        const sub = tokenizar(m[2]).filter(t => t.t !== 'fim');
        if (sub.length === 1 && sub[0].t === 'num') defines.set(m[1], [{ ...sub[0], nome: m[1] }]);
        else defines.set(m[1], sub);
      }
      i = f;
      continue;
    }
    inicioLinha = false;
    const ini = i;
    const add = (t: TipoToken, v: string, extra: Partial<Token> = {}) => toks.push({ t, v, linha, ini, fim: i, ...extra });

    if (/\d/.test(c)) {
      const m = fonte.slice(i).match(/^(0x[0-9a-fA-F]+|0b[01]+|\d+)([uUlL]*)/)!;
      i += m[0].length;
      if (/^[.eE]/.test(fonte[i] ?? '')) {
        const f = fonte.slice(i).match(/^(\.\d*)?([eE][+-]?\d+)?[fF]?/)!;
        i += f[0].length;
        add('num', m[1], { n: Math.trunc(parseFloat(m[1] + (f[1] ?? '') + (f[2] ?? ''))) , nome: 'real' });
        continue;
      }
      const t = m[1];
      const n = /^0x/i.test(t) ? parseInt(t, 16) : /^0b/i.test(t) ? parseInt(t.slice(2), 2) : parseInt(t, 10);
      add('num', t, { n });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = fonte.slice(i).match(/^[A-Za-z_]\w*/)!;
      i += m[0].length;
      const def = defines.get(m[0]);
      if (def) { def.forEach(d => toks.push({ ...d, linha, ini, fim: i })); continue; }
      add('id', m[0]);
      continue;
    }
    if (c === '"') {
      let s = '';
      i++;
      while (i < fonte.length && fonte[i] !== '"') {
        if (fonte[i] === '\n') erro('Texto entre aspas sem o " de fechamento.');
        if (fonte[i] === '\\') { s += ESCAPES[fonte[i + 1]] ?? fonte[i + 1]; i += 2; } else s += fonte[i++];
      }
      if (i >= fonte.length) erro('Texto entre aspas sem o " de fechamento.');
      i++;
      add('str', s);
      continue;
    }
    if (c === "'") {
      let ch: string;
      if (fonte[i + 1] === '\\') { ch = ESCAPES[fonte[i + 2]] ?? fonte[i + 2]; i += 3; } else { ch = fonte[i + 1]; i += 2; }
      if (fonte[i] !== "'") erro("Caractere entre aspas simples inválido (use, por exemplo, 'A').");
      i++;
      add('num', `'${ch}'`, { n: ch.charCodeAt(0) });
      continue;
    }
    const op = OPS.find(o => fonte.startsWith(o, i));
    if (!op) erro(`Símbolo não reconhecido: ${c}`);
    i += op!.length;
    add('op', op!);
  }
  toks.push({ t: 'fim', v: '', linha, ini: fonte.length, fim: fonte.length });
  return toks;
}

// ─────────────────────────── árvore ───────────────────────────

type OpAri = '+' | '-' | '*' | '/' | '%';
type OpCmp = '==' | '!=' | '<' | '<=' | '>' | '>=';

type Expr =
  | { k: 'num'; v: number; nome?: string; linha: number }
  | { k: 'var'; n: string; linha: number }
  | { k: 'idx'; n: string; i: Expr; linha: number }
  | { k: 'porta'; n: string; linha: number }            // A0…A5
  | { k: 'bin'; op: OpAri; l: Expr; r: Expr; linha: number }
  | { k: 'neg'; e: Expr; linha: number }
  | { k: 'cmp'; op: OpCmp; l: Expr; r: Expr; linha: number }
  | { k: 'e' | 'ou'; l: Expr; r: Expr; linha: number }
  | { k: 'nao'; e: Expr; linha: number }
  | { k: 'call'; f: string; args: Expr[]; linha: number }
  | { k: 'str'; v: string; linha: number };

interface ItemDecl { nome: string; linha: number; tamanho: number | null; init?: Expr; lista?: Expr[]; }
type Parte = { t: 'texto'; v: string } | { t: 'expr'; e: Expr };

type Cmd = { linha: number; texto: string } & (
  | { k: 'decl'; itens: ItemDecl[] }
  | { k: 'atrib'; alvo: Expr; op: '=' | OpAri; valor: Expr }
  | { k: 'chamada'; f: string; args: Expr[] }
  | { k: 'saida'; partes: Parte[] }
  | { k: 'if'; cond: Expr; entao: Cmd; senao?: Cmd }
  | { k: 'for'; init?: Cmd; cond?: Expr; passo?: Cmd; corpo: Cmd }
  | { k: 'while'; cond: Expr; corpo: Cmd }
  | { k: 'do'; corpo: Cmd; cond: Expr }
  | { k: 'bloco'; corpo: Cmd[] }
  | { k: 'return' | 'break' | 'continue' | 'vazio' }
);

interface ProgramaC {
  /** Comandos fora de função (declarações globais e trechos soltos). */
  topo: Cmd[];
  funcoes: Map<'main' | 'setup' | 'loop', Cmd[]>;
  avisos: string[];
}

const TIPOS = new Set(['int', 'long', 'short', 'byte', 'bool', 'boolean', 'char', 'unsigned', 'signed', 'const', 'float', 'double',
  'void', 'static', 'volatile', 'word', 'size_t', 'auto', 'register']);
const ehTipo = (v: string) => TIPOS.has(v) || /^u?int(8|16|32|64)_t$/.test(v);

/** Constantes conhecidas do Arduino e do C. */
const CONSTANTES: Record<string, number> = {
  HIGH: 1, LOW: 0, true: 1, false: 0, TRUE: 1, FALSE: 0, OUTPUT: 1, INPUT: 0, INPUT_PULLUP: 2, LED_BUILTIN: 13,
};

const PALAVRAS_CHAVE = new Set(['if', 'else', 'for', 'while', 'do', 'switch', 'return', 'sizeof']);
const FUNCOES_COMANDO = new Set(['printf', 'puts', 'digitalWrite', 'delay', 'pinMode']);
const FUNCOES_EXPR = new Set(['digitalRead', 'analogRead']);

class Parser {
  private p = 0;
  private readonly consts = new Map<string, number>();
  readonly avisos: string[] = [];

  constructor(private readonly toks: Token[], private readonly fonte: string) {}

  private get atual(): Token { return this.toks[this.p]; }
  private acabou(): boolean { return this.toks[this.p].t === 'fim'; }
  private olhar(k = 0): Token { return this.toks[Math.min(this.p + k, this.toks.length - 1)]; }
  private eh(v: string, k = 0): boolean { const t = this.olhar(k); return (t.t === 'op' || t.t === 'id') && t.v === v; }
  private prox(): Token { return this.toks[this.p++]; }
  private erro(msg: string, t: Token = this.atual): never { throw new ErroTraducao(t.linha, msg); }
  private esperar(v: string, msg?: string): Token {
    if (!this.eh(v)) this.erro(msg ?? `Esperado "${v}"${this.atual.t === 'fim' ? ' antes do fim do código' : `, encontrado "${this.atual.v}"`}.`);
    return this.prox();
  }
  private ident(): Token {
    if (this.atual.t !== 'id') this.erro(`Esperado um nome${this.atual.t === 'fim' ? '' : `, encontrado "${this.atual.v}"`}.`);
    return this.prox();
  }
  private textoDe(ini: number, fim: number): string {
    return this.fonte.slice(ini, fim).replace(/\s+/g, ' ').trim();
  }

  programa(): ProgramaC {
    const topo: Cmd[] = [];
    const funcoes = new Map<'main' | 'setup' | 'loop', Cmd[]>();
    while (this.atual.t !== 'fim') {
      if (this.eh('using')) { while (!this.eh(';') && !this.acabou()) this.prox(); this.prox(); continue; }
      const f = this.funcao();
      if (f) {
        if (funcoes.has(f.nome)) this.erro(`A função ${f.nome}() foi definida duas vezes.`);
        funcoes.set(f.nome, f.corpo);
        continue;
      }
      topo.push(this.comando());
    }
    return { topo, funcoes, avisos: this.avisos };
  }

  /** Definição de função: [tipo] nome(…) { … }. Retorna null se não for uma. */
  private funcao(): { nome: 'main' | 'setup' | 'loop'; corpo: Cmd[] } | null {
    let k = 0;
    while (this.olhar(k).t === 'id' && ehTipo(this.olhar(k).v)) k++;
    const nomeTok = this.olhar(k);
    if (nomeTok.t !== 'id' || !this.eh('(', k + 1) || PALAVRAS_CHAVE.has(nomeTok.v)) return null;
    // acha o ) correspondente e vê se vem {
    let d = 0;
    let j = k + 1;
    do {
      if (this.eh('(', j)) d++;
      else if (this.eh(')', j)) d--;
      else if (this.olhar(j).t === 'fim') return null;
      j++;
    } while (d > 0);
    if (!this.eh('{', j)) return null;
    const nome = nomeTok.v;
    if (nome !== 'main' && nome !== 'setup' && nome !== 'loop') {
      this.erro(`Funções próprias (${nome}) ainda não são traduzidas: use só main(), ou setup() e loop() no Arduino.`, nomeTok);
    }
    this.p += j;
    const bloco = this.bloco();
    return { nome, corpo: bloco.k === 'bloco' ? bloco.corpo : [bloco] };
  }

  private bloco(): Cmd {
    const t = this.esperar('{');
    const corpo: Cmd[] = [];
    while (!this.eh('}')) {
      if (this.atual.t === 'fim') this.erro('Falta fechar o bloco com }.', t);
      corpo.push(this.comando());
    }
    this.prox();
    return { k: 'bloco', corpo, linha: t.linha, texto: '' };
  }

  private comando(): Cmd {
    const t = this.atual;
    const base = { linha: t.linha };
    if (this.eh('{')) return this.bloco();
    if (this.eh(';')) { this.prox(); return { k: 'vazio', ...base, texto: '' }; }

    if (this.eh('if')) {
      this.prox();
      this.esperar('(');
      const cond = this.expr();
      const fecha = this.esperar(')');
      const texto = this.textoDe(t.ini, fecha.fim);
      const entao = this.comando();
      let senao: Cmd | undefined;
      if (this.eh('else')) { this.prox(); senao = this.comando(); }
      return { k: 'if', cond, entao, senao, ...base, texto };
    }
    if (this.eh('while')) {
      this.prox();
      this.esperar('(');
      const cond = this.expr();
      const fecha = this.esperar(')');
      const texto = this.textoDe(t.ini, fecha.fim);
      return { k: 'while', cond, corpo: this.comando(), ...base, texto };
    }
    if (this.eh('do')) {
      this.prox();
      const corpo = this.comando();
      this.esperar('while', 'Depois do bloco do "do", falta o while (condição);');
      this.esperar('(');
      const cond = this.expr();
      this.esperar(')');
      this.esperar(';');
      return { k: 'do', corpo, cond, ...base, texto: 'do … while' };
    }
    if (this.eh('for')) {
      this.prox();
      this.esperar('(');
      const init = this.eh(';') ? undefined : this.simples();
      this.esperar(';');
      const cond = this.eh(';') ? undefined : this.expr();
      this.esperar(';');
      const passo = this.eh(')') ? undefined : this.simples();
      const fecha = this.esperar(')');
      const texto = this.textoDe(t.ini, fecha.fim);
      return { k: 'for', init, cond, passo, corpo: this.comando(), ...base, texto };
    }
    if (this.eh('return')) {
      this.prox();
      if (!this.eh(';')) this.expr();
      const fim = this.esperar(';');
      return { k: 'return', ...base, texto: this.textoDe(t.ini, fim.ini) };
    }
    if (this.eh('break') || this.eh('continue')) {
      const k = this.prox().v as 'break' | 'continue';
      this.esperar(';');
      return { k, ...base, texto: k };
    }
    const c = this.simples();
    const fim = this.esperar(';', `Falta o ";" no fim do comando${this.atual.t === 'fim' ? '' : ` (antes de "${this.atual.v}")`}.`);
    c.texto = this.textoDe(t.ini, fim.ini);
    return c;
  }

  /** Comando simples (sem o ;): declaração, atribuição, ++/--, chamada ou saída. */
  private simples(): Cmd {
    const t = this.atual;
    const base = { linha: t.linha, texto: '' };
    if (t.t === 'id' && ehTipo(t.v)) return this.declaracao();

    // cout << … << endl
    if (this.eh('cout') || (this.eh('std') && this.eh('::', 1) && this.eh('cout', 2))) {
      if (this.eh('std')) this.p += 2;
      this.prox();
      const partes: Parte[] = [];
      while (this.eh('<<')) {
        this.prox();
        if (this.eh('endl') || (this.eh('std') && this.eh('::', 1) && this.eh('endl', 2))) {
          if (this.eh('std')) this.p += 2;
          this.prox();
          partes.push({ t: 'texto', v: '\n' });
        } else if (this.atual.t === 'str') partes.push({ t: 'texto', v: this.prox().v });
        else partes.push({ t: 'expr', e: this.soma() });
      }
      return { k: 'saida', partes, ...base };
    }

    // Serial.begin / Serial.print / Serial.println
    if (this.eh('Serial') && this.eh('.', 1)) {
      this.p += 2;
      const f = this.ident().v;
      const args = this.argumentos();
      if (f === 'begin') return { k: 'chamada', f: 'Serial.begin', args, ...base };
      if (f !== 'print' && f !== 'println') this.erro(`Serial.${f} não é traduzido (use Serial.print ou Serial.println).`, t);
      const partes: Parte[] = args.slice(0, 1).map(a => (a.k === 'str' ? { t: 'texto', v: a.v } : { t: 'expr', e: a }));
      if (f === 'println') partes.push({ t: 'texto', v: '\n' });
      return { k: 'saida', partes, ...base };
    }

    // ++X / --X
    if (this.eh('++') || this.eh('--')) {
      const op = this.prox().v === '++' ? '+' : '-';
      const alvo = this.lvalue();
      return { k: 'atrib', alvo, op, valor: { k: 'num', v: 1, linha: t.linha }, ...base };
    }

    if (t.t === 'id' && this.eh('(', 1)) {
      const f = this.prox().v;
      const args = this.argumentos();
      if (f === 'printf') return { k: 'saida', partes: this.formatar(args, t), ...base };
      if (f === 'puts') return { k: 'saida', partes: [{ t: 'texto', v: (args[0]?.k === 'str' ? args[0].v : '') + '\n' }], ...base };
      if (FUNCOES_COMANDO.has(f)) return { k: 'chamada', f, args, ...base };
      if (FUNCOES_EXPR.has(f)) return { k: 'chamada', f, args, ...base };
      this.erro(`A função ${f}() não é traduzida. Use printf, digitalWrite, digitalRead, analogRead ou delay.`, t);
    }

    const alvo = this.lvalue();
    if (this.eh('++') || this.eh('--')) {
      const op = this.prox().v === '++' ? '+' : '-';
      return { k: 'atrib', alvo, op, valor: { k: 'num', v: 1, linha: t.linha }, ...base };
    }
    const opTok = this.atual;
    const ops: Record<string, '=' | OpAri> = { '=': '=', '+=': '+', '-=': '-', '*=': '*', '/=': '/', '%=': '%' };
    const op = opTok.t === 'op' ? ops[opTok.v] : undefined;
    if (!op) this.erro(`Comando incompleto: esperado "=", "++" ou "--" depois de "${t.v}".`, opTok);
    this.prox();
    const valor = this.expr();
    return { k: 'atrib', alvo, op, valor, ...base };
  }

  private lvalue(): Expr {
    const t = this.ident();
    if (CONSTANTES[t.v] !== undefined || this.consts.has(t.v)) this.erro(`"${t.v}" é uma constante e não pode receber valor.`, t);
    if (this.eh('[')) {
      this.prox();
      const i = this.expr();
      this.esperar(']');
      return { k: 'idx', n: t.v, i, linha: t.linha };
    }
    return { k: 'var', n: t.v, linha: t.linha };
  }

  private argumentos(): Expr[] {
    this.esperar('(');
    const args: Expr[] = [];
    if (!this.eh(')')) {
      do { args.push(this.atual.t === 'str' ? { k: 'str', v: this.prox().v, linha: this.atual.linha } : this.expr()); }
      while (this.eh(',') && this.prox());
    }
    this.esperar(')');
    return args;
  }

  /** printf("X = %d", X) → partes de texto e expressões. */
  private formatar(args: Expr[], t: Token): Parte[] {
    const fmt = args[0];
    if (!fmt || fmt.k !== 'str') this.erro('O printf precisa de um texto entre aspas, ex.: printf("X = %d", X);', t);
    const partes: Parte[] = [];
    let a = 1;
    const pedacos = fmt.v.split(/(%[-+ 0#]*\d*(?:\.\d+)?l{0,2}[dicuxfs%])/);
    for (const p of pedacos) {
      if (!p) continue;
      if (p === '%%') { partes.push({ t: 'texto', v: '%' }); continue; }
      if (/^%/.test(p)) {
        if (/[fs]$/.test(p)) this.erro(`O formato ${p} não é traduzido: o assembly simplificado só exibe números inteiros (%d).`, t);
        const e = args[a++];
        if (!e) this.erro(`Falta o valor do ${p} no printf.`, t);
        partes.push({ t: 'expr', e });
      } else partes.push({ t: 'texto', v: p });
    }
    if (a < args.length) this.erro('O printf tem mais valores do que %d no texto.', t);
    return partes;
  }

  private declaracao(): Cmd {
    const t = this.atual;
    const especs: string[] = [];
    while (this.atual.t === 'id' && ehTipo(this.atual.v)) especs.push(this.prox().v);
    if (especs.some(e => e === 'float' || e === 'double')) {
      this.avisos.push(`Linha ${t.linha}: o assembly simplificado só trabalha com números inteiros; float/double viraram int.`);
    }
    const constante = especs.includes('const');
    const itens: ItemDecl[] = [];
    do {
      const nt = this.ident();
      const item: ItemDecl = { nome: nt.v, linha: nt.linha, tamanho: null };
      if (CONSTANTES[nt.v] !== undefined) this.erro(`"${nt.v}" é uma constante do Arduino e não pode ser nome de variável.`, nt);
      if (this.eh('[')) {
        this.prox();
        if (this.eh(']')) item.tamanho = 0;
        else {
          const n = this.expr();
          if (n.k !== 'num' || n.v < 1) this.erro('O tamanho do vetor deve ser um número (ex.: int V[3];).', nt);
          item.tamanho = n.v;
        }
        this.esperar(']');
      }
      if (this.eh('=')) {
        this.prox();
        if (item.tamanho !== null) {
          this.esperar('{', 'Um vetor recebe os valores entre chaves, ex.: int LEDS[] = {8, 9, 10};');
          const lista: Expr[] = [];
          if (!this.eh('}')) do { lista.push(this.expr()); } while (this.eh(',') && this.prox());
          this.esperar('}');
          if (item.tamanho === 0) item.tamanho = lista.length;
          if (lista.length > item.tamanho) this.erro(`O vetor ${nt.v} tem mais valores do que o tamanho.`, nt);
          item.lista = lista;
        } else item.init = this.expr();
      }
      if (item.tamanho === 0) this.erro(`Informe o tamanho ou os valores do vetor ${nt.v}.`, nt);
      // const int N = 3; → constante (entra direto nas instruções, como #define)
      if (constante && item.tamanho === null && item.init?.k === 'num') this.consts.set(nt.v, item.init.v);
      else itens.push(item);
    } while (this.eh(',') && this.prox());
    return { k: 'decl', itens, linha: t.linha, texto: '' };
  }

  // ── expressões ──

  expr(): Expr { return this.ou(); }

  private ou(): Expr {
    let l = this.e();
    while (this.eh('||')) { const t = this.prox(); l = { k: 'ou', l, r: this.e(), linha: t.linha }; }
    return l;
  }
  private e(): Expr {
    let l = this.igualdade();
    while (this.eh('&&')) { const t = this.prox(); l = { k: 'e', l, r: this.igualdade(), linha: t.linha }; }
    return l;
  }
  private igualdade(): Expr {
    let l = this.relacional();
    while (this.eh('==') || this.eh('!=')) { const t = this.prox(); l = { k: 'cmp', op: t.v as OpCmp, l, r: this.relacional(), linha: t.linha }; }
    return l;
  }
  private relacional(): Expr {
    let l = this.soma();
    while (this.eh('<') || this.eh('<=') || this.eh('>') || this.eh('>=')) {
      const t = this.prox();
      l = { k: 'cmp', op: t.v as OpCmp, l, r: this.soma(), linha: t.linha };
    }
    return l;
  }
  private soma(): Expr {
    let l = this.termo();
    while (this.eh('+') || this.eh('-')) { const t = this.prox(); l = { k: 'bin', op: t.v as OpAri, l, r: this.termo(), linha: t.linha }; }
    return l;
  }
  private termo(): Expr {
    let l = this.unario();
    while (this.eh('*') || this.eh('/') || this.eh('%')) { const t = this.prox(); l = { k: 'bin', op: t.v as OpAri, l, r: this.unario(), linha: t.linha }; }
    return l;
  }
  private unario(): Expr {
    const t = this.atual;
    if (this.eh('-')) {
      this.prox();
      const e = this.unario();
      return e.k === 'num' ? { ...e, v: -e.v, nome: undefined } : { k: 'neg', e, linha: t.linha };
    }
    if (this.eh('+')) { this.prox(); return this.unario(); }
    if (this.eh('!')) { this.prox(); return { k: 'nao', e: this.unario(), linha: t.linha }; }
    if (this.eh('++') || this.eh('--')) this.erro('Use o ++ e o -- como comando separado (ex.: i++;), não dentro de uma expressão.');
    // conversão de tipo: (int) x
    if (this.eh('(') && this.olhar(1).t === 'id' && ehTipo(this.olhar(1).v)) {
      this.prox();
      while (this.atual.t === 'id' && ehTipo(this.atual.v)) this.prox();
      this.esperar(')');
      return this.unario();
    }
    return this.primario();
  }
  private primario(): Expr {
    const t = this.prox();
    if (t.t === 'num') {
      if (t.nome === 'real') this.avisos.push(`Linha ${t.linha}: o número ${t.v} foi arredondado para inteiro.`);
      return { k: 'num', v: t.n!, nome: t.nome === 'real' ? undefined : t.nome ?? (t.v.startsWith("'") ? t.v : undefined), linha: t.linha };
    }
    if (t.t === 'str') this.erro('Texto entre aspas só pode aparecer no printf.', t);
    if (t.t === 'op' && t.v === '(') {
      const e = this.expr();
      this.esperar(')');
      return e;
    }
    if (t.t === 'id') {
      if (CONSTANTES[t.v] !== undefined) return { k: 'num', v: CONSTANTES[t.v], nome: t.v, linha: t.linha };
      if (this.consts.has(t.v)) return { k: 'num', v: this.consts.get(t.v)!, nome: t.v, linha: t.linha };
      if (/^A[0-5]$/.test(t.v)) return { k: 'porta', n: t.v, linha: t.linha };
      if (this.eh('(')) {
        if (!FUNCOES_EXPR.has(t.v)) this.erro(`A função ${t.v}() não pode ser usada numa expressão (só digitalRead e analogRead).`, t);
        return { k: 'call', f: t.v, args: this.argumentos(), linha: t.linha };
      }
      if (this.eh('[')) {
        this.prox();
        const i = this.expr();
        this.esperar(']');
        return { k: 'idx', n: t.v, i, linha: t.linha };
      }
      return { k: 'var', n: t.v, linha: t.linha };
    }
    this.erro(t.t === 'fim' ? 'O código terminou no meio de uma expressão.' : `Expressão inválida perto de "${t.v}".`, t);
  }
}

// ─────────────────────────── geração ───────────────────────────

const REGS = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R0'] as const;
type Reg = typeof REGS[number];

interface Var {
  /** Nome no C. */
  c: string;
  /** Nome no assembly (pode mudar se colidir com uma palavra reservada). */
  asm: string;
  tamanho: number;
  valores: (number | null)[];
  ordem: number;
  /** Já tem valor neste ponto do programa (memória inicial ou atribuição anterior). */
  definida: boolean;
}

type Linha =
  | { t: 'ins'; txt: string; com?: string; nivel: number }
  | { t: 'rot'; nome: string; nivel: number }
  | { t: 'com'; txt: string; nivel: number }
  | { t: 'branco' };

type Operando = { t: 'reg'; r: Reg } | { t: 'const'; v: number; txt: string };

interface Laco { inicio: string; fim: string; cont: string | null; usouCont: boolean; }

const INVERSO: Record<OpCmp, OpCmp> = { '==': '!=', '!=': '==', '<': '>=', '>=': '<', '>': '<=', '<=': '>' };
const ESPELHO: Record<OpCmp, OpCmp> = { '==': '==', '!=': '!=', '<': '>', '>': '<', '<=': '>=', '>=': '<=' };
const SALTO: Record<OpCmp, string> = { '==': 'JE', '!=': 'JNE', '>': 'JG', '>=': 'JGE', '<': 'JL', '<=': 'JLE' };
const PREC: Record<string, number> = { ou: 1, e: 2, cmp: 3, '+': 4, '-': 4, '*': 5, '/': 5, '%': 5 };

/** Texto C de uma expressão (para os comentários). */
function mostrarC(e: Expr): string {
  const pr = (x: Expr) => (x.k === 'bin' ? PREC[x.op] : x.k === 'cmp' || x.k === 'e' || x.k === 'ou' ? PREC[x.k] : 9);
  const lado = (x: Expr, p: number, dir = false) => (pr(x) < p || (dir && pr(x) === p) ? `(${mostrarC(x)})` : mostrarC(x));
  switch (e.k) {
    case 'num': return e.nome ?? String(e.v);
    case 'var': case 'porta': return e.n;
    case 'str': return `"${e.v}"`;
    case 'idx': return `${e.n}[${mostrarC(e.i)}]`;
    case 'neg': return `-${lado(e.e, 9)}`;
    case 'nao': return `!${lado(e.e, 9)}`;
    case 'call': return `${e.f}(${e.args.map(mostrarC).join(', ')})`;
    case 'bin': return `${lado(e.l, PREC[e.op])} ${e.op} ${lado(e.r, PREC[e.op], true)}`;
    case 'cmp': return `${lado(e.l, 4)} ${e.op} ${lado(e.r, 4)}`;
    case 'e': return `${lado(e.l, 2)} && ${lado(e.r, 2)}`;
    case 'ou': return `${lado(e.l, 1)} || ${lado(e.r, 1)}`;
  }
}

/** Variáveis citadas numa expressão ou comando. */
function varsDe(x: Expr | Cmd | undefined, out = new Set<string>()): Set<string> {
  if (!x) return out;
  switch (x.k) {
    case 'var': out.add(x.n); break;
    case 'idx': out.add(x.n); varsDe(x.i, out); break;
    case 'bin': case 'cmp': case 'e': case 'ou': varsDe(x.l, out); varsDe(x.r, out); break;
    case 'neg': case 'nao': varsDe(x.e, out); break;
    case 'call': case 'chamada': x.args.forEach(a => varsDe(a, out)); break;
    case 'decl': x.itens.forEach(i => { out.add(i.nome); varsDe(i.init, out); i.lista?.forEach(l => varsDe(l, out)); }); break;
    case 'atrib': varsDe(x.alvo, out); varsDe(x.valor, out); break;
    case 'saida': x.partes.forEach(p => p.t === 'expr' && varsDe(p.e, out)); break;
    case 'if': varsDe(x.cond, out); varsDe(x.entao, out); varsDe(x.senao, out); break;
    case 'for': varsDe(x.init, out); varsDe(x.cond, out); varsDe(x.passo, out); varsDe(x.corpo, out); break;
    case 'while': case 'do': varsDe(x.cond, out); varsDe(x.corpo, out); break;
    case 'bloco': x.corpo.forEach(c => varsDe(c, out)); break;
  }
  return out;
}

/** Variáveis que recebem valor num comando. */
function escritasDe(x: Cmd | undefined, out = new Set<string>()): Set<string> {
  if (!x) return out;
  switch (x.k) {
    case 'atrib': out.add(x.alvo.k === 'var' || x.alvo.k === 'idx' ? x.alvo.n : ''); break;
    case 'decl': x.itens.forEach(i => (i.init || i.lista) && out.add(i.nome)); break;
    case 'if': escritasDe(x.entao, out); escritasDe(x.senao, out); break;
    case 'for': escritasDe(x.init, out); escritasDe(x.passo, out); escritasDe(x.corpo, out); break;
    case 'while': case 'do': escritasDe(x.corpo, out); break;
    case 'bloco': x.corpo.forEach(c => escritasDe(c, out)); break;
  }
  return out;
}

const contaVar = (e: Expr, n: string): number => {
  switch (e.k) {
    case 'var': return e.n === n ? 1 : 0;
    case 'idx': return (e.n === n ? 1 : 0) + contaVar(e.i, n);
    case 'bin': case 'cmp': case 'e': case 'ou': return contaVar(e.l, n) + contaVar(e.r, n);
    case 'neg': case 'nao': return contaVar(e.e, n);
    case 'call': return e.args.reduce((s, a) => s + contaVar(a, n), 0);
    default: return 0;
  }
};

/** Folha mais à esquerda de uma conta (X em X * 3 + 2). */
const folhaEsquerda = (e: Expr): Expr => (e.k === 'bin' ? folhaEsquerda(e.l) : e);

const ehConst = (e: Expr | undefined): e is { k: 'num'; v: number; nome?: string; linha: number } => e?.k === 'num';
const ehBotao = (n: string) => /^(bot(a|ã)o\w*|button\w*|btn\w*)$/i.test(n);
const ehLed = (n: string) => /^led$/i.test(n);

class Gerador {
  private readonly linhas: Linha[] = [];
  private readonly vars = new Map<string, Var>();
  /** Nomes de pinos (int led = 13;): não vão para a memória. */
  private readonly pinos = new Map<string, number | string>();
  private readonly usadosAsm = new Set<string>();
  private readonly rotulos = new Map<string, number>();
  private texto: string | null = null;
  private readonly avisos: string[];
  private arduino = false;
  private nivel = 0;
  private profLaco = 0;
  private cabecalho: string | null = null;
  private linhaAtual = 0;
  private ultimoHalt = false;

  // registradores
  private readonly cache = new Map<Reg, Set<string>>();
  private readonly preso = new Map<Reg, string>();
  private readonly ocupado = new Set<Reg>();
  private readonly lacos: Laco[] = [];

  constructor(private readonly prog: ProgramaC, private readonly comentarios: boolean) {
    this.avisos = [...prog.avisos];
    REGS.forEach(r => this.cache.set(r, new Set()));
  }

  gerar(): ResultadoTraducao {
    const { topo, funcoes } = this.prog;
    const todos: Cmd[] = [...topo, ...(funcoes.get('setup') ?? []), ...(funcoes.get('loop') ?? []), ...(funcoes.get('main') ?? [])];
    this.prepararPinos(todos);
    this.arduino = funcoes.has('setup') || funcoes.has('loop') || this.usaArduino(todos);

    // nomes das variáveis declaradas, para os rótulos não colidirem
    const declarados = new Set<string>();
    const coletar = (c: Cmd) => {
      if (c.k === 'decl') c.itens.forEach(i => declarados.add(i.nome.toUpperCase()));
      if (c.k === 'bloco') c.corpo.forEach(coletar);
      if (c.k === 'if') { coletar(c.entao); if (c.senao) coletar(c.senao); }
      if (c.k === 'for') { if (c.init) coletar(c.init); coletar(c.corpo); }
      if (c.k === 'while' || c.k === 'do') coletar(c.corpo);
    };
    todos.forEach(coletar);
    declarados.forEach(n => this.usadosAsm.add(n));

    this.lista(topo, true);
    if (funcoes.has('setup')) { this.secao('setup()'); this.lista(funcoes.get('setup')!, true); }
    if (funcoes.has('loop')) {
      this.secao('loop() — no Arduino repete para sempre; aqui executa uma vez');
      this.lista(funcoes.get('loop')!, true);
      this.avisos.push('O loop() do Arduino repete para sempre; no assembly, o corpo do loop() executa uma vez.');
    }
    if (funcoes.has('main')) {
      this.lista(funcoes.get('main')!, true);
      if (!this.ultimoHalt) { this.cabecalho = null; this.emitir('HALT', 'encerra o programa'); }
    }
    this.eliminarStoresRepetidos();
    return { codigo: this.montarTexto(), erros: [], avisos: this.avisos, arduino: this.arduino };
  }

  // ── pinos do Arduino ──

  private usaArduino(cmds: Cmd[]): boolean {
    let usa = false;
    const ver = (x: Expr | Cmd | undefined): void => {
      if (!x) return;
      if ((x.k === 'chamada' && x.f !== 'Serial.begin') || x.k === 'call') usa = true;
      if (x.k === 'bloco') x.corpo.forEach(ver);
      if (x.k === 'if') { ver(x.cond); ver(x.entao); ver(x.senao); }
      if (x.k === 'for') { ver(x.init); ver(x.cond); ver(x.passo); ver(x.corpo); }
      if (x.k === 'while' || x.k === 'do') { ver(x.cond); ver(x.corpo); }
      if (x.k === 'atrib') ver(x.valor);
      if (x.k === 'decl') x.itens.forEach(i => ver(i.init));
      if (x.k === 'cmp' || x.k === 'bin' || x.k === 'e' || x.k === 'ou') { ver(x.l); ver(x.r); }
      if (x.k === 'nao' || x.k === 'neg') ver(x.e);
    };
    cmds.forEach(ver);
    return usa;
  }

  /** Variáveis usadas só como número de pino (int led = 13;) não vão para a memória. */
  private prepararPinos(cmds: Cmd[]): void {
    const usoPino = new Set<string>();
    const outroUso = new Set<string>();
    const decl = new Map<string, Expr | undefined>();
    const pino = (e: Expr | undefined) => { if (e?.k === 'var') usoPino.add(e.n); else if (e) expr(e); };
    const expr = (e: Expr): void => {
      switch (e.k) {
        case 'var': outroUso.add(e.n); break;
        case 'idx': outroUso.add(e.n); expr(e.i); break;
        case 'bin': case 'cmp': case 'e': case 'ou': expr(e.l); expr(e.r); break;
        case 'neg': case 'nao': expr(e.e); break;
        case 'call': pino(e.args[0]); break;
      }
    };
    const cmd = (c: Cmd | undefined): void => {
      if (!c) return;
      switch (c.k) {
        case 'decl': c.itens.forEach(i => {
          if (i.tamanho === null && (ehConst(i.init) || i.init?.k === 'porta') && !decl.has(i.nome)) decl.set(i.nome, i.init);
          else outroUso.add(i.nome);
          if (i.init && !ehConst(i.init) && i.init.k !== 'porta') expr(i.init);
        }); break;
        case 'chamada':
          if (c.f === 'digitalWrite' || c.f === 'pinMode') { pino(c.args[0]); c.args.slice(1).forEach(expr); }
          else if (c.f === 'digitalRead' || c.f === 'analogRead') pino(c.args[0]);
          else c.args.forEach(expr);
          break;
        case 'atrib': outroUso.add(c.alvo.k === 'var' || c.alvo.k === 'idx' ? c.alvo.n : ''); if (c.alvo.k === 'idx') expr(c.alvo.i); expr(c.valor); break;
        case 'saida': c.partes.forEach(p => p.t === 'expr' && expr(p.e)); break;
        case 'if': expr(c.cond); cmd(c.entao); cmd(c.senao); break;
        case 'for': cmd(c.init); if (c.cond) expr(c.cond); cmd(c.passo); cmd(c.corpo); break;
        case 'while': case 'do': expr(c.cond); cmd(c.corpo); break;
        case 'bloco': c.corpo.forEach(cmd); break;
      }
    };
    cmds.forEach(cmd);
    usoPino.forEach(n => {
      if (outroUso.has(n)) return;
      const init = decl.get(n);
      if (init?.k === 'num') this.pinos.set(n, init.v);
      else if (init?.k === 'porta') this.pinos.set(n, init.n);
      else if (!decl.has(n) && (ehLed(n) || ehBotao(n))) this.pinos.set(n, ehLed(n) ? 13 : 'BOTAO');
    });
  }

  private portaSaida(e: Expr): string | null {
    const v = e.k === 'num' ? e.v : e.k === 'var' && this.pinos.has(e.n) ? this.pinos.get(e.n)! : null;
    if (v === null) return null;
    if (typeof v === 'string' || v < 0 || v > 13) throw new ErroTraducao(e.linha, `Pino de saída inválido: ${mostrarC(e)} (use de 0 a 13; o LED é o pino 13).`);
    return v === 13 ? 'LED' : String(v);
  }

  private portaEntrada(e: Expr, analogico: boolean): string | null {
    const nome = e.k === 'var' ? e.n : e.k === 'num' ? e.nome : undefined;
    const v = e.k === 'num' ? e.v : e.k === 'porta' ? e.n : e.k === 'var' && this.pinos.has(e.n) ? this.pinos.get(e.n)! : null;
    if (v === null) return null;
    if (analogico) {
      if (typeof v === 'string' && /^A[0-5]$/.test(v)) return v;
      if (typeof v === 'number' && v >= 0 && v <= 5) return `A${v}`;
      throw new ErroTraducao(e.linha, `analogRead lê os pinos A0 a A5 (encontrado ${mostrarC(e)}).`);
    }
    if (v === 'BOTAO' || (nome && ehBotao(nome))) return 'BOTAO';
    if (typeof v === 'string') return v;
    if (v < 0 || v > 13) throw new ErroTraducao(e.linha, `Pino de entrada inválido: ${mostrarC(e)}.`);
    return String(v);
  }

  // ── variáveis e memória ──

  private declarar(item: ItemDecl, valores: (number | null)[]): Var {
    const existente = this.vars.get(item.nome);
    if (existente) return existente;
    let asm = item.nome;
    const ocupado = (n: string) => ehReservada(n) || [...this.vars.values()].some(v => v.asm.toUpperCase() === n.toUpperCase())
      || n.toUpperCase() === 'TEXTO' || n.toUpperCase() === 'IMPRIME';
    while (ocupado(asm)) asm += '_';
    if (asm !== item.nome) {
      this.avisos.push(`A variável "${item.nome}" virou "${asm}" no assembly (o nome ${item.nome.toUpperCase()} é reservado ou já foi usado — o assembly não diferencia maiúsculas de minúsculas).`);
    }
    const v: Var = { c: item.nome, asm, tamanho: item.tamanho ?? 1, valores, ordem: this.vars.size, definida: valores.some(x => x !== null) };
    this.vars.set(item.nome, v);
    this.usadosAsm.add(asm.toUpperCase());
    return v;
  }

  private varDe(nome: string, linha: number, vetor: boolean): Var {
    const v = this.vars.get(nome);
    if (!v) {
      if (this.pinos.has(nome)) throw new ErroTraducao(linha, `"${nome}" é um número de pino; use-o só no digitalWrite, digitalRead, analogRead ou pinMode.`);
      throw new ErroTraducao(linha, `Variável não declarada: ${nome} (declare antes, ex.: int ${nome} = 0;).`);
    }
    if (vetor && v.tamanho === 1) throw new ErroTraducao(linha, `${nome} não é um vetor.`);
    if (!vetor && v.tamanho > 1) throw new ErroTraducao(linha, `${nome} é um vetor: use uma posição, ex.: ${nome}[0].`);
    return v;
  }

  // ── emissão ──

  private secao(titulo: string): void {
    if (this.linhas.length) this.linhas.push({ t: 'branco' });
    if (this.comentarios) this.linhas.push({ t: 'com', txt: titulo, nivel: 0 });
  }

  private emitir(txt: string, com?: string): void {
    if (this.cabecalho !== null) {
      if (this.comentarios) this.linhas.push({ t: 'com', txt: this.cabecalho, nivel: this.nivel });
      this.cabecalho = null;
    }
    this.linhas.push({ t: 'ins', txt, com: this.comentarios ? com : undefined, nivel: this.nivel });
    this.ultimoHalt = txt === 'HALT';
  }

  private rotulo(nome: string): void {
    this.linhas.push({ t: 'rot', nome, nivel: Math.max(0, this.nivel - 1) });
    this.ultimoHalt = false;
    // um rótulo pode ser alcançado por um salto: o que estava nos registradores (fora os presos) já não vale
    REGS.forEach(r => this.cache.get(r)!.clear());
  }

  private novoRotulo(base: string): string {
    let n = this.rotulos.get(base) ?? 0;
    let nome: string;
    do { n++; nome = n === 1 ? base : `${base}${n}`; } while (this.usadosAsm.has(nome));
    this.rotulos.set(base, n);
    this.usadosAsm.add(nome);
    return nome;
  }

  // ── registradores ──

  private livre(): Reg {
    const disp = REGS.filter(r => !this.preso.has(r) && !this.ocupado.has(r));
    const r = disp.find(x => !this.cache.get(x)!.size) ?? disp[0];
    if (!r) throw new ErroTraducao(this.linhaAtual, 'A expressão é complexa demais: faltam registradores (R0 a R7). Divida a conta em partes.');
    this.escrever(r);
    return r;
  }

  /** O registrador vai receber um valor novo: esquece o que ele guardava. */
  private escrever(r: Reg): void {
    this.cache.get(r)!.clear();
    this.ocupado.add(r);
  }

  private chave(e: Expr): string | null {
    if (e.k === 'var') return `v:${e.n}`;
    if (e.k === 'idx') {
      if (e.i.k === 'num') return `i:${e.n}:${e.i.v}`;
      if (e.i.k === 'var') return `i:${e.n}:v:${e.i.n}`;
    }
    return null;
  }

  private emCache(chave: string): Reg | undefined {
    return REGS.find(r => this.cache.get(r)!.has(chave));
  }

  /** A variável mudou: some do cache tudo o que depende dela. */
  private invalidar(nome: string, vetor: boolean): void {
    REGS.forEach(r => {
      const s = this.cache.get(r)!;
      [...s].forEach(k => {
        if ((!vetor && (k === `v:${nome}` || k.endsWith(`:v:${nome}`))) || (vetor && k.startsWith(`i:${nome}:`))) s.delete(k);
      });
    });
  }

  private presoDe(nome: string): Reg | undefined {
    return REGS.find(r => this.preso.get(r) === nome);
  }

  /** Nome para os comentários: a variável presa no registrador, ou o próprio registrador. */
  private nomeReg(r: Reg): string {
    const p = this.preso.get(r);
    if (p) return p;
    const k = [...this.cache.get(r)!][0];
    if (k?.startsWith('v:')) return k.slice(2);
    return r;
  }

  private textoOp(o: Operando): string { return o.t === 'reg' ? o.r : o.txt; }
  private nomeOp(o: Operando): string { return o.t === 'reg' ? this.nomeReg(o.r) : o.txt; }

  private constante(e: { v: number; nome?: string }): { t: 'const'; v: number; txt: string } {
    const txt = e.nome && /^'.'$/.test(e.nome) ? e.nome : String(e.v);
    return { t: 'const', v: e.v, txt };
  }

  /** Valor da expressão: constante ou registrador (que pode ser só para leitura). */
  private valor(e: Expr): Operando {
    switch (e.k) {
      case 'num': return this.constante(e);
      case 'var': {
        const v = this.varDe(e.n, e.linha, false);
        const p = this.presoDe(e.n);
        if (p) { this.ocupado.add(p); return { t: 'reg', r: p }; }
        const c = this.emCache(`v:${e.n}`);
        if (c) { this.ocupado.add(c); return { t: 'reg', r: c }; }
        const r = this.livre();
        this.emitir(`LOAD ${r}, ${v.asm}`, `${r} = ${e.n}`);
        this.cache.get(r)!.add(`v:${e.n}`);
        return { t: 'reg', r };
      }
      case 'idx': {
        const v = this.varDe(e.n, e.linha, true);
        const k = this.chave(e);
        const c = k ? this.emCache(k) : undefined;
        if (c) { this.ocupado.add(c); return { t: 'reg', r: c }; }
        const ind = e.i.k === 'num' ? this.constante(e.i) : this.registrador(this.valor(e.i));
        const r = this.livre();
        this.emitir(`LOAD ${r}, ${v.asm}[${this.textoOp(ind)}]`, `${r} = ${e.n}[${mostrarC(e.i)}]`);
        if (k) this.cache.get(r)!.add(k);
        return { t: 'reg', r };
      }
      case 'call': {
        const analogico = e.f === 'analogRead';
        if (!e.args[0]) throw new ErroTraducao(e.linha, `${e.f} precisa do pino, ex.: ${analogico ? 'analogRead(A0)' : 'digitalRead(botao)'}.`);
        const porta = this.portaEntrada(e.args[0], analogico);
        const p = porta ?? this.registrador(this.valor(e.args[0])).r;
        const r = this.livre();
        this.emitir(`IN ${r}, ${p}`, porta === 'BOTAO' ? 'lê o botão (0 ou 1)' : analogico ? `lê o sensor em ${p} (0 a 1023)` : `lê o pino ${p}`);
        return { t: 'reg', r };
      }
      case 'porta': throw new ErroTraducao(e.linha, `${e.n} é um pino analógico: leia com analogRead(${e.n}).`);
      case 'str': throw new ErroTraducao(e.linha, 'Texto entre aspas só pode aparecer no printf.');
      case 'cmp': case 'e': case 'ou': case 'nao':
        throw new ErroTraducao(e.linha, 'Comparações (==, <, &&…) só podem ser usadas como condição de if, while ou for.');
      default: return { t: 'reg', r: this.conta(e) };
    }
  }

  /** Garante que o operando está num registrador. */
  private registrador(o: Operando): { t: 'reg'; r: Reg } {
    if (o.t === 'reg') return o;
    const r = this.livre();
    this.emitir(`LOAD ${r}, ${o.txt}`, `${r} = ${o.txt}`);
    return { t: 'reg', r };
  }

  /** Calcula a expressão num registrador que pode ser alterado (ou no registrador `alvo`). */
  private conta(e: Expr, alvo?: Reg): Reg {
    switch (e.k) {
      case 'num': {
        const r = alvo ?? this.livre();
        if (alvo) this.escrever(alvo);
        const c = this.constante(e);
        this.emitir(`LOAD ${r}, ${c.txt}`, `${this.nomeReg(r)} = ${e.nome ?? c.txt}`);
        return r;
      }
      case 'var': case 'idx': case 'call': {
        const p = e.k === 'var' ? this.presoDe(e.n) : undefined;
        if (p && p === alvo) return p;
        const o = this.registrador(this.valor(e));
        if (alvo) {
          if (o.r === alvo) return alvo;
          this.escrever(alvo);
          this.emitir(`MOV ${alvo}, ${o.r}`, `${this.nomeReg(alvo)} = ${this.nomeReg(o.r)}`);
          return alvo;
        }
        // registrador preso a uma variável do laço, ou já usado nesta conta: copia
        if (this.preso.has(o.r) || this.usadoNaConta.has(o.r)) {
          const r = this.livre();
          this.emitir(`MOV ${r}, ${o.r}`, `${r} = ${this.nomeReg(o.r)}`);
          return r;
        }
        this.escrever(o.r);
        return o.r;
      }
      case 'neg': {
        const r = alvo ?? this.livre();
        if (alvo) this.escrever(alvo);
        this.emitir(`LOAD ${r}, 0`, `${this.nomeReg(r)} = 0`);
        const v = this.valor(e.e);
        this.emitir(`SUB ${r}, ${this.textoOp(v)}`, `${this.nomeReg(r)} = -${this.nomeOp(v)}`);
        return r;
      }
      case 'bin': {
        const l = this.conta(e.l, alvo);
        this.usadoNaConta.add(l);
        const nomeL = this.nomeReg(l);
        if (e.op === '%') {
          // resto: a - (a / b) * b
          const b = this.valor(e.r);
          const t = this.livre();
          this.emitir(`MOV ${t}, ${l}`, `${t} = ${nomeL}`);
          this.emitir(`DIV ${t}, ${this.textoOp(b)}`, `${t} = ${nomeL} / ${this.nomeOp(b)}`);
          this.emitir(`MUL ${t}, ${this.textoOp(b)}`, `${t} = ${t} * ${this.nomeOp(b)}`);
          this.emitir(`SUB ${l}, ${t}`, `${nomeL} = ${nomeL} % ${this.nomeOp(b)} (resto)`);
          return l;
        }
        const r = this.valor(e.r);
        const op = { '+': 'ADD', '-': 'SUB', '*': 'MUL', '/': 'DIV' }[e.op];
        this.emitir(`${op} ${l}, ${this.textoOp(r)}`, `${nomeL} = ${nomeL} ${e.op} ${this.nomeOp(r)}`);
        return l;
      }
      default: return this.registrador(this.valor(e)).r;
    }
  }

  /** Registradores que já guardam um pedaço da conta em andamento. */
  private readonly usadoNaConta = new Set<Reg>();

  private fimComando(): void {
    this.ocupado.clear();
    this.usadoNaConta.clear();
  }

  // ── comandos ──

  private lista(cmds: Cmd[], topo = false): void {
    cmds.forEach(c => {
      if (topo && c.k !== 'decl' && c.k !== 'vazio' && this.linhas.some(l => l.t === 'ins') && this.linhas[this.linhas.length - 1]?.t !== 'branco') {
        this.linhas.push({ t: 'branco' });
      }
      this.comando(c);
    });
  }

  private comando(c: Cmd): void {
    if (c.linha) this.linhaAtual = c.linha;
    this.cabecalho = c.texto ? c.texto.replace(/;$/, '') : null;
    switch (c.k) {
      case 'vazio': break;
      case 'bloco': this.cabecalho = null; this.lista(c.corpo); break;
      case 'decl': this.declaracao(c.itens); break;
      case 'atrib': this.atribuir(c.alvo, c.op === '=' ? c.valor : { k: 'bin', op: c.op, l: c.alvo, r: c.valor, linha: c.linha }); break;
      case 'saida': this.saida(c.partes, c.linha); break;
      case 'chamada': this.chamada(c.f, c.args, c.linha); break;
      case 'if': this.se(c.cond, c.entao, c.senao); break;
      case 'for': this.laco(c.texto, c.corpo, c.cond, c.init, c.passo, 'for'); break;
      case 'while': this.laco(c.texto, c.corpo, c.cond, undefined, undefined, 'while'); break;
      case 'do': this.laco('do', c.corpo, c.cond, undefined, undefined, 'do'); break;
      case 'return': this.emitir('HALT', 'encerra o programa'); break;
      case 'break': case 'continue': {
        const l = this.lacos[this.lacos.length - 1];
        if (!l) throw new ErroTraducao(c.linha, `${c.k} só pode ser usado dentro de um laço (for, while).`);
        if (c.k === 'break') this.emitir(`JMP ${l.fim}`, 'sai do laço (break)');
        else { l.usouCont = true; this.emitir(`JMP ${l.cont ?? l.inicio}`, 'próxima volta (continue)'); }
        break;
      }
    }
    this.fimComando();
    this.cabecalho = null;
  }

  private declaracao(itens: ItemDecl[], noLaco = this.profLaco > 0): void {
    for (const it of itens) {
      if (this.pinos.has(it.nome)) continue;   // número de pino: não vai para a memória
      if (it.tamanho !== null) {
        const vals = (it.lista ?? []).map(x => {
          if (!ehConst(x)) throw new ErroTraducao(it.linha, `Os valores iniciais do vetor ${it.nome} devem ser números.`);
          return x.v;
        });
        while (vals.length < it.tamanho) vals.push(0);
        if (this.vars.has(it.nome)) throw new ErroTraducao(it.linha, `O vetor ${it.nome} já foi declarado.`);
        this.declarar(it, vals);
        continue;
      }
      const ja = this.vars.has(it.nome);
      // valor constante e declaração que executa uma vez só → direto na memória
      if (!ja && ehConst(it.init) && !noLaco) { this.declarar(it, [it.init.v]); continue; }
      this.declarar(it, [null]);
      if (it.init) this.atribuir({ k: 'var', n: it.nome, linha: it.linha }, it.init);
    }
  }

  private atribuir(alvo: Expr, valor: Expr): void {
    if (alvo.k === 'idx') {
      const v = this.varDe(alvo.n, alvo.linha, true);
      const val = valor.k === 'var' || valor.k === 'idx' ? this.registrador(this.valor(valor)) : { t: 'reg' as const, r: this.conta(valor) };
      const ind = alvo.i.k === 'num' ? this.constante(alvo.i) : this.registrador(this.valor(alvo.i));
      this.emitir(`STORE ${v.asm}[${this.textoOp(ind)}], ${val.r}`, `${alvo.n}[${mostrarC(alvo.i)}] = ${this.nomeReg(val.r)}`);
      this.invalidar(alvo.n, true);
      v.definida = true;
      return;
    }
    if (alvo.k !== 'var') return;
    const v = this.varDe(alvo.n, alvo.linha, false);
    const p = this.presoDe(alvo.n);
    if (p) {
      // variável presa num registrador (dentro de um laço): calcula direto nele
      const n = contaVar(valor, alvo.n);
      const folha = folhaEsquerda(valor);
      const direto = n === 0 || (n === 1 && folha.k === 'var' && folha.n === alvo.n);
      if (direto) this.conta(valor, p);
      else {
        const r = this.conta(valor);
        this.escrever(p);
        this.emitir(`MOV ${p}, ${r}`, `${alvo.n} = ${this.nomeReg(r)}`);
      }
      this.cache.get(p)!.clear();
      this.invalidar(alvo.n, false);
      v.definida = true;
      return;
    }
    const r = valor.k === 'var' || valor.k === 'idx' ? this.registrador(this.valor(valor)).r : this.conta(valor);
    this.emitir(`STORE ${v.asm}, ${r}`, `${alvo.n} = ${this.nomeReg(r)}`);
    this.invalidar(alvo.n, false);
    this.cache.get(r)!.add(`v:${alvo.n}`);
    v.definida = true;
  }

  private saida(partes: Parte[], linha: number): void {
    for (const p of partes) {
      if (p.t === 'texto') {
        const t = p.v.replace(/\n/g, '');
        if (!t) continue;
        if (this.texto === null) this.texto = t;
        if (this.texto !== t) {
          this.avisos.push(`Linha ${linha}: o texto "${t}" não foi exibido — o simulador tem um TEXTO só (o CALL imprime exibe sempre "${this.texto}").`);
          if (this.comentarios) this.linhas.push({ t: 'com', txt: `(texto "${t}" não exibido: só existe um TEXTO)`, nivel: this.nivel });
          continue;
        }
        this.emitir('CALL imprime', `exibe o texto "${t}"`);
        // como no slide: depois do CALL, o valor é lido da memória de novo
        REGS.forEach(r => !this.preso.has(r) && this.cache.get(r)!.clear());
      } else {
        const o = this.registrador(this.valor(p.e));
        this.emitir(`OUT TELA, ${o.r}`, `exibe ${this.nomeReg(o.r)} na tela`);
      }
    }
  }

  private chamada(f: string, args: Expr[], linha: number): void {
    switch (f) {
      case 'pinMode': case 'Serial.begin':
        if (this.comentarios && this.cabecalho) this.linhas.push({ t: 'com', txt: `${this.cabecalho} — não gera instrução no simulador`, nivel: this.nivel });
        this.cabecalho = null;
        return;
      case 'delay': {
        if (!args[0]) throw new ErroTraducao(linha, 'O delay precisa do tempo em ms, ex.: delay(1000);');
        const o = this.valor(args[0]);
        this.emitir(`DELAY ${this.textoOp(o)}`, `pausa ${o.t === 'const' ? o.txt + ' ms' : 'por ' + this.nomeReg(o.r) + ' ms'}`);
        return;
      }
      case 'digitalWrite': {
        if (args.length !== 2) throw new ErroTraducao(linha, 'Use digitalWrite(pino, valor), ex.: digitalWrite(led, HIGH);');
        const porta = this.portaSaida(args[0]);
        const p = porta ?? this.registrador(this.valor(args[0])).r;
        const val = args[1];
        const o = this.valor(val);
        const r = o.t === 'reg' ? o.r : this.livre();
        if (o.t === 'const') this.emitir(`LOAD ${r}, ${o.txt}`, val.k === 'num' && val.nome ? val.nome : `${r} = ${o.txt}`);
        const onde = porta === 'LED' ? 'o LED' : porta ? `o pino ${porta}` : `o pino indicado por ${p}`;
        const com = o.t === 'const' && o.v === 1 ? `acende ${onde}` : o.t === 'const' && o.v === 0 ? `apaga ${onde}` : `envia ${this.nomeReg(r)} para ${onde}`;
        this.emitir(`OUT ${p}, ${r}`, com);
        return;
      }
      case 'digitalRead': case 'analogRead':
        this.valor({ k: 'call', f, args, linha });
        return;
    }
  }

  private salto(cond: Expr, rotulo: string, seVerdadeira: boolean, comentario?: (c: string) => string): void {
    switch (cond.k) {
      case 'nao': this.salto(cond.e, rotulo, !seVerdadeira, comentario); return;
      case 'e': case 'ou': {
        const curto = (cond.k === 'e') !== seVerdadeira;   // && com salto se falsa, ou || com salto se verdadeira
        if (curto) {
          this.salto(cond.l, rotulo, seVerdadeira, comentario);
          this.fimComando();
          this.salto(cond.r, rotulo, seVerdadeira, comentario);
        } else {
          const ok = this.novoRotulo('SEGUE');
          this.salto(cond.l, ok, !seVerdadeira, c => `se ${c}, segue`);
          this.fimComando();
          this.salto(cond.r, rotulo, seVerdadeira, comentario);
          this.rotulo(ok);
        }
        return;
      }
      case 'num':
        if ((cond.v !== 0) === seVerdadeira) this.emitir(`JMP ${rotulo}`, comentario?.(mostrarC(cond)));
        return;
      case 'cmp': {
        let { l, r, op } = cond;
        if (ehConst(l) && !ehConst(r)) { [l, r] = [r, l]; op = ESPELHO[op]; }
        const a = this.registrador(this.valor(l));
        const b = this.valor(r);
        this.emitir(`CMP ${a.r}, ${this.textoOp(b)}`, `compara ${mostrarC(l)} com ${mostrarC(r)}`);
        const testa = seVerdadeira ? op : INVERSO[op];
        this.emitir(`${SALTO[testa]} ${rotulo}`, comentario?.(`${mostrarC(l)} ${testa} ${mostrarC(r)}`));
        return;
      }
      default: {
        // if (x) → x != 0
        this.salto({ k: 'cmp', op: '!=', l: cond, r: { k: 'num', v: 0, linha: cond.linha }, linha: cond.linha }, rotulo, seVerdadeira, comentario);
      }
    }
  }

  private se(cond: Expr, entao: Cmd, senao?: Cmd): void {
    const fim = this.novoRotulo('FIM');
    const desvio = senao ? this.novoRotulo('SENAO') : fim;
    this.salto(cond, desvio, false, c => `se ${c}, pula o bloco`);
    this.fimComando();
    this.cabecalho = null;
    this.nivel++;
    this.comando(entao);
    if (senao) {
      this.emitir(`JMP ${fim}`, 'pula o else');
      this.rotulo(desvio);
      if (this.comentarios) this.linhas.push({ t: 'com', txt: 'else', nivel: this.nivel });
      this.comando(senao);
    }
    this.rotulo(fim);
    this.nivel--;
  }

  private laco(texto: string, corpo: Cmd, cond: Expr | undefined, init: Cmd | undefined, passo: Cmd | undefined, tipo: 'for' | 'while' | 'do'): void {
    const cab = this.cabecalho;
    // variável declarada no for (int i = 1): vai para a memória com o valor inicial, como no slide
    let declFor: string | null = null;
    let initVar: { nome: string; valor: Expr } | null = null;
    if (init?.k === 'decl' && init.itens.length === 1 && init.itens[0].tamanho === null && init.itens[0].init) {
      const it = init.itens[0];
      declFor = it.nome;
      if (!this.vars.has(it.nome) && ehConst(it.init) && this.profLaco === 0) this.declarar(it, [it.init!.v]);
      else { this.declarar(it, [null]); initVar = { nome: it.nome, valor: it.init! }; }
    } else if (init?.k === 'atrib' && init.op === '=' && init.alvo.k === 'var') {
      initVar = { nome: init.alvo.n, valor: init.valor };
    } else if (init?.k === 'decl') {
      this.declaracao(init.itens);
    } else if (init) {
      this.comando(init);
    }

    // variáveis do laço presas em registradores: lidas antes, gravadas depois (slide do for com soma)
    const todos: Cmd = { k: 'bloco', corpo: passo ? [corpo, passo] : [corpo], linha: 0, texto: '' };
    const usadas = varsDe(todos, varsDe(cond));
    const escritas = escritasDe(todos);
    if (initVar) { usadas.add(initVar.nome); if (initVar.nome !== declFor) escritas.add(initVar.nome); }
    const candidatas = [...usadas]
      .map(n => this.vars.get(n))
      .filter((v): v is Var => !!v && v.tamanho === 1 && !this.presoDe(v.c))
      .sort((a, b) => a.ordem - b.ordem);
    const livres = REGS.filter(r => !this.preso.has(r)).length - 3;   // sobram 3 para as contas
    const presas = candidatas.length <= livres ? candidatas : [];

    this.cabecalho = cab;
    const novas: Reg[] = [];
    for (const v of presas) {
      const ehInit = initVar?.nome === v.c;
      const c = this.emCache(`v:${v.c}`);
      let r: Reg;
      if (ehInit) {
        r = this.livre();
        this.preso.set(r, v.c);
        this.conta(initVar!.valor, r);
        v.definida = true;
      } else if (c && !this.ocupado.has(c)) {
        r = c;
      } else {
        r = this.livre();
        if (v.definida) this.emitir(`LOAD ${r}, ${v.asm}`, `${r} = ${v.c}`);
      }
      this.preso.set(r, v.c);
      this.cache.get(r)!.clear();
      novas.push(r);
      this.fimComando();
    }
    if (initVar && !presas.some(v => v.c === initVar!.nome)) {
      this.atribuir({ k: 'var', n: initVar.nome, linha: 0 }, initVar.valor);
      this.fimComando();
    }
    if (this.cabecalho !== null && this.comentarios) {
      this.linhas.push({ t: 'com', txt: this.cabecalho, nivel: this.nivel });
    }
    this.cabecalho = null;

    const inicio = this.novoRotulo('LOOP');
    const fim = this.novoRotulo('FIM');
    const info: Laco = { inicio, fim, cont: null, usouCont: false };
    if (((tipo === 'for' && passo) || tipo === 'do') && this.temContinue(corpo)) info.cont = this.novoRotulo('PROXIMO');
    this.lacos.push(info);
    this.profLaco++;
    this.nivel++;
    this.rotulo(inicio);
    if (tipo !== 'do' && cond) {
      this.salto(cond, fim, false, c => `se ${c}, sai do laço`);
      this.fimComando();
    }
    this.comando(corpo);
    if (info.cont) this.rotulo(info.cont);
    if (passo) this.comando(passo);
    if (tipo === 'do') {
      if (cond) this.salto(cond, inicio, true, c => `se ${c}, repete`);
      else this.emitir(`JMP ${inicio}`, 'volta ao início do laço');
      this.fimComando();
    } else this.emitir(`JMP ${inicio}`, 'volta ao início do laço');
    this.profLaco--;
    this.lacos.pop();
    this.rotulo(fim);
    this.nivel--;

    // grava na memória as variáveis que mudaram no laço (menos a do for, que só existe nele)
    for (const r of novas) {
      const nome = this.preso.get(r)!;
      this.preso.delete(r);
      const v = this.vars.get(nome)!;
      if (escritas.has(nome) && nome !== declFor) {
        this.emitir(`STORE ${v.asm}, ${r}`, `guarda ${nome} na memória`);
        this.cache.get(r)!.add(`v:${nome}`);
      }
    }
    this.fimComando();
  }

  private temContinue(c: Cmd): boolean {
    switch (c.k) {
      case 'continue': return true;
      case 'bloco': return c.corpo.some(x => this.temContinue(x));
      case 'if': return this.temContinue(c.entao) || (!!c.senao && this.temContinue(c.senao));
      default: return false;   // continue de laço interno pertence ao laço interno
    }
  }

  /**
   * STORE X seguido de outro STORE X, sem ninguém ler X no meio (e sem rótulos ou saltos):
   * o primeiro é desnecessário (slide: int D = T - L; D = D * 2 → um STORE só).
   */
  private eliminarStoresRepetidos(): void {
    for (let i = 0; i < this.linhas.length; i++) {
      const a = this.linhas[i];
      if (a.t !== 'ins') continue;
      const m = a.txt.match(/^STORE (\w+), /);
      if (!m) continue;
      const nome = m[1];
      for (let j = i + 1; j < this.linhas.length; j++) {
        const b = this.linhas[j];
        if (b.t === 'rot') break;
        if (b.t !== 'ins') continue;
        if (/^(J|CALL|HALT|RET)/.test(b.txt)) break;
        if (new RegExp(`^LOAD \\w+, ${nome}\\b`).test(b.txt)) break;
        if (new RegExp(`^STORE ${nome}, `).test(b.txt)) { this.linhas.splice(i, 1); i--; break; }
      }
    }
  }

  // ── texto final ──

  private montarTexto(): string {
    const out: string[] = [];
    const vars = [...this.vars.values()].sort((a, b) => a.ordem - b.ordem);
    const COL = 22;
    if (vars.length || this.texto !== null) {
      if (this.comentarios) out.push('; valores na memória');
      vars.forEach(v => out.push(`${v.asm}: ${v.valores.map(x => (x === null ? 'vazio' : x)).join(', ')}`));
      if (this.texto !== null) {
        const l = `TEXTO: "${this.texto.replace(/"/g, "'")}"`;
        out.push(this.comentarios ? `${l.padEnd(COL)}; texto do printf (usado pelo CALL imprime)` : l);
      }
      if (this.linhas.length) out.push('');
    }
    for (const l of this.linhas) {
      if (l.t === 'branco') { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
      const ind = '  '.repeat(l.nivel);
      if (l.t === 'com') out.push(`${ind}; ${l.txt}`);
      else if (l.t === 'rot') out.push(`${ind}${l.nome}:`);
      else {
        const s = ind + l.txt;
        out.push(l.com ? `${s.padEnd(COL)}; ${l.com}` : s);
      }
    }
    while (out.length && out[out.length - 1] === '') out.pop();
    return out.join('\n');
  }
}

// ─────────────────────────── entrada ───────────────────────────

/** Traduz um código em C/C++ (PC ou Arduino) para o Assembly simplificado das aulas. */
export function traduzirParaAssembly(fonte: string, opcoes: OpcoesTraducao = {}): ResultadoTraducao {
  try {
    if (!fonte.trim()) return { codigo: '', erros: [], avisos: [], arduino: false };
    const prog = new Parser(tokenizar(fonte), fonte).programa();
    return new Gerador(prog, opcoes.comentarios ?? true).gerar();
  } catch (e) {
    if (e instanceof ErroTraducao) return { codigo: '', erros: [{ linha: e.linha, msg: e.message }], avisos: [], arduino: false };
    throw e;
  }
}
