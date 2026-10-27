import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=express(),server=createServer(app),io=new Server(server,{cors:{origin:false}});
const here=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here,'public'),{maxAge:0}));
const PORT=process.env.PORT||3000,PIN=process.env.TEACHER_PIN||'1234';
let players=new Map(),tokens=new Map(),recovery=new Map();
let phase='lobby',round=0,deadline=0,timer=null,result=null,admissionOpen=true;
const newCode=()=>String(crypto.randomInt(100000,1000000));
let classCode=newCode();
let questions=[{text:'He has went to school. (This sentence is grammatically correct.)',answer:'X',explanation:'Present perfect: has gone, not has went.'},{text:'“Since 2020” can be used with the present perfect tense.',answer:'O',explanation:'Since introduces a starting point.'},{text:'“Quickly” is an adjective.',answer:'X',explanation:'Quickly is an adverb.'}];
const colors=['#f3b46a','#b6a1e8','#80c7bc','#f18eaa','#82a9ed','#e7c66e'];
function clean(s,n=30){return String(s??'').trim().slice(0,n).replace(/[<>]/g,'');}
function publicPlayer({id,name,x,y,color,alive,connected}){return {id,name,x,y,color,alive,connected};}
function state(){return {players:[...players.values()].filter(p=>p.connected).map(publicPlayer),phase,round,question:{text:questions[round%questions.length].text},deadline,count:questions.length,result,admissionOpen,registeredCount:players.size};}
function teacherState(){return {code:classCode,admissionOpen,registeredCount:players.size,connectedCount:[...players.values()].filter(p=>p.connected).length,roster:[...players.values()].map(publicPlayer)};}
function broadcast(){io.emit('state',state());io.to('teachers').emit('teacher_state',teacherState());}
function clearTimer(){if(timer)clearTimeout(timer);timer=null;}
function resetGame(){clearTimer();phase='lobby';round=0;deadline=0;result=null;for(const p of players.values())p.alive=true;io.emit('result',null);}
function reveal(){if(phase!=='moving')return;clearTimer();phase='result';deadline=0;const q=questions[round%questions.length];for(const p of players.values())if(p.alive&&(p.x<50?'O':'X')!==q.answer)p.alive=false;result={answer:q.answer,explanation:q.explanation};io.emit('result',result);broadcast();}
function detach(p,event,message){const peer=io.sockets.sockets.get(p.socketId);if(peer){delete peer.data.playerId;peer.leave('players');peer.emit(event,{message});}p.socketId=null;p.connected=false;}
function removePlayer(p){detach(p,'forced_exit','선생님이 입장을 취소했습니다. 재입장이 필요하면 선생님께 문의하세요.');tokens.delete(p.token);players.delete(p.id);for(const [code,r] of recovery)if(r.id===p.id)recovery.delete(code);}
function clearClass(){for(const p of players.values())detach(p,'forced_exit','새 반이 시작되었습니다. 선생님께 새 입장코드를 확인하세요.');players.clear();tokens.clear();recovery.clear();resetGame();let code;do{code=newCode();}while(code===classCode);classCode=code;admissionOpen=true;}
function attach(socket,p,ack){if(p.connected&&p.socketId!==socket.id)detach(p,'session_replaced','다른 창에서 다시 연결되었습니다. 이 창은 입장 화면으로 돌아갑니다.');p.connected=true;p.socketId=socket.id;socket.data.playerId=p.id;socket.join('players');ack({id:p.id,token:p.token,name:p.name});broadcast();}
io.on('connection',socket=>{
 socket.emit('state',state());
 socket.on('join',(data={},ack)=>{
  if(typeof ack!=='function')return;
  const {name,token,code}=data||{};
  const current=players.get(socket.data.playerId);
  if(current){ack({id:current.id,token:current.token,name:current.name});return;}
  // A private browser credential, never broadcast, restores the existing roster entry.
  const id=typeof token==='string'?tokens.get(token):null;
  if(id&&players.has(id))return attach(socket,players.get(id),ack);
  const supplied=clean(code,12);
  const pass=recovery.get(supplied);
  if(pass&&pass.expires>Date.now()&&players.has(pass.id)){
   const p=players.get(pass.id);recovery.delete(supplied);tokens.delete(p.token);
   p.token=crypto.randomBytes(32).toString('hex');tokens.set(p.token,p.id);
   return attach(socket,p,ack);
  }
  if(pass)recovery.delete(supplied);
  if(!admissionOpen)return ack({error:'입장이 마감되었습니다. 기존 참가자는 같은 브라우저에서 다시 접속하거나 선생님께 재입장코드를 요청하세요.',reason:'closed'});
  if(supplied!==classCode)return ack({error:'선생님이 알려준 현재 반의 6자리 입장코드를 입력하세요.',reason:'code'});
  const nickname=clean(name,16);if(!nickname)return ack({error:'닉네임을 입력하세요.'});
  const p={id:crypto.randomUUID(),token:crypto.randomBytes(32).toString('hex'),name:nickname,x:Math.random()*80+10,y:Math.random()*65+18,color:colors[players.size%colors.length],alive:true,connected:false};
  players.set(p.id,p);tokens.set(p.token,p.id);attach(socket,p,ack);
 });
 socket.on('auth',({pin}={},ack)=>{if(typeof ack!=='function')return;if(String(pin)!==PIN)return ack({error:'PIN이 맞지 않습니다.'});socket.data.teacher=true;socket.join('teachers');ack({ok:true,questions,room:teacherState()});broadcast();});
 socket.on('move',({dx,dy}={})=>{const p=players.get(socket.data.playerId);if(!p||p.socketId!==socket.id||!p.alive||!['lobby','moving'].includes(phase))return;const now=Date.now();if(now-(socket.data.lastMove||0)<35)return;socket.data.lastMove=now;dx=Number(dx)||0;dy=Number(dy)||0;if(!Number.isFinite(dx)||!Number.isFinite(dy))return;const mag=Math.hypot(dx,dy);if(!mag)return;p.x=Math.max(3,Math.min(97,p.x+dx/mag*2));p.y=Math.max(8,Math.min(92,p.y+dy/mag*2));broadcast();});
 socket.on('teacher',({action,seconds,items,id}={},ack)=>{
  const reply=v=>{if(typeof ack==='function')ack(v);};
  if(!socket.data.teacher)return reply({error:'교사 로그인이 필요합니다.'});
  if(action==='lock')admissionOpen=false;
  else if(action==='unlock')admissionOpen=true;
  else if(action==='new_class')clearClass();
  else if(action==='clear_players'){clearClass();admissionOpen=false;}
  else if(action==='remove'){
   const p=players.get(id);if(!p)return reply({error:'학생을 찾을 수 없습니다.'});removePlayer(p);
  }else if(action==='recovery'){
   const p=players.get(id);if(!p)return reply({error:'학생을 찾을 수 없습니다.'});
   for(const [c,r] of recovery)if(r.id===id)recovery.delete(c);
   let code;do{code=String(crypto.randomInt(10000000,100000000));}while(recovery.has(code));
   recovery.set(code,{id,expires:Date.now()+10*60*1000});
   return reply({ok:true,code,name:p.name,minutes:10});
  }else if(action==='start'&&['lobby','result'].includes(phase)){
   clearTimer();phase='moving';result=null;const sec=Math.max(5,Math.min(60,Number(seconds)||15));deadline=Date.now()+sec*1000;timer=setTimeout(reveal,sec*1000);io.emit('result',null);
  }else if(action==='reveal'){reveal();return reply({ok:true});}
  else if(action==='next'&&phase==='result'){round++;phase='lobby';result=null;io.emit('result',null);}
  else if(action==='revive'){for(const p of players.values())p.alive=true;}
  else if(action==='reset')resetGame();
  else if(action==='questions'&&Array.isArray(items)){
   const valid=items.slice(0,100).map(q=>({text:clean(q.text,250),answer:q.answer==='O'?'O':'X',explanation:clean(q.explanation,350)})).filter(q=>q.text);
   if(!valid.length)return reply({error:'유효한 문제가 없습니다.'});questions=valid;resetGame();
  }else return reply({error:'현재 상태에서는 실행할 수 없습니다.'});
  broadcast();reply({ok:true});
 });
 socket.on('disconnect',()=>{const p=players.get(socket.data.playerId);if(p&&p.socketId===socket.id){p.connected=false;p.socketId=null;broadcast();}});
});
app.get('/health',(req,res)=>res.json({ok:true,players:[...players.values()].filter(p=>p.connected).length}));
server.listen(PORT,()=>console.log('OX game listening on '+PORT));
