import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { buscarInstrucao, ehRegistrador } from '../../../models/instrucoes';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Destaca a sintaxe de uma linha de assembly. */
export function destacarAssembly(linha: string): string {
  const span = (cls: string, txt: string) => `<span class="${cls}">${esc(txt)}</span>`;
  let html = '';
  let i = 0;
  let inicio = true;   // ainda no começo da linha (rótulo ou diretiva)
  while (i < linha.length) {
    const resto = linha.slice(i);
    let m: RegExpMatchArray | null;
    if (resto.startsWith(';')) { html += span('hl-c', resto); break; }
    if ((m = resto.match(/^\s+/))) { html += m[0]; i += m[0].length; continue; }
    if ((m = resto.match(/^"[^"]*"?/))) { html += span('hl-s', m[0]); i += m[0].length; inicio = false; continue; }
    if (inicio && (m = resto.match(/^\.[A-Za-zçÇ]+/))) { html += span('hl-p', m[0]); i += m[0].length; inicio = false; continue; }
    if (inicio && (m = resto.match(/^[A-Za-z_]\w*\s*:/))) { html += span('hl-p', m[0]); i += m[0].length; continue; }
    if ((m = resto.match(/^'.'/))) { html += span('hl-n', m[0]); i += m[0].length; inicio = false; continue; }
    if ((m = resto.match(/^[+-]?(0x[0-9a-fA-F]+|0b[01]+|\d+)\b/))) { html += span('hl-n', m[0]); i += m[0].length; inicio = false; continue; }
    if ((m = resto.match(/^[A-Za-z_]\w*/))) {
      const w = m[0];
      html += buscarInstrucao(w) ? span('hl-k', w)
        : ehRegistrador(w) ? span('hl-f', w)
        : /^(vazio|HIGH|LOW)$/i.test(w) ? span('hl-n', w)
        : esc(w);
      i += w.length;
      inicio = false;
      continue;
    }
    html += esc(linha[i]);
    i++;
    inicio = false;
  }
  return html;
}

/** Editor de assembly com números de linha, destaque de sintaxe e linha atual. */
@Component({
  selector: 'app-editor-assembly',
  standalone: true,
  styleUrls: ['./editor-assembly.component.css'],
  template: `
    <div class="editor" [class.erro]="linhasErro.length > 0" [class.alto]="alto">
      <div class="area">
        <div class="gutter" aria-hidden="true">
          @for (l of linhas(); track $index) {
            <div [class.atual]="$index + 1 === linhaAtual" [class.err]="linhasErro.includes($index + 1)">{{ $index + 1 }}</div>
          }
        </div>
        <div class="camada" aria-hidden="true">
          @for (l of linhas(); track $index) {
            <div class="ln" [class.atual]="$index + 1 === linhaAtual" [class.err]="linhasErro.includes($index + 1)" [innerHTML]="l"></div>
          }
        </div>
        <textarea rows="1" cols="1" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off"
                  aria-label="Código assembly" [value]="texto()" (input)="digitar($event)" (keydown)="tecla($event)"></textarea>
      </div>
    </div>
  `,
})
export class EditorAssemblyComponent {
  readonly texto = signal('');
  @Input() set codigo(v: string) { if (v !== this.texto()) this.texto.set(v); }
  @Input() linhaAtual: number | null = null;
  @Input() linhasErro: number[] = [];
  /** Editor alto, ocupando a altura disponível (tela do executor). */
  @Input() alto = false;
  @Output() codigoChange = new EventEmitter<string>();
  @Output() executar = new EventEmitter<void>();

  readonly linhas = computed(() => this.texto().split('\n').map(destacarAssembly));

  digitar(ev: Event): void {
    const v = (ev.target as HTMLTextAreaElement).value;
    this.texto.set(v);
    this.codigoChange.emit(v);
  }

  tecla(ev: KeyboardEvent): void {
    const ta = ev.target as HTMLTextAreaElement;
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
      ev.preventDefault();
      this.executar.emit();
    } else if (ev.key === 'Tab' && !ev.shiftKey) {
      ev.preventDefault();
      ta.setRangeText('    ', ta.selectionStart, ta.selectionEnd, 'end');
      ta.dispatchEvent(new Event('input'));
    }
  }
}
