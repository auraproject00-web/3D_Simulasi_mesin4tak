import { createSim } from '../src/sim.js';
const out=[];const log=(...a)=>out.push(a.join(' '));
function mk(){const s=createSim();return s;}
// 1. idle in slow-mo steps (dt/20)
{const sim=mk(),st=sim.state;sim.key();let t=0;for(let k=0;k<60*2;k++){sim.step(1/60);if(st.running)sim.release();sim.clearEvents();}
 for(let k=0;k<60*20*3;k++){sim.step(1/1200);sim.clearEvents();} log('slowmo idle rpm',st.rpm.toFixed(0),'running',st.running,'pv len',st.pv.length);}
// 2. stall under load at idle, state after
{const sim=mk(),st=sim.state;sim.key();for(let k=0;k<120;k++){sim.step(1/60);if(st.running)sim.release();sim.clearEvents();}
 sim.setLoad(0.6);for(let k=0;k<300;k++){sim.step(1/60);sim.clearEvents();}
 log('stall: rpm',st.rpm.toFixed(1),'fuel',st.fuel,'running',st.running,'starter',st.starter,'fuelLph',st.fuelLph.toFixed(2),'lastPeak',(st.lastPeak/1e5).toFixed(1));}
// 3. start with heavy load
{const sim=mk(),st=sim.state;sim.setLoad(1);sim.key();let mx=0;for(let k=0;k<210;k++){sim.step(1/60);mx=Math.max(mx,st.rpm);sim.clearEvents();}log('start under full load max rpm',mx.toFixed(0),'running',st.running);}
// 4. rev limiter WOT no load
{const sim=mk(),st=sim.state;sim.key();for(let k=0;k<120;k++){sim.step(1/60);if(st.running)sim.release();sim.clearEvents();}
 sim.setThrottle(1);let mx=0,mf=0;for(let k=0;k<600;k++){sim.step(1/60);mx=Math.max(mx,st.rpm);if(st.misfire)mf++;sim.clearEvents();}log('WOT max rpm',mx.toFixed(0),'misfire frames',mf);}
// 5. stop then restart while spinning down
{const sim=mk(),st=sim.state;sim.key();for(let k=0;k<120;k++){sim.step(1/60);if(st.running)sim.release();sim.clearEvents();}
 sim.setThrottle(0.5);for(let k=0;k<120;k++){sim.step(1/60);sim.clearEvents();}sim.stop();for(let k=0;k<20;k++){sim.step(1/60);sim.clearEvents();}
 const r0=st.rpm;sim.key();for(let k=0;k<120;k++){sim.step(1/60);if(st.running)sim.release();sim.clearEvents();}log('restart from',r0.toFixed(0),'->',st.rpm.toFixed(0),'running',st.running,'starter',st.starter);}
// 6. NaN guard long run with random inputs
{const sim=mk(),st=sim.state;sim.key();let bad=0;for(let k=0;k<60*120;k++){if(k%90==0){sim.setThrottle(Math.random());sim.setLoad(Math.random()*0.8);}if(st.running)sim.release();if(!st.fuel&&Math.random()<0.01)sim.key();sim.step(Math.random()<0.02?0.05:1/60);if(!isFinite(st.rpm)||!isFinite(st.p))bad++;sim.clearEvents();}log('random 2min NaN frames',bad,'rpm',st.rpm.toFixed(0),'temp',st.brakeTemp.toFixed(0));}
// 7. backward rotation after stop
{const sim=mk(),st=sim.state;sim.key();for(let k=0;k<120;k++){sim.step(1/60);if(st.running)sim.release();sim.clearEvents();}sim.stop();let mn=0;for(let k=0;k<600;k++){sim.step(1/60);mn=Math.min(mn,st.rpm);sim.clearEvents();}log('min rpm while stopping',mn.toFixed(0),'final',st.rpm.toFixed(2));}
console.log(out.join('\n'));
