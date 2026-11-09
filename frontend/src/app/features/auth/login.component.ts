import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4 bg-radial-gradient">
      <div class="max-w-md w-full bg-dicom-panel border border-dicom-border rounded-xl p-8 shadow-2xl backdrop-blur">
        
        <!-- Header -->
        <div class="text-center mb-6">
          <div class="inline-flex w-12 h-12 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-400 items-center justify-center font-bold text-xl text-white shadow-lg shadow-sky-500/20 mb-3">
            D
          </div>
          <h1 class="text-xl font-bold text-white tracking-wide">Medical Workstation Login</h1>
          <p class="text-xs text-slate-400 mt-1">AWS Cognito JWT Protected Healthcare Gateway</p>
        </div>

        <!-- Error Notification -->
        @if (authService.error()) {
          <div class="mb-4 p-3 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-200 flex items-center justify-between">
            <span>{{ authService.error() }}</span>
            <button (click)="authService.error.set(null)" class="text-red-400 hover:text-white font-bold ml-2">&times;</button>
          </div>
        }

        <!-- Form -->
        <form (ngSubmit)="handleLogin()" class="space-y-4">
          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Clinical Email</label>
            <input
              type="email"
              [(ngModel)]="email"
              name="email"
              required
              class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              placeholder="physician@hospital.org" />
          </div>

          <div>
            <label class="block text-xs font-medium text-slate-300 mb-1">Password</label>
            <input
              type="password"
              [(ngModel)]="password"
              name="password"
              required
              class="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
              placeholder="••••••••••••" />
          </div>

          <div class="pt-2 space-y-2">
            @if (hasCognitoConfig()) {
              <button
                type="submit"
                [disabled]="authService.loading()"
                class="w-full bg-gradient-to-r from-sky-500 to-cyan-500 hover:from-sky-400 hover:to-cyan-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 rounded text-sm shadow-lg shadow-sky-500/25 transition-all">
                @if (authService.loading()) {
                  Authenticating with AWS Cognito...
                } @else {
                  Authenticate via AWS Cognito
                }
              </button>
            }

            <!-- Quick Local Dev Mode Login -->
            <button
              type="button"
              (click)="handleDevLogin()"
              class="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold py-2 rounded text-xs transition-all flex items-center justify-center gap-2">
              <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>Quick Dev Login (Local Workstation Mode)</span>
            </button>
          </div>
        </form>

        <!-- Architecture note box -->
        <div class="mt-6 p-3 bg-slate-900/80 border border-slate-800 rounded text-[11px] text-slate-400 space-y-1">
          <div class="font-semibold text-slate-300 flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Compliance & Security:
          </div>
          <div>All DICOM objects are accessed using short-lived S3 Pre-signed URLs authorized by Cognito JWT tokens.</div>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  email = '';
  password = '';

  hasCognitoConfig(): boolean {
    return !!(environment.cognito?.clientId && environment.cognito?.region);
  }

  handleLogin(): void {
    if (!this.email || !this.password) return;

    if (this.hasCognitoConfig()) {
      this.authService.loginWithCognito(this.email, this.password).subscribe({
        next: () => this.navigateDestination()
      });
    } else {
      this.handleDevLogin();
    }
  }

  handleDevLogin(): void {
    const devEmail = this.email.trim();
    if (!devEmail) {
      this.authService.error.set('Please provide an email address for the local session.');
      return;
    }
    this.authService.devLogin(devEmail, 'Radiologist');
    this.navigateDestination();
  }

  private navigateDestination(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/studies';
    this.router.navigateByUrl(returnUrl);
  }
}
