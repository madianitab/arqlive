/**
 * Programas em C/C++ do tradutor C → Assembly, tirados das Aulas 14 e 15 de ArqII
 * ("Do C++ ao Assembly"). Cada um tem a resposta correspondente no slide.
 */
export interface ExemploC {
  id: string;
  nome: string;
  codigo: string;
  /** Valores iniciais das portas de entrada (BOTAO, A0…). */
  entradas?: Record<string, number>;
}

export const EXEMPLOS_C: ExemploC[] = [
  {
    id: 'x-mais-2',
    nome: 'X = X + 2 (com printf)',
    codigo: `main(){
  int X = 5;
  X = X + 2;
  printf("X = %d", X);
}
`,
  },
  {
    id: 'y-igual-x',
    nome: 'Y = X',
    codigo: `main(){
  int X = 10, Y;
  Y = X;
}
`,
  },
  {
    id: 'x-mais-y',
    nome: 'X = X + Y; Y++',
    codigo: `main(){
  int X = 10, Y = 20;
  X = X + Y;
  Y++;
}
`,
  },
  {
    id: 'a-expressao',
    nome: 'A = A * 3 + 2 + 5',
    codigo: `main(){
  int A = 8;
  A = A * 3 + 2 + 5;
}
`,
  },
  {
    id: 'd-diferenca',
    nome: 'D = T - L; D = D * 2',
    codigo: `main(){
  int T = 30, L = 25;
  int D = T - L;
  D = D * 2;
}
`,
  },
  {
    id: 'a-vezes-b',
    nome: 'A = A * B; B = B + A',
    codigo: `main(){
  int A = 8, B = 3;
  A = A * B;
  B = B + A;
}
`,
  },
  {
    id: 'x-vezes-3',
    nome: 'X = X * 3 - 1',
    codigo: `int X = 4;
X = X * 3 - 1;
`,
  },
  {
    id: 'if-b-igual-2',
    nome: 'if (B == 2)',
    codigo: `int A = 4, B = 6;
B = B - A;
if (B == 2) { A = B; }
`,
  },
  {
    id: 'for-soma',
    nome: 'for: soma de 1 a 4',
    codigo: `int soma = 0;
for (int i = 1; i <= 4; i++)
    soma = soma + i;
`,
  },
  {
    id: 'pisca-led',
    nome: 'Arduino: digitalWrite (pisca o LED)',
    codigo: `digitalWrite(led, HIGH);
delay(1000);
digitalWrite(led, LOW);
delay(1000);
`,
  },
  {
    id: 'botao',
    nome: 'Arduino: digitalRead (botão)',
    entradas: { BOTAO: 1 },
    codigo: `int estado;
estado = digitalRead(botao);  // lê o botão: 0 ou 1
`,
  },
  {
    id: 'sensor',
    nome: 'Arduino: analogRead (sensor)',
    entradas: { A0: 512 },
    codigo: `int valor;
valor = analogRead(A0);  // lê o sensor no pino A0
`,
  },
  {
    id: 'if-botao',
    nome: 'Arduino: if (botão) acende o LED',
    entradas: { BOTAO: 1 },
    codigo: `if (digitalRead(botao) == HIGH) {
  digitalWrite(led, HIGH);
}
`,
  },
  {
    id: 'for-leds',
    nome: 'Arduino: for com LEDs',
    codigo: `int leds[] = {8, 9, 10};
for (int i = 0; i < 3; i++) {
  digitalWrite(leds[i], HIGH);
  delay(200);
  digitalWrite(leds[i], LOW);
}
`,
  },
];
