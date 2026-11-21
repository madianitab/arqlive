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
    expect(r.aviso).toBeUndefined();
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

  it('laço infinito vira while (true) no PC', () => {
    const r = cpp('L: LOAD R1, 1\nOUT TELA, R1\nJMP L');
    expect(r.aviso).toBeUndefined();
    expect(linhas(r.codigo)).toEqual(jasmine.arrayContaining(['while (true) {', 'printf("%d", 1);']));
  });

  it('zero implícito do registrador não aparece na soma (observação da monitoria)', () => {
    const r = cpp('X: 0\nADD R1, 12\nADD R1, 8\nMUL R1, 7\nSTORE X, R1\nOUT TELA, R1\nHALT');
    expect(r.aviso).toBeUndefined();
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
    expect(r.aviso).toBeUndefined();
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
    expect(r.aviso).toBeUndefined();
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
    expect(r.aviso).toBeUndefined();
    expect(linhas(r.codigo)).toEqual(jasmine.arrayContaining(['int i = 5;', 'while (i != 0) {', 'printf("%d", i);', 'i--;']));
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
    expect(r.aviso).toBeUndefined();
    expect(linhas(r.codigo)).toContain('for (int j = 0; j < 2; j++) {');
  });

  it('todos os exemplos saem legíveis', () => {
    EXEMPLOS_ASSEMBLY.forEach(e => expect(cpp(e.codigo).aviso).withContext(e.id).toBeUndefined());
  });
});

describe('C++ sem registradores e sem goto', () => {
  const corpo = (c: string) => linhas(c).join('\n');
  const semRegistradores = (c: string) => expect(c).not.toMatch(/\bR[0-7]\b|\bgoto\b/);

  it('for da soma (Aula 15): contador vem da variável i; também sai com while', () => {
    const r = cpp(`soma: 0
i: 1
LOAD R1, soma
LOAD R2, i
LOOP:  CMP R2, 4
       JG  FIM
       ADD R1, R2
       ADD R2, 1
       JMP LOOP
FIM:   STORE soma, R1`);
    expect(linhas(r.codigo)).toEqual(['int main() {', 'int soma = 0;', 'for (int i = 1; i <= 4; i++) {', 'soma = soma + i;', '}', '}']);
    expect(linhas(r.codigoWhile!)).toEqual(['int main() {', 'int soma = 0, i = 1;', 'while (i <= 4) {', 'soma = soma + i;', 'i++;', '}', '}']);
  });

  it('só há versão com while quando há for', () => {
    expect(cpp('X: 5\nLOAD R1, X\nADD R1, 2\nSTORE X, R1').codigoWhile).toBeUndefined();
  });

  it('três laços, o segundo usa o contador depois (programa da imagem)', () => {
    const r = cpp(`X: 0
LOAD R1, 0
LOAD R2, 1
LOAD R4, 1
LOAD R6, 1
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
    semRegistradores(r.codigo);
    expect(corpo(r.codigo)).toContain('int j;\nfor (j = 0; j < 2; j++) {\nvalor2 = valor2 * 3;\n}\nwhile (j != 2) {\nvalor2 = valor2 * 3;\nj++;\n}\nX = valor + valor2;');
    expect(corpo(r.codigoWhile!)).toContain('int i = 0;\nwhile (i < 3) {\nvalor = valor * 2;\ni++;\n}');
  });

  it('registrador que só copia a variável vira a própria variável', () => {
    const r = cpp('X: 0\nLOOP:\nLOAD R1, X\nCMP R1, 3\nJE FIM\nADD R1, 1\nSTORE X, R1\nJMP LOOP\nFIM:\nOUT TELA, R1\nHALT');
    expect(linhas(r.codigo)).toEqual(['#include <stdio.h>', 'int main() {', 'int X = 0;', 'while (X != 3) {', 'X++;', '}', 'printf("%d", X);', '}']);
    const c = cpp('X: 0\nLOAD R1, X\nLOOP:\nCMP R1, 3\nJE FIM\nOUT TELA, R1\nADD R1, 1\nJMP LOOP\nFIM:\nSTORE X, R1\nHALT');
    expect(corpo(c.codigo)).toContain('while (X != 3) {\nprintf("%d", X);\nX++;\n}');
  });

  it('leitura antes do teste entra na condição do while', () => {
    const r = cpp('CONT: 0\nLOAD R2, 0\nLOOP:\nIN R1, BOTAO\nCMP R1, 1\nJNE FIM\nADD R2, 1\nDELAY 100\nJMP LOOP\nFIM:\nSTORE CONT, R2\nHALT');
    expect(corpo(r.codigo)).toContain('int valor = 0;\nwhile (digitalRead(botao) == HIGH) {\nvalor++;\ndelay(100);\n}\nCONT = valor;');
    // a leitura usada no corpo fica numa variável (não lê o botão duas vezes)
    const l = cpp('LOOP:\nIN R1, BOTAO\nCMP R1, 1\nJNE FIM\nOUT LED, R1\nJMP LOOP\nFIM:\nHALT');
    expect(corpo(l.codigo)).toContain('while (true) {\nvalor = digitalRead(botao);\nif (valor != 1) break;\ndigitalWrite(led, valor);\n}');
  });

  it('teste no fim: while/for, sem do-while', () => {
    const r = cpp('X: 0\nLOAD R1, 0\nLOAD R2, 0\nLOOP:\nADD R2, 5\nADD R1, 1\nCMP R1, 4\nJL LOOP\nSTORE X, R2\nHALT');
    expect(corpo(r.codigo)).toContain('for (int i = 0; i < 4; i++) {\nvalor = valor + 5;\n}');
    expect(corpo(r.codigoWhile!)).toContain('int i = 0;\nwhile (i < 4) {');
    // primeira volta desconhecida (botão): while (true) com break no fim
    const b = cpp('CONT: 0\nLOOP:\nADD R2, 1\nIN R1, BOTAO\nCMP R1, 1\nJE LOOP\nSTORE CONT, R2\nHALT');
    expect(corpo(b.codigo)).toContain('while (true) {\nvalor++;\nif (digitalRead(botao) != HIGH) break;\n}');
    expect(b.codigo).not.toContain('do');
  });

  it('Arduino: laço infinito no fim vira o próprio loop()', () => {
    const r = cpp('LOOP:\nLOAD R1, 1\nOUT LED, R1\nDELAY 500\nLOAD R1, 0\nOUT LED, R1\nDELAY 500\nJMP LOOP');
    expect(corpo(r.codigo)).toContain('void loop() {\ndigitalWrite(led, HIGH);\ndelay(500);\ndigitalWrite(led, LOW);\ndelay(500);\n}');
    expect(r.codigo).not.toContain('while');
  });

  it('break, com o bloco do break dentro do if', () => {
    const r = cpp('V: 4, 7, 9, 2, 5\nPOS: 0\nLOAD R1, 0\nLOOP:\nCMP R1, 5\nJE FIM\nLOAD R2, V[R1]\nCMP R2, 9\nJE ACHOU\nADD R1, 1\nJMP LOOP\nACHOU:\nSTORE POS, R1\nFIM:\nHALT');
    expect(corpo(r.codigo)).toContain('for (int i = 0; i < 5; i++) {\nif (V[i] == 9) {\nPOS = i;\nbreak;\n}\n}');
    const d = cpp('V: 4, 7, 9, 2, 5\nPOS: 0\nLOAD R1, 0\nLOOP:\nCMP R1, 5\nJE FIM\nLOAD R2, V[R1]\nCMP R2, 9\nJE FIM\nADD R1, 1\nJMP LOOP\nFIM:\nSTORE POS, R1\nHALT');
    expect(corpo(d.codigo)).toContain('int i;\nfor (i = 0; i < 5; i++) {\nif (V[i] == 9) break;\n}\nPOS = i;');
  });

  it('continue (só while, porque o contador muda antes do teste)', () => {
    const r = cpp('V: 3, 8, 6, 1\nSOMA: 0\nLOAD R1, 0\nLOOP:\nCMP R1, 4\nJE FIM\nLOAD R2, V[R1]\nADD R1, 1\nCMP R2, 5\nJL LOOP\nADD R3, R2\nJMP LOOP\nFIM:\nSTORE SOMA, R3\nOUT TELA, R3\nHALT');
    semRegistradores(r.codigo);
    expect(r.codigoWhile).toBeUndefined();
    expect(corpo(r.codigo)).toContain('while (i != 4) {\nint valor2 = V[i];\ni++;\nif (valor2 < 5) continue;\nvalor = valor + valor2;\n}');
  });

  it('CALL rótulo vira função; registradores da sub-rotina viram globais', () => {
    const r = cpp('X: 3\nLOAD R1, X\nCALL DOBRA\nCALL DOBRA\nSTORE X, R1\nOUT TELA, R1\nHALT\nDOBRA:\nMUL R1, 2\nRET');
    expect(corpo(r.codigo)).toContain('int X = 3;\nint valor;\nvoid dobra() {\nvalor = valor * 2;\n}\nint main() {\nvalor = X;\ndobra();\ndobra();\nX = valor;');
  });

  it('JMP para o teste ou para o meio do laço', () => {
    const t = cpp('S: 0\nLOAD R1, 0\nLOAD R2, 0\nJMP TESTE\nLOOP:\nADD R2, R1\nADD R1, 1\nTESTE:\nCMP R1, 5\nJL LOOP\nSTORE S, R2\nHALT');
    expect(corpo(t.codigo)).toContain('for (int i = 0; i < 5; i++) {\nvalor = valor + i;\n}');
    const m = cpp('X: 0\nLOAD R1, 0\nJMP MEIO\nLOOP:\nADD R1, 2\nMEIO:\nADD R1, 1\nCMP R1, 10\nJL LOOP\nSTORE X, R1\nHALT');
    expect(corpo(m.codigo)).toContain('int i = 0;\ni++;\nwhile (i < 10) {\ni = i + 2;\ni++;\n}\nX = i;');
  });

  it('desvios embaralhados: aviso, sem C++', () => {
    const r = cpp('X: 0\nLOAD R1, 0\nA: ADD R1, 1\nB: ADD R1, 2\nCMP R1, 5\nJL A\nCMP R1, 20\nJL B\nSTORE X, R1\nHALT');
    expect(r.codigo).toBe('');
    expect(r.aviso).toContain('JL B (linha 8) entra no meio de um laço');
  });

  it('o C++ dos exemplos não tem registradores nem goto', () => {
    EXEMPLOS_ASSEMBLY.forEach(e => {
      const r = cpp(e.codigo);
      semRegistradores(r.codigo);
      if (r.codigoWhile) semRegistradores(r.codigoWhile);
    });
  });
});
