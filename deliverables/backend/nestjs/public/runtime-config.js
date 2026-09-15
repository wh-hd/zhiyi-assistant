// 由后端 NestJS 直接托管时（http://localhost:3000），使用同源相对路径，
// 避免 Helmet CSP（connect-src 'self'）与 CORS 拦截。
window.ZHIYI_CONFIG = Object.freeze({
  environment: 'development',
  apiBaseUrl: '/v1',
  allowDevIdentity: true,
  uploadEnabled: false,
});
