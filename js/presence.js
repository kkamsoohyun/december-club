/* 다른 접속자와 위치 주고받기
   - Supabase 키가 있으면 Supabase Realtime(브로드캐스트 + 접속 상태)으로 모든 접속자와
   - 없으면 같은 브라우저의 다른 탭끼리만 (로컬에서 시험해 볼 때)
   위치는 저장하지 않고 흘려보내기만 함 */
import { SUPABASE } from './config.js';

const SB_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
export const myId = Math.random().toString(36).slice(2, 10);   // 이번 접속(탭) 하나를 가리키는 이름

/**
 * @param {{ no:number, onPos:(m:object)=>void, onThrow:(m:object)=>void, onLeave:(id:string)=>void, onJoin:()=>void }} h
 * @returns {Promise<{ send:(msg:object)=>void, emit:(event:string, msg:object)=>void }>} 위치 보내기 / 눈 던지기 같은 일 알리기
 */
export async function connect({ no, onPos, onThrow, onLeave, onJoin }) {
  const none = { send() {}, emit() {} };
  if (SUPABASE.url && SUPABASE.anonKey) {
    try {
      const { createClient } = await import(SB_JS);
      const sb = createClient(SUPABASE.url, SUPABASE.anonKey, {
        auth: { persistSession: false },
        realtime: { params: { eventsPerSecond: 10 } },
      });
      const ch = sb.channel('december-village', {
        config: { broadcast: { self: false }, presence: { key: myId } },
      });
      let ready = false;
      ch.on('broadcast', { event: 'pos' }, ({ payload }) => payload && payload.id !== myId && onPos(payload));
      ch.on('broadcast', { event: 'throw' }, ({ payload }) => payload && payload.id !== myId && onThrow(payload));
      ch.on('broadcast', { event: 'bye' }, ({ payload }) => payload && onLeave(payload.id));
      ch.on('presence', { event: 'leave' }, ({ key }) => onLeave(key));
      ch.on('presence', { event: 'join' }, ({ key }) => { if (key !== myId) onJoin(); });
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') { ready = true; ch.track({ no }); onJoin(); }
        else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') ready = false;
      });
      addEventListener('pagehide', () => { ch.send({ type: 'broadcast', event: 'bye', payload: { id: myId } }); });
      return {
        send: (msg) => { if (ready) ch.send({ type: 'broadcast', event: 'pos', payload: msg }); },
        emit: (event, msg) => { if (ready) ch.send({ type: 'broadcast', event, payload: msg }); },
      };
    } catch (e) {
      console.warn('실시간 연결 실패 — 혼자 걷기로 계속', e);
      return none;
    }
  }

  // 로컬 시험용: 같은 브라우저 탭끼리
  if (!('BroadcastChannel' in window)) return none;
  const bc = new BroadcastChannel('december-village');
  bc.onmessage = ({ data }) => {
    if (!data || data.id === myId) return;
    if (data.type === 'bye') onLeave(data.id);
    else if (data.type === 'hello') onJoin();
    else if (data.type === 'throw') onThrow(data);
    else onPos(data);
  };
  addEventListener('pagehide', () => bc.postMessage({ type: 'bye', id: myId }));
  bc.postMessage({ type: 'hello', id: myId });
  return {
    send: (msg) => bc.postMessage(msg),
    emit: (event, msg) => bc.postMessage({ ...msg, type: event }),
  };
}
