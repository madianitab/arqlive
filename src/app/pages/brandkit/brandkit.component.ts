import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OsButtonComponent } from '../../ui/button/button.component';
import { OsBadgeComponent } from '../../ui/badge/badge.component';
import { OsInputComponent } from '../../ui/input/input.component';
import { OsAlertComponent } from '../../ui/alert/alert.component';
import { OsCardComponent } from '../../ui/card/card.component';
import { OsCardIconComponent } from '../../ui/card-icon/card-icon.component';
import { OsProgressComponent } from '../../ui/progress/progress.component';
import { OsTerminalComponent } from '../../ui/terminal/terminal.component';

@Component({
  selector: 'app-brandkit',
  standalone: true,
  imports: [
    RouterLink,
    OsButtonComponent,
    OsBadgeComponent,
    OsInputComponent,
    OsAlertComponent,
    OsCardComponent,
    OsCardIconComponent,
    OsProgressComponent,
    OsTerminalComponent,
  ],
  styleUrls: ['./brandkit.component.css'],
  template: `
<div class="bk-wrap">
  <header class="bk-header">
    <div class="bk-eyebrow">ArqLive · Design System · v2.0</div>
    <h1 class="bk-title">OS<b>Live</b></h1>
    <p class="bk-desc">Componentes, tokens e fundação visual da plataforma.</p>
    <div style="margin-top:24px">
      <a routerLink="/" style="font-family:var(--f-mono);font-size:12px;color:var(--text-3)">← Voltar ao app</a>
    </div>
  </header>

  <section class="bk-section">
    <div class="bk-section-title">01 — Tokens de Cor</div>
    <div class="bk-row">
      <div class="token-chip"><span class="token-swatch" style="background:var(--a)"></span>--a (acento)</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--phos)"></span>--phos</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--ok)"></span>--ok</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--warn)"></span>--warn</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--err)"></span>--err</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--info)"></span>--info</div>
    </div>
    <div class="bk-row" style="margin-top:12px">
      <div class="token-chip"><span class="token-swatch" style="background:var(--bg);border-color:var(--line)"></span>--bg</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--surface);border-color:var(--line)"></span>--surface</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--text)"></span>--text</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--text-2)"></span>--text-2</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--text-3)"></span>--text-3</div>
      <div class="token-chip"><span class="token-swatch" style="background:var(--line)"></span>--line</div>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">02 — Tipografia</div>
    <div class="type-sample">
      <div class="type-label">IBM Plex Mono / 600 / Display</div>
      <div style="font-family:var(--f-mono);font-size:48px;font-weight:600;letter-spacing:-.04em;color:var(--text);line-height:1">Sistemas Operacionais</div>
    </div>
    <div class="type-sample">
      <div class="type-label">IBM Plex Sans / 600 / H1</div>
      <div style="font-family:var(--f-sans);font-size:34px;font-weight:600;letter-spacing:-.035em;color:var(--text)">Gerenciamento de Memória</div>
    </div>
    <div class="type-sample">
      <div class="type-label">IBM Plex Serif / 400 / Body</div>
      <div style="font-family:var(--f-serif);font-size:18px;color:var(--text-2);line-height:1.8">A memória virtual permite ao sistema operacional usar o disco como extensão da RAM.</div>
    </div>
    <div class="type-sample" style="border-bottom:none">
      <div class="type-label">IBM Plex Mono / 400 / Code</div>
      <div style="font-family:var(--f-mono);font-size:14px;color:var(--text)"><span style="color:var(--a)">$</span> ps aux | sort -k3 -rn | head -10</div>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">03 — os-button</div>
    <div class="bk-row">
      <os-button variant="p">Executar</os-button>
      <os-button variant="s">Ver Código</os-button>
      <os-button variant="g">Cancelar</os-button>
      <os-button variant="d">Encerrar Processo</os-button>
    </div>
    <div class="bk-row" style="margin-top:12px">
      <os-button variant="p" size="sm">Pequeno</os-button>
      <os-button variant="p">Médio</os-button>
      <os-button variant="p" size="lg">Grande</os-button>
      <os-button variant="p" [glow]="true">Glow</os-button>
      <os-button variant="p" [disabled]="true">Desabilitado</os-button>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">04 — os-badge</div>
    <div class="bk-row">
      <os-badge variant="n">Idle</os-badge>
      <os-badge variant="a" [live]="true">Active</os-badge>
      <os-badge variant="s" [live]="true">Running</os-badge>
      <os-badge variant="w">High CPU</os-badge>
      <os-badge variant="d">Killed</os-badge>
      <os-badge variant="i">Sleeping</os-badge>
    </div>
    <div class="bk-row" style="margin-top:10px">
      <os-badge variant="n">Linux 5.x</os-badge>
      <os-badge variant="a">Intermediário</os-badge>
      <os-badge variant="s">Concluído</os-badge>
      <os-badge variant="w">Em Progresso</os-badge>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">05 — os-input</div>
    <div class="g2">
      <os-input label="Nome do Processo" placeholder="nginx, mysql…" [required]="true" hint="Exibido na tabela de processos"></os-input>
      <os-input label="Erro de validação" placeholder="PID inválido" status="err" hint="PID deve ser inteiro positivo"></os-input>
      <os-input label="Validado" placeholder="Processo iniciado" status="ok" hint="Validado com sucesso"></os-input>
      <os-input label="Prioridade" type="number" placeholder="0–19"></os-input>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">06 — os-alert</div>
    <div class="bk-col">
      <os-alert variant="info" title="Dica de Simulação">
        <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        Use Ctrl+Z para suspender. O processo vai para "Stopped" e pode ser retomado com fg.
      </os-alert>
      <os-alert variant="ok" title="Exercício Concluído">
        <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
        Round Robin com quantum de 4ms implementado corretamente. Próximo: Prioridades.
      </os-alert>
      <os-alert variant="warn" title="Uso Elevado de Memória">
        <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>
        O processo leakdemo está consumindo mais de 85% da memória disponível.
      </os-alert>
      <os-alert variant="err" title="Kernel Panic">
        <svg slot="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>
        Falha fatal. Estado da simulação salvo. Reinicie o ambiente para continuar.
      </os-alert>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">07 — os-card</div>
    <div class="g3">
      <os-card title="Simulador Linux">
        <os-card-icon slot="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>
        </os-card-icon>
        <os-badge slot="badge" variant="s" [live]="true">Online</os-badge>
        Ambiente kernel 5.x com gerenciamento de processos e sistema de arquivos.
        <div slot="footer">
          <span style="font-family:var(--f-mono);font-size:11px;color:var(--text-3)">247 processos</span>
          <os-button variant="p" size="sm">Abrir</os-button>
        </div>
      </os-card>
      <os-card title="Windows NT Kernel">
        <os-card-icon slot="icon" variant="warn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6v6H9z"/></svg>
        </os-card-icon>
        <os-badge slot="badge" variant="w">Beta</os-badge>
        Exploração da arquitetura HAL e dos subsistemas Win32.
        <div slot="footer">
          <span style="font-family:var(--f-mono);font-size:11px;color:var(--text-3)">preview</span>
          <os-button variant="s" size="sm">Preview</os-button>
        </div>
      </os-card>
      <os-card title="Capítulo Ativo" [accent]="true">
        <os-card-icon slot="icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5z"/></svg>
        </os-card-icon>
        <os-badge slot="badge" variant="a">Cap. 4</os-badge>
        Memória Virtual. Continue de onde parou na última sessão.
        <div slot="footer" style="display:flex;align-items:center;gap:10px;width:100%">
          <div style="flex:1"><os-progress [value]="62"></os-progress></div>
          <span style="font-family:var(--f-mono);font-size:12px;color:var(--a);font-weight:500;flex-shrink:0">62%</span>
        </div>
      </os-card>
    </div>
  </section>

  <section class="bk-section">
    <div class="bk-section-title">08 — os-terminal</div>
    <os-terminal label="bash — arqlive">
      <div><span style="color:#5fb87a">aluno&#64;arqlive</span><span style="color:#4a463c">:~$</span> <span>ps aux | sort -k3 -rn | head -5</span></div>
      <div style="margin:4px 0;color:#4a463c">USER         PID  %CPU  %MEM  COMMAND</div>
      <div><span style="color:#6ea8d8">mysql</span>        643   3.2   8.1  mysqld</div>
      <div><span style="color:#6ea8d8">user</span>        2847  <span style="color:#d8736b">87.3</span>  15.2  <span style="color:var(--phos)">leakdemo</span></div>
      <div style="margin-top:8px"><span style="color:#5fb87a">aluno&#64;arqlive</span><span style="color:#4a463c">:~$</span></div>
    </os-terminal>
  </section>
</div>
  `,
})
export class BrandkitComponent {}
