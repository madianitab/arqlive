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

  it('todos os exemplos saem no estilo das aulas', () => {
    EXEMPLOS_ASSEMBLY.forEach(e => expect(cpp(e.codigo).nivel).withContext(e.id).toBe('alto'));
  });
});
