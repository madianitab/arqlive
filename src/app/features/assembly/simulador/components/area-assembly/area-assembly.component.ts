import { Component, ElementRef, ViewChild, computed, effect } from '@angular/core';
import { OsStatComponent } from 'src/app/ui/stat/stat.component';
import { OsAlertComponent } from 'src/app/ui/alert/alert.component';
import { OsTerminalComponent } from 'src/app/ui/terminal/terminal.component';
import { OsSimPlayerComponent } from 'src/app/ui/sim-player/sim-player.component';
import { SimuladorAssemblyService } from 'src/app/features/assembly/services/simulador-assembly.service';
import { Fase } from 'src/app/features/assembly/models/assembly';
import { REGISTRADORES } from 'src/app/features/assembly/models/instrucoes';
import { EditorAssemblyComponent } from '../editor-assembly/editor-assembly.component';

const ROTULO_FASE: Record<Fase, string> = {
  carga: 'carga', busca: 'busca', decodificacao: 'decodificação', execucao: 'execução', fim: 'fim', erro: 'erro',
};

interface Celula { end: number; conteudo: string; nome: string; dado: boolean; }

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
  @ViewChild('memoria') memoria?: ElementRef<HTMLElement>;
  @ViewChild('saidaScroll') saidaScroll?: ElementRef<HTMLElement>;

  readonly linhasErro = computed(() => this.sim.erros().map(e => e.linha));

  /** Células da memória: instruções (com o rótulo, se houver) e variáveis. */
  readonly celulas = computed<Celula[]>(() => {
    const p = this.sim.programa();
    const passo = this.sim.passo();
    const rot = new Map<number, string>();
    p.rotulos.forEach(r => rot.set(r.end, rot.has(r.end) ? rot.get(r.end) + ', ' + r.nome : r.nome));
    const cel: Celula[] = p.instrucoes.map(i => ({ end: i.end, conteudo: i.texto, nome: rot.get(i.end) ?? '', dado: false }));
    p.variaveis.forEach(v => v.valores.forEach((val, k) => {
      const end = v.end + k;
      const atual = passo ? passo.dados[end - p.inicioDados] : val;
      cel.push({ end, conteudo: String(atual ?? val), nome: v.valores.length > 1 ? `${v.nome}[${k}]` : v.nome, dado: true });
    }));
    return cel;
  });

  constructor(public sim: SimuladorAssemblyService) {
    // mantém visíveis a instrução atual na memória e a última linha da saída
    effect(() => {
      this.sim.passo();
      setTimeout(() => {
        const mem = this.memoria?.nativeElement;
        const alvo = mem?.querySelector<HTMLElement>('tr.acesso, tr.atual');
        if (mem && alvo) {
          const topo = alvo.offsetTop - mem.clientHeight / 2;
          mem.scrollTo({ top: Math.max(0, topo), behavior: 'smooth' });
        }
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
}
