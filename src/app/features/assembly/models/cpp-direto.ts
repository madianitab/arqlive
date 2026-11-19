/**
 * Tradução DIRETA para C++ (instrução por instrução, com registradores e goto).
 * Usada quando o programa não tem uma estrutura reconhecível (veja cpp.ts).
 * É uma tradução didática, instrução por instrução: os registradores viram variáveis,
 * os desvios viram if/goto e as portas viram digitalRead/digitalWrite/analogRead.
 * Se o programa usa portas ou DELAY, sai no formato do Arduino; senão, no formato de PC.
 * Registradores que são contadores de laço viram i, j, k… (veja contadoresDeLaco).
 */
import { Operando, Programa, textoOperando } from './assembly';
import { REGISTRADORES, Registrador } from './instrucoes';

const COMPARA: Record<string, string> = { JE: '==', JNE: '!=', JG: '>', JGE: '>=', JL: '<', JLE: '<=' };

export function ehArduino(p: Programa): boolean {
  return p.instrucoes.some(i =>
    i.def.op === 'IN' || i.def.op === 'DELAY' ||
    (i.def.op === 'OUT' && !(i.operandos[0].t === 'porta' && i.operandos[0].nome === 'TELA')));
}

const NOMES_CONTADORES = ['i', 'j', 'k', 'm', 'n'];

/**
 * Registradores usados como contador de laço, com o nome que recebem no C++ (i, j, k…),
 * na ordem em que aparecem. Contador: registrador comparado no teste do laço e
 * alterado no corpo por ADD/SUB com constante. Dois formatos de laço:
 *   ROTULO: CMP R, x / Jcc FIM / … ADD R, 1 … / JMP ROTULO / FIM:    (teste no início)
 *   ROTULO: … ADD R, 1 … / CMP R, x / Jcc ROTULO                    (teste no fim)
 * Nomes já usados por variáveis ou rótulos (sem diferenciar maiúsculas) são pulados.
 */
export function contadoresDeLaco(p: Programa): Map<Registrador, string> {
  const ins = p.instrucoes;
  const rotulos = new Set(p.rotulos.map(r => r.end));
  const alvo = (k: number) => {
    const a = ins[k]?.operandos[0];
    return a && a.t === 'rotulo' && !a.sistema ? a.end : -1;
  };
  /** O corpo [s, e) muda o registrador com ADD/SUB de constante? */
  const contaNoCorpo = (r: Registrador, s: number, e: number) => ins.slice(s, e).some(it =>
    (it.def.op === 'ADD' || it.def.op === 'SUB') && it.operandos[0].t === 'reg' && it.operandos[0].r === r && it.operandos[1].t === 'num');
  const regCmp = (k: number) => {
    const a = ins[k]?.operandos[0];
    return ins[k]?.def.op === 'CMP' && a?.t === 'reg' ? a.r : null;
  };

  const achados: Registrador[] = [];
  const achar = (r: Registrador | null) => { if (r && !achados.includes(r)) achados.push(r); };
  ins.forEach((it, k) => {
    // teste no início
    const r = regCmp(k);
    if (r && rotulos.has(k) && COMPARA[ins[k + 1]?.def.op]) {
      const fim = alvo(k + 1);
      if (fim > k + 2 && ins[fim - 1].def.op === 'JMP' && alvo(fim - 1) === k && contaNoCorpo(r, k + 2, fim - 1)) achar(r);
    }
    // teste no fim
    if (COMPARA[it.def.op]) {
      const ini = alvo(k);
      const rc = regCmp(k - 1);
      if (rc && ini >= 0 && ini < k - 1 && contaNoCorpo(rc, ini, k - 1)) achar(rc);
    }
  });

  const ocupados = new Set([...p.variaveis.map(v => v.nome), ...p.rotulos.map(r => r.nome)].map(n => n.toLowerCase()));
  const livres = NOMES_CONTADORES.filter(n => !ocupados.has(n));
  const mapa = new Map<Registrador, string>();
  achados.forEach(r => { const n = livres.shift(); if (n) mapa.set(r, n); });
  return mapa;
}

export function gerarCppDireto(p: Programa): string {
  if (p.erros.length) return '';
  const arduino = ehArduino(p);
  const ins = p.instrucoes;
  const contadores = contadoresDeLaco(p);
  /** Texto do operando no C++ (registrador contador vira i, j…). */
  const txt = (o: Operando): string => {
    if (o.t === 'reg') return contadores.get(o.r) ?? o.r;
    if (o.t === 'mem' && o.indice?.t === 'reg') return `${o.nome}[${contadores.get(o.indice.r) ?? o.indice.r}]`;
    return textoOperando(o);
  };

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
    const A = a ? txt(a) : '';
    const B = b ? txt(b) : '';
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
  const comuns = usados.filter(r => !contadores.has(r));
  const cont = [...contadores.keys()].filter(r => regs.has(r));
  if (comuns.length) out.push(`  int ${comuns.map(r => `${r} = 0`).join(', ')};   // registradores`);
  if (cont.length) out.push(`  int ${cont.map(r => `${contadores.get(r)} = 0`).join(', ')};   // contadores dos laços (${cont.join(', ')})`);
  out.push(...linhas);
  if (!arduino && !ins.some(i => i.def.op === 'HALT')) out.push('  return 0;');
  out.push('}');
  if (arduino) out.push('', 'void loop() { }');
  return out.join('\n');
}

