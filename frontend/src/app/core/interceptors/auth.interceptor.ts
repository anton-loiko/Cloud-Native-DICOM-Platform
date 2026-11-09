import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Functional HTTP Interceptor for Angular 19.
 * 1. Attaches `Authorization: Bearer <token>` ONLY to `/api/*` endpoints.
 * 2. Crucial: DOES NOT attach Bearer tokens to Amazon S3 Pre-signed URLs,
 *    preventing S3 "Only one auth mechanism allowed" rejection.
 * 3. Handles 401 Unauthorized responses by redirecting to /login.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if request is targeting our internal backend API
  const isApiRequest = req.url.startsWith('/api') || req.url.includes('/api/');
  const isS3Request = req.url.includes('s3.amazonaws.com') || req.url.includes('X-Amz-Signature');

  let modifiedReq = req;

  if (isApiRequest && !isS3Request) {
    const token = authService.getAccessToken();
    if (token) {
      modifiedReq = req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      });
    }
  }

  return next(modifiedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        console.warn('🔒 [AuthInterceptor] 401 Unauthorized received. Redirecting to login.');
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};

