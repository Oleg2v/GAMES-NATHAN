import test from 'node:test';
import assert from 'node:assert/strict';
import { readViewport, createResumeCountdown } from '../dist/mobile-shell.js';
import { createGame, stepGame } from '../dist/game-core.js';

test('visible viewport wins over stale layout dimensions during iOS rotation', () => {
 assert.deepEqual(readViewport({width:844,height:354,offsetTop:36,offsetLeft:0},390,844), {width:844,height:354,left:0,top:36,landscape:true});
 assert.deepEqual(readViewport(null,390,844), {width:390,height:844,left:0,top:0,landscape:false});
 assert.equal(readViewport({width:0,height:NaN},667,375).landscape,true);
});

function clock() {
 let now=0, next=0; const timers=new Map();
 return { setTimer(fn,delay){ const id=++next;timers.set(id,{fn,at:now+delay});return id; },clearTimer(id){timers.delete(id);},
  advance(ms){const end=now+ms;while(true){const first=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!first||first[1].at>end)break;timers.delete(first[0]);now=first[1].at;first[1].fn();}now=end;},
  get pending(){return timers.size;}
 };
}
test('rotation resumes only after a complete 3-2-1 countdown', () => {
 const fake=clock(), ticks=[];let finished=0;
 const countdown=createResumeCountdown({...fake,canResume:()=>true,onTick:n=>ticks.push(n),onFinish:()=>finished++});
 countdown.start();countdown.start(); assert.deepEqual(ticks,[3]);
 fake.advance(2999); assert.deepEqual(ticks,[3,2,1]);assert.equal(finished,0);
 fake.advance(1);assert.equal(finished,1);assert.equal(countdown.active,false);assert.equal(fake.pending,0);
});
test('ten interrupted rotations never resume a stale countdown', () => {
 const fake=clock(),ticks=[];let allowed=true,finished=0;
 const countdown=createResumeCountdown({...fake,canResume:()=>allowed,onTick:n=>ticks.push(n),onFinish:()=>finished++});
 for(let i=0;i<10;i++){allowed=true;countdown.start();fake.advance(650);allowed=false;countdown.cancel();fake.advance(4000);assert.equal(finished,0);assert.equal(fake.pending,0);}
 allowed=true;countdown.start();fake.advance(3000);assert.equal(finished,1);assert.deepEqual(ticks.slice(-3),[3,2,1]);
});
test('backgrounding or cancelling prevents automatic resume', () => {
 const fake=clock();let visible=true,finished=0,cancelled=0;
 const countdown=createResumeCountdown({...fake,canResume:()=>visible,onTick:()=>{},onFinish:()=>finished++,onCancel:()=>cancelled++});
 countdown.start();fake.advance(1000);visible=false;fake.advance(1000);
 assert.equal(countdown.active,false);assert.equal(cancelled,1);assert.equal(finished,0);
 visible=true;countdown.start();countdown.cancel();fake.advance(4000);assert.equal(finished,0);
});
test('analog movement scales walking speed without changing digital speed or combat state', () => {
 function move(input){const state=createGame(0,'ru');state.enemies=[];state.spawnQueue=[];state.player.x=500;state.player.y=400;stepGame(state,.04,input);return state;}
 const full=move({right:true}), analog=move({moveX:.25,moveY:0}), neutral=move({moveX:0,moveY:0});
 assert.ok(Math.abs((analog.player.x-500)*4-(full.player.x-500))<1e-8);
 assert.equal(neutral.player.x,500);assert.equal(neutral.player.moving,false);
 assert.equal(analog.player.hp,full.player.hp);assert.equal(analog.player.attack,full.player.attack);
 const diagonal=move({moveX:Math.SQRT1_2,moveY:Math.SQRT1_2});
 assert.ok(Math.abs(Math.hypot(diagonal.player.x-500,(diagonal.player.y-400)/.73)-(full.player.x-500))<1e-8);
});
