import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { OsButtonComponent } from '../../ui/button/button.component';
import { OsCardComponent } from '../../ui/card/card.component';
import { OsCardIconComponent } from '../../ui/card-icon/card-icon.component';
import { OsBadgeComponent } from '../../ui/badge/badge.component';
import { ASSUNTOS, IdAssunto } from './conteudos';

/** Página "Laboratório": módulos agrupados por assunto, com abas para filtrar. */
@Component({
  selector: 'app-simulacoes',
  standalone: true,
  imports: [OsButtonComponent, OsCardComponent, OsCardIconComponent, OsBadgeComponent],
  styleUrls: ['./simulacoes.component.css'],
  template: `
<div class="sim-page">
  <header class="sim-head">
    <div class="section-idx">Laboratório</div>
    <h1 class="sim-title">O que você quer fazer?</h1>
    <p class="sim-sub">Níveis da máquina, CPU, memória, barramentos e assembly: simule, acompanhe e pratique como o computador funciona por dentro.</p>
  </header>

  <nav class="abas" role="tablist" aria-label="Assuntos">
    <button type="button" role="tab" class="aba" [class.ativa]="filtro() === null" [attr.aria-selected]="filtro() === null" (click)="filtrar(null)">Todos</button>
    @for (a of assuntos; track a.id) {
      <button type="button" role="tab" class="aba" [class.ativa]="filtro() === a.id" [attr.aria-selected]="filtro() === a.id" (click)="filtrar(a.id)">{{ a.nome }}</button>
    }
  </nav>

  @for (a of visiveis(); track a.id) {
    <section class="sim-group" [attr.aria-label]="a.nome">
      <h2 class="group-title">{{ a.nome }}</h2>
      <p class="group-sub">{{ a.descricao }}</p>
      <div class="tw-grid tw-grid-cols-1 md:tw-grid-cols-2 lg:tw-grid-cols-3 tw-gap-4 sim-deck">
        @for (m of a.modulos; track m.titulo) {
          <os-card [title]="m.titulo" [class.construcao]="!m.rota">
            <os-card-icon slot="icon" [variant]="m.variante ?? 'default'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                @for (d of m.icone; track $index) { <path [attr.d]="d"></path> }
              </svg>
            </os-card-icon>
            @if (m.rota) {
              <os-badge slot="badge" [variant]="m.tipo.variante">{{ m.tipo.texto }}</os-badge>
            } @else {
              <os-badge slot="badge" variant="w">em construção</os-badge>
            }
            {{ m.descricao }}
            <div slot="footer">
              @if (m.rota) {
                <os-button variant="p" size="sm" (click)="go(m.rota)">Abrir →</os-button>
              } @else {
                <os-button variant="g" size="sm" [disabled]="true">Em construção</os-button>
              }
            </div>
          </os-card>
        }
      </div>
    </section>
  }
</div>
  `,
})
export class SimulacoesComponent {
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);

  readonly assuntos = ASSUNTOS;
  /** Assunto escolhido na aba (null = todos); vem de ?assunto= na URL. */
  readonly filtro = signal<IdAssunto | null>(this.lerFiltro());
  readonly visiveis = computed(() => this.assuntos.filter(a => !this.filtro() || a.id === this.filtro()));

  filtrar(id: IdAssunto | null): void {
    this.filtro.set(id);
    this.router.navigate([], { relativeTo: this.rota, queryParams: { assunto: id }, replaceUrl: true });
  }

  go(path: string): void {
    this.router.navigateByUrl(path);
  }

  private lerFiltro(): IdAssunto | null {
    const q = this.rota.snapshot.queryParamMap.get('assunto');
    return this.assuntos.some(a => a.id === q) ? (q as IdAssunto) : null;
  }
}
