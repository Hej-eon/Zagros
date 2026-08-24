const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const scoreEl=document.getElementById('score'),livesEl=document.getElementById('lives'),timeEl=document.getElementById('time');
const overlay=document.getElementById('overlay'),title=document.getElementById('overlayTitle'),text=document.getElementById('overlayText'),startBtn=document.getElementById('startBtn');
const COLS=15,ROWS=11,TILE=48;let board,player,enemies,bombs,flames,powerups,score,lives,timeLeft,running=false,last=0,timerAcc=0;
const keys={};const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
function resize(){const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();canvas.width=r.width*dpr;canvas.height=r.height*dpr;ctx.setTransform(canvas.width/(COLS*TILE),0,0,canvas.height/(ROWS*TILE),0,0)}
addEventListener('resize',resize);resize();
function free(x,y){return x>0&&x<COLS-1&&y>0&&y<ROWS-1&&!board[y][x].solid&&!board[y][x].brick}
function bombAt(x,y){return bombs.some(b=>b.x===x&&b.y===y)}
function randomFree(minX,minY){for(let i=0;i<100;i++){const x=minX+Math.floor(Math.random()*(COLS-minX-1)),y=minY+Math.floor(Math.random()*(ROWS-minY-1));if(free(x,y)&&!bombAt(x,y))return{x,y}}return{x:COLS-2,y:ROWS-2}}
function reset(){board=Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>({solid:x===0||y===0||x===COLS-1||y===ROWS-1||x%2===0&&y%2===0,brick:false})));for(let y=1;y<ROWS-1;y++)for(let x=1;x<COLS-1;x++)if(!board[y][x].solid&&Math.random()<.42)board[y][x].brick=true;[[1,1],[1,2],[2,1],[COLS-2,ROWS-2],[COLS-2,ROWS-3],[COLS-3,ROWS-2]].forEach(([x,y])=>board[y][x].brick=false);
player={x:1,y:1,px:1,py:1,bombsMax:1,range:1,moveCooldown:0,moveFromX:1,moveFromY:1,moveProgress:1,alive:true};bombs=[];flames=[];powerups=[];enemies=[];for(let i=0;i<4;i++){const p=randomFree(8,5);enemies.push({x:p.x,y:p.y,px:p.x,py:p.y,dir:Math.floor(Math.random()*4),think:0,moveCooldown:0,moveFromX:p.x,moveFromY:p.y,moveProgress:1,alive:true})}score=0;lives=3;timeLeft=120;updateHud()}
function canEnter(x,y,currentX,currentY){if(!free(x,y))return false;return !bombAt(x,y)||(x===currentX&&y===currentY)}
function stepEntity(e,dx,dy){if(!dx&&!dy||e.moveProgress<1)return false;const nx=e.x+dx,ny=e.y+dy;if(!canEnter(nx,ny,e.x,e.y))return false;e.moveFromX=e.px;e.moveFromY=e.py;e.x=nx;e.y=ny;e.moveProgress=0;return true}
function updateVisualPosition(e,dt){if(e.moveProgress<1){e.moveProgress=Math.min(1,e.moveProgress+dt/.105);const t=e.moveProgress;const s=t*t*(3-2*t);e.px=e.moveFromX+(e.x-e.moveFromX)*s;e.py=e.moveFromY+(e.y-e.moveFromY)*s}else{e.px=e.x;e.py=e.y}}
function placeBomb(){if(!running||bombs.filter(b=>b.owner===player).length>=player.bombsMax||bombAt(player.x,player.y))return;bombs.push({x:player.x,y:player.y,t:2.35,owner:player})}
function explode(b){if(!bombs.includes(b))return;bombs=bombs.filter(x=>x!==b);const f={cells:[[b.x,b.y]],t:.45};flames.push(f);for(const[dX,dY]of dirs)for(let n=1;n<=player.range;n++){const x=b.x+dX*n,y=b.y+dY*n;if(board[y][x].solid)break;f.cells.push([x,y]);if(board[y][x].brick){board[y][x].brick=false;if(Math.random()<.3)powerups.push({x,y,type:Math.random()<.5?'range':'bomb'});score+=10;break}}}
function damage(){if(!player.alive)return;player.alive=false;lives--;updateHud();setTimeout(()=>{if(lives<=0)end(false);else{player.alive=true;player.px=player.x=1;player.py=player.y=1}},650)}
function checkCollisions(){const danger=new Set(flames.flatMap(f=>f.cells.map(c=>c.join(','))));if(danger.has(player.x+','+player.y))damage();for(const e of enemies){if(danger.has(e.x+','+e.y))e.alive=false;if(e.alive&&e.x===player.x&&e.y===player.y)damage()}enemies=enemies.filter(e=>e.alive);for(const p of powerups)if(p.x===player.x&&p.y===player.y){score+=50;if(p.type==='range')player.range++;else player.bombsMax++;p.taken=true}powerups=powerups.filter(p=>!p.taken)}
function update(dt){if(!running)return;timerAcc+=dt;if(timerAcc>=1){timerAcc-=1;timeLeft--;updateHud();if(timeLeft<=0)end(false)}
if(player.alive){
  updateVisualPosition(player,dt);
  player.moveCooldown-=dt;
  if(player.moveCooldown<=0){
    let dx=(keys.ArrowRight||keys.d)?1:(keys.ArrowLeft||keys.a)?-1:0;
    let dy=(keys.ArrowDown||keys.s)?1:(keys.ArrowUp||keys.w)?-1:0;
    if(dx&&dy)dy=0;
    if(stepEntity(player,dx,dy))player.moveCooldown=.13;
    else if(dx||dy)player.moveCooldown=.08;
  }
}
for(const e of enemies){
  updateVisualPosition(e,dt);
  e.think-=dt;e.moveCooldown-=dt;
  if(e.moveCooldown<=0){
    if(e.think<=0){
      const options=dirs.map((d,i)=>({d,i,x:e.x+d[0],y:e.y+d[1]})).filter(o=>free(o.x,o.y)&&!bombAt(o.x,o.y));
      if(options.length){
        if(Math.random()<0.2&&player.alive){
          options.sort((a,b)=>(Math.abs(a.x-player.x)+Math.abs(a.y-player.y))-(Math.abs(b.x-player.x)+Math.abs(b.y-player.y)));
          e.dir=options[0].i;
        }else e.dir=options[Math.floor(Math.random()*options.length)].i;
        e.think=.9+Math.random()*1.4;
      }else e.think=.25;
    }
    const[dX,dY]=dirs[e.dir];
    if(stepEntity(e,dX,dY))e.moveCooldown=.18;
    else {e.think=0;e.moveCooldown=.08;}
  }
}
for(const b of [...bombs]){b.t-=dt;if(b.t<=0)explode(b)}for(const f of flames)f.t-=dt;flames=flames.filter(f=>f.t>0);for(const b of [...bombs])if(flames.some(f=>f.cells.some(c=>c[0]===b.x&&c[1]===b.y)))explode(b);checkCollisions();if(enemies.length===0)end(true)}
function end(win){running=false;title.textContent=win?'ARENA CLEARED':'GAME OVER';text.textContent=(win?'Final score: ':'Final score: ')+score+'. '+(win?'The Zagros arena is yours.':'Survive longer next run.');startBtn.textContent='PLAY AGAIN';overlay.classList.remove('hidden')}
function updateHud(){scoreEl.textContent=score;livesEl.textContent=lives;timeEl.textContent=timeLeft}
function draw(){ctx.clearRect(0,0,COLS*TILE,ROWS*TILE);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){ctx.fillStyle=(x+y)%2?'#20352d':'#1b3029';ctx.fillRect(x*TILE,y*TILE,TILE,TILE);if(board[y][x].solid){ctx.fillStyle='#3b4a3d';ctx.fillRect(x*TILE+1,y*TILE+1,TILE-2,TILE-2);ctx.fillStyle='#64705b';ctx.fillRect(x*TILE+5,y*TILE+5,TILE-10,6);ctx.fillStyle='#2a342d';ctx.fillRect(x*TILE+5,y*TILE+32,TILE-10,6);ctx.fillRect(x*TILE+8,y*TILE+12,5,17);ctx.fillRect(x*TILE+35,y*TILE+12,5,17)}else if(board[y][x].brick){ctx.fillStyle='#9a5b28';ctx.fillRect(x*TILE+3,y*TILE+3,TILE-6,TILE-6);ctx.fillStyle='#c4873b';ctx.fillRect(x*TILE+7,y*TILE+7,TILE-14,5)}}for(const p of powerups){ctx.fillStyle=p.type==='range'?'#2ca58d':'#e4b43c';ctx.beginPath();ctx.arc(p.x*TILE+24,p.y*TILE+24,10,0,Math.PI*2);ctx.fill();ctx.fillStyle='#07111f';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText(p.type==='range'?'R':'B',p.x*TILE+24,p.y*TILE+29)}for(const b of bombs){ctx.fillStyle='#161a18';ctx.beginPath();ctx.arc(b.x*TILE+24,b.y*TILE+27,14,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e4b43c';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x*TILE+32,b.y*TILE+15);ctx.lineTo(b.x*TILE+38,b.y*TILE+7);ctx.stroke()}for(const f of flames){ctx.fillStyle='#d96b27';for(const[cx,cy]of f.cells){ctx.fillRect(cx*TILE+7,cy*TILE+7,TILE-14,TILE-14);ctx.fillStyle='#f0c04a';ctx.fillRect(cx*TILE+15,cy*TILE+15,TILE-30,TILE-30);ctx.fillStyle='#d96b27'}}for(const e of enemies){ctx.fillStyle='#8d2f36';ctx.beginPath();ctx.arc(e.px*TILE+24,e.py*TILE+25,15,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.fillRect(e.px*TILE+15,e.py*TILE+19,5,5);ctx.fillRect(e.px*TILE+28,e.py*TILE+19,5,5)}if(player.alive){ctx.fillStyle='#f0d7a1';ctx.beginPath();ctx.arc(player.px*TILE+24,player.py*TILE+24,16,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e4b43c';ctx.fillRect(player.px*TILE+12,player.py*TILE+31,24,5)}}
function loop(t){const dt=Math.min((t-last)/1000,.05);last=t;update(dt);draw();requestAnimationFrame(loop)}requestAnimationFrame(loop);
addEventListener('keydown',e=>{keys[e.key]=true;if(e.code==='Space'){e.preventDefault();placeBomb()}});addEventListener('keyup',e=>keys[e.key]=false);
document.querySelectorAll('[data-key]').forEach(b=>{const k=b.dataset.key;b.addEventListener('pointerdown',e=>{e.preventDefault();keys[k]=true;if(k==='Space')placeBomb()});b.addEventListener('pointerup',()=>keys[k]=false);b.addEventListener('pointerleave',()=>keys[k]=false)});
function startGame(){try{reset();running=true;overlay.classList.add('hidden');last=performance.now();}catch(err){console.error('Zagros start error:',err);text.textContent='Game error: '+err.message;}}
startBtn.addEventListener('click',startGame);startBtn.addEventListener('pointerup',startGame);addEventListener('keydown',e=>{if(e.key==='Enter'&& !running)startGame()});reset();draw();