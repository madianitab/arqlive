/**
 * Programas fixos do módulo Ciclo de instrução: curtos, sem portas,
 * para o foco ficar na busca, decodificação e execução.
 */
export interface ExemploCiclo {
  id: string;
  nome: string;
  grupo: 'Sem laço' | 'Com desvio' | 'Com laço';
  codigo: string;
}

export const EXEMPLOS_CICLO: ExemploCiclo[] = [
  {
    id: 'x-mais-2',
    nome: 'X = X + 2',
    grupo: 'Sem laço',
    codigo: `; int X = 5;
; X = X + 2;

X: 5

LOAD R1, X      ; lê X da memória
ADD R1, 2       ; soma 2 na ULA
STORE X, R1     ; grava X na memória
HALT
`,
  },
  {
    id: 'c-igual-a-mais-b',
    nome: 'C = A + B',
    grupo: 'Sem laço',
    codigo: `; int A = 4, B = 3, C;
; C = A + B;

A: 4
B: 3
C: vazio

LOAD R1, A
LOAD R2, B
ADD R1, R2      ; R1 = A + B
STORE C, R1
HALT
`,
  },
  {
    id: 'maior',
    nome: 'Maior valor (if-else)',
    grupo: 'Com desvio',
    codigo: `; int A = 7, B = 9, M;
; if (A > B) M = A;
; else M = B;

A: 7
B: 9
M: vazio

LOAD R1, A
LOAD R2, B
CMP R1, R2      ; compara A com B
JLE SENAO       ; se A <= B, vai para o senão
STORE M, R1     ; M = A
JMP FIM
SENAO:
STORE M, R2     ; M = B
FIM:
HALT
`,
  },
  {
    id: 'soma-for',
    nome: 'Soma de 1 a 3 (for)',
    grupo: 'Com laço',
    codigo: `; int soma = 0;
; for (int i = 1; i <= 3; i++)
;     soma = soma + i;

soma: 0
i: 1

LOAD R1, soma
LOAD R2, i
LOOP:
CMP R2, 3       ; i <= 3?
JG FIM          ; se i > 3, sai do laço
ADD R1, R2      ; soma = soma + i
ADD R2, 1       ; i++
JMP LOOP        ; volta para o teste
FIM:
STORE soma, R1
HALT
`,
  },
  {
    id: 'dobro-while',
    nome: 'Dobra até passar de 10 (while)',
    grupo: 'Com laço',
    codigo: `; int V = 1;
; while (V < 10)
;     V = V * 2;

V: 1

LOAD R1, V
LOOP:
CMP R1, 10      ; V < 10?
JGE FIM         ; se V >= 10, sai do laço
MUL R1, 2       ; V = V * 2
JMP LOOP        ; volta para o teste
FIM:
STORE V, R1
HALT
`,
  },
];

export const GRUPOS_CICLO: ExemploCiclo['grupo'][] = ['Sem laço', 'Com desvio', 'Com laço'];
