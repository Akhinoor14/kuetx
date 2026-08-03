import{aq as v,r as l,an as e}from"./vendor-C1WfLDDx.js";import{D as y,bw as j,bo as N,bt as C,bv as w}from"./index-Cbo6f_bg.js";import{aR as m,aQ as S,aj as q,C as E,a4 as I}from"./vendor-lucide-CLvHgTfq.js";import"./vendor-pdf-Cwk5R7Zj.js";import"./vendor-firebase-CU-YtS9U.js";function T(r){return Object.prototype.hasOwnProperty.call(r,"requesterUid")?"errand":Object.prototype.hasOwnProperty.call(r,"items")&&Object.prototype.hasOwnProperty.call(r,"replyText")?"inquiry":"booking"}const z={booking:{pending:"Waiting for shop to confirm",confirmed:"Confirmed",done:"Completed",cancelled:"Cancelled",expired_shop_closed:"Cancelled — shop closed"},inquiry:{open:"Waiting for a reply",answered:"Replied",closed:"Closed"},errand:{open:"Waiting for a Runner",runner_accepted:"Runner accepted — confirm to proceed",confirmed:"Confirmed",finished:"Completed",cancelled:"Cancelled"}},O={booking:["pending","confirmed"],inquiry:["open","answered"],errand:["open","runner_accepted","confirmed"]},B={booking:["done"],inquiry:[],errand:["finished"]};function A(r,n){return O[r].includes(n)?"active":B[r].includes(n)?"done":"closed"}const R={booking:I,inquiry:E,errand:q},_={booking:"Booking",inquiry:"Inquiry",errand:"Delivery request"};function L(){const r=v(),n=y.currentUser?.uid||null,[s,o]=l.useState(null),[a,i]=l.useState(null),[u,x]=l.useState("");l.useEffect(()=>{if(!n){o([]);return}return j(n,o)},[n]);const c=l.useMemo(()=>{const t={active:[],done:[],closed:[]};return(s||[]).forEach(d=>{const h=T(d),f=A(h,d.status);t[f].push({...d,kind:h})}),t},[s]),g=async t=>{x(""),i(t.id);try{t.kind==="errand"?await N(t.serviceId,t.id):t.kind==="inquiry"?await C(t.serviceId,t.id):await w(t.serviceId,t.id,"student")}catch(d){x(d?.message||"Could not cancel this — please try again.")}finally{i(null)}};if(s===null)return e.jsxs("div",{className:"page-enter page-container content-page-bg",children:[e.jsx(b,{navigate:r}),e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:10},children:[0,1,2].map(t=>e.jsx("div",{className:"card kuetx-orderhub-skeleton",style:{padding:16,height:72}},t))}),e.jsx("style",{children:`
          .kuetx-orderhub-skeleton { animation: kuetxOrderHubPulse 1.1s ease-in-out infinite; }
          @keyframes kuetxOrderHubPulse { 0%, 100% { opacity: 0.55; } 50% { opacity: 1; } }
        `})]});const k=c.active.length===0&&c.done.length===0&&c.closed.length===0;return e.jsxs("div",{className:"page-enter page-container content-page-bg",children:[e.jsx(b,{navigate:r}),u&&e.jsx("div",{className:"kx-hub-error",children:u}),k?e.jsxs("div",{className:"card kx-hub-empty",children:[e.jsx(m,{size:36,strokeWidth:1.5}),e.jsx("div",{style:{fontWeight:700,marginTop:10},children:"No orders yet"}),e.jsx("div",{style:{fontSize:13.5,color:"var(--muted)",marginTop:4},children:"Anything you book, ask about, or request delivery for will show up here."})]}):e.jsxs(e.Fragment,{children:[e.jsx(p,{title:"Active",records:c.active,onCancel:g,busyId:a,navigate:r}),e.jsx(p,{title:"Completed",records:c.done,onCancel:null,busyId:a,navigate:r}),e.jsx(p,{title:"Cancelled / Closed",records:c.closed,onCancel:null,busyId:a,navigate:r})]}),e.jsx("style",{children:`
        .kx-hub-error {
          padding: 12px 14px; border-radius: 12px; margin-bottom: 14px;
          background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.30);
          color: var(--text); font-size: 13.5px;
        }
        .kx-hub-empty {
          padding: 40px 20px; text-align: center; color: var(--muted);
          display: flex; flex-direction: column; align-items: center;
        }
      `})]})}function b({navigate:r}){return e.jsxs("div",{className:"kx-hub-header",children:[e.jsx("button",{onClick:()=>r("/services"),className:"kx-hub-back","aria-label":"Back to Services",children:e.jsx(S,{size:18})}),e.jsxs("div",{children:[e.jsx("div",{className:"kx-hub-title",children:"My Orders"}),e.jsx("div",{className:"kx-hub-subtitle",children:"Everything you've booked or asked about, across every shop"})]}),e.jsx("style",{children:`
        .kx-hub-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .kx-hub-back {
          width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--card); border: 1px solid var(--border); color: var(--text); cursor: pointer;
        }
        .kx-hub-title { font-size: 20px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .kx-hub-subtitle { font-size: 13px; color: var(--muted); margin-top: 2px; }
      `})]})}function p({title:r,records:n,onCancel:s,busyId:o,navigate:a}){return n.length===0?null:e.jsxs("div",{style:{marginBottom:22},children:[e.jsx("div",{className:"kx-hub-section-title",children:r}),e.jsx("div",{style:{display:"flex",flexDirection:"column",gap:10},children:n.map(i=>e.jsx(D,{rec:i,onCancel:s,busy:o===i.id,navigate:a},`${i.serviceId}-${i.id}`))}),e.jsx("style",{children:`
        .kx-hub-section-title {
          font-size: 12.5px; font-weight: 800; letter-spacing: 0.03em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 10px;
        }
      `})]})}function D({rec:r,onCancel:n,busy:s,navigate:o}){const a=R[r.kind]||m,i=z[r.kind]?.[r.status]||r.status,u=r.kind==="errand"?r.itemDescription:r.serviceName||"Shop";return e.jsxs("div",{className:"card kx-hub-card",onClick:()=>o(`/services/${r.serviceId}`),children:[e.jsx("div",{className:"kx-hub-card-icon",children:e.jsx(a,{size:20,strokeWidth:1.75})}),e.jsxs("div",{className:"kx-hub-card-body",children:[e.jsxs("div",{className:"kx-hub-card-top",children:[e.jsx("span",{className:"kx-hub-card-kind",children:_[r.kind]}),e.jsx("span",{className:"kx-hub-card-shop",children:r.serviceName||"Shop"})]}),e.jsx("div",{className:"kx-hub-card-title",children:u}),e.jsx("div",{className:"kx-hub-card-status",children:i})]}),n&&e.jsx("button",{onClick:x=>{x.stopPropagation(),n(r)},disabled:s,className:"btn btn-sm btn-secondary kx-hub-card-cancel",children:s?"Cancelling…":"Cancel"}),e.jsx("style",{children:`
        .kx-hub-card {
          display: flex; align-items: flex-start; gap: 12px; padding: 14px;
          cursor: pointer; transition: border-color 0.15s ease;
        }
        .kx-hub-card:hover { border-color: rgba(var(--accentRGB), 0.35); }
        .kx-hub-card-icon {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-hub-card-body { flex: 1; min-width: 0; }
        .kx-hub-card-top { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
        .kx-hub-card-kind {
          font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.03em;
          color: var(--accent); background: var(--accentSoft); padding: 2px 8px; border-radius: 999px;
        }
        .kx-hub-card-shop { font-size: 12px; color: var(--muted); }
        .kx-hub-card-title { font-size: 14.5px; font-weight: 700; color: var(--text); margin-top: 2px; }
        .kx-hub-card-status { font-size: 12.5px; color: var(--muted); margin-top: 3px; }
        .kx-hub-card-cancel { flex-shrink: 0; align-self: center; }
      `})]})}export{L as default};
