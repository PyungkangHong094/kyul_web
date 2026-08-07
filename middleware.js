/* Vercel Edge Middleware — 메타태그 지역화.
   한국(KR IP) 또는 한국어 브라우저면 한글 메타 버전(*.ko.html)으로 리라이트한다.
   URL 은 그대로라서 카카오톡 크롤러(한국 IP)는 한글 카드, 페북·트위터(해외 IP)는 영어 카드를 본다.
   ?hl=ko / ?hl=en 쿼리로 강제 지정 가능 (테스트·공유용). */
export const config = { matcher: ['/', '/kyul'] };

export default function middleware(req) {
  const url = new URL(req.url);
  const hl = url.searchParams.get('hl');
  const country = (req.headers.get('x-vercel-ip-country') || '').toUpperCase();
  const acceptKo = /^\s*ko/i.test(req.headers.get('accept-language') || '');
  const ko = hl ? hl === 'ko' : (country === 'KR' || acceptKo);
  if (!ko) return;
  /* cleanUrls 라서 .html 내부 경로는 404 — 클린 URL(/index.ko, /kyul.ko)로 리라이트 */
  url.pathname = url.pathname === '/' ? '/index.ko' : `${url.pathname}.ko`;
  return new Response(null, { headers: { 'x-middleware-rewrite': url.toString() } });
}
