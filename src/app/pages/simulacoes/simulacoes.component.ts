import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { OsButtonComponent } from '../../ui/button/button.component';
import { OsCardComponent } from '../../ui/card/card.component';
import { OsCardIconComponent } from '../../ui/card-icon/card-icon.component';
import { OsBadgeComponent } from '../../ui/badge/badge.component';

@Component({
  selector: 'app-simulacoes',
  standalone: true,
  imports: [OsButtonComponent, OsCardComponent, OsCardIconComponent, OsBadgeComponent],
  styleUrls: ['./simulacoes.component.css'],
  template: `
<div class="sim-page">
  <header class="sim-head">
    <div class="section-idx">Simulações</div>
    <h1 class="sim-title">Escolha um simulador</h1>
    <p class="sim-sub">Veja a CPU executar um programa, um módulo de cada vez.</p>
  </header>

  <section class="sim-group">
    <h2 class="group-title">Assembly</h2>
    <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-3 tw-gap-4 sim-deck">
      <os-card title="Simulador de Assembly">
        <os-card-icon slot="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M12 15h5"/></svg></os-card-icon>
        <os-badge slot="badge" variant="a">simulador</os-badge>
        Assembly simplificado (PC e Arduino), passo a passo: registradores, ULA, flags, memória e portas (LED, botão, sensor).
        <div slot="footer"><os-button variant="p" size="sm" (click)="go('/assembly/simulador')">Abrir →</os-button></div>
      </os-card>
      <os-card title="Executor de código">
        <os-card-icon slot="icon" variant="ok"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 5l12 7-12 7z"/></svg></os-card-icon>
        <os-badge slot="badge" variant="s">executor</os-badge>
        Escreva, execute e veja o resultado direto, com o código equivalente em C++ (PC ou Arduino).
        <div slot="footer"><os-button variant="p" size="sm" (click)="go('/assembly/executor')">Abrir →</os-button></div>
      </os-card>
    </div>
  </section>

</div>
  `,
})
export class SimulacoesComponent {
  private readonly router = inject(Router);
  go(path: string): void {
    this.router.navigateByUrl(path);
  }
}
