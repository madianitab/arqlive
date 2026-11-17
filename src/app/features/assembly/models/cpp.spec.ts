import { montar } from './assembly';
import { traduzirCpp } from './cpp';
import { EXEMPLOS_ASSEMBLY } from './exemplos';

const cpp = (codigo: string) => traduzirCpp(montar(codigo));
const ex = (id: string) => cpp(EXEMPLOS_ASSEMBLY.find(e => e.id === id)!.codigo);
/** Linhas do corpo, sem espaços nas pontas. */
const linhas = (c: string) => c.split('\n').map(l => l.trim()).filter(Boolean);

describe('C++ no estilo das aulas (sem registradores)', () => {
  it('X = X + 2 com printf (slide 14)', () => {
    const r = ex('x-mais-2');
    expect(r.nivel).toBe('alto');
    expect(linhas(r.codigo)).toEqual(['#include <stdio.h>', 'int main() {', 'int X = 5;', 'X = X + 2;', 'printf("X = %d", X);', '}']);
  });

  it('respostas dos desafios do slide', () => {
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

  it('if do botão (slide 6)', () => {
    const l = linhas(ex('if-botao').codigo);
    expect(l).toEqual(jasmine.arrayContaining(['if (digitalRead(botao) == HIGH) {', 'digitalWrite(led, HIGH);']));
  });

  it('for com LEDs (slide 7)', () => {
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

  it('todos os exemplos saem no estilo das aulas', () => {
    EXEMPLOS_ASSEMBLY.forEach(e => expect(cpp(e.codigo).nivel).withContext(e.id).toBe('alto'));
  });
});
