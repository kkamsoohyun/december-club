/* Supabase 연결 정보 (Supabase → Project Settings → API)
   - url: Project URL
   - anonKey: anon public 키 (웹페이지에 공개해도 되는 키 — service_role 키는 절대 넣지 말 것)
   비워 두면: server.py 로 열었을 땐 그 서버를, 아니면 이 브라우저에만 저장하는 혼자 모드를 씀 */
export const SUPABASE = {
  url: '',
  anonKey: '',
};
