import test from 'node:test';
import assert from 'node:assert/strict';
import {logicalFraming,computeCameraTarget,updateCamera,screenBox,edgeIndicators,intersects,nearbyThreats} from '../dist/camera.js';

function state(x=1200,y=430){return {mode:'playing',level:0,player:{x,y,face:1,hp:120,attackTimer:0,moving:false},enemies:[]};}
function enemy(id,x,y){return {id,x,y,face:-1,hp:70,type:'punk',attackTimer:0};}
function framing(width=1169){return {width,height:540,occlusions:[
  {left:10,top:330,right:215,bottom:525},
  {left:width-220,top:315,right:width-8,bottom:530},
  {left:10,top:8,right:330,bottom:108},
  {left:width-205,top:8,right:width-10,bottom:125},
]};}

test('CSS control rectangles convert into full-viewport logical coordinates',()=>{
  const result=logicalFraming({enabled:true,viewportWidth:844,viewportHeight:390,
    occlusions:[{left:12,top:260,right:144,bottom:380},{left:0,top:0,right:0,bottom:0}]},1169,540);
  assert.equal(result.width,1169);assert.equal(result.height,540);assert.equal(result.occlusions.length,1);
  assert(Math.abs(result.occlusions[0].left-12*1169/844)<1e-9);
  assert(Math.abs(result.occlusions[0].top-260*540/390)<1e-9);
});

test('world boundaries do not trap Nathan beneath either control cluster',()=>{
  for(const width of [960,1169,1249])for(const x of [45,2355])for(const y of [330,500]){
    const s=state(x,y),config=framing(width),view=computeCameraTarget(s,config);
    assert(view.playerSafe,JSON.stringify({width,x,y,box:view.playerBox}));
    assert.equal(view.scale,1);
    assert(s.player.x-view.x>width*.25&&s.player.x-view.x<width*.75);
    if(x===45)assert(view.x<0,'left overscan keeps hero centered');
    else assert(view.x>2400-width,'right overscan keeps hero centered');
  }
});

test('full punch, kick and throw silhouettes avoid controls in both directions',()=>{
  for(const width of [960,1169,1249])for(const attack of ['punch','kick','throw'])for(const face of [-1,1]){
    const s=state(1200,500);Object.assign(s.player,{attack,attackTimer:.2,face});
    s.enemies=[enemy(1,1200+face*115,500)];
    const config=framing(width),view=computeCameraTarget(s,config);
    assert(view.playerSafe,JSON.stringify({width,attack,face,box:view.playerBox}));
    assert(view.combatSafe);
    for(const rect of config.occlusions)assert(!intersects(screenBox(s.player,view,true),rect));
  }
});

test('vertical view remains natural until a central overlay requires upward framing',()=>{
  const s=state(1200,500),config=framing();
  assert.equal(computeCameraTarget(s,config).y,0);
  config.occlusions.push({left:470,top:440,right:700,bottom:540});
  const view=computeCameraTarget(s,config);
  assert(view.playerSafe);assert(view.y>0);
  assert(330-view.y>=0&&500-view.y<=540,'whole feet lane remains in the viewport');
});

test('nearest combatants are framed at unchanged scale while distant waves stay outside focus',()=>{
  const s=state();s.enemies=[enemy(1,1310,450),enemy(2,1050,410),enemy(3,2000,430),enemy(4,190,430)];
  const view=computeCameraTarget(s,framing());
  assert.deepEqual(view.focusIds,[1,2]);assert(view.combatSafe);assert.equal(view.scale,1);
  assert.equal(nearbyThreats({...s,enemies:[{...s.enemies[0],hp:0}]}).length,0);
});

test('stationary facing flips cannot jerk the camera',()=>{
  const s=state(),config=framing();let view=updateCamera(null,s,config,1/60);
  const initial={x:view.x,y:view.y};
  for(let i=0;i<30;i++){s.player.face*=-1;view=updateCamera(view,s,config,1/60);}
  assert.equal(view.x,initial.x);assert.equal(view.y,initial.y);assert.equal(view.velocityX,0);
});

test('rapid boosted movement remains fully visible with safe hard containment',()=>{
  const s=state(45,500),config=framing(960);let view=null;
  for(let i=0;i<120;i++){
    s.player.x=Math.min(2355,s.player.x+923.5/60);s.player.moving=true;
    s.enemies=[enemy(1,s.player.x+100,500)];
    view=updateCamera(view,s,config,1/60);
    assert(view.playerSafe,'frame '+i);assert(view.combatSafe,'combat frame '+i);
  }
});

test('camera easing is continuous and dt zero preserves the paused view',()=>{
  const s=state(),config=framing();let previous=updateCamera(null,s,config,1/60);
  s.player.x+=20;
  const next=updateCamera(previous,s,config,1/60);
  assert(next.x>previous.x&&next.x<previous.x+20);
  const paused=updateCamera(next,s,config,0);
  assert.equal(paused.x,next.x);assert.equal(paused.y,next.y);
});

test('all camera calculations leave simulation state untouched',()=>{
  const s=state();s.enemies=[enemy(1,1350,460)];const before=structuredClone(s),config=framing();
  const view=updateCamera(null,s,config,1/60);computeCameraTarget(s,config);edgeIndicators(s,view,config);
  assert.deepEqual(s,before);
});

test('offscreen enemy arrows use the actual view and avoid control rectangles',()=>{
  const s=state();s.enemies=[enemy(1,10,490),enemy(2,40,500),enemy(3,2380,490),{...enemy(4,2390,400),hp:0}];
  const config=framing(),view=computeCameraTarget(s,config),arrows=edgeIndicators(s,view,config);
  assert.equal(arrows.length,2);assert.equal(arrows.find(a=>a.edge==='left').count,2);
  assert.equal(arrows.find(a=>a.edge==='right').count,1);
  for(const arrow of arrows){
    assert(arrow.box.left>=0&&arrow.box.right<=config.width&&arrow.box.top>=0&&arrow.box.bottom<=540);
    for(const control of config.occlusions)assert(!intersects(arrow.box,control));
  }
});
