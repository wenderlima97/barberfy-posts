// Uso: node tools/reel.js spec.json saida.mp4
// spec: {"scenes":[{"theme":"dark|light","kicker":"","title":"","bullets":[""],"sub":"","cta":"","logo":true,"duration":3.5}]}
const {chromium}=require('playwright');
const {spawn,execFileSync}=require('child_process');
const fs=require('fs'),path=require('path');
const [specPath,outPath]=process.argv.slice(2);
const spec=JSON.parse(fs.readFileSync(specPath,'utf8'));
const root=path.resolve(__dirname,'..');
const b64=f=>fs.readFileSync(path.join(root,'brand',f)).toString('base64');
const LOGO={dark:'data:image/jpeg;base64,'+b64('logo-branca.jpg'),light:'data:image/png;base64,'+b64('logo-preta.png')};
const W=1080,H=1920,FPS=30;
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
function html(s){
  const dark=s.theme!=='light';
  const bg=dark?'#000':'#EFEFEF',fg=dark?'#fff':'#0A0A0A',mut=dark?'#8C8C8C':'#555',line=dark?'#2E2E2E':'#BDBDBD';
  let t=0.15,els='';
  const add=(cls,inner,gap=0.45)=>{els+=`<div class="a ${cls}" data-s="${t.toFixed(2)}">${inner}</div>`;t+=gap;};
  if(s.kicker)add('k',esc(s.kicker),0.35);
  if(s.title)add('t',esc(s.title),0.6);
  (s.bullets||[]).forEach(b=>add('b',`<i></i><span>${esc(b)}</span>`,0.8));
  if(s.sub)add('sub',esc(s.sub),0.5);
  if(s.cta)add('cta',esc(s.cta),0.5);
  if(s.logo)add('lg',`<img src="${LOGO[dark?'dark':'light']}"><div class="w">BARBERFY</div>`,0.4);
  return `<!doctype html><meta charset=utf-8><style>
  *{box-sizing:border-box}body{margin:0;width:${W}px;height:${H}px;background:${bg};color:${fg};font-family:'Inter',sans-serif;overflow:hidden}
  #r{position:absolute;inset:0;padding:260px 88px 340px;display:flex;flex-direction:column;justify-content:center;gap:44px;transform-origin:50% 50%}
  .a{opacity:0}.k{font-size:30px;letter-spacing:.3em;text-transform:uppercase;color:${mut}}
  .t{font-family:'Anton','Inter Display','Inter';font-weight:900;font-size:150px;line-height:.98;letter-spacing:-.03em;text-transform:uppercase}
  .b{display:flex;align-items:center;gap:28px;font-size:46px;font-weight:600;line-height:1.25;border-top:1px solid ${line};padding-top:30px}
  .b i{width:18px;height:18px;background:${fg};flex:none}.sub{font-size:40px;font-weight:600;color:${mut}}
  .cta{font-size:44px;font-weight:700}.lg{display:flex;flex-direction:column;align-items:center;gap:20px;margin-top:20px}
  .lg img{width:140px;height:140px;object-fit:contain}.w{font-size:26px;letter-spacing:.5em;padding-left:.5em}
  </style><div id=r>${els}</div><script>
  const ease=x=>1-Math.pow(1-x,3);
  window.setT=(t,d)=>{document.querySelectorAll('.a').forEach(e=>{const p=Math.max(0,Math.min(1,(t-parseFloat(e.dataset.s))/0.45));e.style.opacity=ease(p);e.style.transform='translateY('+((1-ease(p))*70)+'px)'});
  document.getElementById('r').style.transform='scale('+(1+0.025*t/d)+')';};
  </script>`;
}
(async()=>{
  const tmp=fs.mkdtempSync(path.join(require('os').tmpdir(),'reel-'));
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:W,height:H}});
  const files=[];
  for(let i=0;i<spec.scenes.length;i++){
    const s=spec.scenes[i],d=s.duration||3.5,n=Math.round(d*FPS);
    await page.setContent(html(s));await page.evaluate(()=>document.fonts.ready);
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
  await browser.close();
  fs.writeFileSync(path.join(tmp,'list.txt'),files.map(f=>`file '${f}'`).join('\n'));
  const cat=path.join(tmp,'cat.tmp.mp4');
  execFileSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',path.join(tmp,'list.txt'),'-c','copy',cat]);
  execFileSync('ffmpeg',['-y','-loglevel','error','-i',cat,'-f','lavfi','-i','anullsrc=r=44100:cl=stereo','-map','0:v','-map','1:a','-c:v','copy','-c:a','aac','-shortest','-movflags','+faststart',outPath]);
  console.log('ok',outPath);
})().catch(e=>{console.error(e);process.exit(1)});
