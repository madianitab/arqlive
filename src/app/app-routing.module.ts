import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingComponent } from './pages/landing/landing.component';
import { SimulacoesComponent } from './pages/simulacoes/simulacoes.component';
import { BrandkitComponent } from './pages/brandkit/brandkit.component';
import { ExecutorAssemblyComponent } from './features/assembly/executor/components/executor-assembly/executor-assembly.component';
import { ExerciciosAssemblyComponent } from './features/assembly/exercicios/components/exercicios-assembly/exercicios-assembly.component';
import { TradutorCComponent } from './features/assembly/tradutor/components/tradutor-c/tradutor-c.component';
import { HomeCicloComponent } from './features/assembly/ciclo/components/home-ciclo/home-ciclo.component';
import { HomeAssemblyComponent } from './features/assembly/simulador/components/home-assembly/home-assembly.component';

const routes: Routes = [
  { path: '', component: LandingComponent, pathMatch: 'full' },
  { path: 'simulacoes', component: SimulacoesComponent },
  { path: 'brandkit', component: BrandkitComponent },

  // CPU
  { path: 'cpu/ciclo', component: HomeCicloComponent },

  // Assembly
  { path: 'assembly/simulador', component: HomeAssemblyComponent },
  { path: 'assembly/ciclo', redirectTo: 'cpu/ciclo' },   // endereço antigo (links já passados aos alunos)
  { path: 'assembly/executor', component: ExecutorAssemblyComponent },
  { path: 'assembly/tradutor', component: TradutorCComponent },
  { path: 'assembly/exercicios', component: ExerciciosAssemblyComponent },

  { path: '**', redirectTo: '' },
];

@NgModule({
  // useHash: sem isso, recarregar uma página no GitHub Pages dá 404
  imports: [RouterModule.forRoot(routes, { useHash: true, scrollPositionRestoration: 'enabled' })],
  exports: [RouterModule],
})
export class AppRoutingModule { }
