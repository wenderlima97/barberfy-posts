// Uso: node tools/reel.js spec.json saida.mp4
// spec: {"scenes":[{"theme":"dark|light","kicker":"","title":"","bullets":[""],"sub":"","cta":"","logo":true,"duration":3.5}]}
const {chromium}=require('playwright');
const {spawn,execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');
const [specPath,outPath,timelinePath]=process.argv.slice(2);
const spec=JSON.parse(fs.readFileSync(specPath,'utf8'));
const root=path.resolve(__dirname,'..');
const b64=f=>fs.readFileSync(path.join(root,'brand',f)).toString('base64');
const LOGO={dark:'data:image/jpeg;base64,'+b64('logo-branca.jpg'),light:'data:image/png;base64,'+b64('logo-preta.png')};
const W=1080,H=1920,FPS=30;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function html(s,idx){
  const dark=s.theme!=='light';
  const bg=dark?'#000':'#EFEFEF',fg=dark?'#fff':'#0A0A0A',mut=dark?'#8C8C8C':'#555',line=dark?'#2E2E2E':'#BDBDBD';
  let t=(idx>0?0.35:0.1),els='';const ev=[];
  const add=(cls,inner,gap,type)=>{els+=`<div class="a ${cls}" data-s="${t.toFixed(2)}">${inner}</div>`;ev.push({t:+t.toFixed(2),type:type||cls});t+=gap;};
  if(s.kicker)add('k',esc(s.kicker),0.3);
  if(s.title){
    const words=esc(s.title).split(' ');
    els+=`<div class="t" data-s="${t.toFixed(2)}" data-n="${words.length}">`+words.map((w,i)=>`<span class="m"><span class="w">${w}</span></span>`).join(' ')+`</div>`;
    ev.push({t:+t.toFixed(2),type:'title'});t+=0.12*words.length+0.35;
    els+=`<div class="bar" data-s="${t.toFixed(2)}"></div>`;ev.push({t:+t.toFixed(2),type:'bar'});t+=0.45;
  }
  (s.bullets||[]).forEach(b=>add('b',`<i></i><span>${esc(b)}</span>`,0.85,'b'));
  if(s.sub)add('sub',esc(s.sub),0.55);
  if(s.cta)add('cta',esc(s.cta),0.55);
  if(s.logo)add('lg',`<img src="${LOGO[dark?'dark':'light']}"><div class="w2">BARBERFY</div>`,0.4);
  const wipe=idx>0?`<div id="wp"></div>`:'';
  const page=`<!doctype html><meta charset=utf-8><style>
  *{box-sizing:border-box}body{margin:0;width:${W}px;height:${H}px;background:${bg};color:${fg};font-family:'Inter',sans-serif;overflow:hidden}
  #r{position:absolute;inset:0;padding:260px 88px 340px;display:flex;flex-direction:column;justify-content:center;gap:40px;transform-origin:50% 50%}
  #wp{position:absolute;inset:0;background:${dark?'#EFEFEF':'#000'};z-index:9}
  .grain{position:absolute;inset:0;z-index:8;opacity:.07;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");mix-blend-mode:${dark?'screen':'multiply'}}
  .a{opacity:0}.k{font-size:30px;letter-spacing:.3em;text-transform:uppercase;color:${mut}}
  .t{font-family:'Anton','Inter Display','Inter';font-weight:900;font-size:150px;line-height:1;letter-spacing:-.03em;text-transform:uppercase}
  .m{display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.06em}.w{display:inline-block;transform:translateY(110%)}
  .bar{height:12px;width:0;background:${fg}}
  .b{display:flex;align-items:center;gap:28px;font-size:48px;font-weight:600;line-height:1.25;border-top:1px solid ${line};padding-top:30px}
  .b i{width:18px;height:18px;background:${fg};flex:none}.sub{font-size:40px;font-weight:600;color:${mut}}
  .cta{font-size:46px;font-weight:700}.lg{display:flex;flex-direction:column;align-items:center;gap:20px;margin-top:20px}
  .lg img{width:150px;height:150px;object-fit:contain}.w2{font-size:26px;letter-spacing:.5em;padding-left:.5em}
  </style><div id=r>${els}</div><div class=grain></div>${wipe}<script>
  const E=x=>1-Math.pow(1-x,3),B=x=>{const c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
  const cl=x=>Math.max(0,Math.min(1,x));
  window.setT=(t,d)=>{
   document.querySelectorAll('.a').forEach(e=>{const p=cl((t-parseFloat(e.dataset.s))/0.5);e.style.opacity=E(p);e.style.transform='translateY('+((1-E(p))*80)+'px)'});
   document.querySelectorAll('.t').forEach(e=>{const s0=parseFloat(e.dataset.s);e.querySelectorAll('.w').forEach((w,i)=>{const p=cl((t-s0-i*0.12)/0.5);w.style.transform='translateY('+((1-B(p))*110)+'%)'})});
   document.querySelectorAll('.bar').forEach(e=>{const p=cl((t-parseFloat(e.dataset.s))/0.45);e.style.width=(E(p)*220)+'px'});
   const wp=document.getElementById('wp');if(wp){const p=cl(t/0.4);wp.style.transform='translateY('+(-E(p)*100)+'%)'}
   const z=1+0.035*t/d;document.getElementById('r').style.transform='scale('+z+')';};
  </script>`;
  return {page,ev};
}
(async()=>{
  const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'reel-'));
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:W,height:H}});
  const files=[];const timeline={scenes:[],events:[],total:0};let off=0;
  for(let i=0;i<spec.scenes.length;i++){
    const s=spec.scenes[i],d=s.duration||3.5,n=Math.round(d*FPS);
    const h=html(s,i);await page.setContent(h.page);timeline.scenes.push({start:+off.toFixed(2),dur:d,theme:s.theme||'dark'});if(i>0)timeline.events.push({t:+off.toFixed(2),type:'scene'});h.ev.forEach(e=>timeline.events.push({t:+(off+e.t).toFixed(2),type:e.type}));off+=d;await page.evaluate(()=>document.fonts.ready);
    const part=path.join(tmp,`s${i}.tmp.mp4`);
    const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate',String(FPS),'-c:v','mjpeg','-i','-','-c:v','libx264','-crf','18','-preset','veryfast','-pix_fmt','yuv420p','-r',String(FPS),part]);
    const done=new Promise(r=>ff.on('close',r));
    for(let f=0;f<n;f++){
      await page.evaluate(([t,d])=>setT(t,d),[f/FPS,d]);
      const buf=await page.screenshot({type:'jpeg',quality:90});
      if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
    }
    ff.stdin.end();const code=await done;if(code!==0)throw new Error('ffmpeg falhou na cena '+i);
    const fin=path.join(tmp,`s${i}.mp4`);fs.renameSync(part,fin);files.push(fin);
  }
  await browser.close();timeline.total=+off.toFixed(2);if(timelinePath)fs.writeFileSync(timelinePath,JSON.stringify(timeline));
  fs.writeFileSync(path.join(tmp,'list.txt'),files.map(f=>`file '${f}'`).join('\n'));
  const cat=path.join(tmp,'cat.tmp.mp4');
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(tmp,'list.txt'),'-c','copy',cat]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',cat,'-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-shortest','-movflags','+faststart',outPath]);
  console.log('ok',outPath);
})().catch(e=>{console.error(e);process.exit(1)});
