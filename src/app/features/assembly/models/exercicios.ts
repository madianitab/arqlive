/**
 * Exercícios de Assembly simplificado e a conferência das respostas (lógica pura, sem Angular).
 *
 * Tipos de exercício:
 * - c-para-asm: o aluno escreve o Assembly simplificado de um código em C;
 * - asm-para-c: o aluno escreve o C de um programa em assembly;
 * - perguntas: só perguntas sobre um trecho dado (ex.: prever as flags de um CMP).
 *
 * A conferência não compara o texto: executa a resposta do aluno e a de referência e compara o
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
  /** Assunto (agrupa os exercícios na lista). */
  tema: Tema;
  titulo: string;
  enunciado: string;
  tipo: TipoExercicio;
  /** Código dado: C (c-para-asm) ou assembly (asm-para-c e perguntas). */
  codigo: string;
  /** Resposta de referência: assembly (c-para-asm) ou C (asm-para-c). */
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

/** Assuntos, na ordem da lista. */
export const TEMAS = ['Memória e contas', 'Desvios e flags', 'Laços', 'Arduino', 'Assembly → C'] as const;
export type Tema = typeof TEMAS[number];

const LISTA: Exercicio[] = [
  {
    id: 'y-igual-x',
    tema: 'Memória e contas',
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
    id: 'x-mais-y',
    tema: 'Memória e contas',
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
    id: 'a-expressao',
    tema: 'Memória e contas',
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
    id: 'd-diferenca',
    tema: 'Memória e contas',
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
    id: 'asm-para-c',
    tema: 'Assembly → C',
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
    id: 'troca',
    tema: 'Memória e contas',
    titulo: 'Troca: C = A; A = B; B = C',
    enunciado: 'Escreva o Assembly simplificado. No final, A e B devem estar trocados.',
    tipo: 'c-para-asm',
    codigo: `main(){
   int A = 3, B = 7, C;
   C = A;
   A = B;
   B = C;
}`,
    gabarito: `; valores na memória
A: 3
B: 7
C: vazio
; C = A
LOAD R1, A
STORE C, R1
; A = B
LOAD R2, B
STORE A, R2
; B = C
STORE B, R1`,
    dica: 'O valor de A continua em R1 depois do primeiro STORE: dá para usá-lo no B = C.',
  },
  {
    id: 'expressao-parenteses',
    tema: 'Memória e contas',
    titulo: 'M = (A + B) * 2 - C',
    enunciado: 'Escreva o Assembly simplificado.',
    tipo: 'c-para-asm',
    codigo: `main(){
   int A = 5, B = 3, C = 4, M;
   M = (A + B) * 2 - C;
}`,
    gabarito: `; valores na memória
A: 5
B: 3
C: 4
M: vazio
; M = (A + B) * 2 - C
LOAD R1, A
LOAD R2, B
ADD R1, R2
MUL R1, 2
LOAD R3, C
SUB R1, R3
STORE M, R1`,
    dica: 'Comece pelos parênteses: some A e B num registrador e continue as contas nele.',
  },
  {
    id: 'printf',
    tema: 'Memória e contas',
    titulo: 'X = X * X com printf',
    enunciado: 'Escreva o Assembly simplificado, com a impressão (como no exemplo X = X + 2).',
    tipo: 'c-para-asm',
    codigo: `main(){
   int X = 3;
   X = X * X;
   printf("X = %d", X);
}`,
    gabarito: `; valores na memória
X: 3
TEXTO: "X = "
; X = X * X
LOAD R1, X
MUL R1, R1
STORE X, R1
; impressão
CALL imprime
LOAD R1, X
OUT TELA, R1
HALT`,
    usar: ['CALL', 'OUT'],
    dica: 'O texto do printf vai para a variável TEXTO e é exibido com CALL imprime; o valor sai com OUT TELA, R1.',
  },
  {
    id: 'asm-para-c-2',
    tema: 'Assembly → C',
    titulo: 'Qual seria o código em C? (2)',
    enunciado: 'Escreva o código em C que corresponde a este assembly.',
    tipo: 'asm-para-c',
    codigo: `; valores na memória
P: 2
Q: 9

; código
LOAD R1, Q
LOAD R2, P
SUB R1, R2
MUL R1, 2
STORE Q, R1`,
    gabarito: `main(){
   int P = 2, Q = 9;
   Q = (Q - P) * 2;
}`,
    dica: 'Acompanhe o R1: começa com Q, perde o P (que está em R2) e depois é multiplicado por 2. Atenção à ordem das contas.',
  },
  {
    id: 'x-vezes-3',
    tema: 'Memória e contas',
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
    id: 'if-b-igual-2',
    tema: 'Desvios e flags',
    titulo: 'if (B == 2)',
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
    id: 'cmp-flags',
    tema: 'Desvios e flags',
    titulo: 'CMP com R1 menor',
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
    id: 'digitalwrite',
    tema: 'Arduino',
    titulo: 'digitalWrite (pisca o LED)',
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
    id: 'digitalread',
    tema: 'Arduino',
    titulo: 'digitalRead (botão)',
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
    id: 'analogread',
    tema: 'Arduino',
    titulo: 'analogRead (sensor)',
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
    id: 'if-botao',
    tema: 'Arduino',
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
    id: 'for-soma',
    tema: 'Laços',
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
    id: 'for-leds',
    tema: 'Arduino',
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
  {
    id: 'cmp-iguais',
    tema: 'Desvios e flags',
    titulo: 'CMP com valores iguais',
    enunciado: 'Preveja as flags e o salto (R1 = 7 e R2 = 7).',
    tipo: 'perguntas',
    codigo: `; R1 = 7 e R2 = 7
CMP R1, R2
JNE DIFERENTE`,
    dica: 'Releia a tabela do CMP: o que acontece com as flags quando R1 = R2?',
    perguntas: [
      { id: 'conta', texto: 'Quanto vale R1 − R2?', tipo: 'numero', resposta: '0', explicacao: '7 − 7 = 0 (não é guardado)' },
      { id: 'flags', texto: 'Quais os valores de Z, N e C? (ex.: 0, 1, 0)', tipo: 'bits', resposta: '100', explicacao: 'Z = 1, N = 0, C = 0' },
      { id: 'salto', texto: 'O JNE pula para DIFERENTE?', tipo: 'simnao', resposta: 'não', explicacao: 'Não: o JNE só pula quando Z = 0' },
    ],
  },
  {
    id: 'cmp-maior',
    tema: 'Desvios e flags',
    titulo: 'CMP com R1 maior',
    enunciado: 'Preveja as flags e o salto (R1 = 9 e R2 = 4).',
    tipo: 'perguntas',
    codigo: `; R1 = 9 e R2 = 4
CMP R1, R2
JG  MAIOR`,
    dica: 'O JG pula quando Z = 0 e N = 0.',
    perguntas: [
      { id: 'conta', texto: 'Quanto vale R1 − R2?', tipo: 'numero', resposta: '5', explicacao: '9 − 4 = 5 (não é guardado)' },
      { id: 'flags', texto: 'Quais os valores de Z, N e C? (ex.: 0, 1, 0)', tipo: 'bits', resposta: '000', explicacao: 'Z = 0, N = 0, C = 0' },
      { id: 'salto', texto: 'O JG pula para MAIOR?', tipo: 'simnao', resposta: 'sim', explicacao: 'Sim: Z = 0 e N = 0, então R1 > R2' },
    ],
  },
  {
    id: 'if-else',
    tema: 'Desvios e flags',
    titulo: 'if-else',
    enunciado: 'Escreva o Assembly simplificado. Use CMP, JNE e JMP. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `int N = 7, R;
if (N == 7) {
   R = 1;
} else {
   R = 0;
}`,
    gabarito: `; valores na memória
N: 7
R: vazio
; if (N == 7)
LOAD R1, N
CMP R1, 7
JNE SENAO
LOAD R2, 1
STORE R, R2
JMP FIM
SENAO:
LOAD R2, 0
STORE R, R2
FIM:`,
    usar: ['CMP', 'JNE', 'JMP'],
    dica: 'O JNE leva para o bloco do else; no fim do bloco do if, um JMP pula o else.',
    perguntas: [
      { id: 'pula', texto: 'Qual instrução faz o programa pular o bloco do else?', tipo: 'instrucoes', resposta: 'JMP', explicacao: 'JMP FIM, no fim do bloco do if' },
      { id: 'r', texto: 'Quanto vale R no final?', tipo: 'numero', resposta: '1', explicacao: 'R = 1 (N vale 7)' },
    ],
  },
  {
    id: 'while-contagem',
    tema: 'Laços',
    titulo: 'while: contagem regressiva',
    enunciado: 'Escreva o Assembly simplificado. Use CMP, JE e JMP. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `int c = 3;
while (c != 0) {
   printf("%d\n", c);
   c--;
}`,
    gabarito: `; valores na memória
c: 3
LOAD R1, c
LOOP:  CMP R1, 0
       JE  FIM
       OUT TELA, R1
       SUB R1, 1
       JMP LOOP
FIM:   STORE c, R1`,
    usar: ['CMP', 'JE', 'JMP'],
    dica: 'O while testa antes de cada volta: o salto sai quando c == 0 (o contrário de c != 0).',
    perguntas: [
      { id: 'telas', texto: 'Quantas vezes o OUT TELA é executado?', tipo: 'numero', resposta: '3', explicacao: '3 vezes (3, 2 e 1)' },
      { id: 'c', texto: 'Quanto vale c no final?', tipo: 'numero', resposta: '0', explicacao: 'c = 0' },
    ],
  },
  {
    id: 'for-vetor',
    tema: 'Laços',
    titulo: 'for: soma de um vetor',
    enunciado: 'Escreva o Assembly simplificado. Use o vetor com LOAD R, V[R1]. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `int V[] = {4, 6, 5};
int total = 0;
for (int i = 0; i < 3; i++)
    total = total + V[i];`,
    gabarito: `; valores na memória
V: 4, 6, 5
total: 0
i: 0
LOAD R1, total
LOAD R2, i
LOOP:  CMP R2, 3
       JGE FIM
       LOAD R3, V[R2]
       ADD R1, R3
       ADD R2, 1
       JMP LOOP
FIM:   STORE total, R1`,
    usar: ['CMP', 'JMP'],
    verificar: ['total'],
    dica: 'LOAD R3, V[R2] lê a posição R2 do vetor (endereço de V + R2).',
    perguntas: [
      { id: 'voltas', texto: 'Quantas vezes o JMP volta ao início?', tipo: 'numero', resposta: '3', explicacao: '3 vezes' },
      { id: 'total', texto: 'Quanto vale total no final?', tipo: 'numero', resposta: '15', explicacao: 'total = 4 + 6 + 5 = 15' },
    ],
  },
  {
    id: 'asm-para-c-laco',
    tema: 'Assembly → C',
    titulo: 'Qual seria o código em C? (laço)',
    enunciado: 'Escreva o código em C (com for) que corresponde a este assembly.',
    tipo: 'asm-para-c',
    codigo: `; valores na memória
X: 1
i: 0

; código
LOAD R1, X
LOAD R2, i
LOOP:  CMP R2, 3
       JE  FIM
       MUL R1, 2
       ADD R2, 1
       JMP LOOP
FIM:   STORE X, R1`,
    gabarito: `int X = 1;
for (int i = 0; i < 3; i++)
    X = X * 2;`,
    verificar: ['X'],
    dica: 'R2 é o contador (i) e R1 guarda X. Quantas voltas o laço dá e o que acontece com X em cada uma?',
  },
  {
    id: 'botao-if-else',
    tema: 'Arduino',
    titulo: 'Botão: acende ou apaga o LED',
    enunciado: 'Escreva o Assembly simplificado. Use IN, CMP, JNE, JMP e OUT.',
    tipo: 'c-para-asm',
    codigo: `if (digitalRead(botao) == HIGH) {
  digitalWrite(led, HIGH);
} else {
  digitalWrite(led, LOW);
}`,
    gabarito: `IN  R1, BOTAO
CMP R1, 1
JNE APAGA
LOAD R2, 1
OUT LED, R2
JMP FIM
APAGA:
LOAD R2, 0
OUT LED, R2
FIM:`,
    usar: ['IN', 'CMP', 'JNE', 'JMP', 'OUT'],
    casos: [{ BOTAO: 0 }, { BOTAO: 1 }],
    dica: 'É um if-else: o JNE leva para o bloco que apaga o LED, e um JMP pula esse bloco quando o LED acende.',
  },
  {
    id: 'sensor',
    tema: 'Arduino',
    titulo: 'Sensor: acende o LED acima de 500',
    enunciado: 'Escreva o Assembly simplificado. Use IN, CMP, JG, JMP e OUT. Depois, responda.',
    tipo: 'c-para-asm',
    codigo: `valor = analogRead(A0);
if (valor > 500) {
  digitalWrite(led, HIGH);
}`,
    gabarito: `IN  R1, A0
CMP R1, 500
JG  ACENDE
JMP FIM
ACENDE:
LOAD R2, 1
OUT LED, R2
FIM:`,
    usar: ['IN', 'CMP', 'OUT'],
    casos: [{ A0: 300 }, { A0: 500 }, { A0: 800 }],
    dica: 'Com JG e JMP: o JG vai para o bloco que acende o LED; se não pular, o JMP leva para o fim.',
    perguntas: [
      { id: 'pc', texto: 'Quais instruções podem alterar o PC?', tipo: 'instrucoes', resposta: 'JG, JMP', explicacao: 'JG (se valor > 500) e JMP' },
      { id: 'acende', texto: 'Com o sensor em 500, o LED acende?', tipo: 'simnao', resposta: 'não', explicacao: 'Não: 500 não é maior que 500' },
    ],
  },
];

/** Exercícios agrupados por assunto. */
export const EXERCICIOS: Exercicio[] = TEMAS.flatMap(t => LISTA.filter(e => e.tema === t));

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
        const rodRef = simular(asmRef, caso);
        if (rodRef.programa.erros.length || !rodRef.passos.length) {
          itens.push({ ok: false, texto: 'a resposta de referência deste exercício tem um erro (avise a professora)' });
          break;
        }
        const a = resultado(rodAluno);
        const r = resultado(rodRef);
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
