/** Programas de exemplo do simulador de assembly. */
export interface ExemploAssembly { id: string; nome: string; codigo: string; entrada?: string; }

export const EXEMPLOS_ASSEMBLY: ExemploAssembly[] = [
  {
    id: 'soma',
    nome: 'Soma de duas variáveis',
    codigo: `; Soma X + Y e guarda em R
.DADOS
    X = 5
    Y = 7
    R = 0

.CODIGO
    MOV A, X        ; A recebe X
    ADD A, Y        ; A = A + Y
    MOV R, A        ; guarda o resultado em R
    ESCREVER R
    HLT
`,
  },
  {
    id: 'maior',
    nome: 'Maior de dois números (LER)',
    entrada: '8 3',
    codigo: `; Lê dois números e mostra o maior
.CODIGO
    LER A
    LER B
    CMP A, B
    JGE a_maior     ; se A >= B, desvia
    ESCREVER "O maior é B:"
    ESCREVER B
    HLT
a_maior:
    ESCREVER "O maior é A:"
    ESCREVER A
    HLT
`,
  },
  {
    id: 'contar',
    nome: 'Contar de 1 a 5 (laço)',
    codigo: `; Mostra os números de 1 a 5
.CODIGO
    MOV A, 1
laco:
    CMP A, 5
    JG fim          ; se A > 5, sai do laço
    ESCREVER A
    INC A
    JMP laco
fim:
    HLT
`,
  },
  {
    id: 'vetor',
    nome: 'Soma dos elementos de um vetor',
    codigo: `; Soma os 4 elementos do vetor V
.DADOS
    V = 3, 8, 1, 6
    SOMA = 0

.CODIGO
    MOV B, 0        ; B é o índice
    MOV A, 0        ; A acumula a soma
laco:
    CMP B, 4
    JE fim
    ADD A, V[B]     ; A = A + V[B]
    INC B
    JMP laco
fim:
    MOV SOMA, A
    ESCREVER SOMA
    HLT
`,
  },
  {
    id: 'fatorial',
    nome: 'Fatorial (LER)',
    entrada: '5',
    codigo: `; Calcula N! (fatorial)
.DADOS
    N = 0
    FAT = 1

.CODIGO
    LER N
    MOV A, N
laco:
    CMP A, 1
    JLE fim
    MUL FAT, A      ; FAT = FAT * A
    DEC A
    JMP laco
fim:
    ESCREVER FAT
    HLT
`,
  },
  {
    id: 'par',
    nome: 'Par ou ímpar (LER)',
    entrada: '7',
    codigo: `; Diz se o número lido é par ou ímpar
.CODIGO
    LER A
    MOV B, A
    MOD B, 2        ; B = resto de A / 2
    CMP B, 0
    JE par
    ESCREVER "ímpar"
    HLT
par:
    ESCREVER "par"
    HLT
`,
  },
];
