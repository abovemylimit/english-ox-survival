const s=io(),$=x=>document.getElementById(x);let authenticatedPin=null;
function authenticate(pin){s.timeout(8000).emit('auth',{pin},(err,r)=>{if(err||r.error){$('autherror').textContent=err?'연결을 확인하고 다시 시도하세요.':r.error;$('auth').hidden=false;$('admin').hidden=true;authenticatedPin=null;return;}authenticatedPin=pin;$('auth').hidden=true;$('admin').hidden=false;$('autherror').textContent='';$('questions').value=r.questions.map(q=>[q.text,q.answer,q.explanation].join(' | ')).join('\n');renderRoom(r.room);});}
$('unlock').onclick=()=>authenticate($('pin').value);
$('pin').addEventListener('keydown',e=>{if(e.key==='Enter')authenticate($('pin').value);});
s.on('connect',()=>{$('connection').textContent='🟢 연결됨';document.querySelectorAll('#admin button').forEach(b=>b.disabled=false);if(authenticatedPin)authenticate(authenticatedPin);});
s.on('disconnect',()=>{$('connection').textContent='🔴 다시 연결 중';document.querySelectorAll('#admin button').forEach(b=>b.disabled=true);});
function command(action,extra={},onSuccess){s.timeout(8000).emit('teacher',{action,seconds:$('seconds').value,...extra},(err,r)=>{if(err||r.error){$('notice').textContent=err?'연결을 확인하고 다시 시도하세요.':r.error;return;}$('notice').textContent='완료되었습니다.';if(onSuccess)onSuccess(r);});}
document.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
 const a=b.dataset.action;
 if(a==='new_class'&&!confirm('기존 학생의 입장 권한을 지우고 새 코드를 발급할까요? 문제는 유지됩니다.'))return;
 if(a==='clear_players'&&!confirm('학생 전체를 퇴장시키고 입장을 마감할까요? 문제는 유지되며, 다시 입장하려면 새 코드를 알려줘야 합니다.'))return;
 if(a==='new_class'||a==='clear_players')$('recoveryinfo').textContent='';
 command(a);
});
$('save').onclick=()=>{const items=$('questions').value.split('\n').map(line=>{const [text,answer,explanation='']=line.split('|').map(x=>x.trim());return{text,answer,explanation};}).filter(q=>q.text&&['O','X'].includes(q.answer));if(!items.length)return alert('유효한 문제를 입력하세요.');command('questions',{items},()=>alert(Math.min(items.length,100)+'문제 저장!'));};
function renderRoom(v){
 $('classcode').textContent=v.code;$('admission').textContent=v.admissionOpen?'🟢 입장 가능':'🔒 입장 마감';
 document.querySelector('[data-action="lock"]').disabled=!v.admissionOpen;document.querySelector('[data-action="unlock"]').disabled=v.admissionOpen;
 $('roomsummary').textContent=`등록 ${v.registeredCount}명 · 현재 접속 ${v.connectedCount}명 · 연결 끊김 ${v.registeredCount-v.connectedCount}명`;
 // Reuse unchanged rows: movement updates must not replace a button under the teacher's pointer.
 const signature=JSON.stringify(v.roster.map(p=>[p.id,p.name,p.connected,p.alive]));if($('roster').dataset.signature===signature)return;$('roster').dataset.signature=signature;
 $('roster').replaceChildren();
 for(const p of v.roster){const row=document.createElement('tr');row.dataset.id=p.id;for(const text of [p.name,p.connected?'접속 중':'연결 끊김',p.alive?'생존':'탈락']){const cell=document.createElement('td');cell.textContent=text;row.appendChild(cell);}const actions=document.createElement('td');
 const recover=document.createElement('button');recover.textContent='재입장코드';recover.onclick=()=>command('recovery',{id:p.id},r=>{$('recoveryinfo').textContent=`${r.name} 학생 재입장코드: ${r.code} · ${r.minutes}분 이내 한 번만 사용 가능. 해당 학생에게만 알려주세요.`;});
 const remove=document.createElement('button');remove.textContent='입장 취소';remove.className='danger';remove.onclick=()=>{if(confirm(`${p.name} 학생의 등록을 취소할까요? 이 학생의 기존 재접속 권한도 없어집니다.`))command('remove',{id:p.id},()=>{$('recoveryinfo').textContent='';});};actions.append(recover,remove);row.appendChild(actions);$('roster').appendChild(row);}
}
s.on('teacher_state',renderRoom);
s.on('state',v=>{$('summary').textContent=`${v.phase} · ROUND ${v.round+1} · 접속 ${v.players.length}명 · 생존 ${v.players.filter(p=>p.alive).length}명`;});
