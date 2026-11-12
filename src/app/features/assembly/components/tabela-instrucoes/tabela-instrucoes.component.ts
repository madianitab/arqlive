import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
import { DefInstrucao, INSTRUCOES } from 'src/app/features/assembly/models/instrucoes';

interface Linha { codigo: string; descricao: string; }

/**
 * Janela com a tabela de todas as instruções do Assembly simplificado
 * (usada no Simulador e no Executor). Abra com `abrir()`.
 */
@Component({
  selector: 'app-tabela-instrucoes',
  standalone: true,
  templateUrl: './tabela-instrucoes.component.html',
  styleUrls: ['./tabela-instrucoes.component.css'],
})
export class TabelaInstrucoesComponent {
  @ViewChild('dlg') dlg!: ElementRef<HTMLDialogElement>;
  readonly busca = signal('');

  readonly memoria: Linha[] = [
    { codigo: 'X: 5', descricao: 'variável com valor inicial' },
    { codigo: 'D: 0   D: vazio   D', descricao: 'variável sem valor (vazio) ou com 0' },
    { codigo: 'LEDS: 8, 9, 10', descricao: 'vetor; acesso com LEDS[R1] ou LEDS[0]' },
    { codigo: 'TEXTO: "X = "', descricao: 'texto exibido pelo CALL imprime' },
    { codigo: 'LOOP:', descricao: 'rótulo (destino dos desvios)' },
    { codigo: '; comentário', descricao: 'o resto da linha é ignorado' },
  ];
  readonly operandos: Linha[] = [
    { codigo: 'R0 … R7', descricao: 'registradores de uso geral' },
    { codigo: '5   0x1F   0b101   \'0\'   HIGH   LOW', descricao: 'constantes (decimal, hexa, binário, caractere ASCII, 1 e 0)' },
    { codigo: 'BOTAO   A0 … A5', descricao: 'portas de entrada (botão 0/1; sensor 0 a 1023)' },
    { codigo: 'LED   TELA   0 … 13', descricao: 'portas de saída (LED = pino 13; TELA exibe o valor)' },
  ];

  readonly grupos = computed(() => {
    const t = this.busca().trim().toLowerCase();
    const ok = (d: DefInstrucao) => !t || [d.op, ...d.apelidos, d.uso, ...(d.outros ?? []), d.descricao, d.cpp ?? '', d.grupo]
      .some(x => x.toLowerCase().includes(t));
    const gs: { nome: string; itens: DefInstrucao[] }[] = [];
    for (const d of INSTRUCOES.filter(ok)) {
      let g = gs.find(x => x.nome === d.grupo);
      if (!g) gs.push(g = { nome: d.grupo, itens: [] });
      g.itens.push(d);
    }
    return gs;
  });

  private filtrar(l: Linha[]): Linha[] {
    const t = this.busca().trim().toLowerCase();
    return t ? l.filter(x => x.codigo.toLowerCase().includes(t) || x.descricao.toLowerCase().includes(t)) : l;
  }
  readonly memoriaFiltrada = computed(() => this.filtrar(this.memoria));
  readonly operandosFiltrados = computed(() => this.filtrar(this.operandos));
  readonly nadaEncontrado = computed(() => !this.grupos().length && !this.memoriaFiltrada().length && !this.operandosFiltrados().length);

  abrir(): void {
    this.busca.set('');
    this.dlg.nativeElement.showModal();
  }

  fechar(): void {
    this.dlg.nativeElement.close();
  }

  /** Fecha ao clicar fora da caixa. */
  clicarFundo(ev: MouseEvent): void {
    if (ev.target === this.dlg.nativeElement) this.fechar();
  }
}
