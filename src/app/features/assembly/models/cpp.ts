/**
 * Gera o código equivalente em C++ (PC ou Arduino) de um programa montado.
 * É uma tradução didática, instrução por instrução: os registradores viram variáveis,
 * os desvios viram if/goto e as portas viram digitalRead/digitalWrite/analogRead.
 * Se o programa usa portas ou DELAY, sai no formato do Arduino; senão, no formato de PC.
 */
import { Operando, Programa, textoOperando } from './assembly';
import { REGISTRADORES } from './instrucoes';

const COMPARA: Record<string, string> = { JE: '==', JNE: '!=', JG: '>', JGE: '>=', JL: '<', JLE: '<=' };

export function ehArduino(p: Programa): boolean {
  return p.instrucoes.some(i =>
    i.def.op === 'IN' || i.def.op === 'DELAY' ||
    (i.def.op === 'OUT' && !(i.operandos[0].t === 'porta' && i.operandos[0].nome === 'TELA')));
}

export function gerarCpp(p: Programa): string {
  if (p.erros.length) return '';
  const arduino = ehArduino(p);
  const ins = p.instrucoes;

  // registradores usados
  const regs = new Set<string>();
  const marcar = (o: Operando) => {
    if (o.t === 'reg') regs.add(o.r);
    if (o.t === 'mem' && o.indice?.t === 'reg') regs.add(o.indice.r);
  };
  ins.forEach(i => i.operandos.forEach(marcar));
  const usados = REGISTRADORES.filter(r => regs.has(r));

  // declarações globais (memória)
  const decl: string[] = [];
  const usaBotao = ins.some(i => i.def.op === 'IN' && i.operandos[1].t === 'porta' && i.operandos[1].nome === 'BOTAO');
  if (arduino && usaBotao) decl.push('const int BOTAO = 2;          // pino do botão');
  for (const v of p.variaveis) {
    const val = v.valores;
    if (typeof val[0] === 'string') decl.push(`const char ${v.nome}[] = "${val[0]}";`);
    else if (val.length > 1) decl.push(`int ${v.nome}[] = {${val.map(x => x ?? 0).join(', ')}};`);
    else decl.push(val[0] === null ? `int ${v.nome};` : `int ${v.nome} = ${val[0]};`);
  }

  // corpo
  const corpo: [string, string][] = [];   // [código, comentário]
  const rotulosEm = new Map<number, string[]>();
  p.rotulos.forEach(r => rotulosEm.set(r.end, [...(rotulosEm.get(r.end) ?? []), r.nome]));
  /** Última comparação (flags): [a, b] — CMP a, b ou resultado da ULA comparado com 0. */
  let flags: [string, string] | null = null;
  /** CMP que foi juntado ao desvio seguinte (vai no comentário do if). */
  let cmpPendente = '';
  const tela = (x: string, texto: boolean) => arduino
    ? `Serial.${texto ? 'print' : 'println'}(${x});`
    : texto ? `printf("%s", ${x});` : `printf("%d\\n", ${x});`;

  ins.forEach((i, k) => {
    (rotulosEm.get(k) ?? []).forEach(r => corpo.push([`${r}:`, '']));
    const [a, b] = i.operandos;
    const A = a ? textoOperando(a) : '';
    const B = b ? textoOperando(b) : '';
    let c = '';
    switch (i.def.op) {
      case 'LOAD': case 'MOV': c = `${A} = ${B};`; break;
      case 'STORE': c = `${A} = ${B};`; break;
      case 'ADD': c = `${A} = ${A} + ${B};`; flags = [A, '0']; break;
      case 'SUB': c = `${A} = ${A} - ${B};`; flags = [A, '0']; break;
      case 'MUL': c = `${A} = ${A} * ${B};`; flags = [A, '0']; break;
      case 'DIV': c = `${A} = ${A} / ${B};`; flags = [A, '0']; break;
      case 'CMP':
        flags = [A, B];
        if (COMPARA[ins[k + 1]?.def.op] && !rotulosEm.has(k + 1)) { cmpPendente = i.texto; return; }
        c = `// compara ${A} com ${B}`;
        break;
      case 'JMP': c = `goto ${A};`; break;
      case 'JE': case 'JNE': case 'JG': case 'JGE': case 'JL': case 'JLE': {
        const [x, y] = flags ?? ['0', '0'];
        c = `if (${x} ${COMPARA[i.def.op]} ${y}) goto ${A};`;
        corpo.push([c, cmpPendente ? `${cmpPendente} + ${i.texto}` : i.texto]);
        cmpPendente = '';
        return;
      }
      case 'IN':
        c = b.t === 'porta' && /^A\d$/.test(b.nome) ? `${A} = analogRead(${B});` : `${A} = digitalRead(${B});`;
        break;
      case 'OUT':
        if (a.t === 'porta' && a.nome === 'TELA') c = tela(B, false);
        else c = `digitalWrite(${a.t === 'porta' ? 'LED_BUILTIN' : A}, ${B});`;
        break;
      case 'DELAY': c = `delay(${A});`; break;
      case 'CALL':
        c = a.t === 'rotulo' && a.sistema ? tela('TEXTO', true) : `// chama a sub-rotina ${A} (em C++ seria uma função)`;
        break;
      case 'RET': c = '// volta da sub-rotina'; break;
      case 'NOP': c = ';'; break;
      case 'HALT': c = arduino ? 'while (true) { }' : 'return 0;'; break;
    }
    if (c) corpo.push([c, i.texto]);
  });
  (rotulosEm.get(ins.length) ?? []).forEach(r => corpo.push([`${r}: ;`, '']));

  // monta o texto
  const ind = (s: string) => (s.endsWith(':') || /^\w+: ;$/.test(s) ? '' : '  ') + s;
  const larg = Math.max(...corpo.map(([c]) => ind(c).length), 20) + 2;
  const linhas = corpo.map(([c, com]) => com ? `${ind(c).padEnd(larg)}// ${com}` : ind(c));
  const usaTela = ins.some(i => (i.def.op === 'OUT' && i.operandos[0].t === 'porta' && i.operandos[0].nome === 'TELA') || (i.def.op === 'CALL' && i.operandos[0].t === 'rotulo' && i.operandos[0].sistema));
  const out: string[] = [];
  if (!arduino && usaTela) out.push('#include <stdio.h>', '');
  if (decl.length) out.push(...decl, '');
  out.push(arduino ? 'void setup() {' : 'int main() {');
  if (arduino && usaTela) out.push('  Serial.begin(9600);');
  if (arduino && ins.some(i => i.def.op === 'OUT' && i.operandos[0].t === 'porta' && i.operandos[0].nome === 'LED')) out.push('  pinMode(LED_BUILTIN, OUTPUT);');
  if (usados.length) out.push(`  int ${usados.map(r => `${r} = 0`).join(', ')};   // registradores`);
  out.push(...linhas);
  if (!arduino && !ins.some(i => i.def.op === 'HALT')) out.push('  return 0;');
  out.push('}');
  if (arduino) out.push('', 'void loop() { }');
  return out.join('\n');
}

