// @ts-nocheck
'use client';

import { useState, useMemo, useEffect, useRef, createContext, useContext } from "react";
import {
  ComposedChart, LineChart, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  Area, Bar as RBar, Line, ReferenceLine, ResponsiveContainer,
} from "recharts";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THEME CONTEXT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const TC = createContext<any>(null);
const useT = () => useContext(TC);

const mkTheme = dm => ({
  bg:     dm?"#060E1C":"#EEF2F7", surf:  dm?"#0C1828":"#FFFFFF",
  surf2:  dm?"#101E33":"#F1F5F9", bdr:   dm?"#1A2E48":"#E2E8F0",
  t1:     dm?"#E2EBF6":"#0F172A", t2:    dm?"#6A83A2":"#475569",
  t3:     dm?"#3C5270":"#94A3B8",
  nav:    "#040C18",              navT:  dm?"#3C5270":"#64748B",
  pri:    "#2563EB",              priH:  "#1D4ED8",
  crit:   "#DC2626", critBg: dm?"#1B0707":"#FEF2F2", critBd: dm?"#7F1D1D":"#FCA5A5",
  warn:   "#D97706", warnBg: dm?"#1B1200":"#FFFBEB", warnBd: dm?"#78350F":"#FDE68A",
  good:   "#059669", goodBg: dm?"#051410":"#ECFDF5", goodBd: dm?"#064E3B":"#A7F3D0",
  tick:   "#7C3AED", tickBg: dm?"#100720":"#F5F3FF", tickBd: dm?"#4C1D95":"#DDD6FE",
  auto:   "#2563EB", autoBg: dm?"#0C1828":"#EFF6FF", autoBd: dm?"#1D4ED8":"#BFDBFE",
  teal:   "#0D9488", tealBg: dm?"#051510":"#F0FDFA", tealBd: dm?"#134E4A":"#99F6E4",
  sh:  dm?"0 1px 4px rgba(0,0,0,.5)":"0 1px 3px rgba(0,0,0,.07)",
  sh2: dm?"0 8px 32px rgba(0,0,0,.65)":"0 8px 24px rgba(0,0,0,.11)",
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CSS INJECTION (animations, scrollbar, reset)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CSS = `*{box-sizing:border-box;margin:0;}body{font-family:Inter,system-ui,sans-serif;}
button{cursor:pointer;}input,select{outline:none;font-family:inherit;}
::-webkit-scrollbar{width:5px;height:5px;}::-webkit-scrollbar-thumb{background:#334155;border-radius:3px;}
.dr{animation:dr .22s cubic-bezier(.22,1,.36,1);}@keyframes dr{from{transform:translateX(100%)}}
.ti{animation:ti .28s cubic-bezier(.22,1,.36,1);}@keyframes ti{from{opacity:0;transform:translateY(-10px)}}
.fi{animation:fi .18s ease;}@keyframes fi{from{opacity:0;transform:translateY(-3px)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// THRESHOLDS + AGENT EVALUATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const DEF_TH={pg:24,sc:24,dt:16,mp:16};

const evalAgent=(b,th)=>{
  const br=[];
  if((b.pg??0)>th.pg) br.push(`Price Gap (${b.pg}>${th.pg}/30)`);
  if(b.sc>th.sc) br.push(`Stock Coverage (${b.sc}>${th.sc}/30)`);
  if(b.dt>th.dt) br.push(`Demand Trend (${b.dt}>${th.dt}/20)`);
  if(b.mp>th.mp) br.push(`Margin Proximity (${b.mp}>${th.mp}/20)`);
  return {auto:!br.length,breaches:br};
};

const computeMetrics=(skus,tickets,audit)=>{
  const critical=skus.filter(s=>s.band==="CRITICAL").length;
  const warning=skus.filter(s=>s.band==="WARNING").length;
  const healthy=skus.filter(s=>s.band==="HEALTHY").length;
  const dMap={};skus.forEach(s=>{dMap[s.topDriver]=(dMap[s.topDriver]||0)+1;});
  const topDriver=Object.entries(dMap).sort((a,b)=>b[1]-a[1])[0];
  const openTickets=tickets.filter(t=>t.status==="OPEN").length;
  const autoActions=audit.filter(a=>a.type==="AUTONOMOUS").length;
  const avgRisk=Math.round(skus.reduce((s,sk)=>s+sk.composite,0)/skus.length);
  return {total:skus.length,critical,warning,healthy,topDriver,openTickets,autoActions,avgRisk};
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED ATOMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Pill=({band,children,style:sx={}})=>{
  const t=useT();
  const cs=band==="CRITICAL"?{c:t.crit,bg:t.critBg,bd:t.critBd}
    :band==="WARNING"?{c:t.warn,bg:t.warnBg,bd:t.warnBd}
    :band==="HEALTHY"?{c:t.good,bg:t.goodBg,bd:t.goodBd}
    :band==="TICKET"?{c:t.tick,bg:t.tickBg,bd:t.tickBd}
    :band==="AUTO"?{c:t.auto,bg:t.autoBg,bd:t.autoBd}
    :{c:t.t2,bg:t.surf2,bd:t.bdr};
  return <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:"2px 8px",borderRadius:999,
    fontSize:11,fontWeight:700,background:cs.bg,color:cs.c,border:`1px solid ${cs.bd}`,...sx}}>
    {children||band}
  </span>;
};

const Bar=({val,max,band})=>{
  const t=useT();
  const pct=Math.round((val/max)*100);
  const c=band==="CRITICAL"?t.crit:band==="WARNING"?t.warn:t.good;
  return <div style={{width:"100%",height:6,background:t.bdr,borderRadius:3,overflow:"hidden"}}>
    <div style={{width:`${pct}%`,height:"100%",background:c,borderRadius:3}}/>
  </div>;
};

const Toggle=({val,onChange})=>(
  <button onClick={()=>onChange(!val)} style={{
    position:"relative",width:44,height:24,borderRadius:99,border:"none",
    background:val?"#2563EB":"#94A3B8",transition:"background .2s",cursor:"pointer"}}>
    <span style={{position:"absolute",top:2,left:val?20:2,width:20,height:20,
      background:"#fff",borderRadius:"50%",transition:"left .2s",boxShadow:"0 1px 3px rgba(0,0,0,.3)"}}/>
  </button>
);

const Btn=({onClick,children,variant="primary",disabled,style:sx={}})=>{
  const t=useT();
  const vs={
    primary:{background:t.pri,color:"#fff",border:"none"},
    secondary:{background:"transparent",color:t.t2,border:`1px solid ${t.bdr}`},
    danger:{background:"#DC2626",color:"#fff",border:"none"},
    ghost:{background:"transparent",color:t.pri,border:"none"},
    teal:{background:t.teal,color:"#fff",border:"none"},
    ticket:{background:t.tick,color:"#fff",border:"none"},
  };
  return <button onClick={onClick} disabled={disabled} style={{
    display:"inline-flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:8,
    fontSize:13,fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.5:1,
    transition:"opacity .15s",...vs[variant],...sx}}>
    {children}
  </button>;
};

const NInput=({value,onChange,min,max,suffix,label})=>{
  const t=useT();
  return <div style={{display:"flex",alignItems:"center",gap:8}}>
    {label&&<span style={{fontSize:13,color:t.t2,minWidth:160}}>{label}</span>}
    <input type="number" value={value} min={min} max={max}
      onChange={e=>onChange(Number(e.target.value))}
      style={{width:80,padding:"6px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,
        background:t.surf2,color:t.t1,fontSize:13,textAlign:"right"}}/>
    {suffix&&<span style={{fontSize:12,color:t.t3}}>{suffix}</span>}
  </div>;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKELETON
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const Sk=({w="100%",h=14,r=6,style:sx={}}:{w?:any,h?:number,r?:number,style?:any})=>{
  const t=useT();
  return <div style={{width:w,height:h,borderRadius:r,flexShrink:0,
    background:`linear-gradient(90deg,${t.bdr} 25%,${t.surf2} 50%,${t.bdr} 75%)`,
    backgroundSize:"200% 100%",animation:"shimmer 1.6s ease-in-out infinite",...sx}}/>;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIDEBAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Sidebar({page,setPage,critCount,openTickets}){
  const t=useT();
  const nav=[
    {id:"dashboard",lbl:"Dashboard",badge:critCount},
    {id:"tickets",  lbl:"Tickets",  badge:openTickets},
    {id:"audit",    lbl:"Audit Log",badge:null},
    {id:"settings", lbl:"Settings", badge:null},
  ];
  return <div style={{width:196,background:t.nav,display:"flex",flexDirection:"column",flexShrink:0}}>
    <div style={{height:56,display:"flex",alignItems:"center",padding:"0 16px",
      borderBottom:"1px solid rgba(255,255,255,.05)"}}>
      <span style={{color:"#3B82F6",marginRight:8,fontSize:16}}>⚡</span>
      <span style={{color:"#fff",fontWeight:700,fontSize:13.5,letterSpacing:"-.01em"}}>ASTRA</span>
    </div>
    <nav style={{flex:1,padding:"6px 0"}}>
      {nav.map(n=>(
        <button key={n.id} onClick={()=>setPage(n.id)} style={{
          width:"100%",display:"flex",alignItems:"center",padding:"9px 16px",border:"none",
          background:page===n.id?"rgba(59,130,246,.18)":"transparent",
          color:page===n.id?"#fff":t.navT,fontSize:13,fontWeight:page===n.id?600:400,
          cursor:"pointer",borderLeft:page===n.id?"2px solid #3B82F6":"2px solid transparent",
          transition:"all .15s",textAlign:"left"}}>
          <span style={{flex:1}}>{n.lbl}</span>
          {n.badge>0&&<span style={{background:"#EF4444",color:"#fff",borderRadius:99,
            fontSize:10,fontWeight:700,padding:"1px 6px"}}>{n.badge}</span>}
        </button>
      ))}
    </nav>
    <div style={{padding:14,borderTop:"1px solid rgba(255,255,255,.05)"}}>
      <div style={{color:"rgba(226,235,246,.5)",fontSize:11,fontWeight:500}}>Anirudha's Store</div>
      <div style={{color:"rgba(100,116,139,.5)",fontSize:10,marginTop:2}}>Amazon · Shopify</div>
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TOP BAR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TopBar({dm,setDm,waOn,lastSync,onRunAgents,agentRunning,unreadCount,notifOpen,setNotifOpen,period,setPeriod}){
  const t=useT();
  const syncLabel=lastSync?`${Math.round((Date.now()-lastSync)/1000)}s ago`:"—";
  return <div style={{height:56,background:t.surf,borderBottom:`1px solid ${t.bdr}`,
    display:"flex",alignItems:"center",justifyContent:"space-between",
    padding:"0 20px",flexShrink:0,boxShadow:t.sh}}>
    <div style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:t.t2}}>
      Last synced: <span style={{color:t.t1,fontWeight:500}}>{syncLabel}</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <select value={period} onChange={e=>setPeriod(e.target.value)} style={{
        padding:"5px 10px",borderRadius:8,border:`1px solid ${t.bdr}`,
        background:t.surf2,color:t.t1,fontSize:12,fontWeight:500,cursor:"pointer"}}>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
      </select>
      <button onClick={onRunAgents} disabled={agentRunning} style={{
        display:"inline-flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:8,
        border:"none",background:agentRunning?"#64748B":"#2563EB",color:"#fff",
        fontSize:12,fontWeight:600,cursor:agentRunning?"not-allowed":"pointer",
        opacity:agentRunning?.7:1,transition:"all .15s"}}>
        {agentRunning?<><span style={{display:"inline-block",width:12,height:12,border:"2px solid rgba(255,255,255,.3)",
          borderTop:"2px solid #fff",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Running…</>
          :<>▶ Run Agents</>}
      </button>
      <div style={{position:"relative"}}>
        <button onClick={()=>setNotifOpen(!notifOpen)} style={{
          position:"relative",width:36,height:36,borderRadius:8,border:`1px solid ${t.bdr}`,
          background:notifOpen?t.surf2:t.surf,color:t.t2,fontSize:16,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center"}}>
          🔔
          {unreadCount>0&&<span style={{position:"absolute",top:-4,right:-4,minWidth:18,height:18,
            borderRadius:99,background:"#EF4444",color:"#fff",fontSize:10,fontWeight:700,
            display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>
            {unreadCount>99?"99+":unreadCount}
          </span>}
        </button>
      </div>
      {waOn&&<span style={{fontSize:11,color:"#059669",background:t.goodBg,
        border:`1px solid ${t.goodBd}`,padding:"3px 10px",borderRadius:99}}>💬 WhatsApp ON</span>}
      <button onClick={()=>setDm(!dm)} style={{
        padding:"5px 12px",borderRadius:8,border:`1px solid ${t.bdr}`,
        background:t.surf2,color:t.t2,fontSize:12,fontWeight:500,cursor:"pointer"}}>
        {dm?"☀ Light Mode":"🌙 Dark Mode"}
      </button>
      <div style={{width:32,height:32,borderRadius:"50%",background:"#2563EB",
        color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:12,fontWeight:700}}>A</div>
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// NOTIFICATION PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const NOTIF_ICONS={TICKET_CREATED:"⚠️",TICKET_APPROVED:"✅",TICKET_REJECTED:"❌",AUTO_ACTION:"🤖",TICKET_ACTION:"🚩",RISK_ASSESSED:"📊"};
const NOTIF_COLORS=(t,type)=>type.startsWith("TICKET_C")?{c:t.tick,bg:t.tickBg,bd:t.tickBd}
  :type==="TICKET_APPROVED"?{c:t.good,bg:t.goodBg,bd:t.goodBd}
  :type==="TICKET_REJECTED"?{c:t.crit,bg:t.critBg,bd:t.critBd}
  :type==="AUTO_ACTION"?{c:t.auto,bg:t.autoBg,bd:t.autoBd}
  :{c:t.teal,bg:t.tealBg,bd:t.tealBd};

function NotificationPanel({notifications,unreadCount,onMarkAllRead,onClose,onNavigate}){
  const t=useT();
  const relTime=(ts)=>{
    if(!ts)return"—";
    const diff=Date.now()-new Date(ts).getTime();
    if(diff<60000)return"Just now";
    if(diff<3600000)return`${Math.floor(diff/60000)}m ago`;
    if(diff<86400000)return`${Math.floor(diff/3600000)}h ago`;
    return`${Math.floor(diff/86400000)}d ago`;
  };
  return <div className="fi" style={{position:"absolute",top:56,right:60,width:380,maxHeight:"70vh",
    background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:14,boxShadow:t.sh2,zIndex:40,
    display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{padding:"12px 16px",borderBottom:`1px solid ${t.bdr}`,display:"flex",
      alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:14,fontWeight:700,color:t.t1}}>Notifications</span>
        {unreadCount>0&&<span style={{background:"#EF4444",color:"#fff",borderRadius:99,
          fontSize:10,fontWeight:700,padding:"1px 7px"}}>{unreadCount}</span>}
      </div>
      <div style={{display:"flex",gap:8}}>
        {unreadCount>0&&<button onClick={onMarkAllRead} style={{fontSize:11,color:t.pri,
          background:"none",border:"none",cursor:"pointer",fontWeight:500}}>Mark all read</button>}
        <button onClick={onClose} style={{background:"none",border:"none",color:t.t3,
          fontSize:14,cursor:"pointer"}}>✕</button>
      </div>
    </div>
    <div style={{flex:1,overflowY:"auto"}}>
      {notifications.length===0&&<div style={{padding:32,textAlign:"center",color:t.t3,fontSize:13}}>
        No notifications yet
      </div>}
      {notifications.map(n=>{
        const nc=NOTIF_COLORS(t,n.type);
        return <div key={n.id} onClick={()=>onNavigate(n)} style={{
          padding:"10px 16px",borderBottom:`1px solid ${t.bdr}`,cursor:"pointer",
          background:n.read?"transparent":nc.bg,transition:"background .1s"}}>
          <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
            <span style={{fontSize:14,flexShrink:0,marginTop:2}}>{NOTIF_ICONS[n.type]||"🔔"}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:8}}>
                <span style={{fontSize:12,fontWeight:600,color:t.t1,overflow:"hidden",
                  textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.title}</span>
                <span style={{fontSize:10,color:t.t3,flexShrink:0}}>{relTime(n.timestamp)}</span>
              </div>
              {n.message&&<div style={{fontSize:11,color:t.t2,marginTop:2,overflow:"hidden",
                textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{n.message}</div>}
              <span style={{fontSize:10,fontWeight:600,color:nc.c,marginTop:3,display:"inline-block"}}>
                {n.type.replace(/_/g," ")}
              </span>
            </div>
            {!n.read&&<span style={{width:8,height:8,borderRadius:"50%",background:"#2563EB",
              flexShrink:0,marginTop:6}}/>}
          </div>
        </div>;
      })}
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI SUMMARY PANEL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AISummaryPanel({skus,tickets,audit}){
  const t=useT();
  const [collapsed,setCollapsed]=useState(false);
  const [aiInsights,setAiInsights]=useState(null);
  const [aiSource,setAiSource]=useState("none");
  const [loading,setLoading]=useState(false);
  const metrics=useMemo(()=>computeMetrics(skus,tickets,audit),[skus,tickets,audit]);

  useEffect(()=>{
    setLoading(true);
    fetch("/api/v1/insights").then(r=>r.ok?r.json():null)
      .then(d=>{
        if(d?.insights?.length){
          setAiInsights(d.insights);
          setAiSource(d.source||"agent-llm");
        }
        setLoading(false);
      })
      .catch(()=>setLoading(false));
  },[skus]);

  const stats=[
    {lbl:"Critical",val:metrics.critical,c:t.crit,bg:t.critBg,bd:t.critBd},
    {lbl:"Warning", val:metrics.warning, c:t.warn,bg:t.warnBg,bd:t.warnBd},
    {lbl:"Healthy", val:metrics.healthy, c:t.good,bg:t.goodBg,bd:t.goodBd},
    {lbl:"Open Tickets",val:metrics.openTickets,c:t.tick,bg:t.tickBg,bd:t.tickBd},
    {lbl:"Auto Actions",val:metrics.autoActions,c:t.auto,bg:t.autoBg,bd:t.autoBd},
  ];
  const fallbackLines=[
    `${metrics.critical} critical SKUs need immediate attention today.`,
    `${metrics.topDriver?.[0]||"Stock Coverage"} is the top risk driver across ${metrics.topDriver?.[1]||0} SKUs.`,
    `${metrics.openTickets} exception tickets awaiting your approval.`,
  ];
  const lines=aiInsights||fallbackLines;

  return <div style={{background:t.surf,borderBottom:`1px solid ${t.bdr}`,
    boxShadow:t.sh,flexShrink:0}}>
    <div style={{padding:"10px 20px",display:"flex",alignItems:"center",gap:12,cursor:"pointer"}}
      onClick={()=>setCollapsed(!collapsed)}>
      <span style={{fontSize:12,fontWeight:700,color:t.pri,letterSpacing:".06em"}}>✦ AI INSIGHT</span>
      <div style={{flex:1,display:"flex",gap:8,flexWrap:"wrap"}}>
        {stats.map(s=>(
          <div key={s.lbl} style={{display:"flex",alignItems:"center",gap:6,padding:"2px 10px",
            borderRadius:99,background:s.bg,border:`1px solid ${s.bd}`}}>
            <span style={{fontSize:15,fontWeight:800,color:s.c}}>{s.val}</span>
            <span style={{fontSize:11,color:s.c,opacity:.8}}>{s.lbl}</span>
          </div>
        ))}
      </div>
      <span style={{color:t.t3,fontSize:11}}>{collapsed?"▼ Show":"▲ Hide"}</span>
    </div>
    {!collapsed&&<div className="fi" style={{padding:"0 20px 12px",display:"flex",gap:16,alignItems:"flex-start"}}>
      <div style={{flex:1,fontSize:13,color:t.t2,lineHeight:1.65,minHeight:60}}>
        {loading?(
          <span style={{color:t.t3,fontStyle:"italic"}}>✦ Loading insights…</span>
        ):(
          lines.map((line,i)=>(
            <div key={i} style={{marginBottom:3}}>
              <span style={{color:t.pri}}>✦</span>{" "}
              <span>{String(line).replace(/^[•·]\s?/,"")}</span>
            </div>
          ))
        )}
      </div>
      <div style={{fontSize:11,color:t.t3,whiteSpace:"nowrap",paddingTop:4}}>
        {aiSource==="agent-llm"
          ?<span style={{color:t.good}}>✦ Powered by Azure OpenAI</span>
          :<span>Local fallback</span>}
        {" · "}Avg risk {metrics.avgRisk}/100
      </div>
    </div>}
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DASHBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function Dashboard({skus,setSelected,selected,tickets,audit,loading}){
  const t=useT();
  const [q,setQ]=useState(""),  [f,setF]=useState("ALL"),
        [col,setCol]=useState("composite"), [dir,setDir]=useState("desc"),
        [fOpen,setFOpen]=useState(false);

  const rows=useMemo(()=>{
    let l=skus;
    if(q) l=l.filter(s=>s.name.toLowerCase().includes(q.toLowerCase())||s.id.toLowerCase().includes(q.toLowerCase()));
    if(f!=="ALL") l=l.filter(s=>s.band===f);
    return [...l].sort((a,b)=>{
      const va=col==="composite"?a.composite:col==="pg"?a.b.pg??0:col==="sc"?a.b.sc:col==="dt"?a.b.dt:a.b.mp;
      const vb=col==="composite"?b.composite:col==="pg"?b.b.pg??0:col==="sc"?b.b.sc:col==="dt"?b.b.dt:b.b.mp;
      return dir==="desc"?vb-va:va-vb;
    });
  },[skus,q,f,col,dir]);

  const sort=c=>{if(col===c)setDir(d=>d==="desc"?"asc":"desc");else{setCol(c);setDir("desc");}};
  const SH=({c})=><span style={{color:col===c?"#2563EB":t.t3,fontSize:10}}>{col===c?(dir==="desc"?"↓":"↑"):"↕"}</span>;

  const bandC=(band)=>band==="CRITICAL"?t.crit:band==="WARNING"?t.warn:t.good;
  const bandBg=(band)=>band==="CRITICAL"?t.critBg:band==="WARNING"?t.warnBg:t.goodBg;

  const ticketedIds=new Set(tickets.filter(tk=>tk.status==="OPEN").map(tk=>tk.skuId));

  return <div style={{display:"flex",flexDirection:"column",flex:1,minHeight:0,overflow:"hidden"}}>
    <AISummaryPanel skus={skus} tickets={tickets} audit={audit}/>
    {/* Toolbar */}
    <div style={{padding:"10px 20px",display:"flex",alignItems:"center",gap:10,flexShrink:0,
      background:t.surf2,borderBottom:`1px solid ${t.bdr}`}}>
      <div style={{position:"relative"}}>
        <span style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",color:t.t3,fontSize:12}}>🔍</span>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search SKUs…"
          style={{paddingLeft:30,paddingRight:10,paddingTop:7,paddingBottom:7,borderRadius:8,
            border:`1px solid ${t.bdr}`,background:t.surf,color:t.t1,fontSize:13,width:210}}/>
      </div>
      <div style={{position:"relative"}}>
        <button onClick={()=>setFOpen(!fOpen)} style={{
          display:"flex",alignItems:"center",gap:6,padding:"7px 12px",borderRadius:8,
          border:`1px solid ${f!=="ALL"?"#2563EB":t.bdr}`,background:t.surf,
          color:f!=="ALL"?t.pri:t.t2,fontSize:13,cursor:"pointer"}}>
          ⚙ {f==="ALL"?"Filter":f} ▾
        </button>
        {fOpen&&<div className="fi" style={{position:"absolute",top:"calc(100% + 4px)",left:0,
          background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:10,boxShadow:t.sh2,
          zIndex:30,overflow:"hidden",width:150}}>
          {["ALL","CRITICAL","WARNING","HEALTHY"].map(x=>(
            <button key={x} onClick={()=>{setF(x);setFOpen(false);}} style={{
              width:"100%",padding:"9px 14px",border:"none",background:f===x?t.surf2:t.surf,
              color:f===x?t.pri:t.t1,fontSize:13,cursor:"pointer",textAlign:"left",
              fontWeight:f===x?600:400}}>
              {x==="ALL"?"All SKUs":x.charAt(0)+x.slice(1).toLowerCase()}
            </button>
          ))}
        </div>}
      </div>
      <div style={{marginLeft:"auto",fontSize:12,color:t.t3}}>{rows.length} / {skus.length} SKUs</div>
    </div>
    {/* Table */}
    <div style={{flex:1,overflow:"auto",background:t.surf}}>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:13,minWidth:820}}>
        <thead style={{position:"sticky",top:0,zIndex:10}}>
          <tr style={{background:t.surf2,borderBottom:`1px solid ${t.bdr}`}}>
            {[
              {c:"name",      l:"SKU",                 w:170, align:"left"},
              {c:"composite", l:"Composite Risk",      w:160, align:"left"},
              {c:"pg",        l:"Price Gap /30",        w:100, align:"center"},
              {c:"sc",        l:"Stock Cov /30",        w:100, align:"center"},
              {c:"dt",        l:"Demand /20",           w:90,  align:"center"},
              {c:"mp",        l:"Margin /20",           w:90,  align:"center"},
              {c:"status",    l:"Agent",                w:110, align:"center"},
              {c:"action",    l:"",                    w:80,  align:"center"},
            ].map(h=>(
              <th key={h.c} onClick={h.c!=="action"&&h.c!=="status"?()=>sort(h.c):undefined}
                style={{padding:"10px 12px",fontSize:11,fontWeight:600,color:t.t3,
                  textTransform:"uppercase",letterSpacing:".05em",textAlign:h.align,
                  cursor:h.c!=="action"&&h.c!=="status"?"pointer":"default",
                  width:h.w,userSelect:"none",whiteSpace:"nowrap"}}>
                {h.l} {h.c!=="action"&&h.c!=="status"&&<SH c={h.c}/>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((sku,i)=>{
            const sel=selected?.id===sku.id;
            const hasTick=ticketedIds.has(sku.id);
            const rowBg=sel?`${t.autoBg}`:sku.band==="CRITICAL"?t.critBg:"transparent";
            const borderC=sel?"#2563EB":sku.band==="CRITICAL"?t.crit:"transparent";
            const pct=(v,max)=>Math.round((v/max)*100);
            const dotC=(v,max)=>{const p=v/max;return p>.8?t.crit:p>.55?t.warn:t.good;};
            return (
              <tr key={sku.id} onClick={()=>setSelected(sku===selected?null:sku)}
                style={{borderBottom:`1px solid ${t.bdr}`,cursor:"pointer",
                  background:rowBg,borderLeft:`3px solid ${borderC}`,transition:"background .1s"}}>
                <td style={{padding:"11px 12px"}}>
                  <div style={{fontWeight:600,color:t.t1,fontSize:13}}>{sku.name}</div>
                  <div style={{fontFamily:"monospace",fontSize:11,color:t.t3,marginTop:2}}>{sku.id}</div>
                </td>
                <td style={{padding:"11px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontSize:20,fontWeight:800,fontFamily:"monospace",color:bandC(sku.band)}}>{sku.composite}</span>
                    <Pill band={sku.band}/>
                  </div>
                  <div style={{width:110,height:5,background:t.bdr,borderRadius:3,overflow:"hidden"}}>
                    <div style={{width:`${sku.composite}%`,height:"100%",background:bandC(sku.band),borderRadius:3}}/>
                  </div>
                </td>
                {[{v:sku.b.pg??0,m:30},{v:sku.b.sc,m:30},{v:sku.b.dt,m:20},{v:sku.b.mp,m:20}].map((d,idx)=>(
                  <td key={idx} style={{padding:"11px 12px",textAlign:"center"}}>
                    <div style={{display:"inline-flex",alignItems:"center",gap:4}}>
                      <span style={{width:8,height:8,borderRadius:"50%",background:dotC(d.v,d.m),display:"inline-block"}}/>
                      <span style={{fontWeight:700,fontFamily:"monospace",color:dotC(d.v,d.m)}}>{d.v}</span>
                    </div>
                  </td>
                ))}
                <td style={{padding:"11px 12px",textAlign:"center"}}>
                  {sku.agent.auto
                    ?<Pill band="AUTO">AUTO</Pill>
                    :<Pill band="TICKET">⚠ TICKET</Pill>}
                </td>
                <td style={{padding:"11px 12px",textAlign:"center"}}>
                  <button onClick={e=>{e.stopPropagation();setSelected(sku===selected?null:sku);}}
                    style={{fontSize:12,fontWeight:600,color:t.pri,background:t.autoBg,
                      border:`1px solid ${t.autoBd}`,padding:"4px 10px",borderRadius:6,cursor:"pointer"}}>
                    Review →
                  </button>
                </td>
              </tr>
            );
          })}
          {loading&&Array.from({length:8}).map((_,i)=>(
            <tr key={i} style={{borderBottom:`1px solid ${t.bdr}`}}>
              <td style={{padding:"13px 12px"}}><Sk h={13} w={140}/><Sk h={10} w={80} style={{marginTop:5}}/></td>
              <td style={{padding:"13px 12px"}}><Sk h={13} w={110}/></td>
              {[0,1,2,3].map(j=><td key={j} style={{padding:"13px 12px",textAlign:"center" as const}}><Sk h={13} w={32} style={{margin:"0 auto"}}/></td>)}
              <td style={{padding:"13px 12px",textAlign:"center" as const}}><Sk h={22} w={60} r={99} style={{margin:"0 auto"}}/></td>
              <td style={{padding:"13px 12px",textAlign:"center" as const}}><Sk h={26} w={70} r={6} style={{margin:"0 auto"}}/></td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading&&rows.length===0&&<div style={{padding:48,textAlign:"center",color:t.t3}}>
        <div style={{fontSize:32,marginBottom:8}}>🔍</div>
        <div style={{fontSize:13}}>No SKUs match your filters</div>
        <button onClick={()=>{setQ("");setF("ALL");}} style={{color:t.pri,fontSize:12,marginTop:8,background:"none",border:"none",cursor:"pointer"}}>Clear filters</button>
      </div>}
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SIMPLE MARKDOWN RENDERER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function MdLine({text,t}){
  // inline: **bold**, `code`
  const parts=[];let i=0;let key=0;
  while(i<text.length){
    if(text[i]==="*"&&text[i+1]==="*"){
      const end=text.indexOf("**",i+2);
      if(end>-1){parts.push(<strong key={key++} style={{color:t.t1}}>{text.slice(i+2,end)}</strong>);i=end+2;continue;}
    }
    if(text[i]==="`"){
      const end=text.indexOf("`",i+1);
      if(end>-1){parts.push(<code key={key++} style={{background:t.bdr,color:t.t2,padding:"1px 4px",borderRadius:3,fontSize:"0.9em"}}>{text.slice(i+1,end)}</code>);i=end+1;continue;}
    }
    const next=text.indexOf("**",i);const nxt2=text.indexOf("`",i);
    const stop=Math.min(next>-1?next:text.length,nxt2>-1?nxt2:text.length);
    parts.push(text.slice(i,stop));i=stop;
  }
  return <>{parts}</>;
}

function SimpleMarkdown({text,t}){
  if(!text)return null;
  const lines=text.split("\n");
  const out=[];let inList=false;let listItems=[];let key=0;
  const flushList=()=>{if(listItems.length){out.push(<ul key={key++} style={{margin:"4px 0 8px 16px",padding:0,listStyleType:"disc"}}>{listItems}</ul>);listItems=[];inList=false;}};
  for(const raw of lines){
    const line=raw.trimEnd();
    if(!line){flushList();out.push(<div key={key++} style={{height:6}}/>);continue;}
    if(line.startsWith("### ")){flushList();out.push(<div key={key++} style={{fontSize:12,fontWeight:700,color:t.t1,margin:"10px 0 4px",textTransform:"uppercase",letterSpacing:".04em"}}><MdLine text={line.slice(4)} t={t}/></div>);continue;}
    if(line.startsWith("## ")){flushList();out.push(<div key={key++} style={{fontSize:13,fontWeight:700,color:t.t1,margin:"10px 0 4px"}}><MdLine text={line.slice(3)} t={t}/></div>);continue;}
    if(line.startsWith("# ")){flushList();out.push(<div key={key++} style={{fontSize:14,fontWeight:800,color:t.t1,margin:"10px 0 4px"}}><MdLine text={line.slice(2)} t={t}/></div>);continue;}
    if(line.match(/^[-*] /)){inList=true;listItems.push(<li key={key++} style={{fontSize:12,color:t.t2,lineHeight:1.6,marginBottom:2}}><MdLine text={line.slice(2)} t={t}/></li>);continue;}
    flushList();
    out.push(<div key={key++} style={{fontSize:12,color:t.t2,lineHeight:1.7,marginBottom:3}}><MdLine text={line} t={t}/></div>);
  }
  flushList();
  return <>{out}</>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DRAWER ACCORDION ITEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AccItem({title,badge,children,defaultOpen=true}){
  const t=useT();
  const [open,setOpen]=useState(defaultOpen);
  return <div style={{border:`1px solid ${t.bdr}`,borderRadius:10,marginBottom:10,overflow:"hidden"}}>
    <button onClick={()=>setOpen(!open)} style={{
      width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",
      padding:"10px 14px",background:t.surf2,border:"none",cursor:"pointer"}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:11,fontWeight:700,color:t.t2,textTransform:"uppercase",letterSpacing:".05em"}}>{title}</span>
        {badge&&<span style={{fontSize:10,background:t.pri,color:"#fff",padding:"1px 6px",borderRadius:99}}>{badge}</span>}
      </div>
      <span style={{fontSize:11,color:t.t3}}>{open?"▲":"▼"}</span>
    </button>
    {open&&<div className="fi" style={{padding:"12px 14px",background:t.surf}}>{children}</div>}
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SKU DRAWER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SKUDrawer({sku,onClose,onAction,onRunAgent,skuAgentRunning,poOn,waOn,approved,ticketed}){
  const t=useT();
  const [evid,setEvid]=useState(false);
  const [rationale,setRationale]=useState<any>(null);
  const [rationaleLoading,setRationaleLoading]=useState(false);

  // ── SKU Detail (charts data) ──────────────────────────────────────
  const [detail,setDetail]=useState<any>(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const detailSkuRef=useRef<string|null>(null);

  useEffect(()=>{
    const id=sku.cosmosId||sku.id;
    if(detailSkuRef.current===id)return;
    detailSkuRef.current=id;
    setDetailLoading(true);
    fetch(`/api/v1/sku-detail/${id}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>setDetail(d))
      .catch(()=>setDetail(null))
      .finally(()=>setDetailLoading(false));
  },[sku]);

  // ── AI Insight (always-visible rationale) ────────────────────────
  const [insight,setInsight]=useState<any>(null);
  const [insightLoading,setInsightLoading]=useState(false);
  const [insightError,setInsightError]=useState(false);
  const insightSkuRef=useRef<string|null>(null);

  const fetchInsight=()=>{
    const id=sku.cosmosId||sku.id;
    insightSkuRef.current=id;
    setInsightLoading(true);setInsightError(false);
    fetch(`/api/v1/agent-rationale/${id}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d?.rationale)setInsight(d.rationale);else setInsight(null);})
      .catch(()=>{setInsight(null);setInsightError(true);})
      .finally(()=>setInsightLoading(false));
  };

  useEffect(()=>{
    const id=sku.cosmosId||sku.id;
    if(insightSkuRef.current===id)return;
    fetchInsight();
  },[sku]);

  const hasAgentRec=!!sku.recAction;
  const rec=hasAgentRec?{
    action:sku.recAction,
    title:sku.recAction==="PRICE_DECREASE"?`LOWER PRICE ₹${sku.own.toLocaleString()} → ₹${sku.recPrice.toLocaleString()}`
      :sku.recAction==="PRICE_INCREASE"?`RAISE PRICE ₹${sku.own.toLocaleString()} → ₹${sku.recPrice.toLocaleString()}`
      :sku.recAction==="HOLD_REORDER"?"HOLD PRICE + SEND PO":"HOLD CURRENT PRICE",
    rationale:sku.recRationale,
    needsPO:sku.recAction==="HOLD_REORDER",
    confidence:sku.recConfidence,
  }:null;

  const prevRunning=useRef(skuAgentRunning);
  useEffect(()=>{
    if(prevRunning.current&&!skuAgentRunning){setRationale(null);}
    prevRunning.current=skuAgentRunning;
  },[skuAgentRunning]);

  // Fetch real LLM rationale when evidence is opened or after agent run
  useEffect(()=>{
    if(!evid||rationale!==null)return;
    setRationaleLoading(true);
    fetch(`/api/v1/agent-rationale/${sku.cosmosId||sku.id}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{
        if(d?.rationale)setRationale(d.rationale);
        else setRationale(false);
      })
      .catch(()=>setRationale(false))
      .finally(()=>setRationaleLoading(false));
  },[evid,rationale]);

  const gap=sku.comp?(sku.own-sku.comp)/sku.comp:0;

  const cardBg=rec?.action==="PRICE_DECREASE"?t.critBg
    :rec?.action==="PRICE_INCREASE"?t.goodBg
    :rec?.action==="HOLD_REORDER"?t.warnBg:t.surf2;
  const cardBd=rec?.action==="PRICE_DECREASE"?t.critBd
    :rec?.action==="PRICE_INCREASE"?t.goodBd
    :rec?.action==="HOLD_REORDER"?t.warnBd:t.bdr;

  const actionEmoji=rec?.action==="PRICE_DECREASE"?"📉":rec?.action==="PRICE_INCREASE"?"📈":rec?.action==="HOLD_REORDER"?"📦":"➖";

  return <div className="dr" style={{position:"absolute",right:0,top:0,height:"100%",
    width:464,background:t.surf,boxShadow:t.sh2,display:"flex",flexDirection:"column",
    borderLeft:`1px solid ${t.bdr}`,zIndex:20}}>
    {/* Header */}
    <div style={{padding:"12px 16px",background:t.surf2,borderBottom:`1px solid ${t.bdr}`,
      display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
      <div>
        <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
          <span style={{fontWeight:700,color:t.t1,fontSize:13}}>{sku.name}</span>
          <Pill band={sku.band}/>
          {approved&&<Pill band="HEALTHY">✓ Executed</Pill>}
          {ticketed&&!approved&&<Pill band="TICKET">🎫 Ticket Open</Pill>}
        </div>
        <div style={{fontFamily:"monospace",fontSize:11,color:t.t3,marginTop:3}}>{sku.id} · {sku.conf==="low"?"⚠ Low confidence":"High confidence"}</div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <button onClick={()=>onRunAgent(sku)} disabled={skuAgentRunning} style={{
          display:"inline-flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:6,
          border:`1px solid ${t.bdr}`,background:skuAgentRunning?t.surf2:t.surf,
          color:skuAgentRunning?t.t3:t.pri,fontSize:11,fontWeight:600,
          cursor:skuAgentRunning?"not-allowed":"pointer",opacity:skuAgentRunning?.6:1}}>
          {skuAgentRunning?<><span style={{display:"inline-block",width:10,height:10,border:"2px solid rgba(37,99,235,.3)",
            borderTop:"2px solid #2563EB",borderRadius:"50%",animation:"spin .8s linear infinite"}}/>Running…</>
            :<>▶ Run Agent</>}
        </button>
        <button onClick={onClose} style={{background:"none",border:"none",color:t.t2,fontSize:18,cursor:"pointer",padding:4}}>✕</button>
      </div>
    </div>
    {/* Body */}
    <div style={{flex:1,overflowY:"auto",padding:16}}>
      {/* Score */}
      <div style={{background:sku.band==="CRITICAL"?t.critBg:sku.band==="WARNING"?t.warnBg:t.goodBg,
        border:`1px solid ${sku.band==="CRITICAL"?t.critBd:sku.band==="WARNING"?t.warnBd:t.goodBd}`,
        borderRadius:12,padding:16,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:t.t3,textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>Composite Risk</div>
            <div style={{display:"flex",alignItems:"baseline",gap:4}}>
              <span style={{fontSize:40,fontWeight:900,fontFamily:"monospace",
                color:sku.band==="CRITICAL"?t.crit:sku.band==="WARNING"?t.warn:t.good}}>{sku.composite}</span>
              <span style={{color:t.t3,fontSize:14}}>/100</span>
            </div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:11,color:t.t3,marginBottom:2}}>Top Driver</div>
            <div style={{fontSize:13,fontWeight:600,color:t.t1}}>{sku.topDriver}</div>
            <div style={{fontSize:11,color:t.t3,marginTop:4}}>Days Cover: <strong style={{color:sku.doc<7?t.crit:sku.doc<14?t.warn:t.good}}>{sku.doc}d</strong></div>
          </div>
        </div>
        <Bar val={sku.composite} max={100} band={sku.band}/>
      </div>

      {/* Risk Breakdown */}
      <div style={{fontSize:11,fontWeight:700,color:t.t3,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Risk Breakdown</div>
      <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,overflow:"hidden",marginBottom:12}}>
        {[
          {lbl:"Price Gap Risk",     s:sku.b.pg??0, max:30, detail:sku.comp?`₹${sku.own.toLocaleString()} vs ₹${sku.comp.toLocaleString()} (${gap>0?"+":""}${Math.round(gap*100)}%)`:"No competitor data"},
          {lbl:"Stock Coverage Risk",s:sku.b.sc,    max:30, detail:`${sku.doc}d cover · ${sku.onH} units · ${sku.vel}/day velocity`},
          {lbl:"Demand Trend Risk",  s:sku.b.dt,    max:20, detail:`${sku.v7>sku.v14?"+":""}${Math.round(((sku.v7-sku.v14)/Math.max(sku.v14,1))*100)}% vs 14-day baseline`},
          {lbl:"Margin Proximity",   s:sku.b.mp,    max:20, detail:`${(sku.mPct*100).toFixed(1)}% margin · Floor ${(sku.mFloor*100).toFixed(0)}%`},
        ].map((row,i)=>{
          const pct=row.s/row.max; const c=pct>.8?t.crit:pct>.55?t.warn:t.good;
          return <div key={row.lbl} style={{padding:"10px 14px",borderBottom:i<3?`1px solid ${t.bdr}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{fontSize:12,fontWeight:500,color:t.t2}}>{row.lbl}</span>
              <span style={{fontFamily:"monospace",fontSize:12,fontWeight:700,color:c}}>{row.s}<span style={{color:t.t3,fontWeight:400}}>/{row.max}</span></span>
            </div>
            <div style={{width:"100%",height:4,background:t.bdr,borderRadius:2,overflow:"hidden",marginBottom:4}}>
              <div style={{width:`${(row.s/row.max)*100}%`,height:"100%",background:c,borderRadius:2}}/>
            </div>
            <div style={{fontSize:11,color:t.t3}}>{row.detail}</div>
          </div>;
        })}
      </div>

      {/* Agent Decision */}
      <div style={{fontSize:11,fontWeight:700,color:t.t3,textTransform:"uppercase",letterSpacing:".05em",marginBottom:8}}>Agent Evaluation</div>
      <div style={{background:sku.agent.auto?t.autoBg:t.tickBg,
        border:`1px solid ${sku.agent.auto?t.autoBd:t.tickBd}`,
        borderRadius:12,padding:14,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:sku.agent.breaches.length?8:0}}>
          <span style={{fontSize:16}}>{sku.agent.auto?"🤖":"🎫"}</span>
          <span style={{fontSize:13,fontWeight:700,color:sku.agent.auto?t.auto:t.tick}}>
            {sku.agent.auto?"AUTONOMOUS ACTION — within all thresholds":"EXCEPTION TICKET REQUIRED"}
          </span>
        </div>
        {sku.agent.breaches.length>0&&<div>
          <div style={{fontSize:11,color:t.t3,marginBottom:6}}>Threshold breaches preventing autonomous action:</div>
          {sku.agent.breaches.map(b=>(
            <div key={b} style={{fontSize:11,color:t.tick,marginBottom:3}}>⚡ {b}</div>
          ))}
        </div>}
      </div>

      {/* Recommendation */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
        <span style={{fontSize:11,fontWeight:700,color:t.t3,textTransform:"uppercase",letterSpacing:".05em"}}>Recommendation</span>
        {hasAgentRec&&<span style={{fontSize:10,color:t.good,background:t.goodBg,border:`1px solid ${t.goodBd}`,
          padding:"1px 6px",borderRadius:99}}>Agent</span>}
      </div>
      {!rec&&<div style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:12,padding:24,marginBottom:12,textAlign:"center"}}>
        <div style={{fontSize:22,marginBottom:8}}>🤖</div>
        <div style={{fontSize:13,color:t.t2,marginBottom:4}}>No recommendation yet</div>
        <div style={{fontSize:11,color:t.t3}}>Run agents to generate a pricing recommendation for this SKU.</div>
      </div>}
      {rec&&<div style={{background:cardBg,border:`1px solid ${cardBd}`,borderRadius:12,padding:14,marginBottom:12}}>
        <div style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:10}}>
          <span style={{fontSize:16}}>{actionEmoji}</span>
          <span style={{fontSize:13,fontWeight:700,color:t.t1,lineHeight:1.4}}>{rec.title}</span>
        </div>
        <p style={{fontSize:13,color:t.t2,lineHeight:1.6,marginBottom:12}}>{rec.rationale}</p>

        {!approved&&!ticketed&&(
          sku.agent.auto
            ?<div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>onAction("approve",sku,rec)} style={{flex:1,justifyContent:"center"}}>Approve & Execute</Btn>
              <Btn onClick={()=>onAction("skip",sku,rec)} variant="secondary">Skip</Btn>
            </div>
            :<div>
              <Btn onClick={()=>onAction("ticket",sku,rec)} variant="ticket" style={{width:"100%",justifyContent:"center"}}>
                🎫 Submit Exception Ticket
              </Btn>
              <div style={{fontSize:11,color:t.t3,textAlign:"center",marginTop:6}}>Requires approval before execution</div>
            </div>
        )}
        {ticketed&&!approved&&<div style={{background:t.tickBg,border:`1px solid ${t.tickBd}`,borderRadius:8,padding:10,fontSize:12,color:t.tick,textAlign:"center"}}>🎫 Ticket submitted — awaiting your approval in Tickets tab</div>}
        {approved&&<div style={{background:t.goodBg,border:`1px solid ${t.goodBd}`,borderRadius:8,padding:10,fontSize:12,color:t.good,textAlign:"center"}}>✅ Action executed</div>}
      </div>}

      {/* PO */}
      {poOn&&rec?.needsPO&&(
        <div style={{background:t.warnBg,border:`1px solid ${t.warnBd}`,borderRadius:12,padding:14,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:700,color:t.warn,marginBottom:10}}>📦 PO RECOMMENDATION</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            {[["Vendor",sku.vendor||"—"],["MOQ",`${sku.moq||"—"} units`],["Lead Time",`${sku.lt||"—"} days`]].map(([l,v])=>(
              <div key={l} style={{background:t.surf,borderRadius:8,padding:10,border:`1px solid ${t.bdr}`}}>
                <div style={{fontSize:10,color:t.t3}}>{l}</div>
                <div style={{fontWeight:600,color:t.t1,fontSize:13,marginTop:2}}>{v}</div>
              </div>
            ))}
          </div>
          {!approved&&<Btn onClick={()=>onAction("po",sku,rec)} variant="teal" style={{width:"100%",justifyContent:"center"}}>📦 Send PO →</Btn>}
        </div>
      )}

      {/* Agent Reasoning */}
      <button onClick={()=>setEvid(!evid)} style={{display:"flex",alignItems:"center",gap:6,
        fontSize:12,color:t.t3,background:"none",border:"none",cursor:"pointer",marginBottom:8}}>
        🧠 {evid?"Hide":"Show"} agent reasoning {evid?"▲":"▼"}
      </button>
      {evid&&<div className="fi" style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:10,padding:12}}>
        {rationaleLoading&&<div style={{fontSize:12,color:t.t3,fontStyle:"italic"}}>Loading agent rationale…</div>}
        {rationale&&<div style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
            <span style={{fontSize:11,fontWeight:700,color:t.pri,letterSpacing:".04em"}}>🧠 LLM RATIONALE</span>
            <span style={{fontSize:10,color:t.good,background:t.goodBg,border:`1px solid ${t.goodBd}`,
              padding:"1px 6px",borderRadius:99}}>Agent-generated</span>
          </div>
          <div style={{fontSize:13,color:t.t2,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{rationale}</div>
        </div>}
        {rationale===false&&<div style={{fontSize:11,color:t.t3,marginBottom:8,fontStyle:"italic"}}>
          No agent rationale available yet. Run agents to generate LLM-powered explanations.
        </div>}
        <div style={{fontSize:11,fontWeight:600,color:t.t3,marginBottom:6,marginTop:rationale?8:0}}>DATA SOURCES</div>
        {[
          ["competitor_price",sku.comp?`₹${sku.comp.toLocaleString()} (${sku.compName||"competitor"})`:"No competitor data"],
          ["inventory",`${sku.onH} units on hand · ${sku.vel}/day velocity → ${sku.doc}d cover`],
          ["demand_7d_vs_14d",`v7=${sku.v7} vs v14=${sku.v14} (${sku.v7>sku.v14?"+":""}${Math.round(((sku.v7-sku.v14)/Math.max(sku.v14,1))*100)}%)`],
          ["margin",`${(sku.mPct*100).toFixed(1)}% margin · floor ${(sku.mFloor*100).toFixed(0)}%`],
          ["source", hasAgentRec?"Agent recommendation (real)":"No agent recommendation yet"],
        ].map(([src,detail])=>(
          <div key={src} style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:6,fontSize:11}}>
            <code style={{background:t.bdr,color:t.t2,padding:"2px 6px",borderRadius:4}}>{src}</code>
            <span style={{color:t.t2}}>{detail}</span>
          </div>
        ))}
      </div>}

      {/* ── ANALYTICS ACCORDION ─────────────────────────── */}
      <div style={{marginTop:8}}>
        <div style={{fontSize:11,fontWeight:700,color:t.t3,textTransform:"uppercase",
          letterSpacing:".05em",marginBottom:8}}>Analytics</div>

        {/* Section A — Inventory Burndown */}
        <AccItem title="Inventory Burndown">
          {detailLoading&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
            <Sk h={12} w={120}/><Sk h={180}/><Sk h={10} w={80}/>
          </div>}
          {!detailLoading&&(!detail?.ownSnapshots?.length)&&
            <div style={{fontSize:12,color:t.t3,textAlign:"center",padding:"20px 0"}}>
              No snapshot data for the last 30 days
            </div>}
          {!detailLoading&&detail?.ownSnapshots?.length>0&&(()=>{
            const data=detail.ownSnapshots.map(s=>({
              date:s.date.slice(5), // MM-DD
              onHand:s.onHandUnits,
              inbound:s.inboundUnits,
              velocity:Math.round(s.dailyVelocity*10)/10,
            }));
            return <>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data} margin={{top:4,right:30,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.bdr}/>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:t.t3}} tickLine={false}/>
                  <YAxis yAxisId="left" tick={{fontSize:10,fill:t.t3}} tickLine={false} axisLine={false}/>
                  <YAxis yAxisId="right" orientation="right" tick={{fontSize:10,fill:t.t3}} tickLine={false} axisLine={false}/>
                  <RTooltip contentStyle={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:8,fontSize:11,color:t.t1}}/>
                  <Area yAxisId="left" type="monotone" dataKey="onHand" name="On Hand" fill={t.pri+"33"} stroke={t.pri} strokeWidth={2}/>
                  <RBar yAxisId="left" dataKey="inbound" name="Inbound" fill={t.teal+"66"} stackId="a"/>
                  <Line yAxisId="right" type="monotone" dataKey="velocity" name="Velocity/day" stroke={t.warn} strokeWidth={1.5} strokeDasharray="4 2" dot={false}/>
                  <ReferenceLine yAxisId="left" y={0} stroke={t.crit} strokeDasharray="4 2" label={{value:"Stockout",position:"insideTopLeft",fontSize:10,fill:t.crit}}/>
                </ComposedChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:12,marginTop:6,flexWrap:"wrap"}}>
                {[["■",t.pri,"On Hand"],["■",t.teal,"Inbound"],["─",t.warn,"Velocity/day"]].map(([icon,color,lbl])=>(
                  <span key={lbl} style={{fontSize:10,color:t.t3,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{color}}>{icon}</span>{lbl}
                  </span>
                ))}
              </div>
            </>;
          })()}
        </AccItem>

        {/* Section B — Price vs Competitor */}
        <AccItem title="Price vs Competitor">
          {detailLoading&&<div style={{display:"flex",flexDirection:"column",gap:6}}>
            <Sk h={12} w={100}/><Sk h={160}/><Sk h={10} w={60}/>
          </div>}
          {!detailLoading&&(!detail?.ownSnapshots?.length&&!detail?.compSnapshots?.length)&&
            <div style={{fontSize:12,color:t.t3,textAlign:"center",padding:"20px 0"}}>
              No price data for the last 30 days
            </div>}
          {!detailLoading&&(detail?.ownSnapshots?.length||detail?.compSnapshots?.length)&&(()=>{
            // Merge own + comp by date
            const ownMap={};
            (detail.ownSnapshots||[]).forEach(s=>{ownMap[s.date]=s.sellingPrice||sku.own;});
            const compMap={};
            (detail.compSnapshots||[]).forEach(s=>{compMap[s.date]=s.competitorPrice;});
            const allDates=[...new Set([
              ...(detail.ownSnapshots||[]).map(s=>s.date),
              ...(detail.compSnapshots||[]).map(s=>s.date),
            ])].sort();
            const chartData=allDates.map(d=>({
              date:d.slice(5),
              ownPrice:ownMap[d]??sku.own,
              compPrice:compMap[d]??null,
            }));
            // Badge
            const latestOwn=sku.own;
            const latestComp=sku.comp;
            const gap=latestComp?(latestOwn-latestComp)/latestComp:0;
            const badge=!latestComp?null
              :gap<0?{c:t.good,bg:t.goodBg,bd:t.goodBd,lbl:"Competitive"}
              :Math.abs(gap)<0.05?{c:t.warn,bg:t.warnBg,bd:t.warnBd,lbl:"Close"}
              :{c:t.crit,bg:t.critBg,bd:t.critBd,lbl:"Undercut"};
            const hasLive=(detail.compSnapshots||[]).some(s=>s.source==="crawler");
            return <>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                {badge&&<span style={{fontSize:10,fontWeight:700,padding:"2px 8px",borderRadius:99,
                  color:badge.c,background:badge.bg,border:`1px solid ${badge.bd}`}}>{badge.lbl}</span>}
                {hasLive&&<span style={{fontSize:10,color:t.warn,background:t.warnBg,border:`1px solid ${t.warnBd}`,
                  padding:"2px 8px",borderRadius:99}}>⚡ Live</span>}
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData} margin={{top:4,right:4,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={t.bdr}/>
                  <XAxis dataKey="date" tick={{fontSize:10,fill:t.t3}} tickLine={false}/>
                  <YAxis tick={{fontSize:10,fill:t.t3}} tickLine={false} axisLine={false}/>
                  <RTooltip contentStyle={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:8,fontSize:11,color:t.t1}}
                    formatter={(val,name,props)=>{
                      const own=props.payload?.ownPrice;const comp=props.payload?.compPrice;
                      const g=own&&comp?` (gap ₹${Math.round(own-comp)})`:""
                      return [`₹${val?.toLocaleString()}${name==="Your Price"?g:""}`,name];
                    }}/>
                  <Line type="monotone" dataKey="ownPrice" name="Your Price" stroke={t.pri} strokeWidth={2} dot={false}/>
                  <Line type="monotone" dataKey="compPrice" name="Best Competitor" stroke="#F59E0B" strokeWidth={2} dot={false} connectNulls/>
                </LineChart>
              </ResponsiveContainer>
              <div style={{display:"flex",gap:12,marginTop:6}}>
                {[["─",t.pri,"Your Price"],["─","#F59E0B","Best Competitor"]].map(([icon,color,lbl])=>(
                  <span key={lbl} style={{fontSize:10,color:t.t3,display:"flex",alignItems:"center",gap:3}}>
                    <span style={{color}}>{icon}</span>{lbl}
                  </span>
                ))}
              </div>
            </>;
          })()}
        </AccItem>

        {/* Section C — AI Insight Summary */}
        <AccItem title="AI Analysis" badge={insight?"Agent":""}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontSize:16}}>✨</span>
              <span style={{fontSize:11,fontWeight:700,color:t.pri,letterSpacing:".04em"}}>SKU-LEVEL INSIGHT</span>
            </div>
            <button onClick={()=>{setInsight(null);setInsightError(false);fetchInsight();}}
              disabled={insightLoading}
              title="Refresh insight"
              style={{background:"none",border:`1px solid ${t.bdr}`,borderRadius:6,
                padding:"3px 8px",fontSize:11,color:t.t3,cursor:insightLoading?"not-allowed":"pointer",
                opacity:insightLoading?.5:1}}>
              {insightLoading?"…":"↻"}
            </button>
          </div>
          {insightLoading&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
            <Sk h={12} w="90%"/><Sk h={12} w="75%"/><Sk h={12} w="80%"/>
          </div>}
          {!insightLoading&&insightError&&<div style={{fontSize:12,color:t.crit}}>
            Failed to load insight.{" "}
            <button onClick={fetchInsight} style={{background:"none",border:"none",color:t.pri,
              cursor:"pointer",fontSize:12,textDecoration:"underline"}}>Retry</button>
          </div>}
          {!insightLoading&&!insightError&&!insight&&<div style={{fontSize:12,color:t.t3,fontStyle:"italic"}}>
            No AI insight yet — run agents to generate SKU-level analysis.
          </div>}
          {!insightLoading&&insight&&
            <div style={{background:t.autoBg,border:`1px solid ${t.autoBd}`,borderRadius:8,padding:"10px 12px"}}>
              <SimpleMarkdown text={insight} t={t}/>
            </div>}
        </AccItem>
      </div>
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TICKETS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function TicketsPage({tickets,onApprove,onReject,loading}){
  const t=useT();
  const [tab,setTab]=useState("OPEN");
  const filtered=tickets.filter(tk=>tab==="ALL"?true:tk.status===tab);
  const statusColor=s=>s==="OPEN"?t.tick:s==="APPROVED"?t.good:s==="REJECTED"?t.crit:t.warn;
  const statusBg=s=>s==="OPEN"?t.tickBg:s==="APPROVED"?t.goodBg:s==="REJECTED"?t.critBg:t.warnBg;
  const statusBd=s=>s==="OPEN"?t.tickBd:s==="APPROVED"?t.goodBd:s==="REJECTED"?t.critBd:t.warnBd;
  return <div style={{padding:24,maxWidth:760}}>
    <div style={{marginBottom:20}}>
      <h1 style={{fontSize:20,fontWeight:800,color:t.t1}}>Exception Tickets</h1>
      <p style={{fontSize:13,color:t.t3,marginTop:4}}>Actions that exceeded autonomy thresholds — review and approve or reject</p>
    </div>
    <div style={{display:"flex",gap:4,marginBottom:20,background:t.surf2,borderRadius:10,padding:4,width:"fit-content"}}>
      {["OPEN","APPROVED","REJECTED","ALL"].map(s=>(
        <button key={s} onClick={()=>setTab(s)} style={{
          padding:"6px 16px",borderRadius:8,border:"none",fontSize:12,fontWeight:600,cursor:"pointer",
          background:tab===s?t.surf:t.surf2,color:tab===s?t.t1:t.t3,
          boxShadow:tab===s?t.sh:"none"}}>
          {s==="ALL"?"All":s.charAt(0)+s.slice(1).toLowerCase()}
          {s!=="ALL"&&<span style={{marginLeft:6,fontSize:10,background:statusBg(s),color:statusColor(s),
            padding:"1px 6px",borderRadius:99,border:`1px solid ${statusBd(s)}`}}>
            {tickets.filter(tk=>tk.status===s).length}
          </span>}
        </button>
      ))}
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {loading&&Array.from({length:3}).map((_,i)=>(
        <div key={i} style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:14,padding:18,boxShadow:t.sh}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                <Sk w={60} h={11}/><Sk w={48} h={20} r={99}/><Sk w={56} h={20} r={99}/>
              </div>
              <Sk w={160} h={14} style={{marginBottom:6}}/><Sk w={90} h={11}/>
            </div>
            <div style={{textAlign:"right"}}><Sk w={80} h={11} style={{marginBottom:6}}/><Sk w={70} h={11}/></div>
          </div>
          <div style={{background:t.surf2,borderRadius:10,padding:12,marginBottom:12}}>
            <Sk w={120} h={11} style={{marginBottom:8}}/><Sk w={180} h={13} style={{marginBottom:10}}/><Sk w={100} h={11} style={{marginBottom:6}}/><Sk w={140} h={11}/>
          </div>
          <div style={{display:"flex",gap:8}}><Sk h={34} r={8} style={{flex:1}}/><Sk w={90} h={34} r={8}/></div>
        </div>
      ))}
      {!loading&&filtered.length===0&&<div style={{padding:48,textAlign:"center",color:t.t3}}>
        <div style={{fontSize:32,marginBottom:8}}>🎫</div>
        <div>No {tab.toLowerCase()} tickets</div>
      </div>}
      {!loading&&filtered.map(tk=>(
        <div key={tk.id} className="fi" style={{background:t.surf,border:`1px solid ${t.bdr}`,
          borderRadius:14,padding:18,boxShadow:t.sh}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                <span style={{fontFamily:"monospace",fontSize:11,color:t.t3}}>{tk.id}</span>
                <Pill band={tk.band}/>
                <span style={{fontSize:11,fontWeight:700,padding:"2px 8px",borderRadius:99,
                  background:statusBg(tk.status),color:statusColor(tk.status),
                  border:`1px solid ${statusBd(tk.status)}`}}>{tk.status}</span>
              </div>
              <div style={{fontWeight:700,color:t.t1,fontSize:14}}>{tk.skuName}</div>
              <div style={{fontFamily:"monospace",fontSize:11,color:t.t3}}>{tk.skuId}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:11,color:t.t3}}>{tk.ts}</div>
              <div style={{fontSize:11,color:t.t3,marginTop:2}}>
                WA: {tk.wa==="sent"?"✅ Sent":tk.wa==="pending"?"🔄 Pending":"—"}
              </div>
            </div>
          </div>
          <div style={{background:t.surf2,borderRadius:10,padding:12,marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:t.t3,marginBottom:8}}>RECOMMENDED ACTION</div>
            <div style={{fontSize:13,fontWeight:600,color:t.t1,marginBottom:8}}>📌 {tk.action}</div>
            <div style={{fontSize:11,fontWeight:700,color:t.t3,marginBottom:6}}>THRESHOLD BREACHES</div>
            {tk.breaches.map(b=>(
              <div key={b} style={{fontSize:11,color:t.tick,marginBottom:3}}>⚡ {b}</div>
            ))}
          </div>
          {tk.status==="OPEN"&&(
            <div style={{display:"flex",gap:8}}>
              <Btn onClick={()=>onApprove(tk.id)} style={{flex:1,justifyContent:"center"}}>✓ Approve & Execute</Btn>
              <Btn onClick={()=>onReject(tk.id)} variant="secondary">✕ Reject</Btn>
            </div>
          )}
        </div>
      ))}
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUDIT PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function AuditPage({log,loading}){
  const t=useT();
  const typeC={AUTONOMOUS:t.auto,TICKET:t.tick};
  const typeBg={AUTONOMOUS:t.autoBg,TICKET:t.tickBg};
  const typeBd={AUTONOMOUS:t.autoBd,TICKET:t.tickBd};
  return <div style={{padding:24,maxWidth:640}}>
    <div style={{marginBottom:20}}>
      <h1 style={{fontSize:20,fontWeight:800,color:t.t1}}>Audit Log</h1>
      <p style={{fontSize:13,color:t.t3,marginTop:4}}>All agent actions and system events</p>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {loading&&Array.from({length:5}).map((_,i)=>(
        <div key={i} style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:12,padding:16,display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:8,height:8,borderRadius:"50%",marginTop:5,flexShrink:0,background:t.bdr}}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
              <Sk w={120} h={13}/><Sk w={70} h={11}/><Sk w={44} h={18} r={99}/>
            </div>
            <Sk w="80%" h={13} style={{marginBottom:8}}/><div style={{display:"flex",gap:16}}><Sk w={80} h={11}/><Sk w={70} h={11}/></div>
          </div>
        </div>
      ))}
      {!loading&&log.map(e=>(
        <div key={e.id} style={{background:t.surf,border:`1px solid ${t.bdr}`,
          borderRadius:12,padding:16,display:"flex",gap:14,alignItems:"flex-start"}}>
          <div style={{width:8,height:8,borderRadius:"50%",marginTop:5,flexShrink:0,
            background:typeC[e.type]||t.t3}}/>
          <div style={{flex:1}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginBottom:4}}>
              <span style={{fontWeight:700,color:t.t1,fontSize:13}}>{e.skuName}</span>
              <span style={{fontFamily:"monospace",fontSize:11,color:t.t3}}>{e.skuId}</span>
              <span style={{fontSize:10,fontWeight:700,padding:"2px 7px",borderRadius:99,
                background:typeBg[e.type]||t.surf2,color:typeC[e.type]||t.t3,
                border:`1px solid ${typeBd[e.type]||t.bdr}`}}>
                {e.type==="AUTONOMOUS"?"AUTO":"TICKET"}
              </span>
            </div>
            <div style={{fontSize:13,color:t.t2,marginBottom:4}}>{e.action}</div>
            <div style={{display:"flex",gap:16,fontSize:11,color:t.t3}}>
              <span>{e.ts}</span>
              <span>WA: {e.wa==="sent"?"✅ Sent":"—"}</span>
            </div>
          </div>
        </div>
      ))}
      {!loading&&log.length===0&&<div style={{padding:48,textAlign:"center",color:t.t3}}>No actions yet</div>}
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SETTINGS PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function SettingsPage({thresholds,setThresholds,poOn,setPoOn,waOn,setWaOn,dm,setDm,onSave}){
  const t=useT();
  const [tab,setTab]=useState("thresholds");
  const [local,setLocal]=useState({...thresholds});
  const [dirty,setDirty]=useState(false);
  const [saving,setSaving]=useState(false);
  const upd=(k,v)=>{setLocal(p=>({...p,[k]:v}));setDirty(true);};
  const save=()=>{setSaving(true);setTimeout(()=>{setThresholds(local);setSaving(false);setDirty(false);onSave();},700);};

  const tabs=[{id:"thresholds",l:"Autonomy Thresholds"},{id:"price",l:"Price Rules"},{id:"inventory",l:"Inventory & PO"},{id:"notifs",l:"Notifications"}];
  const F=({label,desc,children})=>(
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
      padding:"14px 0",borderBottom:`1px solid ${t.bdr}`}}>
      <div>
        <div style={{fontSize:13,fontWeight:500,color:t.t1}}>{label}</div>
        {desc&&<div style={{fontSize:11,color:t.t3,marginTop:2}}>{desc}</div>}
      </div>
      <div style={{marginLeft:16}}>{children}</div>
    </div>
  );

  return <div style={{padding:24,maxWidth:560}}>
    <div style={{marginBottom:20}}>
      <h1 style={{fontSize:20,fontWeight:800,color:t.t1}}>Settings</h1>
      <p style={{fontSize:13,color:t.t3,marginTop:4}}>Configure agent thresholds, toggles, and preferences</p>
    </div>
    <div style={{display:"flex",gap:3,marginBottom:20,background:t.surf2,borderRadius:10,padding:4}}>
      {tabs.map(tb=>(
        <button key={tb.id} onClick={()=>setTab(tb.id)} style={{
          flex:1,padding:"7px 4px",borderRadius:8,border:"none",cursor:"pointer",
          fontSize:12,fontWeight:600,background:tab===tb.id?t.surf:t.surf2,
          color:tab===tb.id?t.t1:t.t3,boxShadow:tab===tb.id?t.sh:"none"}}>
          {tb.l}
        </button>
      ))}
    </div>
    <div style={{background:t.surf,border:`1px solid ${t.bdr}`,borderRadius:14,padding:"0 20px 4px"}}>
      {tab==="thresholds"&&<>
        <div style={{padding:"12px 0 6px",fontSize:11,fontWeight:700,color:t.tick,textTransform:"uppercase",letterSpacing:".05em"}}>
          Agent autonomy limits — breach any one → exception ticket
        </div>
        <F label="Price Gap threshold (max /30)" desc="Agent can auto-act if PG score ≤ this">
          <NInput value={local.pg} onChange={v=>upd("pg",v)} min={0} max={30} suffix="/30"/>
        </F>
        <F label="Stock Coverage threshold (max /30)" desc="Agent can auto-act if SC score ≤ this">
          <NInput value={local.sc} onChange={v=>upd("sc",v)} min={0} max={30} suffix="/30"/>
        </F>
        <F label="Demand Trend threshold (max /20)" desc="Agent can auto-act if DT score ≤ this">
          <NInput value={local.dt} onChange={v=>upd("dt",v)} min={0} max={20} suffix="/20"/>
        </F>
        <F label="Margin Proximity threshold (max /20)" desc="Agent can auto-act if MP score ≤ this">
          <NInput value={local.mp} onChange={v=>upd("mp",v)} min={0} max={20} suffix="/20"/>
        </F>
      </>}
      {tab==="price"&&<>
        <F label="Margin floor (%)" desc="Agent won't recommend prices below this">
          <NInput value={15} onChange={()=>{}} suffix="%" min={0} max={50}/>
        </F>
        <F label="Max price increase per action" desc="">
          <NInput value={15} onChange={()=>{}} suffix="%" min={1} max={50}/>
        </F>
        <F label="Max price decrease per action" desc="">
          <NInput value={10} onChange={()=>{}} suffix="%" min={1} max={30}/>
        </F>
        <F label="Cooldown between actions" desc="Min hours between actions on same SKU">
          <NInput value={24} onChange={()=>{}} suffix="hrs" min={1} max={168}/>
        </F>
        <F label="Auto-approve actions" desc="Disabled for MVP — manual approval required">
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <Toggle val={false} onChange={()=>{}}/>
            <span style={{fontSize:11,color:t.t3,background:t.surf2,padding:"2px 7px",borderRadius:4}}>MVP: OFF</span>
          </div>
        </F>
      </>}
      {tab==="inventory"&&<>
        <F label="PO Recommendations" desc="Enable purchase order suggestions">
          <Toggle val={poOn} onChange={x=>{setPoOn(x);setDirty(true);}}/>
        </F>
        <F label="Min days of cover" desc="Trigger PO when stock drops below this">
          <NInput value={14} onChange={()=>{}} suffix="days" min={3} max={60}/>
        </F>
        <F label="Default MOQ (units)" desc="">
          <NInput value={50} onChange={()=>{}} suffix="units" min={1} max={9999}/>
        </F>
        <F label="Target cover post-reorder" desc="">
          <NInput value={30} onChange={()=>{}} suffix="days" min={7} max={180}/>
        </F>
        <F label="Max autonomous PO value" desc="PO above this → exception ticket">
          <NInput value={50000} onChange={()=>{}} suffix="₹" min={1000} max={500000}/>
        </F>
      </>}
      {tab==="notifs"&&<>
        <F label="WhatsApp Notifications" desc="Alerts on actions, tickets, PO sends">
          <Toggle val={waOn} onChange={x=>{setWaOn(x);setDirty(true);}}/>
        </F>
        <F label="WhatsApp number" desc="">
          <input value="+91-9876543210" readOnly disabled={!waOn}
            style={{padding:"6px 10px",borderRadius:6,border:`1px solid ${t.bdr}`,
              background:t.surf2,color:t.t1,fontSize:13,width:180,opacity:waOn?1:.5}}/>
        </F>
        <F label="Dark Mode" desc="Switch between light and dark theme">
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <Toggle val={dm} onChange={setDm}/>
            <span style={{fontSize:12,color:t.t3}}>{dm?"Dark":"Light"}</span>
          </div>
        </F>
        <div style={{padding:"14px 0"}}>
          <Btn onClick={()=>{}} variant="secondary">Send Test Notification</Btn>
        </div>
      </>}
    </div>
    <div style={{display:"flex",alignItems:"center",gap:12,marginTop:16}}>
      <Btn onClick={()=>{setLocal({...thresholds});setDirty(false);}} variant="secondary">Reset</Btn>
      <Btn onClick={save} disabled={!dirty||saving}>
        {saving?"Saving…":dirty?"Save Settings":"✓ Saved"}
      </Btn>
      {dirty&&<span style={{fontSize:12,color:t.warn,fontWeight:500}}>● Unsaved changes</span>}
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONFIRM MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function ConfirmModal({data,waOn,onConfirm,onCancel}){
  const t=useT();
  const {sku,rec,type}=data;
  return <div onClick={onCancel} style={{position:"fixed",inset:0,zIndex:50,
    display:"flex",alignItems:"center",justifyContent:"center",padding:20,
    background:"rgba(0,0,0,.55)"}}>
    <div onClick={e=>e.stopPropagation()} style={{background:t.surf,borderRadius:18,
      boxShadow:t.sh2,width:"100%",maxWidth:440,padding:28}}>
      <h2 style={{fontSize:17,fontWeight:800,color:t.t1,marginBottom:6}}>
        {type==="ticket"?"Submit Exception Ticket":"Confirm Action"}
      </h2>
      <p style={{fontSize:13,color:t.t3,marginBottom:16}}>
        {type==="ticket"?"Ticket will be created and sent for approval.":"Executing for "}
        <strong style={{color:t.t1}}>{sku.name}</strong>
      </p>
      <div style={{background:t.surf2,border:`1px solid ${t.bdr}`,borderRadius:12,padding:16,marginBottom:16}}>
        {[["Action",rec.title],["SKU",`${sku.id} · ${sku.name}`],
          type==="ticket"?["Reason","Threshold breach — needs approval"]:null,
          waOn?["WhatsApp","Alert will be sent"]:null]
          .filter(Boolean).map(([l,v])=>(
          <div key={l} style={{display:"flex",gap:12,marginBottom:8,fontSize:13}}>
            <span style={{color:t.t3,width:80,flexShrink:0}}>{l}</span>
            <span style={{fontWeight:500,color:t.t1}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{background:t.warnBg,border:`1px solid ${t.warnBd}`,borderRadius:10,
        padding:"10px 14px",fontSize:12,color:t.warn,marginBottom:20}}>
        ⚠️ This action will be logged in Audit Log.
      </div>
      <div style={{display:"flex",gap:10}}>
        <Btn onClick={onCancel} variant="secondary" style={{flex:1,justifyContent:"center"}}>Cancel</Btn>
        <Btn onClick={onConfirm} style={{flex:1,justifyContent:"center"}}>
          {type==="ticket"?"Submit Ticket":"Confirm & Execute →"}
        </Btn>
      </div>
    </div>
  </div>;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROOT APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
export default function App(){
  const [dm,setDm]=useState(false);
  const theme=useMemo(()=>mkTheme(dm),[dm]);
  const [page,setPage]=useState("dashboard");
  const [thresholds,setThresholds]=useState(DEF_TH);
  const [poOn,setPoOn]=useState(true);
  const [waOn,setWaOn]=useState(true);
  const [skus,setSkus]=useState<any[]>([]);
  const [selected,setSelected]=useState<any>(null);
  const [tickets,setTickets]=useState<any[]>([]);
  const [audit,setAudit]=useState<any[]>([]);
  const [approved,setApproved]=useState<Set<string>>(new Set());
  const [ticketed,setTicketed]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(true);
  const [modal,setModal]=useState<any>(null);
  const [toasts,setToasts]=useState<any[]>([]);
  const [notifications,setNotifications]=useState<any[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [notifOpen,setNotifOpen]=useState(false);
  const [lastSync,setLastSync]=useState<number|null>(null);
  const [agentRunning,setAgentRunning]=useState(false);
  const [skuAgentRunning,setSkuAgentRunning]=useState(false);
  const [period,setPeriod]=useState("daily");

  const mapDashboard=(dashRes)=>{
    if(!dashRes?.skus?.length)return;
    const mapped=dashRes.skus.map(s=>{
      const pg=s.riskPG||0, sc=s.riskSC||0, dt=s.riskDT||0, mp=s.riskMP||0;
      const composite=s.composite||0;
      const band=s.band||"HEALTHY";
      const b={pg,sc,dt,mp};
      const ag=evalAgent(b,thresholds);
      return {
        id:s.partNo||s.id, name:s.partName,
        own:s.sellingPrice, comp:s.compPrice||null, compName:s.compName||"",
        onH:s.onHandUnits||0, vel:Math.round((s.dailyVelocity||0)*100)/100,
        v7:s.velocity7d||0, v14:s.velocity14d||0,
        mPct:s.profitMarginPct/100, mFl:0.10,
        vend:"VoltEdge Supply", moq:50, lt:7, vendor:"VoltEdge Supply", mFloor:0.10,
        doc:s.daysCover||0, b, composite, band,
        topDriver:s.topDriver||"N/A", agent:ag,
        conf:s.confidence>0?"high":"low",
        agentMode:s.agentMode||"",
        riskComputedAt:s.riskComputedAt||"",
        recAction:s.recAction||"",
        recPrice:s.recSuggestedPrice||0,
        recRationale:s.recRationale||"",
        recConfidence:s.recConfidence||0,
        recCreatedAt:s.recCreatedAt||"",
        cosmosId:s.id,
      };
    });
    setSkus(mapped);
  };
  const mapTickets=(tktRes)=>{
    if(!tktRes?.tickets?.length)return;
    setTickets(tktRes.tickets.map(t=>({
      id:t.id, skuId:t.skuId, skuName:t.skuName, action:t.action,
      breaches:t.breaches||[], composite:t.compositeScore, band:t.band,
      status:t.status, ts:t.createdAt, wa:t.whatsappStatus||"none",
    })));
  };
  const mapAudit=(audRes)=>{
    if(!audRes?.entries?.length)return;
    setAudit(audRes.entries.map(a=>({
      id:a.id, ts:a.timestamp, skuId:a.skuId, skuName:a.skuName,
      action:a.action, type:a.type, wa:a.whatsappStatus||"none",
    })));
  };
  const mapNotifs=(nRes)=>{
    if(!nRes)return;
    setNotifications(nRes.notifications||[]);
    setUnreadCount(nRes.unreadCount||0);
  };

  const refreshAll=async(p=period)=>{
    try{
      const [dashRes,tktRes,audRes,nRes]=await Promise.all([
        fetch(`/api/v1/dashboard?period=${p}`).then(r=>r.ok?r.json():null).catch(()=>null),
        fetch("/api/v1/tickets").then(r=>r.ok?r.json():null).catch(()=>null),
        fetch("/api/v1/audit").then(r=>r.ok?r.json():null).catch(()=>null),
        fetch("/api/v1/notifications").then(r=>r.ok?r.json():null).catch(()=>null),
      ]);
      mapDashboard(dashRes);
      mapTickets(tktRes);
      mapAudit(audRes);
      mapNotifs(nRes);
      setLastSync(Date.now());
    }catch{}finally{setLoading(false);}
  };

  // Load data when period changes (and on mount)
  useEffect(()=>{ refreshAll(period); },[period]);

  // Poll notifications every 15 seconds
  useEffect(()=>{
    const iv=setInterval(async()=>{
      try{
        const nRes=await fetch("/api/v1/notifications").then(r=>r.ok?r.json():null).catch(()=>null);
        mapNotifs(nRes);
      }catch{}
    },15000);
    return ()=>clearInterval(iv);
  },[]);

  const handleRunAgents=async()=>{
    setAgentRunning(true);
    toast("▶ Agent pipeline started…","info");
    try{
      const res=await fetch("/api/v1/agents/run",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({period})});
      if(!res.ok){toast("Failed to start agents","warn");setAgentRunning(false);return;}
      const {jobId}=await res.json();
      const poll=async()=>{
        for(let i=0;i<60;i++){
          await new Promise(r=>setTimeout(r,3000));
          try{
            const sr=await fetch(`/api/v1/agents/status/${jobId}`);
            if(!sr.ok)continue;
            const job=await sr.json();
            if(job.status==="completed"){
              toast("✅ Agent pipeline complete — refreshing data","ok");
              await refreshAll();
              setAgentRunning(false);
              return;
            }
            if(job.status==="failed"){
              toast(`Agent run failed: ${job.error||"unknown"}`,"warn");
              setAgentRunning(false);
              return;
            }
          }catch{}
        }
        toast("Agent run timed out","warn");
        setAgentRunning(false);
      };
      poll();
    }catch{
      toast("Error triggering agents","warn");
      setAgentRunning(false);
    }
  };

  const handleRunAgentForSku=async(sku)=>{
    const skuId=sku.cosmosId||sku.id;
    setSkuAgentRunning(true);
    toast(`▶ Running agents for ${sku.name}…`,"info");
    try{
      const res=await fetch("/api/v1/agents/run",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({sku_ids:[skuId],period})});
      if(!res.ok){toast("Failed to start agent for SKU","warn");setSkuAgentRunning(false);return;}
      const {jobId}=await res.json();
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,3000));
        try{
          const sr=await fetch(`/api/v1/agents/status/${jobId}`);
          if(!sr.ok)continue;
          const job=await sr.json();
          if(job.status==="completed"){
            toast(`✅ Agent complete for ${sku.name} — refreshing`,"ok");
            await refreshAll();
            setSkuAgentRunning(false);
            return;
          }
          if(job.status==="failed"){
            toast(`Agent failed for ${sku.name}: ${job.error||"unknown"}`,"warn");
            setSkuAgentRunning(false);
            return;
          }
        }catch{}
      }
      toast("Agent run timed out for SKU","warn");
      setSkuAgentRunning(false);
    }catch{
      toast("Error triggering agent for SKU","warn");
      setSkuAgentRunning(false);
    }
  };

  const handleMarkAllRead=()=>{
    setNotifications(ns=>ns.map(n=>({...n,read:true})));
    setUnreadCount(0);
  };

  const handleNotifNavigate=(n)=>{
    setNotifOpen(false);
    if(n.type.startsWith("TICKET"))setPage("tickets");
    else setPage("audit");
  };

  // Inject CSS once
  useEffect(()=>{
    if(!document.getElementById("mg-css")){
      const el=document.createElement("style");el.id="mg-css";el.textContent=CSS;
      document.head.appendChild(el);
    }
  },[]);

  const toast=(msg,type="ok")=>{
    const id=Date.now();
    setToasts(t=>[...t,{id,msg,type}]);
    setTimeout(()=>setToasts(t=>t.filter(x=>x.id!==id)),4500);
  };

  const handleAction=(type,sku,rec)=>{
    if(type==="skip"){setSelected(null);toast("Skipped — no action taken","info");return;}
    setModal({type,sku,rec});
  };

  const handleConfirm=()=>{
    const {type,sku,rec}=modal;
    if(type==="approve"||type==="po"){
      setApproved(s=>new Set([...s,sku.id]));
      const entry={id:Date.now(),ts:"Just now",skuId:sku.id,skuName:sku.name,
        action:rec.title,type:"AUTONOMOUS",wa:waOn?"sent":"none"};
      setAudit(a=>[entry,...a]);
      toast(`✅ Executed: ${sku.id}${waOn?" · WhatsApp sent":""}`, "ok");
    } else if(type==="ticket"){
      const tk={id:`TK-${String(tickets.length+1).padStart(3,"0")}`,skuId:sku.id,skuName:sku.name,
        action:rec.title,breaches:sku.agent.breaches,composite:sku.composite,band:sku.band,
        status:"OPEN",ts:"Just now",wa:waOn?"pending":"none"};
      setTickets(t=>[tk,...t]);
      setTicketed(s=>new Set([...s,sku.id]));
      toast(`🎫 Ticket created for ${sku.id} — awaiting approval`,"ticket");
    }
    setModal(null);setSelected(null);
  };

  const approveTicket=(tkId)=>{
    setTickets(t=>t.map(tk=>tk.id===tkId?{...tk,status:"APPROVED",wa:"sent"}:tk));
    const tk=tickets.find(t=>t.id===tkId);
    if(tk){
      setApproved(s=>new Set([...s,tk.skuId]));
      const entry={id:Date.now(),ts:"Just now",skuId:tk.skuId,skuName:tk.skuName,
        action:`TICKET APPROVED → ${tk.action}`,type:"TICKET",wa:waOn?"sent":"none"};
      setAudit(a=>[entry,...a]);
      toast(`✅ Ticket ${tkId} approved & executed${waOn?" · WhatsApp sent":""}`, "ok");
    }
  };

  const rejectTicket=(tkId)=>{
    setTickets(t=>t.map(tk=>tk.id===tkId?{...tk,status:"REJECTED"}:tk));
    toast(`✕ Ticket ${tkId} rejected`,"warn");
  };

  const handleThresholds=(th)=>{
    setThresholds(th);
    toast("✅ Thresholds updated — agent re-evaluated","ok");
  };

  const critCount=skus.filter(s=>s.band==="CRITICAL").length;
  const openTickets=tickets.filter(t=>t.status==="OPEN").length;

  return <TC.Provider value={theme}>
    <div style={{display:"flex",height:"100vh",background:theme.bg,overflow:"hidden",position:"relative"}}>
      <Sidebar page={page} setPage={p=>{setPage(p);setSelected(null);}} critCount={critCount} openTickets={openTickets}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0,position:"relative"}}>
        <TopBar dm={dm} setDm={setDm} waOn={waOn} lastSync={lastSync}
          onRunAgents={handleRunAgents} agentRunning={agentRunning}
          unreadCount={unreadCount} notifOpen={notifOpen} setNotifOpen={setNotifOpen}
          period={period} setPeriod={setPeriod}/>
        {notifOpen&&<NotificationPanel notifications={notifications} unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllRead} onClose={()=>setNotifOpen(false)}
          onNavigate={handleNotifNavigate}/>}
        <div style={{flex:1,overflow:"auto",display:"flex",flexDirection:"column",minHeight:0}}>
          {page==="dashboard"&&<Dashboard skus={skus} setSelected={setSelected} selected={selected}
            tickets={tickets} audit={audit} loading={loading}/>}
          {page==="tickets"&&<TicketsPage tickets={tickets} onApprove={approveTicket} onReject={rejectTicket} loading={loading}/>}
          {page==="audit"&&<AuditPage log={audit} loading={loading}/>}
          {page==="settings"&&<SettingsPage thresholds={thresholds} setThresholds={handleThresholds}
            poOn={poOn} setPoOn={setPoOn} waOn={waOn} setWaOn={setWaOn} dm={dm} setDm={setDm}
            onSave={()=>toast("✅ Settings saved")}/>}
        </div>
      </div>

      {/* SKU Drawer overlay */}
      {selected&&<div style={{position:"absolute",inset:0,zIndex:15}} onClick={()=>setSelected(null)}>
        <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,.3)"}}/> 
        <div style={{position:"absolute",right:0,top:0,height:"100%"}} onClick={e=>e.stopPropagation()}>
          <SKUDrawer sku={selected} onClose={()=>setSelected(null)} onAction={handleAction}
            onRunAgent={handleRunAgentForSku} skuAgentRunning={skuAgentRunning}
            poOn={poOn} waOn={waOn} approved={approved.has(selected.id)} ticketed={ticketed.has(selected.id)}/>
        </div>
      </div>}

      {/* Confirm modal */}
      {modal&&<ConfirmModal data={modal} waOn={waOn} onConfirm={handleConfirm} onCancel={()=>setModal(null)}/>}

      {/* Toasts */}
      <div style={{position:"fixed",top:16,right:16,zIndex:100,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none"}}>
        {toasts.map(t=>(
          <div key={t.id} className="ti" style={{background:"#0F172A",color:"#E2EBF6",
            fontSize:13,fontWeight:500,padding:"10px 16px",borderRadius:12,
            boxShadow:"0 8px 24px rgba(0,0,0,.5)",maxWidth:360}}>
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  </TC.Provider>;
}
