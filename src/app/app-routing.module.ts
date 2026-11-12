import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { SimulacoesComponent } from './pages/simulacoes/simulacoes.component';
import { BrandkitComponent } from './pages/brandkit/brandkit.component';
import { HomeAssemblyComponent } from './features/assembly/simulador/components/home-assembly/home-assembly.component';

const routes: Routes = [
  { path: '', component: LandingComponent, pathMatch: 'full' },
  { path: 'simulacoes', component: SimulacoesComponent },
  { path: 'brandkit', component: BrandkitComponent },

  // Assembly
  { path: 'assembly/simulador', component: HomeAssemblyComponent },

  { path: '**', redirectTo: '' },
];

@NgModule({
  // useHash: sem isso, recarregar uma página no GitHub Pages dá 404
  imports: [RouterModule.forRoot(routes, { useHash: true, scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule { }
