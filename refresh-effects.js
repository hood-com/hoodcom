(() => {
  'use strict';
  let canvas, context, particles = [], frame, mode = 'idle', buttonCenter = { x: innerWidth - 45, y: innerHeight - 180 }, message, endTimer;
  const colors = ['#FFD700','#FFE66B','#FFB300','#FFF4A3','#FFFFFF'];
  const random = (min, max) => min + Math.random() * (max - min);
  const ensureLayer = () => {
    if (canvas) return;
    canvas = document.createElement('canvas'); canvas.id = 'hudRefreshParticles';
    const ratio=Math.min(devicePixelRatio||1,1.5); canvas.width=innerWidth*ratio; canvas.height=innerHeight*ratio;
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:2147483500;pointer-events:none;';
    context=canvas.getContext('2d',{alpha:true}); context.scale(ratio,ratio); document.body.append(canvas);
    message = document.createElement('div'); message.className = 'hud-refresh-success-text'; document.body.append(message);
  };
  const resize = () => { if (!canvas) return; const ratio=Math.min(devicePixelRatio||1,1.5);canvas.width=innerWidth*ratio;canvas.height=innerHeight*ratio;context=canvas.getContext('2d',{alpha:true});context.scale(ratio,ratio); };
  addEventListener('resize', resize, { passive:true });
  const spawn = (button) => {
    ensureLayer(); clearTimeout(endTimer); message.classList.remove('show','error');
    const rect=button?.getBoundingClientRect?.(); buttonCenter=rect?{x:rect.left+rect.width/2,y:rect.top+rect.height/2}:{x:innerWidth-42,y:innerHeight-170};
    const count=Math.min(190,Math.max(90,Math.round(innerWidth*innerHeight/5200)));
    particles=Array.from({length:count},(_,i)=>{const angle=random(0,Math.PI*2),speed=random(2.2,10.5);return{x:buttonCenter.x,y:buttonCenter.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,size:random(1.2,4.2),color:colors[i%colors.length],alpha:1,targetX:null,targetY:null,phase:random(0,6.28)};});
    mode='scatter'; cancelAnimationFrame(frame); animate();
  };
  const textTargets = (text) => {
    const off=document.createElement('canvas'),ctx=off.getContext('2d');off.width=innerWidth;off.height=180;
    const size=Math.max(28,Math.min(58,innerWidth/9));ctx.font=`900 ${size}px Tajawal,Arial`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(text,innerWidth/2,90);
    const data=ctx.getImageData(0,0,off.width,off.height).data,pts=[],step=5;
    for(let y=0;y<off.height;y+=step)for(let x=0;x<off.width;x+=step)if(data[(y*off.width+x)*4+3]>100)pts.push({x,y:y+innerHeight/2-90});
    return pts.length?pts:[{x:innerWidth/2,y:innerHeight/2}];
  };
  const finish = (success=true) => {
    if(!canvas)return; const text=success?'تم التحديث بنجاح':'تعذر إكمال التحديث';const targets=textTargets(text);
    particles.forEach((p,i)=>{const t=targets[i%targets.length];p.targetX=t.x+random(-2,2);p.targetY=t.y+random(-2,2);});
    mode='text';message.textContent=text;message.classList.toggle('error',!success);
    setTimeout(()=>message.classList.add('show'),500);
    endTimer=setTimeout(()=>{message.classList.remove('show');mode='return';particles.forEach(p=>{p.targetX=buttonCenter.x;p.targetY=buttonCenter.y;});setTimeout(cleanup,900);},4500);
  };
  const cleanup=()=>{cancelAnimationFrame(frame);canvas?.remove();message?.remove();canvas=null;message=null;particles=[];mode='idle';};
  const animate=()=>{
    if(!context||!canvas)return;context.clearRect(0,0,innerWidth,innerHeight);context.globalCompositeOperation='lighter';
    particles.forEach((p,i)=>{
      if(mode==='scatter'){p.vx*=.985;p.vy*=.985;p.vy+=Math.sin(Date.now()/260+p.phase)*.055;p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>innerWidth)p.vx*=-1;if(p.y<0||p.y>innerHeight)p.vy*=-1;}
      else if(mode==='text'||mode==='return'){const force=mode==='text'?.075:.12;p.x+=(p.targetX-p.x)*force;p.y+=(p.targetY-p.y)*force;p.x+=Math.sin(Date.now()/120+p.phase)*(mode==='text'?.35:.1);p.size=mode==='return'?Math.max(.2,p.size*.975):p.size;}
      context.beginPath();context.fillStyle=p.color;context.globalAlpha=Math.max(.15,p.alpha);context.shadowBlur=7;context.shadowColor=p.color;context.arc(p.x,p.y,p.size,0,Math.PI*2);context.fill();
    });context.globalAlpha=1;frame=requestAnimationFrame(animate);
  };
  globalThis.HudRefreshFX={start:spawn,success:()=>finish(true),error:()=>finish(false)};
})();
