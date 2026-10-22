import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const app=express(),server=createServer(app),io=new Server(server,{cors:{origin:false}});
const here=path.dirname(fileURLToPath(import.meta.url));
app.use(express.static(path.join(here,'public')));
app.get('/',(req,res)=>res.sendFile(path.join(here,'public','index.html')));
const PORT=process.env.PORT||3000, PIN=process.env.TEACHER_PIN||'1234';
let players=new Map(), phase='lobby', round=0, deadline=0, timer=null;
let questions=[{text:'He has went to school. (This sentence is grammatically correct.)',answer:'X',explanation:'Present perfect: has gone, not has went.'},{text:'“Since 2020” can be used with the present perfect tense.',answer:'O',explanation:'Since introduces a starting point.'},{text:'“Quickly” is an adjective.',answer:'X',explanation:'Quickly is an adverb.'}];
const colors=['#f3b46a','#b6a1e8','#80c7bc','#f18eaa','#82a9ed','#e7c66e'];
function clean(s,n=30){return String(s??'').trim().slice(0,n).replace(/[<>]/g,'');}
function state(){return {players:[...players.values()].filter(p=>p.connected).map(({id,name,x,y,color,alive,connected})=>({id,name,x,y,color,alive,connected})),phase,round,question:questions[round%questions.length]&&{text:questions[round%questions.length].text},deadline,count:questions.length};}
function broadcast(){io.emit('state',state());}
function clearTimer(){if(timer)clearTimeout(timer);timer=null;}
function reveal(){if(phase!=='moving')return;clearTimer();phase='result';deadline=0;const q=questions[round%questions.length];for(const p of players.values()){if(p.alive){const side=p.x<50?'O':'X';if(side!==q.answer)p.alive=false;}}io.emit('result',{answer:q.answer,explanation:q.explanation});broadcast();}
io.on('connection',socket=>{
 socket.emit('state',state());
 socket.on('join',({name,id}={},ack)=>{
  if(typeof ack!=='function')return;
  name=clean(name,16)||'Student';
  const current=players.get(socket.data.playerId);
  if(current){current.name=name;ack({id:current.id});broadcast();return;}
  let p=id&&players.get(id);
  if(p&&p.connected)return ack({error:'This player is already connected.'});
  if(!p){id=crypto.randomUUID();p={id,name,x:Math.random()*80+10,y:Math.random()*65+18,color:colors[players.size%colors.length],alive:true,connected:true};players.set(id,p);}
  p.connected=true;p.name=name;p.socketId=socket.id;delete p.disconnectedAt;
  socket.data.playerId=p.id;socket.join('players');ack({id:p.id});broadcast();
 });
 socket.on('auth',({pin}={},ack)=>{if(typeof ack!=='function')return;if(String(pin)!==PIN)return ack({error:'Wrong PIN'});socket.data.teacher=true;ack({ok:true,questions});broadcast();});
 socket.on('move',({dx,dy}={})=>{const p=players.get(socket.data.playerId);if(!p||!p.alive||!['lobby','moving'].includes(phase))return;const now=Date.now();if(now-(socket.data.lastMove||0)<35)return;socket.data.lastMove=now;dx=Number(dx)||0;dy=Number(dy)||0;const mag=Math.hypot(dx,dy);if(mag===0)return;p.x=Math.max(3,Math.min(97,p.x+dx/mag*2.0));p.y=Math.max(8,Math.min(92,p.y+dy/mag*2.0));broadcast();});
 socket.on('teacher',({action,seconds,items}={})=>{if(!socket.data.teacher)return;if(action==='clear_players'){
  clearTimer();phase='lobby';round=0;deadline=0;
  for(const peer of io.sockets.sockets.values()){
   if(peer.data.playerId){delete peer.data.playerId;peer.leave('players');peer.emit('forced_exit',{message:'선생님이 학생 전체 퇴장을 실행했습니다. 다시 입장할 수 있어요.'});}
  }
  players.clear();io.emit('result',null);broadcast();
 }else if(action==='start'&&['lobby','result'].includes(phase)){clearTimer();phase='moving';const sec=Math.max(5,Math.min(60,Number(seconds)||15));deadline=Date.now()+sec*1000;timer=setTimeout(reveal,sec*1000);broadcast();}else if(action==='reveal')reveal();else if(action==='next'&&phase==='result'){round++;phase='lobby';io.emit('result',null);broadcast();}else if(action==='revive'){for(const p of players.values())p.alive=true;broadcast();}else if(action==='reset'){clearTimer();round=0;phase='lobby';deadline=0;for(const p of players.values())p.alive=true;io.emit('result',null);broadcast();}else if(action==='questions'&&Array.isArray(items)){const valid=items.slice(0,100).map(q=>({text:clean(q.text,250),answer:q.answer==='O'?'O':'X',explanation:clean(q.explanation,350)})).filter(q=>q.text);if(valid.length){clearTimer();questions=valid;round=0;phase='lobby';deadline=0;for(const p of players.values())p.alive=true;io.emit('result',null);broadcast();}}});
 socket.on('disconnect',()=>{const p=players.get(socket.data.playerId);if(p&&p.socketId===socket.id){p.connected=false;p.disconnectedAt=Date.now();broadcast();}});
});
// Keep reconnect state briefly, then remove abandoned records automatically.
setInterval(()=>{const cutoff=Date.now()-30*60*1000;for(const [id,p] of players){if(!p.connected&&p.disconnectedAt<cutoff)players.delete(id);}},60*1000).unref();
app.get('/health',(req,res)=>res.json({ok:true,players:[...players.values()].filter(p=>p.connected).length}));
server.listen(PORT,()=>console.log('OX game listening on '+PORT));
