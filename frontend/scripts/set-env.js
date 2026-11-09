/**
 * Environment Synchronizer for Angular
 * Reads variables from .env or process.env (Vercel/CI/CD) and updates:
 * 1. src/environments/environment.ts
 * 2. src/environments/environment.prod.ts
 * 3. vercel.json rewrites
 */
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env');

// Read .env if present
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valParts] = trimmed.split('=');
      const val = valParts.join('=').trim().replace(/(^["']|["']$)/g, '');
      if (key && !process.env[key.trim()]) {
        process.env[key.trim()] = val;
      }
    }
  });
}

const apiGatewayUrl = process.env.API_GATEWAY_URL || 'http://localhost:8080';
const cognitoRegion = process.env.COGNITO_REGION || '';
const cognitoClientId = process.env.COGNITO_CLIENT_ID || '';

console.log(`⚙️ [Config] API Gateway Proxy: ${apiGatewayUrl}`);
console.log(`⚙️ [Config] Cognito Region: ${cognitoRegion ? cognitoRegion : '(Not configured - Dev mode only)'}`);
console.log(`⚙️ [Config] Cognito Client ID: ${cognitoClientId ? cognitoClientId : '(Not configured - Dev mode only)'}`);

// 1. Generate environment.ts (Development)
const devEnvContent = `export const environment = {
  production: false,
  apiBaseUrl: '/api',
  cognito: {
    region: '${cognitoRegion}',
    clientId: '${cognitoClientId}'
  }
};
`;
fs.writeFileSync(path.join(rootDir, 'src/environments/environment.ts'), devEnvContent);

// 2. Generate environment.prod.ts (Production)
const prodEnvContent = `export const environment = {
  production: true,
  apiBaseUrl: '/api',
  cognito: {
    region: '${cognitoRegion}',
    clientId: '${cognitoClientId}'
  }
};
`;
fs.writeFileSync(path.join(rootDir, 'src/environments/environment.prod.ts'), prodEnvContent);

// 3. Update vercel.json rewrites
const vercelConfigPath = path.join(rootDir, 'vercel.json');
const vercelConfig = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  cleanUrls: true,
  rewrites: [
    {
      source: '/api/:path*',
      destination: `${apiGatewayUrl.replace(/\/+$/, '')}/api/:path*`
    },
    {
      source: '/(.*)',
      destination: '/index.html'
    }
  ]
};
fs.writeFileSync(vercelConfigPath, JSON.stringify(vercelConfig, null, 2) + '\n');

console.log('✅ [Config] Environments and vercel.json successfully synchronized.');

