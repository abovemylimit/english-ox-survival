import express from 'express';
import {createServer} from 'node:http';
import {Server} from 'socket.io';
import crypto from 'node:crypto';
const app=express(),server=createServer(app),io=new Server(server,{cors:{origin:false}});
app.use(express.static('public'));
const PORT=process.env.PORT||3000, PIN=process.env.TEACHER_PIN||'1234';
let players=new Map(), phase='lobby', round=0, deadline=0, timer=null;
let questions=[{text:'He has went to school. (This sentence is grammatically correct.)',answer:'X',explanation:'Present perfect: has gone, not has went.'},{text:'“Since 2020” can be used with the present perfect tense.',answer:'O',explanation:'Since introduces a starting point.'},{text:'“Quickly” is an adjective.',answer:'X',explanation:'Quickly is an adverb.'}];
const colors=['#f3b46a','#b6a1e8','#80c7bc','#f18eaa','#82a9ed','#e7c66e'];
function clean(s,n=30){return String(s??'').trim().slice(0,n).replace(/[<>]/g,'');}
function state(){return {players:[...players.values()].map(({id,name,x,y,color,alive,connected})=>({id,name,x,y,color,alive,connected})),phase,round,question:questions[round%questions.length]&&{text:questions[round%questions.length].text},deadline,count:questions.length};}
function broadcast(){io.emit('state',state());}
function clearTimer(){if(timer)clearTimeout(timer);timer=null;}
function reveal(){if(phase!=='moving')return;clearTimer();phase='result';deadline=0;const q=questions[round%questions.length];for(const p of players.values()){if(p.alive){const side=p.x<50?'O':'X';if(side!==q.answer)p.alive=false;}}io.emit('result',{answer:q.answer,explanation:q.explanation});broadcast();}
io.on('connection',socket=>{
 socket.on('join',({name,id}={},ack)=>{if(typeof ack!=='function')return;name=clean(name,16)||'Student';let p=id&&players.get(id);if(p&&p.connected)return ack({error:'This player is already connected.'});if(!p){if(players.size>=30)return ack({error:'Room full (30 players).'});id=crypto.randomUUID();p={id,name,x:Math.random()*80+10,y:Math.random()*65+18,color:colors[players.size%colors.length],alive:true,connected:true};players.set(id,p);}p.connected=true;p.name=name;socket.data.playerId=id;socket.join('players');ack({id});broadcast();});
 socket.on('auth',({pin}={},ack)=>{if(typeof ack!=='function')return;if(String(pin)!==PIN)return ack({error:'Wrong PIN'});socket.data.teacher=true;ack({ok:true,questions});broadcast();});
 socket.on('move',({dx,dy}={})=>{const p=players.get(socket.data.playerId);if(!p||!p.alive||!['lobby','moving'].includes(phase))return;const now=Date.now();if(now-(socket.data.lastMove||0)<35)return;socket.data.lastMove=now;dx=Number(dx)||0;dy=Number(dy)||0;const mag=Math.hypot(dx,dy);if(mag===0)return;p.x=Math.max(3,Math.min(97,p.x+dx/mag*2.0));p.y=Math.max(8,Math.min(92,p.y+dy/mag*2.0));broadcast();});
 socket.on('teacher',({action,seconds,items}={})=>{if(!socket.data.teacher)return;if(action==='start'&&['lobby','result'].includes(phase)){clearTimer();phase='moving';const sec=Math.max(5,Math.min(60,Number(seconds)||15));deadline=Date.now()+sec*1000;timer=setTimeout(reveal,sec*1000);broadcast();}else if(action==='reveal')reveal();else if(action==='next'&&phase==='result'){round++;phase='lobby';io.emit('result',null);broadcast();}else if(action==='revive'){for(const p of players.values())p.alive=true;broadcast();}else if(action==='reset'){clearTimer();round=0;phase='lobby';deadline=0;for(const p of players.values())p.alive=true;io.emit('result',null);broadcast();}else if(action==='questions'&&Array.isArray(items)){const valid=items.slice(0,100).map(q=>({text:clean(q.text,250),answer:q.answer==='O'?'O':'X',explanation:clean(q.explanation,350)})).filter(q=>q.text);if(valid.length){clearTimer();questions=valid;round=0;phase='lobby';deadline=0;for(const p of players.values())p.alive=true;io.emit('result',null);broadcast();}}});
 socket.on('disconnect',()=>{const id=socket.data.playerId;if(id&&players.has(id)){players.get(id).connected=false;broadcast();}});
});
app.get('/health',(req,res)=>res.json({ok:true,players:players.size}));
server.listen(PORT,()=>console.log('OX game listening on '+PORT));
