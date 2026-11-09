export default {};
export const readFileSync = () => null;
export const existsSync = () => false;
export const statSync = () => null;
export const resolve = (...args: string[]) => args.join('/');
export const join = (...args: string[]) => args.join('/');
export const dirname = (p: string) => p;
export const basename = (p: string) => p;
export const extname = (p: string) => '';
export const URL = typeof window !== 'undefined' ? window.URL : null;

