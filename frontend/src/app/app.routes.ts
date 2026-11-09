import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'studies'
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'studies',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/studies/study-browser.component').then(
        (m) => m.StudyBrowserComponent
      )
  },
  {
    path: 'viewer',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/viewer/dicom-viewer.component').then(
        (m) => m.DicomViewerComponent
      )
  },
  {
    path: '**',
    redirectTo: 'studies'
  }
];
