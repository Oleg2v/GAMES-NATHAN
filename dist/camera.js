// Pure presentation camera. World coordinates and simulation state are never changed.
export const VIEW_HEIGHT = 540;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value);

export function intersects(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function overlapArea(a, b) {
  return Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)) *
    Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
}
function padded(rect, amount=12) {
  return {left:rect.left-amount,top:rect.top-amount,right:rect.right+amount,bottom:rect.bottom+amount};
}
export function logicalFraming(input={}, width=960, height=VIEW_HEIGHT) {
  const cssWidth=finite(input.viewportWidth)&&input.viewportWidth>0?input.viewportWidth:width;
  const cssHeight=finite(input.viewportHeight)&&input.viewportHeight>0?input.viewportHeight:height;
  const sx=width/cssWidth,sy=height/cssHeight;
  const occlusions=(input.occlusions||[]).filter(r=>['left','top','right','bottom'].every(k=>finite(r[k])))
    .map(r=>({left:clamp(r.left*sx,0,width),top:clamp(r.top*sy,0,height),
      right:clamp(r.right*sx,0,width),bottom:clamp(r.bottom*sy,0,height)}))
    .filter(r=>r.right>r.left&&r.bottom>r.top);
  return {enabled:Boolean(input.enabled),width,height,occlusions};
}

export function spriteOffsets(actor, player=false) {
  if(player){
    const crouch=actor.crouching&&!(actor.attackTimer>0)&&!(actor.dodgeTimer>0);
    const attack=actor.attackTimer>0?actor.attack:null,face=actor.face||1;
    const front=attack==='kick'?145:attack==='throw'?124:attack==='punch'?112:crouch?58:72;
    const rear=attack?78:crouch?58:72;
    return {left:face<0?-front:-rear,right:face<0?rear:front,top:crouch?-122:-176,bottom:9};
  }
  const height=actor.type==='boss'?166:151,air=Math.max(0,actor.airHeight||0),front=actor.attackTimer>0?76:58;
  return {left:actor.face<0?-front:-58,right:actor.face<0?58:front,top:-height-air-20,bottom:9-air};
}
export function screenBox(actor, view, player=false) {
  const r=spriteOffsets(actor,player);
  return {left:actor.x-view.x+r.left,right:actor.x-view.x+r.right,
    top:actor.y-view.y+r.top,bottom:actor.y-view.y+r.bottom};
}
function safeBox(box,config,pad=12) {
  return box.left>=16&&box.right<=config.width-16&&box.top>=16&&box.bottom<=config.height-12&&
    !config.occlusions.some(r=>intersects(box,padded(r,pad)));
}
export function nearbyThreats(state) {
  const p=state.player;
  if(!p)return [];
  return (state.enemies||[]).filter(e=>e.hp>0&&!e.knockedTimer&&!e.grabbed&&
    Math.abs(e.x-p.x)<=300&&Math.abs(e.y-p.y)<=100)
    .sort((a,b)=>(Math.abs(a.x-p.x)+Math.abs(a.y-p.y)*1.6)-
      (Math.abs(b.x-p.x)+Math.abs(b.y-p.y)*1.6)||(a.id||0)-(b.id||0)).slice(0,2);
}
function annotate(view,state,config,threats) {
  view.width=config.width;view.height=config.height;view.scale=1;
  view.playerBox=screenBox(state.player,view,true);
  view.threatBoxes=threats.map(e=>({id:e.id,box:screenBox(e,view),tight:Math.abs(e.x-state.player.x)<=205}));
  view.focusIds=threats.map(e=>e.id);
  view.playerSafe=safeBox(view.playerBox,config);
  view.combatSafe=view.playerSafe&&view.threatBoxes.every(e=>!e.tight||safeBox(e.box,config));
  return view;
}

export function computeCameraTarget(state,options={}) {
  const config={width:options.width||960,height:options.height||VIEW_HEIGHT,occlusions:options.occlusions||[]};
  const p=state.player,threats=nearbyThreats(state),body=spriteOffsets(p,true);
  const relative=[{...body,weight:600}];
  for(const e of threats){
    const r=spriteOffsets(e);
    relative.push({left:e.x-p.x+r.left,right:e.x-p.x+r.right,
      top:e.y-p.y+r.top,bottom:e.y-p.y+r.bottom,weight:Math.abs(e.x-p.x)<=205?260:80});
  }
  const groupLead=threats.reduce((sum,e,i)=>sum+(e.x-p.x)*(i===0?.24:.12),0);
  const lookahead=clamp((options.velocityX||0)*.10,-48,48);
  const preferredX=config.width*.5-clamp(groupLead+lookahead,-82,82);
  // Preserve lane movement: pan vertically only when HUD or controls require it.
  const preferredY=p.y;
  const minX=Math.max(-body.left+18,config.width*.25),maxX=Math.min(config.width-body.right-18,config.width*.75);
  // All feet lanes 330..500 stay visible. Additional vertical space is scenery.
  const minY=Math.max(-body.top+18,p.y-310),maxY=Math.min(config.height-body.bottom-14,p.y+20);
  const px=clamp(preferredX,minX,maxX),py=clamp(preferredY,minY,maxY);
  const controls=config.occlusions.map(r=>padded(r));
  function evaluate(sx,sy){
    let collision=0,playerCollision=0,tightCollision=0;
    for(let i=0;i<relative.length;i++){
      const r=relative[i];let area=0;
      const b={left:sx+r.left,right:sx+r.right,top:sy+r.top,bottom:sy+r.bottom};
      for(const control of controls)area+=overlapArea(b,control);
      const within=Math.max(0,Math.min(b.right,config.width-16)-Math.max(b.left,16))*
        Math.max(0,Math.min(b.bottom,config.height-12)-Math.max(b.top,16));
      area+=Math.max(0,(b.right-b.left)*(b.bottom-b.top)-within);
      collision+=area*r.weight;
      if(i===0)playerCollision=area;
      else if(r.weight===260)tightCollision+=area;
    }
    return {sx,sy,collision,playerCollision,tightCollision,score:collision+(sx-px)**2+(sy-py)**2*1.15};
  }
  function better(a,b){
    // Nathan's full body always takes precedence over distant group composition.
    if(Math.abs(a.playerCollision-b.playerCollision)>.01)return a.playerCollision<b.playerCollision;
    if((a.tightCollision<.01)!==(b.tightCollision<.01))return a.tightCollision<.01;
    return a.score<b.score;
  }
  let best=evaluate(px,py);
  if(best.collision>0){
    const xs=[px,config.width*.5,minX,maxX],ys=[py,minY,maxY,config.height*.6,config.height*.68];
    for(const control of controls)for(const r of relative){
      xs.push(control.left-r.right-.2,control.right-r.left+.2);
      ys.push(control.top-r.bottom-.2,control.bottom-r.top+.2);
    }
    const candidates=(items,min,max,preferred)=>[...new Set(items.map(v=>Math.round(clamp(v,min,max)*10)/10))]
      .sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)).slice(0,18);
    for(const sx of candidates(xs,minX,maxX,px))for(const sy of candidates(ys,minY,maxY,py)){
      const candidate=evaluate(sx,sy);if(better(candidate,best))best=candidate;
    }
  }
  return annotate({x:p.x-best.sx,y:p.y-best.sy},state,config,threats);
}

export function updateCamera(previous,state,options={},dt=1/60) {
  const config={width:options.width||960,height:options.height||VIEW_HEIGHT,occlusions:options.occlusions||[]};
  const seconds=clamp(Number.isFinite(dt)?dt:1/60,0,0.1),p=state.player;
  const reset=!previous||previous.width!==config.width||previous.height!==config.height||
    previous.level!==state.level||Math.abs(p.x-previous.playerX)>config.width*.65;
  const rawVelocity=reset||seconds<=0?0:clamp((p.x-previous.playerX)/seconds,-1000,1000);
  const velocityAlpha=1-Math.exp(-seconds*5);
  const velocityX=reset?0:previous.velocityX+(rawVelocity-previous.velocityX)*velocityAlpha;
  const target=computeCameraTarget(state,{...config,velocityX});
  let view={x:target.x,y:target.y};
  if(!reset){
    const alpha=1-Math.exp(-seconds*8);
    view={x:previous.x+(target.x-previous.x)*alpha,y:previous.y+(target.y-previous.y)*alpha};
    const threats=nearbyThreats(state);
    const playerSafe=safeBox(screenBox(p,view,true),config);
    const tightSafe=threats.filter(e=>Math.abs(e.x-p.x)<=205).every(e=>safeBox(screenBox(e,view),config));
    // Safety overrides easing for a fast dodge, a new attack pose, or close contact.
    if((!playerSafe||!tightSafe)&&target.combatSafe)view={x:target.x,y:target.y};
    else if(!playerSafe&&target.playerSafe)view={x:target.x,y:target.y};
  }
  return {...annotate(view,state,config,nearbyThreats(state)),velocityX,playerX:p.x,playerY:p.y,level:state.level};
}

export function edgeIndicators(state,view,options={}) {
  const width=options.width||view.width,height=options.height||view.height;
  const controls=(options.occlusions||[]).map(r=>padded(r,6));
  const groups=new Map();
  for(const e of state.enemies||[]){
    if(e.hp<=0)continue;
    const box=screenBox(e,view),x=e.x-view.x,y=e.y-view.y;
    const inside=box.left>=8&&box.right<=width-8&&box.top>=8&&box.bottom<=height-8;
    if(inside&&!controls.some(r=>intersects(box,r)))continue;
    const edge=x<60?'left':x>width-60?'right':box.top<8?'top':box.bottom>height-8?'bottom':x<width/2?'left':'right';
    const distance=Math.hypot(e.x-state.player.x,e.y-state.player.y);
    const group=groups.get(edge);
    if(!group)groups.set(edge,{edge,x,y,count:1,distance});
    else{group.count++;if(distance<group.distance)Object.assign(group,{x,y,distance});}
  }
  const results=[];
  for(const group of groups.values()){
    const side=group.edge==='left'||group.edge==='right';
    const preferred=side?clamp(group.y-70,40,height-40):clamp(group.x,40,width-40);
    const candidates=[preferred,side?height*.5:width*.5];
    for(const r of controls)candidates.push(side?r.top-20:r.left-20,side?r.bottom+20:r.right+20);
    for(let i=1;i<8;i++)candidates.push((side?height:width)*i/8);
    let best=null;
    for(const inward of [24,44,68,92])for(const v of candidates){
      const x=side?(group.edge==='left'?inward:width-inward):clamp(v,22,width-22);
      const y=side?clamp(v,22,height-22):(group.edge==='top'?inward:height-inward);
      const box={left:x-17,right:x+17,top:y-17,bottom:y+17};
      if(controls.some(r=>intersects(box,r)))continue;
      const score=(v-preferred)**2+(inward-24)**2*2;
      if(!best||score<best.score)best={x,y,score,box};
    }
    if(best)results.push({x:best.x,y:best.y,count:group.count,edge:group.edge,
      dx:group.edge==='left'?-1:group.edge==='right'?1:0,
      dy:group.edge==='top'?-1:group.edge==='bottom'?1:0,box:best.box});
  }
  return results;
}
