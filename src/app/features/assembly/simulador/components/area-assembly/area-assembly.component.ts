import { Component, ElementRef, ViewChild, computed, effect } from '@angular/core';
import { OsStatComponent } from 'src/app/ui/stat/stat.component';
import { OsAlertComponent } from 'src/app/ui/alert/alert.component';
import { OsTerminalComponent } from 'src/app/ui/terminal/terminal.component';
import { OsSimPlayerComponent } from 'src/app/ui/sim-player/sim-player.component';
import { SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { Fase, textoValor } from 'src/app/features/assembly/models/assembly';
import { PINO_LED, REGISTRADORES } from 'src/app/features/assembly/models/instrucoes';
import { EditorAssemblyComponent } from '../editor-assembly/editor-assembly.component';

const ROTULO_FASE: Record<Fase, string> = {
  carga: 'carga', busca: 'busca', decodificacao: 'decodificação', execucao: 'execução', fim: 'fim', erro: 'erro',
};

interface Celula { end: number; conteudo: string; nome: string; tipo: 'instrucao' | 'dado' | 'pilha'; vazio: boolean; }

@Component({
  selector: 'app-area-assembly',
  templateUrl: './area-assembly.component.html',
  styleUrls: ['../../../../../ui/styles/sim-viz.css', './area-assembly.component.css'],
  standalone: true,
  imports: [OsStatComponent, OsAlertComponent, OsTerminalComponent, OsSimPlayerComponent, EditorAssemblyComponent],
})
export class AreaAssemblyComponent {
  readonly rotuloFase = ROTULO_FASE;
  readonly gerais = REGISTRADORES;
  readonly pinoLed = PINO_LED;
  @ViewChild('memoria') memoria?: ElementRef<HTMLElement>;
  @ViewChild('saidaScroll') saidaScroll?: ElementRef<HTMLElement>;

  readonly linhasErro = computed(() => this.sim.erros().map(e => e.linha));

  /** Células da memória: instruções (com o rótulo, se houver), variáveis e pilha. */
  readonly celulas = computed<Celula[]>(() => {
    const p = this.sim.programa();
    const passo = this.sim.passo();
    const rot = new Map<number, string>();
    p.rotulos.forEach(r => rot.set(r.end, rot.has(r.end) ? rot.get(r.end) + ', ' + r.nome : r.nome));
    const cel: Celula[] = p.instrucoes.map(i => ({ end: i.end, conteudo: i.texto, nome: rot.get(i.end) ?? '', tipo: 'instrucao', vazio: false }));
    p.variaveis.forEach(v => v.valores.forEach((val, k) => {
      const end = v.end + k;
      const atual = passo ? passo.dados[end - p.inicioDados] : val;
      cel.push({ end, conteudo: textoValor(atual), nome: v.valores.length > 1 ? `${v.nome}[${k}]` : v.nome, tipo: 'dado', vazio: atual === null });
    }));
    if (p.inicioPilha !== null) {
      for (let end = p.inicioPilha; end < p.tamanhoMemoria; end++) {
        const atual = passo ? passo.dados[end - p.inicioDados] : null;
        cel.push({ end, conteudo: atual === null ? '—' : String(atual), nome: 'pilha', tipo: 'pilha', vazio: atual === null });
      }
    }
    return cel;
  });

  /** Pinos de saída usados em algum momento da execução (o LED, pino 13, aparece sempre). */
  readonly pinos = computed(() => {
    const s = new Set<number>([PINO_LED]);
    this.sim.execucao().passos.forEach(p => Object.keys(p.pinos).forEach(k => s.add(+k)));
    return [...s].sort((a, b) => a - b);
  });

  readonly linhasSaida = computed(() => {
    const s = this.sim.passo()?.saida ?? '';
    const l = s.split('\n');
    if (l[l.length - 1] === '') l.pop();
    return l;
  });

  constructor(public sim: SimuladorAssemblyService) {
    // mantém visíveis a célula acessada na memória e a última linha da saída
    effect(() => {
      this.sim.passo();
      setTimeout(() => {
        const mem = this.memoria?.nativeElement;
        const alvo = mem?.querySelector<HTMLElement>('tr.acesso, tr.atual');
        if (mem && alvo) mem.scrollTo({ top: Math.max(0, alvo.offsetTop - mem.clientHeight / 2), behavior: 'smooth' });
        const s = this.saidaScroll?.nativeElement;
        if (s) s.scrollTop = s.scrollHeight;
      });
    });
  }

  mudou(chave: string): boolean {
    return this.sim.passo()?.mudou.includes(chave) ?? false;
  }

  acesso(end: number): 'leitura' | 'escrita' | null {
    const a = this.sim.passo()?.acessos.find(x => x.end === end);
    return a ? a.tipo : null;
  }

  valorPino(pino: number): number | null {
    return this.sim.passo()?.pinos[pino] ?? null;
  }

  portaAtiva(tipo: 'entrada' | 'saida', nome: string): boolean {
    const p = this.sim.passo()?.porta;
    return !!p && p.tipo === tipo && p.nome === nome;
  }
}
