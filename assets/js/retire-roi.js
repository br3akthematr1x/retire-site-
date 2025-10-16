/* RETIRE – calculators with live price + currency, gain-vs-gain multiple,
   DCA simulator (daily/weekly/monthly), and 1y auto CAGR via Dexscreener candles.
   Pair: 6HfaJiUuTXFZEfmdkQSNbvfe6i95Nh2wUVJ5dWMf7gtw (Solana)
*/
(() => {
    const CONFIG = {
      dex: { chain: "solana", pair: "6HfaJiUuTXFZEfmdkQSNbvfe6i95Nh2wUVJ5dWMf7gtw", refreshMs: 60_000 },
      defaults: { avgEntryUSD: 0.005, cagr: 0.07, fee: 0.005, dcaYears: 5, dcaRetireCAGR: 1.0 },
      currencies: ["USD", "CAD", "EUR", "GBP"],
      roiCaps: [25e6, 50e6, 100e6, 250e6, 500e6, 750e6, 1e9, 2.5e9, 5e9, 7.5e9]
    };
  
    const $  = (s, r=document)=>r.querySelector(s);
    const $$ = (s, r=document)=>Array.from(r.querySelectorAll(s));
    const num = (v)=>parseFloat(String(v||"").replace(/,/g,""))||0;
    const yearsBetween=(a,b)=>Math.max(0,(b-a)/1000/60/60/24/365.25);
    const F={
      money2:(c)=>new Intl.NumberFormat(undefined,{style:"currency",currency:c,maximumFractionDigits:2}),
      money6:(c)=>new Intl.NumberFormat(undefined,{style:"currency",currency:c,maximumFractionDigits:6}),
      n2:new Intl.NumberFormat(undefined,{maximumFractionDigits:2})
    };
  
    let live={priceUSD:0,change24h:0,vol24h:0,liq:0,fdv:0};
    let fx={rates:{USD:1,CAD:1.36,EUR:0.92,GBP:0.79}};
  
    // ---------- Live data ----------
    async function fetchPair(){
      try{
        const url=`https://api.dexscreener.com/latest/dex/pairs/${CONFIG.dex.chain}/${CONFIG.dex.pair}`;
        const r=await fetch(url); const j=await r.json();
        const p=j.pair||j.pairs?.[0]||{};
        const pick=(...xs)=>{ for(const x of xs){ const v=typeof x==="function"?x():x; if(v!==undefined&&v!==null&&!Number.isNaN(Number(v))) return Number(v);} return 0; };
        live.priceUSD = pick(p.priceUsd, p.price?.usd, p.price);
        live.change24h= pick(p.priceChange?.h24, p.priceChangeH24, p.change24h, p.change?.h24);
        live.vol24h   = pick(p.volume?.h24?.usd, p.volume?.h24, p.volume24hUsd, p.volumeUsd24h, p.volume24h, p["24hVolumeUsd"], p["24hVolume"]);
        live.liq      = pick(p.liquidity?.usd, p.liquidityUsd, p.liquidity);
        live.fdv      = pick(p.fdvUsd, p.fdv);
        document.dispatchEvent(new CustomEvent("retire:live-updated"));
      }catch(e){ console.warn("pair fetch",e); }
    }
    async function fetchFX(){
      try{
        const list="USD,CAD,EUR,GBP";
        const r=await fetch(`https://api.exchangerate.host/latest?base=USD&symbols=${encodeURIComponent(list)}`);
        const j=await r.json();
        fx.rates=j.rates||fx.rates;
        document.dispatchEvent(new CustomEvent("retire:fx-updated"));
      }catch(e){ console.warn("fx fetch",e); }
    }
  
    // ---------- 1y CAGR from candles ----------
    async function estimateCAGR1Y(){
      try{
        const to = Math.floor(Date.now()/1000);
        const from = to - 365*24*60*60;
        const url = `https://api.dexscreener.com/charts/v1/tradingView/${CONFIG.dex.chain}/${CONFIG.dex.pair}?from=${from}&to=${to}&res=1D`;
        const r = await fetch(url);
        if (!r.ok) throw new Error("HTTP "+r.status);
        const j = await r.json();
        const closes = j.c || j.close || [];
        if (!Array.isArray(closes) || closes.length < 2) throw new Error("no candles");
        const start = closes[0], end = closes[closes.length-1];
        if (!(start>0 && end>0)) throw new Error("invalid values");
        const yrs = (to - from) / (365*24*60*60);
        return Math.pow(end/start, 1/yrs) - 1;
      }catch(e){
        console.warn("cagr 1y failed, using default", e);
        return null;
      }
    }
  
    const toC=(usd,ccy)=>usd*(fx.rates[ccy]||1);        // USD → selected currency
    const fromC=(amt,ccy)=>amt/(fx.rates[ccy]||1);      // selected currency → USD
    const ccySymbol=(c)=>({USD:"$",CAD:"C$",EUR:"€",GBP:"£"}[c]||"$");
  
    // ---------- Full page ----------
    function initFull(){
      const root=$("#retire-pro"); if(!root) return;
  
      // Currency selector
      const ccySel=$("#rp-ccy");
      ["USD","CAD","EUR","GBP"].forEach(c=>{ const o=document.createElement("option"); o.value=c;o.textContent=c; ccySel.appendChild(o); });
      ccySel.value="USD";
  
      // Tiles
      const price=$("#rp-price"), change=$("#rp-change"), vol=$("#rp-vol"), liq=$("#rp-liq"), fdv=$("#rp-fdv"), upd=$("#rp-upd"), pairLink=$("#rp-pair");
      function abbr(v,c){
        const n=F.n2; const s=ccySymbol(c);
        if(v>=1e9) return `${s}${n.format(v/1e9)}B`;
        if(v>=1e6) return `${s}${n.format(v/1e6)}M`;
        if(v>=1e3) return `${s}${n.format(v/1e3)}K`;
        return F.money2(c).format(v);
      }
      function paintLive(){
        const c=ccySel.value;
        if(price)  price.textContent = F.money6(c).format(toC(live.priceUSD,c));
        if(change) change.textContent= `24h: ${live.change24h>=0?"▲":"▼"} ${F.n2.format(Math.abs(live.change24h))}%`;
        if(vol)    vol.textContent   = abbr(toC(live.vol24h,c),c);
        if(liq)    liq.textContent   = abbr(toC(live.liq,c),c);
        if(fdv)    fdv.textContent   = abbr(toC(live.fdv,c),c);
        if(upd)    upd.textContent   = `Updated ${new Date().toLocaleTimeString()}`;
        if(pairLink) pairLink.href   = `https://dexscreener.com/${CONFIG.dex.chain}/${CONFIG.dex.pair}`;
      }
  
      // Holdings refs
      const H={
        amt:$("#hp-amount"), avg:$("#hp-avg"), first:$("#hp-firstdate"),
        live:$("#hp-live"), price:$("#hp-price"),
        cagr:$("#hp-cagr"), fee:$("#hp-fee"),
        btn:$("#hp-calc"),
        current:$("#hp-current"), cost:$("#hp-cost"), trad:$("#hp-401k"), diff:$("#hp-diff"),
        xwrap:$("#hp-xwrap"), xmult:$("#hp-xmult"), line:$("#hp-line"), share:$("#hp-share")
      };
  
      // DCA refs
      const D={
        amount:$("#dca-amt"), years:$("#dca-years"), exp:$("#dca-exp"),
        freqRadios:$$('input[name="dca-freq"]'), btn:$("#dca-calc"),
        contrib:$("#dca-contrib"), value:$("#dca-value"), trad:$("#dca-401k"), diff:$("#dca-diff"),
        note:$("#dca-exp-note")
      };
  
      // Defaults
      if(H.avg) H.avg.value=CONFIG.defaults.avgEntryUSD;
      if(H.cagr) H.cagr.value=CONFIG.defaults.cagr;
      if(H.fee) H.fee.value=CONFIG.defaults.fee;
  
      let wantRecalc=false;
  
      function calcHoldings(force=false){
        if(!H.amt||!H.avg||!H.current||!H.cost||!H.trad||!H.diff) return;
        const c=ccySel.value;
  
        const tokens=num(H.amt.value);
        const avgUSD=num(H.avg.value);
        const curUSD = H.live?.checked ? live.priceUSD : num(H.price?.value);
  
        if(H.live?.checked && curUSD<=0){
          wantRecalc=true; fetchPair();
          if(force) alert("Fetching live price… calculation will run automatically.");
          return;
        }
        const cagr=parseFloat(H.cagr?.value||CONFIG.defaults.cagr);
        const fee=parseFloat(H.fee?.value||CONFIG.defaults.fee);
        const net=Math.max(0,cagr-fee);
  
        if(tokens<=0 || avgUSD<=0 || curUSD<=0){
          if(force) alert("Please enter your amount, average price and a current price.");
          return;
        }
  
        let years=1;
        if(H.first?.value){ const d=new Date(H.first.value); if(!isNaN(d)) years=Math.max(0,yearsBetween(d,new Date())); }
  
        const cost=tokens*avgUSD;
        const now=tokens*curUSD;
        const trad=cost*Math.pow(1+net,years);
        const diff=now-trad;
        const pct=trad>0?((now/trad)-1)*100:0;
  
        H.current.textContent=F.money2(c).format(toC(now,c));
        H.cost.textContent   =F.money2(c).format(toC(cost,c));
        H.trad.textContent   =F.money2(c).format(toC(trad,c));
        H.diff.textContent   =`${diff>=0?"+":""}${F.money2(c).format(toC(diff,c))} (${F.n2.format(pct)}%)`;
  
        if(H.line){
          const ds=H.first?.value?`since ${H.first.value}`:`over ~${F.n2.format(years)} year(s)`;
          H.line.textContent=`“Traditional 401k value” compounds your initial cost basis ${ds} at a net annual rate of ${(net*100).toFixed(2)}%.`;
        }
  
        if(H.xwrap&&H.xmult){
          const gainR=now-cost, gainK=trad-cost;
          let html="";
          if(gainR>0 && gainK>0){ const x=gainR/gainK; html=`<span class="rp-xnum">${F.n2.format(x)}×</span> greater gain than a traditional 401k over this period`; H.xwrap.hidden=false; }
          else if(gainR>0 && gainK<=0){ html=`<span class="rp-xnum">∞×</span> greater gain than a traditional 401k over this period`; H.xwrap.hidden=false; }
          else { H.xwrap.hidden=true; }
          if(!H.xwrap.hidden) H.xmult.innerHTML=html;
        }
  
        if(H.share){
          const ds=H.first?.value?`since ${H.first.value}`:`over ~${F.n2.format(years)} year(s)`;
          const msg=`My $RETIRE is worth ${F.money2(c).format(toC(now,c))} today. If the same ${F.money2(c).format(toC(cost,c))} sat in a ${(cagr*100).toFixed(0)}% 401k with ${(fee*100).toFixed(2)}% fees ${ds}, it’d be ${F.money2(c).format(toC(trad,c))}. Outperformance: ${diff>=0?"+":""}${F.money2(c).format(toC(diff,c))} (${F.n2.format(pct)}%). #RETIRE #TheLastPlay`;
          const intent=`https://twitter.com/intent/tweet?text=${encodeURIComponent(msg)}&url=${encodeURIComponent(location.origin)}`;
          H.share.onclick=()=>window.open(intent,"_blank","noopener,noreferrer");
        }
      }
  
      async function calcDCA(){
        if(!D.amount||!D.years||!D.exp||!D.freqRadios.length) return;
        const c=ccySel.value;
  
        const contrib=num(D.amount.value);
        const yrs=Math.max(0,parseFloat(D.years.value)||CONFIG.defaults.dcaYears);
        if(contrib<=0 || yrs<=0) return;
  
        const freq=(D.freqRadios.find(r=>r.checked)||{value:"monthly"}).value;
        const perYear=freq==="daily"?365:freq==="weekly"?52:12;
        const n=Math.floor(yrs*perYear);
  
        let retireCAGR;
        if(D.exp.value==="auto"){
          const est=await estimateCAGR1Y();
          retireCAGR = est ?? CONFIG.defaults.dcaRetireCAGR;
          if(D.note) D.note.textContent = est!==null ? `Auto-estimated from last 365 days: ${(retireCAGR*100).toFixed(2)}%` : `Could not fetch price history. Using default ${(CONFIG.defaults.dcaRetireCAGR*100).toFixed(0)}%.`;
        }else{
          retireCAGR=parseFloat(D.exp.value);
          if(D.note) D.note.textContent=`Manual expected CAGR selected: ${(retireCAGR*100).toFixed(0)}%`;
        }
  
        const rR = Math.pow(1+Math.max(-0.99,retireCAGR),1/perYear)-1;
        const rK = Math.pow(1+Math.max(0,(0.07-0.005)),1/perYear)-1; // 6.5% net default
  
        let vR=0, vK=0;
        for(let i=0;i<n;i++){
          vR=(vR+contrib)*(1+rR);
          vK=(vK+contrib)*(1+rK);
        }
        const total=contrib*n, diff=vR-vK;
        D.contrib.textContent=F.money2(c).format(toC(total,c));
        D.value.textContent  =F.money2(c).format(toC(vR,c));
        D.trad.textContent   =F.money2(c).format(toC(vK,c));
        D.diff.textContent   =`${diff>=0?"+":""}${F.money2(c).format(toC(diff,c))}`;
      }
  
      /* ===================== ROI CALCULATOR ===================== */
      const ROI = {
        invest: $("#roi-invest"),
        tbody: $("#roi-table tbody"),
        symbolEl: null
      };
      if (ROI.invest) {
        ROI.symbolEl = ROI.invest.closest(".roi-input")?.querySelector("span") || null;
      }
  
      function formatCap(usd, ccy){
        const s=ccySymbol(ccy);
        if(usd>=1e9) return `${s}${F.n2.format(usd/1e9)}B`;
        if(usd>=1e6) return `${s}${F.n2.format(usd/1e6)}M`;
        return `${s}${F.n2.format(usd/1e3)}K`;
      }
  
      function renderROI(){
        if(!ROI.invest || !ROI.tbody) return;
        const ccy = ccySel.value;
  
        // Make the visible input prefix match the selected currency
        if(ROI.symbolEl) ROI.symbolEl.textContent = ccySymbol(ccy);
  
        const curPrice = live.priceUSD || 0;
        const curFDV   = live.fdv || 0;
  
        // Treat the user's "Investment" entry as being in the selected currency
        const investEntered = num(ROI.invest.value);
        const investUSD     = fromC(investEntered, ccy);  // convert to USD for math
  
        ROI.tbody.innerHTML = "";
  
        if(!(curPrice>0) || !(curFDV>0)){
          ROI.tbody.innerHTML = `<tr><td colspan="4" style="opacity:.7;text-align:left">Waiting for live price and FDV…</td></tr>`;
          return;
        }
  
        const supply = curFDV / curPrice;
        if(!(supply>0)){
          ROI.tbody.innerHTML = `<tr><td colspan="4" style="opacity:.7;text-align:left">Unable to infer supply from FDV/price.</td></tr>`;
          return;
        }
  
        const caps = [curFDV, ...CONFIG.roiCaps.filter(c=>c>curFDV)];
        ROI.tbody.innerHTML = caps.map((cap,i)=>{
          const targetPrice   = cap / supply;          // USD
          const multiple      = targetPrice / curPrice;
          const investValueUSD= investUSD * multiple;  // USD
          const roiText   = i===0 ? "1x" : `${F.n2.format(multiple)}x`;
          const priceText = F.money6("USD").format(targetPrice); // keep precise in USD
          const capText   = formatCap(cap, ccy);
          const invText   = F.money2(ccy).format(toC(investValueUSD, ccy)); // output in selected currency
          return `<tr>
            <td class="${i===0?'':'roi-green'}">${roiText}</td>
            <td>${priceText}</td>
            <td>${capText}</td>
            <td>${invText}</td>
          </tr>`;
        }).join("");
      }
      /* =================== END ROI CALCULATOR =================== */
  
      // EVENTS
      H.btn?.addEventListener("click",()=>calcHoldings(true));
      ["input","change"].forEach(evt=>{
        ["hp-amount","hp-avg","hp-price","hp-cagr","hp-fee","hp-firstdate"].forEach(id=>{
          const el=document.getElementById(id); el && el.addEventListener(evt,()=>calcHoldings(false));
        });
      });
      $("#hp-live")?.addEventListener("change",()=>{ const p=$("#hp-price"); if(p) p.disabled=$("#hp-live").checked; calcHoldings(false); });
  
      D.btn?.addEventListener("click", calcDCA);
  
      // ROI reacts live
      ROI.invest?.addEventListener("input", renderROI);
  
      // Tabs
      $$(".rp-tab").forEach(btn=>{
        btn.addEventListener("click",()=>{
          $$(".rp-tab").forEach(b=>b.classList.remove("rp-tab-active"));
          $$(".rp-panel").forEach(p=>p.classList.remove("rp-panel-active"));
          btn.classList.add("rp-tab-active");
          $(`.rp-panel[data-panel="${btn.dataset.tab}"]`).classList.add("rp-panel-active");
          if(btn.dataset.tab === "roi") renderROI();
        });
      });
  
      // Currency + live updates
      $("#rp-ccy")?.addEventListener("change",()=>{ paintLive(); calcHoldings(false); renderROI(); });
      document.addEventListener("retire:live-updated",()=>{ paintLive(); if(wantRecalc){ wantRecalc=false; calcHoldings(false); } renderROI(); });
      document.addEventListener("retire:fx-updated",()=>{ paintLive(); calcHoldings(false); renderROI(); });
  
      // Boot
      fetchPair(); fetchFX();
      setInterval(fetchPair, CONFIG.dex.refreshMs);
      setInterval(fetchFX, 10*60*1000);
    }
  
    // (Mini widget init left in place for homepage support)
    function initMini(){ /* no-op on this page */ }
  
    document.addEventListener("DOMContentLoaded",()=>{ initFull(); initMini(); });
  })();
  
  