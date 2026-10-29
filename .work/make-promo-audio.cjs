const fs=require('fs');
const sr=44100, dur=60, n=sr*dur, ch=2, data=Buffer.alloc(n*ch*2);
function add(t, f, len, amp, type='sine', pan=0){const start=Math.max(0,Math.floor(t*sr)), count=Math.min(Math.floor(len*sr),n-start); for(let i=0;i<count;i++){const tt=i/sr, env=Math.exp(-tt/(len*.42)); let v=0; if(type==='kick'){v=Math.sin(2*Math.PI*(95-55*tt/len)*tt)*env; v+=.35*Math.sin(2*Math.PI*180*tt)*Math.exp(-tt/.035);} else if(type==='hat'){v=(Math.random()*2-1)*env*.55;} else if(type==='clap'){v=(Math.random()*2-1)*env*.35 + Math.sin(2*Math.PI*210*tt)*env*.18;} else {v=Math.sin(2*Math.PI*f*tt)*env;} v*=amp; const li=start+i; for(let c=0;c<2;c++){const p=c===0?1-pan:1+pan; const off=(li*2+c)*2; let old=data.readInt16LE(off); let nv=Math.max(-32767,Math.min(32767,old+v*p*32767)); data.writeInt16LE(nv,off)}}}
// 122 BPM, syncopated 4-bar groove
const bpm=122, beat=60/bpm, bar=beat*4;
for(let t=0;t<dur;t+=bar){
  [0,1.5,2.5].forEach(b=>add(t+b*beat,0,.18,.8,'kick',0));
  [1,3].forEach(b=>add(t+b*beat,0,.16,.35,'clap',-.1));
  for(let k=0;k<8;k++) add(t+k*beat/2,0,.045,.13,'hat',k%2?-.25:.25);
  // bass motif
  [[0,73],[.75,73],[1.5,82],[2.5,65],[3.25,73]].forEach(([b,f])=>add(t+b*beat,f,.25,.22,'sine',0));
}
// section stings on scene changes
[7.5,15,22.5,30,37.5,45,52.5].forEach(t=>{add(t,880,.08,.32,'sine',-.2);add(t+.05,1175,.12,.25,'sine',.2)});
const header=Buffer.alloc(44); header.write('RIFF',0); header.writeUInt32LE(36+data.length,4); header.write('WAVE',8); header.write('fmt ',12); header.writeUInt32LE(16,16); header.writeUInt16LE(1,20); header.writeUInt16LE(ch,22); header.writeUInt32LE(sr,24); header.writeUInt32LE(sr*ch*2,28); header.writeUInt16LE(ch*2,32); header.writeUInt16LE(16,34); header.write('data',36); header.writeUInt32LE(data.length,40);
fs.writeFileSync(process.argv[2]||'promo-beat.wav',Buffer.concat([header,data]));
