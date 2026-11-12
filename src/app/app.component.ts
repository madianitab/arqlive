import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OsTopbarComponent } from './ui/topbar/topbar.component';

@Component({
    selector: 'app-root',
    template: `
      <os-topbar></os-topbar>
      <main class="app-shell-main">
        <router-outlet></router-outlet>
      </main>
    `,
    standalone: true,
    imports: [RouterOutlet, OsTopbarComponent],
    styles: [`
      :host { display: block; }
      /* compensa a topbar fixa (60px) para o conteúdo de todas as páginas */
      .app-shell-main { padding-top: 60px; }
    `],
})
export class AppComponent {
}
