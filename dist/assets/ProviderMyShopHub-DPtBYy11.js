import{r as x,aq as g,an as e}from"./vendor-C1WfLDDx.js";import{ba as f,bx as v,x as m}from"./index-Cbo6f_bg.js";import{g as k,k as j,m as S,a7 as y}from"./vendor-lucide-CLvHgTfq.js";import"./vendor-pdf-Cwk5R7Zj.js";import"./vendor-firebase-CU-YtS9U.js";function R({providerProfile:o}){const{t}=f(),[i,n]=x.useState(null),r=o?.uid,c=g();if(x.useEffect(()=>{if(r)return v(r,n)},[r]),!r)return null;const a=i===null,l=i&&i.length>0?i[0]:null,s=l?m(l):null,h=s?(s.offerings||[]).length:0,p=s?t("shopHub.itemsSuffix")(h):t("shopHub.notSetUp"),d=s?.status==="dormant",b=t(s?d?"shopHub.dormant":"shopHub.active":"shopHub.notSetUp");return e.jsxs("div",{style:{padding:"20px 16px",maxWidth:640,margin:"0 auto"},children:[e.jsxs("div",{style:{display:"flex",alignItems:"center",gap:10,marginBottom:18},children:[e.jsx("div",{style:{width:44,height:44,borderRadius:12,background:"var(--accentSoft)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0},children:e.jsx(k,{size:22,color:"var(--accent)"})}),e.jsxs("div",{children:[e.jsx("div",{style:{fontSize:17,fontWeight:700,color:"var(--text)"},children:t("shopHub.title")}),e.jsx("div",{style:{fontSize:12.5,color:"var(--muted)"},children:t("shopHub.subtitle")})]})]}),a&&e.jsx("div",{style:{padding:20,textAlign:"center",color:"var(--muted)",fontSize:13},children:t("shopHub.loading")}),!a&&!s&&e.jsx("div",{style:{padding:20,textAlign:"center",color:"var(--muted)",fontSize:13},children:t("shopHub.noServiceYet")}),!a&&s&&e.jsxs("div",{className:"kx-hub-grid",children:[e.jsx(u,{icon:e.jsx(j,{size:22}),title:t("shopHub.offeringsTitle"),subtitle:p,onClick:()=>c("/provider/shop/offerings")}),e.jsx(u,{icon:e.jsx(S,{size:22}),title:t("shopHub.settingsTitle"),subtitle:b,accent:d?"warn":"ok",onClick:()=>c("/provider/shop/settings")})]}),e.jsx("style",{children:`
        .kx-hub-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (min-width: 480px) {
          .kx-hub-grid { gap: 14px; }
        }
      `})]})}function u({icon:o,title:t,subtitle:i,onClick:n,accent:r}){return e.jsxs("button",{onClick:n,className:"kx-hub-card",children:[e.jsxs("div",{className:"kx-hub-card-top",children:[e.jsx("div",{className:"kx-hub-card-icon",children:o}),e.jsx(y,{size:16,className:"kx-hub-card-chevron"})]}),e.jsx("div",{className:"kx-hub-card-title",children:t}),e.jsx("div",{className:`kx-hub-card-subtitle${r==="warn"?" is-warn":r==="ok"?" is-ok":""}`,children:i}),e.jsx("style",{children:`
        .kx-hub-card {
          text-align: left; cursor: pointer; width: 100%; box-sizing: border-box;
          border: 1px solid var(--border); border-radius: 16px; background: var(--card);
          padding: 14px; display: flex; flex-direction: column; gap: 8px;
          transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
        }
        .kx-hub-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 22px -12px rgba(0,0,0,0.18);
          border-color: rgba(var(--accentRGB), 0.3);
        }
        .kx-hub-card-top { display: flex; align-items: flex-start; justify-content: space-between; }
        .kx-hub-card-icon {
          width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--accentSoft); color: var(--accent);
        }
        .kx-hub-card-chevron { color: var(--muted); margin-top: 4px; }
        .kx-hub-card-title { font-size: 13.5px; font-weight: 700; color: var(--text); margin-top: 2px; }
        .kx-hub-card-subtitle { font-size: 11.5px; color: var(--muted); line-height: 1.4; }
        .kx-hub-card-subtitle.is-ok { color: var(--accentDark, var(--accent)); font-weight: 600; }
        .kx-hub-card-subtitle.is-warn { color: #c2410c; font-weight: 600; }
      `})]})}export{R as default};
