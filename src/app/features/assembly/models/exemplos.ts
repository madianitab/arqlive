/**
 * Programas de exemplo do simulador, tirados da Aula 14 de ArqII ("Do C++ ao Assembly").
 * Acréscimos em relação ao slide estão comentados no próprio código.
 */
export interface ExemploAssembly {
  id: string;
  nome: string;
  codigo: string;
  /** Valores iniciais das portas de entrada (BOTAO, A0…). */
  entradas?: Record<string, number>;
}

export const EXEMPLOS_ASSEMBLY: ExemploAssembly[] = [
  {
    id: 'x-mais-2',
    nome: 'X = X + 2 (com printf)',
    codigo: `; main(){ int X = 5; X = X + 2; printf("X = %d", X); }

; memória
X: 5
TEXTO: "X = "      ; texto do printf (usado pelo CALL imprime)

; x = x + 2
LOAD R1, X         ; lê da memória (R1 = X)
ADD R1, 2          ; soma 2 (R1 = R1 + 2)
STORE X, R1        ; grava na memória (X = R1)

; impressão
CALL imprime       ; exibe o texto "X = "
LOAD R1, X         ; lê X da memória de novo
OUT TELA, R1       ; exibe o conteúdo do R1
HALT               ; encerra o programa
`,
  },
  {
    id: 'y-igual-x',
    nome: 'Y = X',
    codigo: `; main(){ int X = 10, Y; Y = X; }

; valores na memória
X: 10
Y: vazio

; y = x
LOAD R1, X
MOV R2, R1
STORE Y, R2
`,
  },
  {
    id: 'x-mais-y',
    nome: 'X = X + Y; Y++',
    codigo: `; main(){ int X = 10, Y = 20; X = X + Y; Y++; }

; valores na memória
X: 10 e Y: 20

; x = x + y
LOAD R1, X
LOAD R2, Y
ADD R1, R2
STORE X, R1

; y++
ADD R2, 1
STORE Y, R2
`,
  },
  {
    id: 'a-vezes-b',
    nome: 'A = A * B; B = B + A',
    codigo: `; ===== valores na memória =====
A: 8
B: 3

; ===== código assembler =====
LOAD R1, A
LOAD R2, B
MUL R1, R2   ; multiplicar
ADD R2, R1
STORE A, R1
STORE B, R2
`,
  },
  {
    id: 'a-expressao',
    nome: 'A = A * 3 + 2 + 5',
    codigo: `; main(){ int A = 8; A = A * 3 + 2 + 5; }

; valores na memória
A: 8

; A = A * 3 + 2 + 5
LOAD R1, A
MUL R1, 3
ADD R1, 2
ADD R1, 5
STORE A, R1
`,
  },
  {
    id: 'd-diferenca',
    nome: 'D = (T - L) * 2',
    codigo: `; main(){ int T = 30, L = 25; int D = T - L; D = D * 2; }

; valores na memória
T: 30
L: 25
D: vazio      ; D também precisa existir na memória

; D = (T - L) * 2
LOAD R1, T
LOAD R2, L
SUB R1, R2
MUL R1, 2
STORE D, R1
`,
  },
  {
    id: 'pisca-led',
    nome: 'Arduino: digitalWrite (pisca o LED)',
    codigo: `; digitalWrite(led, HIGH); delay(1000);
; digitalWrite(led, LOW);  delay(1000);

LOAD R1, 1      ; carrega o valor 1 em R1
OUT LED, R1     ; envia 1 ao pino do LED
DELAY 1000      ; pausa por 1000 ms
LOAD R1, 0      ; carrega o valor 0 em R1
OUT LED, R1     ; envia 0 ao pino do LED
DELAY 1000      ; pausa por 1000 ms
`,
  },
  {
    id: 'botao',
    nome: 'Arduino: digitalRead (botão)',
    entradas: { BOTAO: 1 },
    codigo: `; estado = digitalRead(botao);

ESTADO: vazio

IN R1, BOTAO        ; R1 = 0 ou 1
STORE ESTADO, R1    ; grava na memória
`,
  },
  {
    id: 'sensor',
    nome: 'Arduino: analogRead (sensor)',
    entradas: { A0: 512 },
    codigo: `; valor = analogRead(A0);

VALOR: vazio

IN R1, A0           ; ADC: 0–5 V → 0 a 1023
STORE VALOR, R1     ; grava na memória
`,
  },
  {
    id: 'if-botao',
    nome: 'Arduino: if (botão) acende o LED',
    entradas: { BOTAO: 1 },
    codigo: `; if (digitalRead(botao) == HIGH) {
;   digitalWrite(led, HIGH);
; }

IN R1, BOTAO  ; lê o botão (0 ou 1)
CMP R1, 1     ; é HIGH?
JNE FIM       ; se não for, pula
LOAD R2, 1    ; R2 = HIGH
OUT LED, R2   ; acende o LED
FIM:          ; segue o programa
`,
  },
  {
    id: 'for-leds',
    nome: 'Arduino: for com LEDs',
    codigo: `; for (int i = 0; i < quantidade; i++) {
;   digitalWrite(leds[i], HIGH);
;   delay(200);
;   digitalWrite(leds[i], LOW);
; }

LED: 8, 9, 10      ; leds[] = {8, 9, 10} na memória

LOAD R1, 0         ; i = 0
LOOP:
 CMP R1, 3         ; i chegou ao final?
 JE FIM            ; se sim, sai do loop
 LOAD R2, LED[R1]  ; R2 = nº do pino
 LOAD R3, 1        ; HIGH
 OUT R2, R3        ; acende o LED indicado por R2
 DELAY 200
 LOAD R3, 0        ; LOW
 OUT R2, R3        ; apaga o LED indicado por R2
 ADD R1, 1         ; i++
 JMP LOOP          ; volta ao início
FIM:
`,
  },
];
