import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * Functional Route Guard for Angular 19.
 * Ensures that clinical screens (/studies, /viewer) are only accessible to authenticated users.
 */
export const authGuard: CanActivateFn = (_, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // Redirect to login page and retain the attempted destination
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};

