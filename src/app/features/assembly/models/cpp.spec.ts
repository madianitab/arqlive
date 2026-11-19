import { montar } from './assembly';
import { traduzirCpp } from './cpp';
import { EXEMPLOS_ASSEMBLY } from './exemplos';

const cpp = (codigo: string) => traduzirCpp(montar(codigo));
const ex = (id: string) => cpp(EXEMPLOS_ASSEMBLY.find(e => e.id === id)!.codigo);
/** Linhas do corpo, sem espaços nas pontas. */
const linhas = (c: string) => c.split('\n').map(l => l.trim()).filter(Boolean);

describe('C++ legível (sem registradores)', () => {
  it('X = X + 2 com printf', () => {
    const r = ex('x-mais-2');
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toEqual(['#include <stdio.h>', 'int main() {', 'int X = 5;', 'X = X + 2;', 'printf("X = %d", X);', '}']);
  });

  it('respostas dos desafios', () => {
    expect(linhas(ex('y-igual-x').codigo)).toContain('Y = X;');
    expect(linhas(ex('x-mais-y').codigo)).toEqual(jasmine.arrayContaining(['X = X + Y;', 'Y++;']));
    expect(linhas(ex('a-vezes-b').codigo)).toEqual(jasmine.arrayContaining(['int A = 8, B = 3;', 'A = A * B;', 'B = B + A;']));
    expect(linhas(ex('a-expressao').codigo)).toContain('A = A * 3 + 2 + 5;');
    expect(linhas(ex('d-diferenca').codigo)).toContain('D = (T - L) * 2;');
  });

  it('registrador que não volta para a memória vira a própria expressão', () => {
    const r = cpp('X: 5\nD\nLOAD R1, X\nADD R1, 2\nSTORE D, R1\nOUT TELA, R1\nHALT');
    expect(linhas(r.codigo)).toEqual(['#include <stdio.h>', 'int main() {', 'int X = 5, D;', 'D = X + 2;', 'printf("%d", D);', '}']);
  });

  it('Arduino: digitalWrite/delay, digitalRead e analogRead', () => {
    expect(linhas(ex('pisca-led').codigo)).toEqual(jasmine.arrayContaining(['digitalWrite(led, HIGH);', 'delay(1000);', 'digitalWrite(led, LOW);']));
    expect(linhas(ex('botao').codigo)).toContain('ESTADO = digitalRead(botao);');
    expect(linhas(ex('sensor').codigo)).toContain('VALOR = analogRead(A0);');
  });

  it('if do botão', () => {
    const l = linhas(ex('if-botao').codigo);
    expect(l).toEqual(jasmine.arrayContaining(['if (digitalRead(botao) == HIGH) {', 'digitalWrite(led, HIGH);']));
  });

  it('for com LEDs', () => {
    const l = linhas(ex('for-leds').codigo);
    expect(l).toEqual(jasmine.arrayContaining([
      'int LEDS[] = {8, 9, 10};', 'for (int i = 0; i < 3; i++) {',
      'digitalWrite(LEDS[i], HIGH);', 'delay(200);', 'digitalWrite(LEDS[i], LOW);',
    ]));
  });

  it('if-else', () => {
    const r = cpp('X: 7\nLOAD R1, X\nCMP R1, 5\nJLE MENOR\nLOAD R2, 1\nOUT TELA, R2\nJMP FIM\nMENOR: LOAD R2, 0\nOUT TELA, R2\nFIM: HALT');
    expect(linhas(r.codigo)).toEqual(jasmine.arrayContaining(['if (X > 5) {', '} else {']));
  });

  it('desvio fora dos padrões usa a tradução direta', () => {
    const r = cpp('L: LOAD R1, 1\nOUT TELA, R1\nJMP L');
    expect(r.nivel).toBe('direto');
    expect(r.codigo).toContain('goto L;');
  });

  it('zero implícito do registrador não aparece na soma (observação da monitoria)', () => {
    const r = cpp('X: 0\nADD R1, 12\nADD R1, 8\nMUL R1, 7\nSTORE X, R1\nOUT TELA, R1\nHALT');
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toContain('X = (12 + 8) * 7;');
    // LOAD R1, 0 explícito continua aparecendo
    expect(linhas(cpp('X: 0\nLOAD R1, 0\nADD R1, 12\nSTORE X, R1').codigo)).toContain('X = 0 + 12;');
  });

  it('registrador que acumula valor no laço vira variável local (observação da monitoria)', () => {
    const r = cpp(`X: 0
LOAD R1, 0
LOAD R2, 1
LOOP:
  CMP R1, 3
  JE FIM
  MUL R2, 2
  ADD R1, 1
  JMP LOOP
FIM:
STORE X, R2
OUT TELA, R2
HALT`);
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toEqual(['#include <stdio.h>', 'int main() {', 'int X = 0;', 'int valor = 1;',
      'for (int i = 0; i < 3; i++) {', 'valor = valor * 2;', '}', 'X = valor;', 'printf("%d", X);', '}']);
  });

  it('acumulador com zero implícito e soma condicional dentro do laço', () => {
    const r = cpp(`V: 3, 8, 5
LOAD R1, 0
LOOP:
  CMP R1, 3
  JE FIM
  LOAD R3, V[R1]
  CMP R3, 4
  JL PULA
  ADD R2, 1
PULA:
  ADD R1, 1
  JMP LOOP
FIM:
OUT TELA, R2`);
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toEqual(jasmine.arrayContaining(['int valor = 0;', 'for (int i = 0; i < 3; i++) {',
      'if (V[i] >= 4) {', 'valor++;', 'printf("%d", valor);']));
  });

  it('while com o registrador da condição mudando no corpo', () => {
    const r = cpp(`LOAD R1, 5
LOOP:
  CMP R1, 0
  JE FIM
  OUT TELA, R1
  SUB R1, 1
  JMP LOOP
FIM:
HALT`);
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toEqual(jasmine.arrayContaining(['int valor = 5;', 'while (valor != 0) {', 'printf("%d", valor);', 'valor--;']));
  });

  it('tradução direta: registradores contadores de laço viram i, j…', () => {
    // dois laços com R3 (o segundo não reinicia R3) → estrutura não reconhecida
    const r = cpp(`X: 0
LOAD R1, 0
LOAD R2, 1
LOAD R4, 1
LOOP:
  CMP R1, 3
  JE FIM
  MUL R2, 2
  ADD R1, 1
  JMP LOOP
FIM:
LOOP1:
  CMP R3, 2
  JE FIM1
  MUL R4, 3
  ADD R3, 1
  JMP LOOP1
FIM1:
LOOP2:
  CMP R3, 2
  JE FIM2
  MUL R4, 3
  ADD R3, 1
  JMP LOOP2
FIM2:
ADD R2, R4
STORE X, R2
OUT TELA, R2
HALT`);
    expect(r.nivel).toBe('direto');
    const l = linhas(r.codigo);
    expect(l).toContain('int R2 = 0, R4 = 0;   // registradores');
    expect(l).toContain('int i = 0, j = 0;   // contadores dos laços (R1, R3)');
    expect(l.some(x => x.startsWith('i = 0;') && x.endsWith('// LOAD R1, 0'))).toBeTrue();
    expect(l.some(x => x.startsWith('if (i == 3) goto FIM;'))).toBeTrue();
    expect(l.some(x => x.startsWith('i = i + 1;') && x.endsWith('// ADD R1, 1'))).toBeTrue();
    expect(l.some(x => x.startsWith('if (j == 2) goto FIM2;'))).toBeTrue();
    expect(l.some(x => x.startsWith('R4 = R4 * 3;'))).toBeTrue();
    // R1 e R3 só aparecem nos comentários
    expect(l.map(x => x.split('//')[0]).some(x => /\bR[13]\b/.test(x))).toBeFalse();
  });

  it('tradução direta: contador com teste no fim, índice de vetor e nome já usado', () => {
    const r = cpp(`V: 1, 2, 3
i: 0
INICIO:
  LOAD R2, V[R1]
  OUT TELA, R2
  ADD R1, 1
  CMP R1, 3
  JL INICIO
L: OUT TELA, R1
JMP L`);
    expect(r.nivel).toBe('direto');
    const l = linhas(r.codigo);
    expect(l).toContain('int j = 0;   // contadores dos laços (R1)');
    expect(l.some(x => x.startsWith('R2 = V[j];'))).toBeTrue();
    expect(l.some(x => x.startsWith('if (j < 3) goto INICIO;'))).toBeTrue();
  });

  it('for legível não usa nome de variável já existente', () => {
    const r = cpp(`i: 5
LOAD R1, 0
LOOP:
  CMP R1, 2
  JE FIM
  OUT TELA, R1
  ADD R1, 1
  JMP LOOP
FIM:
HALT`);
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toContain('for (int j = 0; j < 2; j++) {');
  });

  it('todos os exemplos saem legíveis', () => {
    EXEMPLOS_ASSEMBLY.forEach(e => expect(cpp(e.codigo).nivel).withContext(e.id).toBe('alto'));
  });
});
