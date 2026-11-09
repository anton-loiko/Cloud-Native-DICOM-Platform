import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="bg-dicom-panel border-b border-dicom-border px-4 py-2 flex items-center justify-between h-14 select-none">
      <!-- Left: Logo & Branding -->
      <div class="flex items-center space-x-6">
        <div class="flex items-center space-x-2">
          <div class="w-8 h-8 rounded bg-gradient-to-tr from-cyan-600 to-sky-400 flex items-center justify-center font-bold text-white shadow-md shadow-cyan-900/30">
            D
          </div>
          <div>
            <div class="text-sm font-semibold tracking-wide text-slate-100 flex items-center gap-2">
              Simple <span class="text-sky-400 font-mono text-xs font-normal">DICOM3D</span>
            </div>
            <div class="text-[10px] text-slate-400 font-mono tracking-tighter">
              AWS SERVERLESS &bull; WEBGL2
            </div>
          </div>
        </div>

        <!-- Nav Links -->
        <nav class="flex items-center space-x-1">
          <a
            routerLink="/studies"
            routerLinkActive="bg-slate-800 text-sky-400 border-b-2 border-sky-400"
            class="px-3 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
            Studies Browser
          </a>
          <a
            routerLink="/viewer"
            routerLinkActive="bg-slate-800 text-sky-400 border-b-2 border-sky-400"
            class="px-3 py-1.5 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/60 transition-colors">
            Workstation Viewer
          </a>
        </nav>
      </div>

      <!-- Right: User info & Actions -->
      <div class="flex items-center space-x-4">
        @if (authService.isAuthenticated()) {
          <div class="flex items-center space-x-3">
            <div class="text-right">
              <div class="text-xs font-medium text-slate-200">{{ authService.user()?.name }}</div>
              <div class="text-[10px] font-mono text-emerald-400 flex items-center justify-end gap-1">
                <span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {{ authService.userRole() }}
              </div>
            </div>
            <button
              (click)="authService.logout()"
              class="px-2.5 py-1 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded border border-transparent hover:border-rose-500/20 transition-all">
              Sign out
            </button>
          </div>
        } @else {
          <a
            routerLink="/login"
            class="px-3 py-1.5 text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold rounded shadow transition-all">
            Sign In
          </a>
        }
      </div>
    </header>
  `
})
export class NavbarComponent {
  authService = inject(AuthService);
}

