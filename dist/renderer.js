import { logicalFraming, updateCamera, edgeIndicators } from './camera.js';

const BASE_W = 960, H = 540, WORLD_W = 2400;
const FRAME_NAMES = ['idle', 'walk1', 'walk2', 'punch', 'kick', 'hurt'];
const SIGNS = {
  ru: {shawarma:'ШАУРМА',arcade:'АРКАДА',sector:'СЕКТОР'},
  en: {shawarma:'SHAWARMA',arcade:'ARCADE',sector:'SECTOR'},
  he: {shawarma:'שאורמה',arcade:'ארקייד',sector:'אזור'},
};
const palettes = [
  { sky: '#121c32', horizon: '#313547', floor: '#202730', line: '#37404a', glow: '#f4ad55' },
  { sky: '#172c30', horizon: '#426057', floor: '#354336', line: '#59614a', glow: '#dce7a0' },
  { sky: '#271f2b', horizon: '#60423c', floor: '#332e32', line: '#574340', glow: '#ff9b52' },
];
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function createRenderer(canvas, assets = {}) {
  let W = BASE_W;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d', { alpha: false });
  c.imageSmoothingEnabled = false;
  let menuTime = 0, lastHP = 120, shake = 0, lastKills = 0, lastSpecial = 0, lastActionTime = 0;
  let currentLocale = 'ru';
  let mobileInput={enabled:false},mobileFraming=logicalFraming(mobileInput,W,H),mobileView=null,framingKey='';
  let worldBottom=H;
  const enemyMotion = new WeakMap();
  const reduceMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function refreshFraming(){
    const next=logicalFraming(mobileInput,W,H);
    const key=JSON.stringify([next.enabled,W,H,next.occlusions.map(r=>Object.values(r).map(v=>Math.round(v*10)/10))]);
    if(key!==framingKey){mobileView=null;framingKey=key;}
    mobileFraming=next;
  }
  function setMobileFraming(input={enabled:false}){
    mobileInput={...input,occlusions:(input.occlusions||[]).map(r=>({...r}))};
    refreshFraming();
    return {width:W,height:H,enabled:mobileFraming.enabled,occlusions:mobileFraming.occlusions.map(r=>({...r}))};
  }
  function resize(width = BASE_W, height = H) {
    const nextWidth = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
      ? Math.max(1, Math.round(H * width / height)) : BASE_W;
    W = nextWidth;
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    // Changing the backing store resets canvas context settings.
    c.imageSmoothingEnabled = false;
    refreshFraming();
    return { width: W, height: H };
  }
  const rect = (x,y,w,h,color) => { c.fillStyle = color; c.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h)); };
  const poly = (points,color) => { c.fillStyle=color; c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(Math.round(x),Math.round(y)) : c.moveTo(Math.round(x),Math.round(y))); c.closePath(); c.fill(); };
  const label = (text,x,y,size=14,color='#e9d8ba',align='left') => {
    c.save();c.direction=/[\u0590-\u05ff]/.test(String(text))?'rtl':'ltr';
    c.font=`bold ${size}px "Courier New", monospace`; c.textAlign=align; c.textBaseline='top'; c.fillStyle=color; c.fillText(text,Math.round(x),Math.round(y));c.restore();
  };
  function pixelGlow(x,y,r,color,alpha=.12) {
    c.save(); c.globalAlpha=alpha;
    rect(x-r,y-r*.6,r*2,r*1.2,color); rect(x-r*.7,y-r*.85,r*1.4,r*1.7,color);
    c.restore();
  }
  function shadow(x,y,w=60) {
    c.save(); c.globalAlpha=.34; rect(x-w/2,y-3,w,7,'#070a12'); rect(x-w/2+7,y-6,w-14,13,'#070a12'); c.restore();
  }
  function building(x,y,w,h,seed,color) {
    rect(x,y,w,h,color); rect(x+5,y-7,w-10,7,color);
    rect(x+w-9,y,9,h,'#0c1724');
    for(let wy=y+14;wy<y+h-10;wy+=25) for(let wx=x+10;wx<x+w-14;wx+=20) {
      const k=hash(seed+wx*3+wy);
      rect(wx,wy,8,13,k>.65?'#9c8260':k>.42?'#42515e':'#253342');
      if(k>.8)rect(wx,wy,8,3,'#d5b57e');
    }
  }
  function city(cam,t) {
    const gradient=c.createLinearGradient(0,0,0,330); gradient.addColorStop(0,'#101b31'); gradient.addColorStop(1,'#4a424b'); c.fillStyle=gradient;c.fillRect(0,0,W,330);
    rect(790-cam*.07,43,35,35,'#bebca5'); rect(784-cam*.07,51,48,20,'#bebca5');
    for(let i=Math.floor(cam*.13/105)-2;i<Math.ceil((W+cam*.13)/105)+2;i++) {
      const x=i*105-cam*.13, h=95+hash(i+18)*120;
      building(x,300-h,81+hash(i+8)*25,h,i*2+3,'#1b293a');
      if(i%3===0){rect(x+22,300-h-29,4,29,'#1d2b3b');rect(x+20,300-h-32,8,4,'#af5a5b');}
    }
    for(let i=Math.floor(cam*.35/178)-2;i<Math.ceil((W+cam*.35)/178)+2;i++){
      const x=i*178-cam*.35, h=120+hash(i+27)*90;
      building(x,320-h,159,h,i+90,'#25313b');
    }
    // Shopfronts sit behind the brawling lane.
    for(let i=Math.floor(cam/340)-1;i<Math.ceil((W+cam)/340)+2;i++){
      const x=i*340-cam;
      if(x>W+350||x<-360)continue;
      rect(x,184,332,149,'#34353b');rect(x,184,332,8,'#505052');
      for(let yy=200;yy<325;yy+=14)for(let xx=x+(Math.floor(yy/14)%2)*19;xx<x+325;xx+=38){rect(xx,yy,34,2,'#454046');}
      rect(x+16,227,185,104,'#171e29');rect(x+20,231,177,96,'#24363d');
      rect(x+25,235,75,85,'#21353c');rect(x+108,235,81,85,'#1d2f37');
      rect(x+27,239,5,77,'#3c5556');rect(x+113,239,5,77,'#3c5556');rect(x+20,284,177,5,'#111d27');
      if(i%3===0){
        rect(x+13,193,192,29,'#121c28');rect(x+17,196,184,2,'#f7c06b');rect(x+17,218,184,2,'#e58a54');
        label(SIGNS[currentLocale].shawarma,x+109,198,21,'#ffc274','center');
        pixelGlow(x+108,225,100,'#f2a250',.1);
        rect(x+137,249,34,6,'#eba756');rect(x+141,255,26,30,'#a65733');rect(x+145,261,19,3,'#e4b265');
      }else if(i%3===1){
        rect(x+13,194,192,26,'#172d38');label('24 / 7',x+109,198,20,'#8ccbc2','center');
        rect(x+33,251,48,5,'#b38f61');rect(x+122,251,48,5,'#b38f61');
      }else{rect(x+16,195,184,25,'#2c2935');label(SIGNS[currentLocale].arcade,x+108,198,20,'#b7a3d4','center');}
      rect(x+219,224,91,107,'#1b2530');
      for(let yy=230;yy<330;yy+=8){rect(x+223,yy,83,3,'#3c444c');}
      rect(x+234,204,62,11,'#25212d');rect(x+239,207,48,4,'#685456');
      // Vent and electrical cabinet.
      rect(x+280,158,39,23,'#424a50');rect(x+284,164,31,2,'#192632');rect(x+284,170,31,2,'#192632');
      rect(x+316,243,8,79,'#242730');rect(x+312,238,16,24,'#4c4f50');
    }
    rect(0,327,W,12,'#6b6463');rect(0,339,W,6,'#151f2c');
    ground(0,cam,t);
    for(let i=Math.floor(cam/470)-1;i<Math.ceil((W+cam)/470)+2;i++){
      const x=i*470+270-cam;
      rect(x,177,7,165,'#101d28');rect(x-9,176,26,7,'#101d28');rect(x-16,173,42,7,'#9b8469');rect(x-12,178,34,4,'#f9c16f');
      poly([[x-12,184],[x+22,184],[x+87,340],[x-75,340]],'rgba(237,177,98,.055)');
      rect(x-7,332,22,9,'#111b27');
      const bx=x-126;
      rect(bx,299,49,36,'#293f40');rect(bx-4,296,57,8,'#425a54');rect(bx+7,307,3,24,'#172d34');rect(bx+37,307,3,24,'#172d34');
    }
    // Crisp rain streaks, deterministic motion.
    c.save();c.globalAlpha=.18;
    for(let i=0;i<85;i++){const x=(hash(i+13)*W+t*37)%W, y=(hash(i+39)*H+t*(170+hash(i)*70))%H;rect(x,y,1,8,'#c8e5ed');}
    c.restore();
  }
  function pine(x,y,s,color,seed=1) {
    rect(x-5*s,y-140*s,11*s,145*s,'#27372d');
    for(let j=0;j<6;j++){
      const yy=y-190*s+j*28*s, ww=(30+j*15)*s;
      poly([[x,yy-42*s],[x-ww/2,yy+22*s],[x-ww/2+11*s,yy+22*s],[x-ww*.67,yy+39*s],[x+ww*.67,yy+39*s],[x+ww/2-11*s,yy+22*s],[x+ww/2,yy+22*s]],color);
      if(j%2)rect(x-ww*.3,yy+32*s,ww*.7,3*s,seed%2?'#233e38':'#25443c');
    }
  }
  function forest(cam,t) {
    const gradient=c.createLinearGradient(0,0,0,350);gradient.addColorStop(0,'#162d31');gradient.addColorStop(.6,'#49655b');gradient.addColorStop(1,'#72806a');c.fillStyle=gradient;c.fillRect(0,0,W,350);
    rect(720-cam*.06,44,58,58,'#c2cba1');rect(712-cam*.06,58,74,29,'#c2cba1');
    for(let i=Math.floor(cam*.15/79)-2;i<Math.ceil((W+cam*.15)/79)+2;i++)pine(i*79-cam*.15,335,.85+hash(i+5)*.55,'#304c45',i);
    rect(0,262,W,18,'rgba(147,165,131,.1)');rect(0,291,W,28,'rgba(157,171,137,.1)');
    for(let i=Math.floor(cam*.43/125)-2;i<Math.ceil((W+cam*.43)/125)+2;i++)pine(i*125+15-cam*.43,338,1.12+hash(i+8)*.3,'#203b36',i);
    for(let i=Math.floor(cam/270)-1;i<Math.ceil((W+cam)/270)+2;i++){
      const x=i*270+35-cam;
      rect(x-12,5,26,327,'#283b31');rect(x-9,6,7,316,'#3c4c36');rect(x+5,5,5,326,'#192f2b');
      rect(x-8,90,8,17,'#152d29');rect(x+3,192,7,37,'#152d29');
      poly([[x+8,165],[x+56,111],[x+64,109],[x+15,181]],'#283b31');
      poly([[x-2,107],[x-44,62],[x-50,62],[x-8,126]],'#283b31');
      poly([[x-12,300],[x-40,339],[x+42,339],[x+12,300]],'#293a2d');
      rect(x-36,330,78,8,'#334a32');
    }
    poly([[120-cam*.2,0],[180-cam*.2,0],[440-cam*.2,340],[350-cam*.2,340]],'rgba(213,218,157,.055)');
    poly([[680-cam*.1,0],[710-cam*.1,0],[890-cam*.1,340],[830-cam*.1,340]],'rgba(213,218,157,.04)');
    ground(1,cam,t);
    for(let i=Math.floor(cam/315)-1;i<Math.ceil((W+cam)/315)+2;i++){
      const x=i*315+130-cam;
      rect(x,312,85,21,'#433c2f');rect(x+2,309,79,7,'#5c5038');rect(x+8,319,65,3,'#302d28');rect(x+68,311,16,20,'#b3935f');rect(x+71,315,10,12,'#665333');
      for(let a=0;a<7;a++){rect(x-30+a*19,328-hash(a+i*8)*13,3,12,'#61704b');rect(x-27+a*19,329-hash(a+i*8)*13,6,3,'#61704b');}
      rect(x+122,326,20,9,'#777b64');rect(x+126,320,14,8,'#92917a');
      rect(x+150,327,3,8,'#bdac87');rect(x+144,324,15,5,'#bd6e4e');rect(x+148,322,8,3,'#d69c70');
    }
    for(let i=0;i<25;i++){
      const x=(hash(i+110)*W+t*(2+hash(i)*3))%W, y=170+hash(i+79)*200+Math.sin(t+i)*4;
      c.globalAlpha=.3+Math.sin(t*1.7+i)*.2;rect(x,y,3,3,'#dce8a4');c.globalAlpha=1;
    }
  }
  function factory(cam,t) {
    const gradient=c.createLinearGradient(0,0,0,350);gradient.addColorStop(0,'#241e2b');gradient.addColorStop(1,'#895744');c.fillStyle=gradient;c.fillRect(0,0,W,350);
    for(let i=Math.floor(cam*.18/178)-1;i<Math.ceil((W+cam*.18)/178)+2;i++){
      const x=i*178-cam*.18;
      rect(x,138,139,195,'#332c34');rect(x+20,46,24,138,'#3f3439');rect(x+17,46,30,8,'#69504a');
      rect(x+88,92,16,93,'#40353a');
      for(let j=0;j<5;j++){
        const yy=40-j*15-(t*7)%16, xx=x+24+j*9;
        c.globalAlpha=.1;rect(xx-12,yy,26+j*8,14,'#b19a86');rect(xx-4,yy-6,28+j*7,19,'#b19a86');c.globalAlpha=1;
      }
    }
    for(let i=Math.floor(cam/310)-1;i<Math.ceil((W+cam)/310)+2;i++){
      const x=i*310-cam;
      rect(x,105,304,229,'#43383b');rect(x+9,112,286,215,'#493d3e');
      for(let j=0;j<3;j++){
        const wx=x+25+j*91;
        rect(wx,129,68,87,'#212b30');rect(wx+5,134,58,77,'#71634d');
        for(let a=0;a<3;a++)for(let b=0;b<3;b++)rect(wx+8+a*19,137+b*25,13,19,hash(i*10+a+b*7)>.5?'#ba965d':'#59615a');
        rect(wx+30,133,4,81,'#282c2c');rect(wx+2,173,65,4,'#282c2c');
      }
      rect(x,109,8,225,'#2f2e33');rect(x+296,109,8,225,'#2f2e33');
      rect(x+7,230,290,12,'#6e5145');rect(x+7,234,290,3,'#8a6351');
      rect(x+17,246,57,82,'#282c30');rect(x+22,251,47,72,'#3c3d3d');rect(x+60,280,4,8,'#b99c61');
      rect(x+105,251,139,75,'#1c252a');rect(x+111,257,127,64,'#332827');
      if(i%2===0){
        rect(x+116,267,117,48,'#8b4931');rect(x+122,277,105,38,'#c9783e');rect(x+133,287,82,28,'#efaf60');
        for(let j=0;j<6;j++)rect(x+116+j*22,260,8,65,'#25282c');
        pixelGlow(x+175,302,103,'#ff9b52',.12);
      }else{
        for(let j=0;j<5;j++)rect(x+111,262+j*11,127,4,'#55504a');
        label(SIGNS[currentLocale].sector+' '+(i+2),x+173,270,13,'#b6a78f','center');
      }
      // Overhead pipe bends and safety stripes.
      rect(x+255,90,15,242,'#755746');rect(x+252,85,21,12,'#a47d56');rect(x+251,216,23,8,'#b69361');
      rect(x+270,77,41,15,'#755746');rect(x+265,82,11,13,'#755746');
      rect(x+2,321,294,12,'#b69358');
      for(let j=0;j<15;j++)poly([[x+j*21,321],[x+j*21+11,321],[x+j*21+2,333],[x+j*21-9,333]],'#343036');
    }
    ground(2,cam,t);
    for(let i=Math.floor(cam/360)-1;i<Math.ceil((W+cam)/360)+2;i++){
      const x=i*360+150-cam;
      rect(x,300,45,35,'#3a5151');rect(x-2,297,49,7,'#4f6962');rect(x+3,310,38,5,'#728270');rect(x+3,326,38,4,'#1f393d');
      rect(x+54,311,37,24,'#655041');rect(x+58,316,29,3,'#907357');rect(x+58,329,29,3,'#3f3934');
      rect(x+59,313,4,21,'#9a7955');rect(x+82,313,4,21,'#9a7955');
    }
    for(let i=0;i<22;i++){
      const x=(hash(i+42)*W-t*5)%W,y=340-((hash(i+17)*300+t*(8+hash(i)*15))%300);
      c.globalAlpha=.18+hash(i)*.38;rect(x,y,2,3,'#ffc274');c.globalAlpha=1;
    }
  }
  function ground(level,cam,t){
    const p=palettes[level];rect(0,345,W,worldBottom-345,p.floor);
    const gradient=c.createLinearGradient(0,345,0,worldBottom);gradient.addColorStop(0,'rgba(0,0,0,.1)');gradient.addColorStop(1,'rgba(0,0,0,.25)');c.fillStyle=gradient;c.fillRect(0,345,W,worldBottom-345);
    for(let i=0;i<120;i++){
      const x=((hash(i+108)*2700-cam)%W+W)%W, y=351+hash(i+56)*(worldBottom-355);
      rect(x,y,2+hash(i)*15,1+Math.floor(hash(i+11)*2),p.line);
    }
    if(level===0){
      for(let i=Math.floor(cam/380)-1;i<Math.ceil((W+cam)/380)+2;i++){const x=i*380+20-cam;rect(x,428,110,4,'#736b59');rect(x+4,432,106,2,'#3c3d3e');rect(x+72,375,77,3,'#4b5357');rect(x+82,380,57,2,'#666262');rect(x+91,386,44,2,'#44575c');}
      rect(0,520,W,4,'#48454a');rect(0,524,W,worldBottom-524,'#1b222b');
    }else if(level===1){
      poly([[0,350],[W,350],[W,373],[0,385]],'#46503a');
      for(let i=0;i<100;i++){const x=((i*29-cam*.98)%W+W)%W,y=360+hash(i+25)*(worldBottom-364);rect(x,y,3,3,['#62704a','#7e7950','#263d31'][i%3]);}
      for(let i=0;i<45;i++){const x=(i*71-cam)%W;rect(x,518-hash(i)*8,3,17,'#2b4534');rect(x+3,514-hash(i)*8,2,11,'#4e603e');}
    }else{
      for(let yy=376;yy<worldBottom;yy+=54){rect(0,yy,W,2,'#222a2e');for(let i=Math.floor(cam/220)-1;i<Math.ceil((W+cam)/220)+2;i++){const x=i*220-cam;rect(x,yy,2,54,'#222a2e');rect(x+8,yy+8,3,3,'#80685a');}}
      for(let i=Math.floor(cam/400)-1;i<Math.ceil((W+cam)/400)+2;i++){const x=i*400+45-cam;rect(x,396,69,19,'#1a2429');for(let j=0;j<8;j++)rect(x+4+j*8,397,3,17,'#454244');}
    }
  }
  function itemIcon(index,x,y,s=1){
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(s,s);
    if(index<2){
      rect(-9,-6,18,12,'#171b27');rect(-7,-7,14,14,index===0?'#e1b453':'#b7a2e5');rect(-9,-4,4,8,index===0?'#f6d780':'#d9c6ff');rect(1,-6,6,12,'#eee7d8');rect(-1,-6,2,12,'#635968');
    }else if(index===2){rect(-12,-3,24,6,'#ede7d8');rect(5,-3,7,6,'#b98051');rect(-13,-3,3,6,'#f0784c');rect(-15,-11,2,6,'#9eacb0');rect(-12,-16,2,6,'#9eacb0');}
    else if(index===3){
      rect(-12,-4,22,8,'#b8dde0');rect(-9,-2,10,4,'#4dafb7');rect(9,-2,6,4,'#818f98');rect(15,-1,5,2,'#cad9d7');rect(-14,-6,3,12,'#edf4df');rect(3,-6,3,12,'#e3ebdb');
    }else{
      poly([[-10,-11],[10,-11],[7,14],[-6,14]],'#d7b57c');rect(-8,-12,16,6,'#a46942');rect(-5,-11,10,3,'#72a05d');rect(-7,-6,14,2,'#e4d19c');poly([[-10,-2],[8,1],[7,14],[-6,14]],'#e5ddc4');rect(-5,3,10,2,'#aab6b1');
    }c.restore();
  }
  function pickup(p,cam,t){
    const x=p.x-cam,y=p.y;
    shadow(x,y,30); const dy=Math.sin(t*3+(p.bob||p.id||0))*4;
    rect(x-16,y-30+dy,32,30,'#101c28');rect(x-17,y-31+dy,34,2,'#a4b36d');rect(x-17,y-31+dy,2,32,'#a4b36d');rect(x+15,y-31+dy,2,32,'#a4b36d');rect(x-17,y+dy,34,2,'#a4b36d');
    itemIcon(p.itemIndex??0,x,y-15+dy,.85);
    label(String((p.itemIndex??0)+1),x,y+7,10,'#dce6bf','center');
  }
  function enemy(e,cam,t){
    const x=e.x-cam,y=e.y, boss=e.type==='boss';
    const depth=0.94+(y-330)/180*.12;
    const scale=(boss?1.4:1.22)*depth, face=e.face||-1;
    const height=(boss?154:139)*depth;
    const airborne=e.knockedTimer>0,grabbed=Boolean(e.grabbed);
    const airLift=airborne?(e.airHeight||0)+7:grabbed?31:0;
    const turn=airborne?(e.spin||0):grabbed?-face*.25:0;
    const walking=Math.sin((e.walkTime||0)*12), hit=e.hitTimer>0, attacking=e.attackTimer>0;
    const index=(Number(e.id)||0)%3;
    const jacket=boss?'#78614b':e.type==='runner'?'#62747a':['#8c635c','#687858','#68617e'][index];
    const jacketLight=boss?'#a8875f':e.type==='runner'?'#84949a':['#b07b68','#8c9a69','#9181a0'][index];
    shadow(x,y,boss?58:42);
    if(attacking&&!airborne&&!grabbed){
      c.save();c.globalAlpha=.3+Math.sin(t*24)*.12;
      rect(x-31*scale,y-9,62*scale,12,'#ed8965');rect(x-24*scale,y-13,48*scale,20,'#ed8965');c.restore();
      label('!',x,y-height-25,18,'#ffc777','center');
    }
    const image=assets.enemies;
    if(image?.complete&&image.naturalWidth){
      const atlas=assets.enemyAtlas||{},type=boss?'boss':e.type==='runner'?'runner':'punk';
      const attackPose=attacking&&!airborne&&!grabbed;
      const name=type+(attackPose?'Attack':'Idle');
      const idx=(type==='punk'?0:type==='runner'?1:2)+(attackPose?3:0);
      const cw=image.naturalWidth/3,ch=image.naturalHeight/2;
      const f=atlas.frames?.[name]||{x:idx%3*cw,y:Math.floor(idx/3)*ch,w:cw,h:ch,anchorX:cw/2,anchorY:ch*.94};
      const sc=height/(atlas.characterHeight||ch*.88),dw=f.w??f.width,dh=f.h??f.height;
      const previous=enemyMotion.get(e),moving=previous!==undefined&&(e.walkTime||0)>previous;
      enemyMotion.set(e,e.walkTime||0);
      const bob=moving&&!attacking&&!reduceMotion?Math.round(Math.abs(walking)*2):0;
      const tilt=reduceMotion?0:hit?-.045:attacking?-.025:moving?walking*.012:Math.sin(t*2+(Number(e.id)||0))*.003;
      c.save();c.translate(Math.round(x+(hit?-face*4:0)),Math.round(y-bob-airLift-height*.5));
      c.rotate(turn);c.translate(0,height*.5);
      // Use observed atlas direction; generated enemies face right like Nathan.
      c.scale(face*(atlas.sourceFacing==='left'?-1:1),1);c.rotate(tilt);
      if(hit&&!reduceMotion)c.globalAlpha=.76+.24*(1-clamp(e.hitTimer/.22,0,1));
      c.drawImage(image,f.x,f.y,dw,dh,-(f.anchorX??dw/2)*sc,-(f.anchorY??dh)*sc,dw*sc,dh*sc);
      c.restore();
    }else{
    c.save();c.translate(Math.round(x),Math.round(y-airLift-height*.5));c.rotate(turn);c.translate(0,height*.5);c.scale(face*scale,scale);
    const lean=hit?-6:attacking?5:0;c.translate(lean,Math.round(walking*1.5));
    // Thin adult silhouette: distinct jacket, fitted pants and sneakers.
    const stride=attacking?2:Math.round(walking*6);
    rect(-17+stride,-42,14,38,'#101924');rect(4-stride,-43,13,39,'#101924');
    rect(-15+stride,-39,8,31,'#37414c');rect(5-stride,-40,7,32,'#303b47');
    rect(-17+stride,-9,17,8,'#252e37');rect(3-stride,-9,19,8,'#252e37');
    rect(-18+stride,-4,18,4,'#9b9e97');rect(3-stride,-4,20,4,'#9b9e97');
    poly([[-17,-83],[11,-86],[20,-49],[13,-40],[-17,-40],[-22,-49]],'#111c28');
    poly([[-14,-81],[10,-83],[15,-50],[10,-44],[-15,-44],[-18,-51]],jacket);
    rect(-13,-77,5,30,jacketLight);rect(2,-77,3,32,'#26313a');rect(-12,-45,26,4,'#212b34');
    rect(6,-73,8,5,jacketLight);rect(-11,-62,7,3,'#b4a894');
    // Back arm.
    rect(-23,-76,12,32,'#18212b');rect(-21,-73,8,21,jacket);rect(-22,-54,10,11,'#bc8d6b');rect(-20,-51,5,4,'#e1b38a');
    // Head and hair.
    rect(-11,-109,23,28,'#101b25');rect(-8,-106,18,23,'#c89570');rect(-6,-103,15,10,'#dfb08a');
    rect(-11,-112,22,9,boss?'#343838':'#30343b');rect(-12,-106,6,12,boss?'#434443':'#30343b');rect(6,-107,8,6,'#30343b');
    rect(7,-98,6,7,'#ca9975');rect(6,-101,4,3,'#1d2933');rect(7,-100,2,1,'#e7d1ac');rect(4,-88,8,3,'#6b5046');
    if(boss){rect(-7,-90,18,8,'#4b4c44');rect(-3,-86,9,7,'#4b4c44');}
    else if(index===2){rect(-9,-106,22,4,'#bba15d');}
    // Forward arm extends during windup, then curls back.
    if(attacking){
      rect(12,-77,13,13,'#14202a');rect(17,-72,20,11,'#14202a');rect(15,-75,10,9,jacketLight);rect(24,-70,11,7,jacket);
      rect(33,-74,13,15,'#111c26');rect(35,-72,10,11,'#d2a17c');rect(36,-72,8,3,'#ebc397');
    }else{
      rect(12,-77,12,22,'#14202a');rect(14,-74,8,16,jacketLight);rect(15,-60,12,14,'#14202a');rect(17,-58,9,10,'#d0a17b');rect(18,-57,7,3,'#e4b58c');
    }
    if(hit){c.globalAlpha=.2;rect(-20,-113,44,114,'#fff0bc');c.globalAlpha=1;}
    c.restore();
    }
    if(airborne){c.save();c.globalAlpha=.45;const direction=Math.sign(e.vx||face);for(let i=0;i<4;i++)rect(x-direction*(25+i*15),y-airLift-height*.45+i*8,10+i*4,2,'#e8ce9c');c.restore();}
    if(e.hp>0&&(e.hp<e.maxHp||boss)&&!airborne&&!grabbed){const ww=boss?69:43;rect(x-ww/2,y-height-12,ww,5,'#141c27');rect(x-ww/2+1,y-height-11,(ww-2)*clamp(e.hp/e.maxHp,0,1),3,boss?'#e7ac61':'#b1b985');}
  }
  function heroFrame(p){
    if(p.hitTimer>.4&&!(p.specialTimer>0))return 'hurt';
    if(p.attack==='throw'&&p.attackTimer>0)return p.attackTimer>.42?'grab':'throw';
    if(p.attackTimer>0)return p.attack==='kick'?'kick':'punch';
    if(p.crouching&&!(p.dodgeTimer>0))return 'crouch';
    if(p.isMoving||p.moving)return Math.floor((p.walkTime||0)*7)%2?'walk1':'walk2';
    // walkTime changes only on motion; parent can expose explicit moving for idle.
    return 'idle';
  }
  function hero(p,state,cam,t){
    const x=p.x-cam,y=p.y,slim=state.buffs?.slim?.remaining>0;
    const smoking=state.buffs?.smoke?.remaining>0, strength=state.buffs?.strength?.remaining>0;
    const widthScale=slim?.74:1,face=p.face||1;
    const crouched=Boolean(p.crouching)&&!(p.attackTimer>0)&&!(p.dodgeTimer>0);
    const headHeight=crouched?88:133;
    shadow(x,y,slim?63:82);
    if(strength){c.save();c.globalAlpha=.19;rect(x-38*widthScale,y-9,76*widthScale,8,'#f2c86e');rect(x-31*widthScale,y-13,62*widthScale,17,'#f2c86e');c.restore();}
    if(p.dodgeTimer>0){
      c.save();c.globalAlpha=.15;rect(x-face*64,y-140,47,132,'#a5cbd1');rect(x-face*96,y-132,35,122,'#a5cbd1');c.restore();
    }
    c.save();c.translate(Math.round(x),Math.round(y));c.scale(face*widthScale,1);
    let name=heroFrame(p);
    const useCrouch=name==='crouch'&&assets.crouch?.complete&&assets.crouch.naturalWidth;
    const useThrows=(name==='grab'||name==='throw')&&assets.throws?.complete&&assets.throws.naturalWidth;
    const image=useCrouch?assets.crouch:useThrows?assets.throws:assets.hero;
    if(!useThrows&&(name==='grab'||name==='throw'))name='punch';
    if(name==='crouch'&&!useCrouch){name='idle';c.scale(1,.68);}
    if(image?.complete&&image.naturalWidth){
      const atlas=(useCrouch?assets.crouchAtlas:useThrows?assets.throwAtlas:assets.atlas)||{},frames=atlas.frames;
      const names=useCrouch?['crouch']:useThrows?['grab','throw']:FRAME_NAMES,idx=names.indexOf(name);
      let f=Array.isArray(frames)?frames[idx]:frames?.[name];
      const cols=atlas.columns||(useCrouch?1:useThrows?2:3),rows=atlas.rows||(useCrouch||useThrows?1:2);
      const cw=image.naturalWidth/cols,ch=image.naturalHeight/rows;
      f=f||{x:idx%cols*cw,y:Math.floor(idx/cols)*ch,w:cw,h:ch,anchorX:cw/2,anchorY:ch*.91};
      const sc=160/(atlas.characterHeight||ch*.82), dw=f.w??f.width,dh=f.h??f.height;
      const bob=reduceMotion?0:(p.isMoving||p.moving)?Math.round(Math.sin((p.walkTime||0)*13)*2):Math.sin(t*2)*.8;
      const activePunch=p.attack==='punch'&&p.attackTimer>0;
      const punchProgress=activePunch?clamp(1-p.attackTimer/.25,0,1):0;
      const lunge=activePunch?Math.sin(punchProgress*Math.PI)*(p.isFinisher?11:p.punchStep===2?6:3):0;
      if(p.hitTimer>0&&!reduceMotion&&!(p.specialTimer>0))c.globalAlpha=.7+.3*(1-clamp(p.hitTimer/.6,0,1));
      if(activePunch&&!reduceMotion){c.translate(lunge,0);c.rotate((p.punchStep===2?-.035:p.isFinisher?.045:.01)*Math.sin(punchProgress*Math.PI));}
      c.drawImage(image,f.x,f.y,dw,dh,-(f.anchorX??dw/2)*sc,-(f.anchorY??dh)*sc+bob,dw*sc,dh*sc);
    }else{
      // Used while the atlas loads; this stays a complete heavyweight silhouette.
      rect(-34,-67,29,62,'#111b28');rect(8,-67,27,62,'#111b28');rect(-31,-61,21,51,'#34404b');rect(12,-61,19,51,'#34404b');
      rect(-39,-12,37,11,'#15202a');rect(7,-12,39,11,'#15202a');rect(-39,-4,37,4,'#6c7477');rect(7,-4,39,4,'#6c7477');
      poly([[-32,-128],[27,-128],[43,-87],[34,-59],[-33,-59],[-42,-88]],'#111b27');
      poly([[-27,-124],[23,-124],[37,-86],[28,-64],[-29,-64],[-36,-87]],'#29323b');
      rect(-20,-158,37,36,'#ba8e6d');rect(-18,-157,33,15,'#d5a783');rect(-22,-161,38,9,'#8b755d');
      rect(-21,-141,39,29,'#463e38');rect(-14,-118,25,11,'#463e38');rect(-15,-140,28,11,'#c69a77');rect(9,-147,5,3,'#1a232b');
      rect(-45,-119,20,44,'#bd936f');rect(-44,-105,17,13,'#676960');rect(27,-120,21,38,'#c49a77');rect(30,-103,18,10,'#64685d');
      if(p.attackTimer>0&&p.attack!=='kick'){rect(36,-110,43,19,'#c49a77');rect(69,-115,22,26,'#dab08a');}
    }
    c.restore();
    if(p.attack==='throw'&&p.attackTimer>0){
      c.save();c.globalAlpha=clamp(p.attackTimer/.75,.15,.8);
      const reach=80,xx=x+face*reach;
      rect(xx-5,y-40,11,3,'#e6ce7f');rect(xx-5,y-19,11,3,'#e6ce7f');
      rect(xx+(face>0?4:-6),y-40,3,24,'#e6ce7f');
      for(let i=0;i<4;i++)rect(x+face*(43+i*8),y-29,5,2,'#e6ce7f');c.restore();
    }else if(p.attackTimer>0){
      attackArc(p,x,y,face);
    }
    if(smoking){
      for(let i=0;i<7;i++){
        const z=(t*.7+i*.14)%1,s=7+z*12,xx=x+face*23+Math.sin(z*5+i)*14,yy=y-headHeight-z*48;
        c.globalAlpha=(1-z)*.25;rect(xx,yy,s,5,'#b5c9c0');rect(xx+3,yy-4,s-2,5,'#b5c9c0');c.globalAlpha=1;
      }
    }
    if(slim){c.save();c.globalAlpha=.6;for(let i=0;i<3;i++){rect(x-face*(35+i*13),y-57+i*12,9+i*4,2,'#a8dbc3');}c.restore();}
    if(p.useTimer>0){
      const item=['vyvanse20','vyvanse30','smoke','ozempic','shawarma'].indexOf(p.useItem);
      if(item===3){const bellyHeight=crouched?49:78;itemIcon(3,x+face*23,y-bellyHeight,1);pixelGlow(x,y-bellyHeight,23,'#9ee5ca',.17);}
      else if(item===2)itemIcon(2,x+face*24,y-headHeight+2,.65);
      else if(item===4)itemIcon(4,x+face*28,y-headHeight+23,.8);
      else if(item>=0)itemIcon(item,x+face*18,y-headHeight+2,.7);
    }
  }
  function foreground(level,cam,t){
    if(level===0){
      for(let i=Math.floor(cam/640)-1;i<Math.ceil((W+cam)/640)+2;i++){const x=i*640+565-cam;rect(x,504,42,36,'#111c26');rect(x-3,502,48,6,'#2b3940');rect(x+5,513,3,26,'#35464a');rect(x+31,513,3,26,'#35464a');}
    }else if(level===1){
      for(let i=Math.floor(cam*1.05/410)-1;i<Math.ceil((W+cam*1.05)/410)+2;i++){const x=i*410-cam*1.05;rect(x,485,18,55,'#142d29');rect(x+12,497,13,43,'#20382b');poly([[x,512],[x-28,540],[x+55,540],[x+18,512]],'#172f28');}
    }else{
      rect(0,529,W,worldBottom-529,'#1d242c');for(let i=Math.floor(cam/310)-1;i<Math.ceil((W+cam)/310)+2;i++){const x=i*310+60-cam;rect(x,522,61,6,'#78614b');for(let j=0;j<4;j++)poly([[x+j*17,522],[x+j*17+8,522],[x+j*17+3,528],[x+j*17-5,528]],'#26272c');}
    }
  }
  function atmosphere(level,state,t){
    if(state.buffs?.smoke?.remaining>0){
      c.fillStyle='rgba(90,135,140,.08)';c.fillRect(0,0,W,H);
      c.strokeStyle='rgba(172,213,200,.25)';c.lineWidth=3;c.strokeRect(2,2,W-4,H-4);
    }
    const vig=c.createRadialGradient(W/2,H*.54,190,W/2,H*.54,Math.max(620,W*.65));vig.addColorStop(0,'rgba(5,10,20,0)');vig.addColorStop(1,'rgba(5,10,20,.4)');c.fillStyle=vig;c.fillRect(0,0,W,H);
    // Very subtle scanlines bind raster sprites and scenery together.
    c.fillStyle='rgba(3,8,15,.045)';for(let y=0;y<H;y+=4)c.fillRect(0,y,W,1);
  }
  function attackArc(p,x,y,face){
    const kick=p.attack==='kick',duration=kick?.42:.25;
    const progress=clamp(1-p.attackTimer/duration,0,1),strength=p.isFinisher?1.35:1;
    // One readable curved stroke per swing, fading smoothly without strobing.
    const opacity=Math.sin(progress*Math.PI)*.64;
    if(opacity<=.03)return;
    c.save();c.globalAlpha=reduceMotion?opacity*.55:opacity;
    const cx=x+face*(kick?21:44),cy=y-(kick?88:105);
    const radius=(kick?85:48)*strength,start=kick?-1.07:-.72,end=kick?.72:.59;
    const step=kick?.065:.075;
    for(let a=start;a<end;a+=step){
      const taper=Math.sin((a-start)/(end-start)*Math.PI),size=(p.isFinisher?4:3)*taper+1;
      const xx=cx+face*Math.cos(a)*radius,yy=cy+Math.sin(a)*radius*(kick?.73:.59);
      rect(xx,yy,size,size,p.isFinisher?'#f9c777':'#e9dac0');
      if(taper>.25)rect(xx-face*5,yy,2,2,p.isFinisher?'#c88b43':'#9faba7');
    }
    for(let i=0;i<(p.isFinisher?5:3);i++){
      const length=(kick?22:16)+i*5,yy=cy-13+i*9;
      rect(cx+face*(radius-23-i*3)-(face<0?length:0),yy,length,2,i===1?'#f6e3be':'#b1b5a3');
    }
    c.restore();
  }
  function impact(impact,cam){
    const fraction=clamp(impact.life/(impact.maxLife||.25),0,1),progress=1-fraction;
    const heavy=['finisher','throw','special'].includes(impact.kind);
    const x=impact.x-cam,y=impact.y,dir=impact.direction||1;
    const size=heavy?31:impact.kind==='kick'?22:16;
    const spread=reduceMotion?size*.8:size*(.45+progress*1.2);
    c.save();c.globalAlpha=fraction*(reduceMotion?.58:.84);
    const color=impact.color||(heavy?'#ffc47a':'#ffe6b5');
    // Small localized contact burst: strong feedback, no full-screen flashes.
    if(progress<.34){
      const core=heavy?9:6;
      rect(x-core/2,y-core*1.4,core,core*2.8,'#fff0c5');
      rect(x-core*1.4,y-core/2,core*2.8,core,'#fff0c5');
    }
    const rays=heavy?10:7;
    for(let i=0;i<rays;i++){
      const a=i/rays*Math.PI*2+(heavy?.12:.3),dx=Math.cos(a),dy=Math.sin(a);
      const inner=spread*.43,outer=spread*(i%2?1:1.35);
      const px=-dy*(heavy?2.8:1.7),py=dx*(heavy?2.8:1.7);
      poly([[x+dx*inner+px,y+dy*inner+py],[x+dx*outer,y+dy*outer],[x+dx*inner-px,y+dy*inner-py]],i%3?color:'#fff2ca');
    }
    if(heavy&&!reduceMotion){
      c.globalAlpha=fraction*.55;
      for(let i=0;i<24;i++){
        const a=i/24*Math.PI*2,r=size*(.8+progress*1.6);
        rect(x+Math.cos(a)*r,y+Math.sin(a)*r*.7,3,3,color);
      }
      for(let i=0;i<4;i++)rect(x-dir*(25+i*13),y-17+i*11,dir>0?14:9,2,'#e3c8a1');
    }
    c.restore();
  }
  function shockwave(state,cam){
    const remaining=state.specialTimer||state.player?.specialTimer||0;
    if(remaining<=0||!state.player)return;
    const progress=clamp(1-remaining/.85,0,1),radius=28+195*Math.sqrt(progress);
    const x=state.player.x-cam,y=state.player.y;
    c.save();c.globalAlpha=(1-progress)*.8;
    for(let ring=0;ring<2;ring++){
      const r=radius*(ring?.72:1);
      for(let i=0;i<44;i++){
        const angle=i/44*Math.PI*2,size=ring?3:5;
        rect(x+Math.cos(angle)*r-size/2,y+Math.sin(angle)*r*.38-size/2,size,size,ring?'#ffd599':'#efa357');
      }
    }
    c.globalAlpha=(1-progress)*.22;
    poly([[x-radius,y],[x,y-radius*.5],[x+radius,y],[x,y+radius*.38]],'#f1a357');
    c.globalAlpha=(1-progress)*.7;
    for(let i=0;i<12;i++){
      const angle=i/12*Math.PI*2,spread=radius*.85;
      rect(x+Math.cos(angle)*spread,y-27+Math.sin(angle)*spread*.5-progress*18,3+(i%3)*2,4,'#ffe4ae');
    }
    c.restore();
  }
  function render(state,dt=1/60){
    const time=state.time||0,level=clamp(state.level||0,0,2);
    const baseCamera=W<BASE_W&&state.player?state.player.x-360:(state.cameraX||0);
    const mobile=mobileFraming.enabled&&Boolean(state.mode)&&Boolean(state.player);
    if(mobile)mobileView=updateCamera(mobileView,state,mobileFraming,state.mode==='playing'?dt:0);
    const cam=mobile?mobileView.x:clamp(baseCamera-(W-BASE_W)/2,0,Math.max(0,WORLD_W-W));
    const camY=mobile?mobileView.y:0;
    worldBottom=H+Math.max(0,camY)+32;
    if(!(state.hitStop>0))lastActionTime=time;
    const t=state.hitStop>0?lastActionTime:time;
    currentLocale=SIGNS[state.locale]?state.locale:'ru';
    if(state.player?.hp<lastHP)shake=.16;
    else if(state.kills>lastKills)shake=Math.max(shake,.07);
    if((state.specialTimer||0)>lastSpecial)shake=Math.max(shake,.22);
    lastSpecial=state.specialTimer||0;
    lastHP=state.player?.hp??120;lastKills=state.kills||0;shake=Math.max(0,shake-dt);
    rect(0,0,W,H,palettes[level].sky);
    c.save();c.imageSmoothingEnabled=false;
    const shakePixels=Math.max(shake*22,Math.min(8,state.screenShake||0));
    if(shakePixels&&!reduceMotion)c.translate(Math.round(Math.sin(t*113)*shakePixels),Math.round(Math.cos(t*97)*shakePixels*.65));
    c.translate(0,-camY);
    [city,forest,factory][level](cam,reduceMotion?0:t);
    for(const p of state.pickups||[])pickup(p,cam,t);
    shockwave(state,cam);
    const entities=(state.enemies||[]).map(e=>({y:e.y,e}));if(state.player)entities.push({y:state.player.y,p:state.player});
    entities.sort((a,b)=>a.y-b.y);for(const e of entities)e.p?hero(e.p,state,cam,t):enemy(e.e,cam,t);
    for(const hit of state.impacts||[])impact(hit,cam);
    for(const p of state.particles||[]){c.globalAlpha=clamp(p.life/(p.maxLife||1),0,1);rect(p.x-cam,p.y,p.size||3,p.size||3,p.color||'#ffd187');}c.globalAlpha=1;
    for(const tx of state.texts||[]){c.globalAlpha=clamp(tx.life/(tx.maxLife||1)*2,0,1);label(tx.text,tx.x-cam+1,tx.y+2,tx.text.length>5?13:18,'#17202a','center');label(tx.text,tx.x-cam,tx.y,tx.text.length>5?13:18,tx.color||'#ffda96','center');}c.globalAlpha=1;
    foreground(level,cam,t);c.restore();
    atmosphere(level,state,t);
    if(mobile)drawEdgeWarnings(state,mobileView);
  }
  function drawEdgeWarnings(state,view){
    for(const arrow of edgeIndicators(state,view,mobileFraming)){
      const {x,y,dx,dy}=arrow;
      c.save();c.globalAlpha=.83;
      rect(x-14,y-13,28,26,'#14202a');
      if(dx)poly([[x+dx*10,y],[x-dx*2,y-7],[x-dx*2,y+7]],'#e6b56c');
      else poly([[x,y+dy*9],[x-7,y-dy*2],[x+7,y-dy*2]],'#e6b56c');
      if(arrow.count>1)label(String(arrow.count),x-dx*7,y-5,10,'#f3ddae','center');
      c.restore();
    }
  }
  function drawMenu(level=0,locale='ru'){
    if(W!==BASE_W)resize(BASE_W,H);
    mobileView=null;
    menuTime+=1/60;
    render({level,locale,time:menuTime,cameraX:120,player:{x:500,y:452,face:1,hp:120,walkTime:0},enemies:[],pickups:[],buffs:{},particles:[],texts:[]},1/60);
  }
  return {render,drawMenu,itemIcon,resize,setMobileFraming,getCameraView:()=>mobileView?{...mobileView}:null};
}
