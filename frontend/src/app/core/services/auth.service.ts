import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuthUser {
  email: string;
  name: string;
  role: 'Radiologist' | 'Physician' | 'Admin';
  idToken: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  isDevMode?: boolean;
}

interface CognitoAuthResponse {
  AuthenticationResult?: {
    AccessToken: string;
    ExpiresIn: number;
    IdToken: string;
    RefreshToken?: string;
    TokenType: string;
  };
  ChallengeName?: string;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly STORAGE_KEY = 'dicom_auth_session';

  // State Signals
  readonly currentUser = signal<AuthUser | null>(this.loadStoredUser());
  readonly user = this.currentUser.asReadonly();
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Computed Selectors
  readonly isAuthenticated = computed(() => {
    const user = this.currentUser();
    if (!user) return false;
    return user.expiresAt > Date.now();
  });

  readonly userRole = computed(() => this.currentUser()?.role ?? 'Guest');
  readonly userName = computed(() => this.currentUser()?.name ?? 'Anonymous');

  /**
   * Restores session from localStorage on application startup
   */
  private loadStoredUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return null;

      const user: AuthUser = JSON.parse(data);
      if (user.expiresAt <= Date.now()) {
        localStorage.removeItem(this.STORAGE_KEY);
        return null;
      }
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Authenticates against real AWS Cognito User Pool via standard REST API (USER_PASSWORD_AUTH).
   * Zero external dependencies.
   */
  loginWithCognito(email: string, password: string): Observable<AuthUser> {
    this.loading.set(true);
    this.error.set(null);

    const region = environment.cognito?.region;
    const clientId = environment.cognito?.clientId;

    if (!region || !clientId) {
      this.loading.set(false);
      const errMsg = 'AWS Cognito is not configured (missing COGNITO_REGION or COGNITO_CLIENT_ID in .env).';
      this.error.set(errMsg);
      return throwError(() => new Error(errMsg));
    }

    const endpoint = `https://cognito-idp.${region}.amazonaws.com/`;

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth'
    });

    const payload = {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: clientId,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password
      }
    };

    return this.http.post<CognitoAuthResponse>(endpoint, payload, { headers }).pipe(
      map((res) => {
        if (!res.AuthenticationResult) {
          throw new Error(res.message || 'Authentication challenge required or unexpected response');
        }

        const auth = res.AuthenticationResult;
        const decoded = this.parseJwt(auth.IdToken) || {};
        const name = decoded.name || decoded['cognito:username'] || email.split('@')[0];

        // Role is extracted strictly from Cognito Groups / Claims, NEVER self-assigned
        const groups: string[] = decoded['cognito:groups'] || [];
        let role: 'Radiologist' | 'Physician' | 'Admin' = 'Radiologist';
        if (groups.includes('Admins') || groups.includes('Admin')) {
          role = 'Admin';
        } else if (groups.includes('Physicians') || groups.includes('Physician')) {
          role = 'Physician';
        }

        const user: AuthUser = {
          email,
          name,
          role,
          idToken: auth.IdToken,
          accessToken: auth.AccessToken,
          refreshToken: auth.RefreshToken,
          expiresAt: Date.now() + auth.ExpiresIn * 1000,
          isDevMode: false
        };

        this.persistUser(user);
        this.loading.set(false);
        return user;
      }),
      catchError((err) => {
        this.loading.set(false);
        const message = err.error?.message || err.message || 'Cognito authentication failed';
        this.error.set(message);
        return throwError(() => new Error(message));
      })
    );
  }

  /**
   * Local Developer Bypass Mode:
   * Enables seamless local workstation development and testing without internet or active AWS account.
   */
  devLogin(email: string, role: 'Radiologist' | 'Physician' | 'Admin' = 'Radiologist'): AuthUser {
    const user: AuthUser = {
      email,
      name: email.split('@')[0],
      role,
      idToken: `dev-id-token-${Date.now()}`,
      accessToken: `dev-access-token-${Date.now()}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      isDevMode: true
    };

    this.persistUser(user);
    this.error.set(null);
    return user;
  }

  /**
   * Logs out user, invalidates tokens, and clears storage.
   */
  logout(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    this.currentUser.set(null);
  }

  /**
   * Returns current access token if not expired.
   */
  getAccessToken(): string | null {
    const user = this.currentUser();
    if (!user || user.expiresAt <= Date.now()) {
      return null;
    }
    return user.accessToken;
  }

  private persistUser(user: AuthUser): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user));
    this.currentUser.set(user);
  }

  /**
   * Decodes JWT payload without external libraries
   */
  private parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }
}
