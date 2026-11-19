/**
 * Exercícios das Aulas 14 e 15 de ArqII ("Do C++ ao Assembly") e a conferência das respostas
 * (lógica pura, sem Angular).
 *
 * Tipos de exercício:
 * - c-para-asm: o aluno escreve o Assembly simplificado de um código em C;
 * - asm-para-c: o aluno escreve o C de um programa em assembly (slide 25 da Aula 14);
 * - perguntas: só perguntas sobre um trecho dado (ex.: prever as flags de um CMP).
 *
 * A conferência não compara o texto: executa a resposta do aluno e a do slide e compara o
 * resultado (valores finais das variáveis, o que apareceu na TELA, a sequência de LEDs e o
 * tempo de DELAY). Assim, uma solução com outros registradores também está certa.
 */
import { Execucao, simular, textoValor } from './assembly';
import { traduzirParaAssembly } from './c-assembly';
import { PINO_LED, VARIAVEL_TEXTO, buscarInstrucao } from './instrucoes';

export type TipoExercicio = 'c-para-asm' | 'asm-para-c' | 'perguntas';
export type TipoPergunta = 'instrucoes' | 'numero' | 'simnao' | 'bits';

export interface Pergunta {
  id: string;
  texto: string;
  tipo: TipoPergunta;
  /** Resposta certa: instruções separadas por vírgula, número, "sim"/"não" ou bits ("011"). */
  resposta: string;
  /** Como a resposta aparece ao mostrar a resposta. */
  explicacao: string;
}

export interface Exercicio {
  id: string;
  /** Origem no material (ex.: "Aula 14 · slide 17"). */
  origem: string;
  titulo: string;
  enunciado: string;
  tipo: TipoExercicio;
  /** Código dado: C (c-para-asm) ou assembly (asm-para-c e perguntas). */
  codigo: string;
  /** Resposta do slide: assembly (c-para-asm) ou C (asm-para-c). */
  gabarito?: string;
  /** Instruções que o enunciado pede para usar. */
  usar?: string[];
  /** Variáveis conferidas (padrão: todas as da resposta, menos o TEXTO). */
  verificar?: string[];
  /** Valores das portas de entrada; a conferência roda cada caso. */
  casos?: Record<string, number>[];
  perguntas?: Pergunta[];
  dica?: string;
}

// ─────────────────────────── exercícios ───────────────────────────

export const EXERCICIOS: Exercicio[] = [
  {
    id: 'a14-y-igual-x',
    origem: 'Aula 14 · slide 17',
    titulo: 'Y = X',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `main(){
   int X = 10, Y;
   Y = X;
}`,
    gabarito: `; valores na memória
X: 10
Y: vazio
; y = x
LOAD R1, X
MOV R2, R1
STORE Y, R2`,
    dica: 'Declare as variáveis na memória (X: 10, Y: vazio). Só LOAD e STORE acessam a memória.',
  },
  {
    id: 'a14-x-mais-y',
    origem: 'Aula 14 · slide 19',
    titulo: 'X = X + Y; Y++',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `main(){
   int X = 10, Y=20;
   X = X + Y;
   Y++;
}`,
    gabarito: `; valores na memória
X: 10
Y: 20
; x = x + y
LOAD R1, X
LOAD R2, Y
ADD R1, R2
STORE X, R1
; y++
ADD R2, 1
STORE Y, R2`,
    dica: 'O Y já está num registrador depois da primeira conta: dá para usá-lo no Y++.',
  },
  {
    id: 'a14-a-expressao',
    origem: 'Aula 14 · slide 21',
    titulo: 'A = A * 3 + 2 + 5',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `main(){
   int A = 8;
   A = A * 3 + 2 + 5;
}`,
    gabarito: `; valores na memória
A: 8
; A = A * 3 + 2 + 5
LOAD R1, A
MUL R1, 3
ADD R1, 2
ADD R1, 5
STORE A, R1`,
    dica: 'Faça as contas no registrador, da esquerda para a direita, e grave no fim.',
  },
  {
    id: 'a14-d-diferenca',
    origem: 'Aula 14 · slide 23',
    titulo: 'D = T - L; D = D * 2',
    enunciado: 'Escreva o Assembly simplificado (use SUB).',
    tipo: 'c-para-asm',
    codigo: `main(){
   int T = 30, L = 25;
   int D = T - L;
   D = D * 2;
}`,
    gabarito: `; valores na memória
T: 30
L: 25
D: 0
; D = (T - L) * 2
LOAD R1, T
LOAD R2, L
SUB R1, R2
MUL R1, 2
STORE D, R1`,
    usar: ['SUB'],
  },
  {
    id: 'a14-asm-para-c',
    origem: 'Aula 14 · slide 25',
    titulo: 'Qual seria o código em C?',
    enunciado: 'Escreva o código em C que corresponde a este assembly.',
    tipo: 'asm-para-c',
    codigo: `; ===== valores na memória =====
A: 8
B: 3

; ===== código assembler =====
LOAD R1, A
LOAD R2, B
MUL R1, R2 ;multiplicar
ADD R2, R1
STORE A, R1
STORE B, R2`,
    gabarito: `main(){
   int A=8,B=3;
   A = A * B;
   B = B + A;
}`,
    dica: 'Siga os registradores: R1 começa com A e R2 com B. O que cada um vale quando é gravado?',
  },
  {
    id: 'a15-x-vezes-3',
    origem: 'Aula 15 · slide 2',
    titulo: 'X = X * 3 - 1',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `int X = 4;
X = X * 3 - 1;`,
    gabarito: `; valores na memória
X: 4
; X = X * 3 - 1
LOAD R1, X
MUL R1, 3
SUB R1, 1
STORE X, R1`,
  },
  {
    id: 'a15-if-b-igual-2',
    origem: 'Aula 15 · slide 3',
    titulo: 'Revisão 1: if (B == 2)',
    enunciado: 'Escreva o Assembly simplificado. Use LOAD, SUB, STORE, CMP e JNE. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `int A = 4, B = 6;
B = B - A;
if (B == 2) { A = B; }`,
    gabarito: `; valores na memória
A: 4
B: 6
; B = B - A
LOAD R1, A
LOAD R2, B
SUB R2, R1
STORE B, R2
; if (B == 2) { A = B; }
CMP R2, 2
JNE FIM
STORE A, R2
FIM:`,
    usar: ['LOAD', 'SUB', 'STORE', 'CMP', 'JNE'],
    dica: 'O if vira CMP + JNE, que pula o bloco quando o resultado é diferente.',
    perguntas: [
      { id: 'ula', texto: 'Quais instruções usam a ULA?', tipo: 'instrucoes', resposta: 'SUB, CMP', explicacao: 'SUB e CMP' },
      { id: 'pc', texto: 'Qual instrução pode alterar o PC?', tipo: 'instrucoes', resposta: 'JNE', explicacao: 'JNE, só se B ≠ 2' },
      { id: 'a', texto: 'Quanto vale A no final?', tipo: 'numero', resposta: '2', explicacao: 'A = 2' },
      { id: 'b', texto: 'Quanto vale B no final?', tipo: 'numero', resposta: '2', explicacao: 'B = 2' },
    ],
  },
  {
    id: 'a15-cmp-flags',
    origem: 'Aula 15 · slide 5',
    titulo: 'Revisão 2: CMP e Flags',
    enunciado: 'Preveja as flags e o salto antes de executar o trecho (R1 = 4 e R2 = 9).',
    tipo: 'perguntas',
    codigo: `; R1 = 4 e R2 = 9
CMP R1, R2
JE  IGUAL`,
    dica: 'O CMP faz R1 − R2 sem guardar o resultado; só as flags mudam.',
    perguntas: [
      { id: 'conta', texto: 'Quanto vale R1 − R2?', tipo: 'numero', resposta: '-5', explicacao: '4 − 9 = −5 (não é guardado)' },
      { id: 'flags', texto: 'Quais os valores de Z, N e C? (ex.: 0, 1, 0)', tipo: 'bits', resposta: '011', explicacao: 'Z = 0, N = 1, C = 1' },
      { id: 'salto', texto: 'O JE pula para IGUAL?', tipo: 'simnao', resposta: 'não', explicacao: 'Não: o JE só pula quando Z = 1' },
    ],
  },
  {
    id: 'a15-digitalwrite',
    origem: 'Aula 15 · slide 7',
    titulo: 'Arduino: digitalWrite',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `digitalWrite(led, HIGH);
delay(1000);
digitalWrite(led, LOW);
delay(1000);`,
    gabarito: `LOAD R1, 1
OUT LED, R1
DELAY 1000
LOAD R1, 0
OUT LED, R1
DELAY 1000`,
    usar: ['OUT', 'DELAY'],
    dica: 'A CPU não escreve direto na porta: carregue o valor num registrador e depois use OUT LED, R1.',
  },
  {
    id: 'a15-digitalread',
    origem: 'Aula 15 · slide 8',
    titulo: 'Arduino: digitalRead',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `estado = digitalRead(botao);
// lê o botão: 0 ou 1`,
    gabarito: `ESTADO: vazio
IN R1, BOTAO
STORE ESTADO, R1`,
    usar: ['IN'],
    casos: [{ BOTAO: 0 }, { BOTAO: 1 }],
    dica: 'Declare ESTADO na memória (ESTADO: vazio). Ler o botão vira IN R1, BOTAO.',
  },
  {
    id: 'a15-analogread',
    origem: 'Aula 15 · slide 9',
    titulo: 'Arduino: analogRead',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `valor = analogRead(A0);
// lê o sensor no pino A0`,
    gabarito: `VALOR: vazio
IN R1, A0
STORE VALOR, R1`,
    usar: ['IN'],
    casos: [{ A0: 0 }, { A0: 512 }, { A0: 1023 }],
  },
  {
    id: 'a15-if-botao',
    origem: 'Aula 15 · slide 10',
    titulo: 'if (botão) acende o LED',
    enunciado: 'Escreva o Assembly simplificado. Use IN, CMP, JNE, LOAD e OUT. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `if (digitalRead(botao) == HIGH) {
  digitalWrite(led, HIGH);
}`,
    gabarito: `IN  R1, BOTAO
CMP R1, 1
JNE FIM
LOAD R2, 1
OUT LED, R2
FIM:`,
    usar: ['IN', 'CMP', 'JNE', 'LOAD', 'OUT'],
    casos: [{ BOTAO: 0 }, { BOTAO: 1 }],
    dica: 'O JNE pula para o rótulo FIM se a comparação der diferente.',
    perguntas: [
      { id: 'ula', texto: 'Qual instrução usa a ULA?', tipo: 'instrucoes', resposta: 'CMP', explicacao: 'CMP compara R1 com 1' },
      { id: 'pc', texto: 'Qual instrução altera o PC?', tipo: 'instrucoes', resposta: 'JNE', explicacao: 'JNE: se R1 ≠ 1, PC ← FIM' },
      { id: 'flags', texto: 'Qual instrução mexe nas Flags?', tipo: 'instrucoes', resposta: 'CMP', explicacao: 'CMP liga a flag Z se R1 = 1' },
    ],
  },
  {
    id: 'a15-for-soma',
    origem: 'Aula 15 · slide 14',
    titulo: 'Loop: soma de 1 a 4',
    enunciado: 'Escreva o Assembly simplificado. Use LOAD, ADD, CMP, JG, JMP e STORE. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `int soma = 0;
for (int i = 1; i <= 4; i++)
    soma = soma + i;`,
    gabarito: `; valores na memória
soma: 0
i: 1
; soma = 0; i = 1
LOAD R1, soma
LOAD R2, i
LOOP:  CMP R2, 4
       JG  FIM
       ADD R1, R2
       ADD R2, 1
       JMP LOOP
FIM:   STORE soma, R1`,
    usar: ['CMP', 'JG', 'JMP'],
    verificar: ['soma'],
    dica: 'O for vira um rótulo LOOP, um CMP + JG para sair e um JMP para voltar.',
    perguntas: [
      { id: 'voltas', texto: 'Quantas vezes o JMP volta ao início?', tipo: 'numero', resposta: '4', explicacao: '4 vezes' },
      { id: 'sai', texto: 'Qual instrução faz o loop terminar?', tipo: 'instrucoes', resposta: 'JG', explicacao: 'JG, quando i = 5' },
      { id: 'soma', texto: 'Quanto vale soma no final?', tipo: 'numero', resposta: '10', explicacao: 'soma = 10' },
    ],
  },
  {
    id: 'a15-for-leds',
    origem: 'Aula 15 · slide 16',
    titulo: 'Loop for com LEDs',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `int leds[] = {8, 9, 10};
for (int i = 0; i < 3; i++) {
  digitalWrite(leds[i], HIGH);
  delay(200);
  digitalWrite(leds[i], LOW);
}`,
    gabarito: `LEDS: 8, 9, 10 ; pinos dos LEDs
i: 0
LOAD R1, i
LOOP:
 CMP R1, 3 ; i chegou ao final?
 JE FIM ; se sim, sai do loop
 LOAD R2, LEDS[R1] ; R2 = nº do pino
 LOAD R3, 1 ; HIGH
 OUT R2, R3 ; acende o LED indicado por R2
 DELAY 200
 LOAD R3, 0 ; LOW
 OUT R2, R3 ; apaga o LED indicado por R2
 ADD R1, 1 ; i++
 JMP LOOP ; volta ao início
FIM:`,
    verificar: [],
    dica: 'LOAD R2, LEDS[R1] lê a posição R1 do vetor; OUT R2, R3 usa o pino cujo número está em R2.',
  },
];

// ─────────────────────────── conferência ───────────────────────────

export interface ItemConferencia { ok: boolean; texto: string; }

export interface Conferencia {
  /** Tudo certo (programa e perguntas). */
  ok: boolean;
  /** Erros de montagem/tradução da resposta do aluno (linha do código dele). */
  erros: { linha: number; msg: string }[];
  itens: ItemConferencia[];
  /** Resultado de cada pergunta (id → certa?). */
  perguntas: Record<string, boolean>;
}

/** O que importa no resultado de uma execução. */
interface Resultado {
  /** NOME EM MAIÚSCULAS → valor final. */
  vars: Map<string, string>;
  /** NOME EM MAIÚSCULAS → nome como foi escrito. */
  nomes: Map<string, string>;
  tela: string;
  /** Sequência de escritas nos pinos (ex.: "8 HIGH"). */
  pinos: string[];
  tempo: number;
  erro: string | null;
}

function resultado(ex: Execucao): Resultado {
  const prog = ex.programa;
  const fim = ex.passos[ex.passos.length - 1];
  const vars = new Map<string, string>();
  const nomes = new Map<string, string>();
  prog.variaveis.forEach(v => {
    if (v.nome.toUpperCase() === VARIAVEL_TEXTO) return;
    nomes.set(v.nome.toUpperCase(), v.nome);
    vars.set(v.nome.toUpperCase(), v.valores.map((_, k) => textoValor(fim.dados[v.end + k - prog.inicioDados])).join(', '));
  });
  const pinos: string[] = [];
  ex.passos.forEach(p => {
    if (p.fase === 'execucao' && p.porta?.tipo === 'saida' && p.porta.nome !== 'TELA') {
      const n = +p.porta.nome;
      pinos.push(`${n === PINO_LED ? 'LED' : 'pino ' + n} ${p.pinos[n] ? 'HIGH' : 'LOW'}`);
    }
  });
  return { vars, nomes, tela: fim.saida, pinos, tempo: fim.tempo, erro: ex.erro?.msg ?? null };
}

const sem = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** Confere uma pergunta. */
export function conferirPergunta(p: Pergunta, resposta: string): boolean {
  const r = resposta ?? '';
  switch (p.tipo) {
    case 'numero': {
      const m = r.replace(/−/g, '-').match(/-?\d+/);
      return !!m && parseInt(m[0], 10) === parseInt(p.resposta, 10);
    }
    case 'simnao': {
      const t = sem(r);
      const v = /^(s|sim|pula|yes)\b/.test(t) ? 'sim' : /^(n|nao|no)\b/.test(t) ? 'não' : '';
      return v === p.resposta;
    }
    case 'bits': return (r.match(/[01]/g) ?? []).join('') === p.resposta;
    case 'instrucoes': {
      const nomes = (r.toUpperCase().match(/[A-Z]+/g) ?? [])
        .map(w => buscarInstrucao(w)?.op)
        .filter((x): x is NonNullable<typeof x> => !!x);
      const certas = p.resposta.split(',').map(s => s.trim().toUpperCase());
      return new Set(nomes).size === certas.length && certas.every(c => nomes.includes(c as typeof nomes[number]));
    }
  }
}

/** Instruções usadas num programa em assembly (pelo nome principal). */
function instrucoesUsadas(codigo: string): Set<string> {
  const usadas = new Set<string>();
  codigo.split('\n').forEach(l => {
    const s = l.replace(/;.*/, '').replace(/^\s*[A-Za-z_]\w*\s*:/, '').trim();
    const w = s.match(/^[A-Za-z]+/)?.[0];
    const def = w ? buscarInstrucao(w) : undefined;
    if (def) usadas.add(def.op);
  });
  return usadas;
}

/** Confere a resposta do aluno (código e perguntas). */
export function conferirExercicio(ex: Exercicio, codigoAluno: string, respostas: Record<string, string>): Conferencia {
  const itens: ItemConferencia[] = [];
  const erros: { linha: number; msg: string }[] = [];
  const perguntas: Record<string, boolean> = {};
  (ex.perguntas ?? []).forEach(p => perguntas[p.id] = conferirPergunta(p, respostas[p.id] ?? ''));

  if (ex.tipo !== 'perguntas') {
    // assembly do aluno (no asm-para-c, o C dele traduzido) e assembly de referência
    let asmAluno = codigoAluno;
    let asmRef = ex.gabarito ?? '';
    if (ex.tipo === 'asm-para-c') {
      const t = traduzirParaAssembly(codigoAluno, { comentarios: false });
      erros.push(...t.erros);
      asmAluno = t.codigo;
      asmRef = ex.codigo;
    }
    if (!codigoAluno.trim()) erros.push({ linha: 0, msg: ex.tipo === 'asm-para-c' ? 'Escreva o código em C.' : 'Escreva o assembly.' });

    if (!erros.length) {
      const casos = ex.casos?.length ? ex.casos : [{}];
      for (const caso of casos) {
        const rodAluno = simular(asmAluno, caso);
        if (rodAluno.programa.erros.length) {
          erros.push(...(ex.tipo === 'asm-para-c'
            ? [{ linha: 0, msg: 'O C foi traduzido, mas o assembly gerado não montou.' }]
            : rodAluno.programa.erros));
          break;
        }
        const a = resultado(rodAluno);
        const r = resultado(simular(asmRef, caso));
        const pre = casos.length > 1 ? `Com ${Object.entries(caso).map(([k, v]) => `${k} = ${v}`).join(', ')}: ` : '';

        if (a.erro) { itens.push({ ok: false, texto: `${pre}a execução parou com erro — ${a.erro}` }); continue; }
        const nomes = ex.verificar ? ex.verificar.map(n => n.toUpperCase()) : [...r.vars.keys()];
        nomes.forEach(n => {
          const esperado = r.vars.get(n) ?? '';
          const nomeExib = ex.verificar?.find(v => v.toUpperCase() === n) ?? r.nomes.get(n) ?? n;
          if (!a.vars.has(n)) itens.push({ ok: false, texto: `${pre}a variável ${nomeExib} não foi declarada na memória` });
          else itens.push({ ok: a.vars.get(n) === esperado, texto: `${pre}${nomeExib} = ${a.vars.get(n)}${a.vars.get(n) === esperado ? '' : ` (esperado: ${esperado})`}` });
        });
        if (r.tela || a.tela) {
          const ok = r.tela === a.tela;
          itens.push({ ok, texto: `${pre}TELA: "${a.tela.trim() || '(nada)'}"${ok ? '' : ` (esperado: "${r.tela.trim() || '(nada)'}")`}` });
        }
        if (r.pinos.length || a.pinos.length) {
          const ok = r.pinos.join('|') === a.pinos.join('|');
          itens.push({ ok, texto: `${pre}portas: ${a.pinos.join(' → ') || '(nenhuma)'}${ok ? '' : ` (esperado: ${r.pinos.join(' → ') || '(nenhuma)'})`}` });
        }
        if (r.tempo || a.tempo) {
          itens.push({ ok: r.tempo === a.tempo, texto: `${pre}DELAY total: ${a.tempo} ms${r.tempo === a.tempo ? '' : ` (esperado: ${r.tempo} ms)`}` });
        }
      }
      if (ex.usar?.length && ex.tipo === 'c-para-asm' && !erros.length) {
        const usadas = instrucoesUsadas(codigoAluno);
        const faltam = ex.usar.filter(u => !usadas.has(u));
        itens.push({ ok: !faltam.length, texto: faltam.length ? `não usou ${faltam.join(', ')} (pedido no enunciado)` : `usou ${ex.usar.join(', ')}` });
      }
    }
  }

  const ok = !erros.length && itens.every(i => i.ok) && Object.values(perguntas).every(Boolean);
  return { ok, erros, itens, perguntas };
}

/** Código inicial do editor do aluno. */
export function codigoInicial(ex: Exercicio): string {
  if (ex.tipo === 'asm-para-c') return 'main(){\n   \n}\n';
  if (ex.tipo === 'perguntas') return '';
  return '; valores na memória\n\n; código\n';
}
