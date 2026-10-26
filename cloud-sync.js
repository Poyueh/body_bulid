/* 體態導航站：Supabase Authentication + private JSON cloud sync.
   Public configuration only. Keep secret/service_role keys out of this file.
   The dashboard's original record structures and editors remain in index.html. */
(function () {
  'use strict';
  var URL = 'https://facszcehjrahalcaftyn.supabase.co';
  var KEY = 'sb_publishable_APvk5IE_6iVHpD04gZSnbw_s9uzBtim';
  var client, user = null, remoteVersion = null;
  var writing = false, queued = false, blocked = false, loading = false, recovery = false;
  var $ = function (id) { return document.getElementById(id); };
  var today = function () { return new Date().toLocaleDateString('en-CA', {timeZone:'Asia/Taipei'}); };
  function msg(value, isError) {
    var e = $('cloudMessage');
    e.textContent = value || '';
    e.style.color = isError ? '#ff9888' : '#a6e6d2';
  }
  function status(value, bad) {
    var e = $('cloudState');
    if(e) { e.textContent = value; e.style.color = bad ? '#ff9888' : '#a6e6d2'; }
    if($('saveStatus')) $('saveStatus').textContent = ' · ' + value;
  }
  function draftKey(){ return user ? 'body_compass_unsynced_' + user.id : ''; }
  function show(view) {
    $('cloudGate').hidden = false;
    $('appRoot').hidden = true;
    $('mobileNav').hidden = true;
    ['cloudLogin','cloudLoading','cloudSetup','cloudConflict','cloudRecovery'].forEach(function(id){
      $(id).hidden = (id !== view);
    });
  }
  function app() {
    $('cloudGate').hidden = true;
    $('appRoot').hidden = false;
    $('mobileNav').hidden = false;
    $('cloudUserEmail').textContent = user.email || '私人帳號';
    if (!Array.isArray(D.days)) D.days = [];
    if (!D.days.length) D.days.push({date:today(),kcal:0,protein:0,carbs:0,fat:0,sugar:0,sodium:0,
      burn:null,active:null,exercise:null,status:'當日進行中',note:'',source:'網站手動記錄'});
    renderAll();
    status('已連線 Supabase',false);
  }
  function valid(x){
    return x && typeof x === 'object' && Array.isArray(x.body) && Array.isArray(x.days) &&
      Array.isArray(x.workouts) && x.goals && typeof x.goals === 'object';
  }
  function normalize(x){
    return Object.assign({}, structuredClone(INITIAL), x, {
      foods:Array.isArray(x.foods)?x.foods:[],
      notes:Array.isArray(x.notes)?x.notes:[],
      workouts:Array.isArray(x.workouts)?x.workouts:[],
      body:x.body,days:x.days,
      goals:Object.assign({},INITIAL.goals,x.goals)
    });
  }
  function readDraft(){
    try { return JSON.parse(localStorage.getItem(draftKey()) || 'null'); } catch(e) { return null; }
  }
  function rememberDraft(){
    try {
      localStorage.setItem(draftKey(),JSON.stringify({data:D,serverVersion:remoteVersion,savedAt:new Date().toISOString()}));
    } catch(e) { status('本機空間不足，請立即下載 JSON 備份',true); }
  }
  function clearDraft(){ try { localStorage.removeItem(draftKey()); } catch(e) {} }
  function legacyData(){
    try {
      var obj=JSON.parse(localStorage.getItem(STORE)||'null');
      return valid(obj) && obj.body.length ? normalize(obj) : null;
    }catch(e){ return null; }
  }
  function onSetup() {
    show('cloudSetup');
    $('cloudLegacyImport').hidden = !legacyData();
    msg('雲端目前沒有紀錄。匯入舊備份或新增第一筆測量即可開始。',false);
  }
  function onConflict(text){
    blocked = true;
    show('cloudConflict');
    $('cloudConflictReason').textContent=text||'另一台裝置已更新雲端；為避免覆蓋，已暫停同步。';
    msg('本機未同步變更已保留，請先下載備份再選擇如何處理。',true);
    status('同步衝突：需要你決定',true);
  }
  async function pull() {
    var r=await client.from('dashboard_data').select('data,updated_at')
      .eq('user_id',user.id).maybeSingle();
    if(r.error) throw Error(r.error.message);
    return r.data;
  }
  async function openAccount(){
    if(loading || recovery) return;
    loading=true;
    show('cloudLoading');
    msg('正在驗證帳號與讀取私人紀錄…');
    try{
      var res=await client.auth.getUser();
      if(res.error || !res.data.user) throw Error(res.error ? res.error.message:'登入已失效');
      var next=res.data.user;
      if(user && user.id!==next.id){ queued=false; blocked=false; remoteVersion=null; }
      user=next;
      var row=await pull();
      var draft=readDraft();
      remoteVersion=row ? row.updated_at : null;
      if(draft && valid(draft.data)) {
        D=normalize(draft.data);
        if(draft.serverVersion === remoteVersion && row) {
          blocked=false; queued=true; app();
          status('找到本機未同步紀錄，正在重試…',true);
          void sync();
        } else {
          onConflict(row ? '雲端已由其他裝置更新，本機也有未同步修改。請選擇保留哪一版。'
                         : '找到本機未同步紀錄，但雲端尚無對應資料。請選擇如何還原。');
        }
      }else if(row){
        if(!valid(row.data)) throw Error('資料格式異常，請聯絡維護者並保留備份');
        D=normalize(row.data);
        blocked=false; queued=false; app();
      }else{
        blocked=false; queued=false; onSetup();
      }
    }catch(e){
      user=null;
      show('cloudLogin');
      msg('讀取失敗：'+e.message,true);
    }finally{loading=false;}
  }
  async function begin(data){
    if(!user || !valid(data) || !data.body.length) {
      msg('請先匯入有效備份，或填寫至少一筆體態測量。',true);return;
    }
    show('cloudLoading');
    msg('正在將第一份紀錄保存到私人資料庫…');
    try {
      var clean=normalize(data);
      var r=await client.from('dashboard_data').insert({user_id:user.id,data:clean})
        .select('updated_at').single();
      if(r.error) throw Error(r.error.message);
      D=clean; remoteVersion=r.data.updated_at;
      clearDraft(); blocked=false;queued=false;
      app();status('雲端已同步',false);
      toast('初始資料已安全存入 Supabase');
    }catch(e){onSetup();msg('首次儲存失敗：'+e.message,true);}
  }
  window.cloudSave=function(){
    if(!user){ status('尚未登入，資料不會儲存',true);return; }
    rememberDraft();
    queued=true;
    status('正在同步…',false);
    if(!blocked) void sync();
  };
  async function sync(){
    if(writing || blocked || !user) return;
    if(remoteVersion === null){
      onConflict('雲端找不到原始版本。請使用「匯出本機資料」後處理。');
      return;
    }
    writing=true;
    try{
      while(queued && !blocked && user){
        queued=false;
        var originalVersion=remoteVersion;
        var snapshot=JSON.stringify(D);
        var changedAt=new Date().toISOString();
        var r=await client.from('dashboard_data')
          .update({data:JSON.parse(snapshot),updated_at:changedAt})
          .eq('user_id',user.id)
          .eq('updated_at',originalVersion)
          .select('updated_at').maybeSingle();
        if(r.error){queued=true; status('網路或資料庫錯誤：未同步，可稍後重試',true);break;}
        if(!r.data){queued=true;onConflict('雲端資料版本已改變，已阻止這台裝置覆蓋另一台的紀錄。');break;}
        remoteVersion=r.data.updated_at;
        if(JSON.stringify(D)!==snapshot){queued=true;rememberDraft();}
        else if(!queued){clearDraft();status('雲端已同步 · '+new Date().toLocaleTimeString('zh-TW'),false);}
      }
    }catch(e){queued=true;status('同步失敗：'+e.message,true);}
    finally{writing=false;}
  }
  window.cloudRetryNow=function(){ if(blocked){onConflict();return;} if(queued || readDraft()){queued=true;void sync();}else void refresh();};
  async function refresh(){
    if(!user || writing || queued || blocked || !$('cloudGate').hidden) return;
    try{
      var row=await pull();
      if(!row){status('雲端資料不存在，請保留 JSON 備份',true);return;}
      if(row.updated_at!==remoteVersion){
        if(readDraft()){onConflict('偵測到另一台裝置的更新與本機草稿，請先處理衝突。');return;}
        D=normalize(row.data);remoteVersion=row.updated_at;app();
        status('已載入另一台裝置的新紀錄',false);
      }
    }catch(e){ status('暫時離線，可稍後重試',true); }
  }
  window.cloudRefreshNow=refresh;
  window.cloudLogin=async function(e){
    e.preventDefault();
    if(!client)return;
    var email=$('cloudEmail').value.trim();
    var password=$('cloudPassword').value;
    if(!email || !password){msg('請輸入 Email 和密碼',true);return;}
    $('cloudLoginBtn').disabled=true;msg('登入中…');
    try{
      var r=await client.auth.signInWithPassword({email:email,password:password});
      if(r.error)throw Error(r.error.message);
      await openAccount();
    }catch(err){msg('登入失敗：'+err.message,true);}
    finally{$('cloudLoginBtn').disabled=false;$('cloudPassword').value='';}
  };
  window.cloudResetEmail=async function(){
    if(!client)return;
    var email=$('cloudEmail').value.trim();
    if(!email){msg('請先輸入上方的 Email 再點忘記密碼',true);return;}
    try{
      var redirect=location.origin+location.pathname;
      var r=await client.auth.resetPasswordForEmail(email,{redirectTo:redirect});
      if(r.error)throw Error(r.error.message);
      msg('如果此信箱有帳號，將收到密碼重設郵件。請檢查收件匣及垃圾郵件。',false);
    }catch(e){msg('寄送失敗：'+e.message,true);}
  };
  window.cloudSetPassword=async function(e){
    e.preventDefault(); var p=$('cloudNewPassword').value;
    if(p.length<10){msg('建議使用至少10個字元的密碼',true);return;}
    var r=await client.auth.updateUser({password:p});
    if(r.error){msg('修改密碼失敗：'+r.error.message,true);return;}
    recovery=false;$('cloudNewPassword').value='';
    msg('密碼已更新，正在讀取資料…');await openAccount();
  };
  window.cloudSignOut=async function(){
    if((queued || readDraft()) && !confirm('還有未同步變更。請先下載 JSON 備份。仍要登出嗎？'))return;
    try{await client.auth.signOut();}catch(e){msg(e.message,true);}
    user=null;remoteVersion=null;queued=false;blocked=false;D=structuredClone(INITIAL);
    $('appRoot').hidden=true;$('mobileNav').hidden=true;show('cloudLogin');
    msg('已登出。',false);
  };
  window.cloudImportPasted=async function(){
    var raw=$('cloudPaste').value.trim();
    if(!raw)return msg('請先把 ChatGPT 的私人備份碼貼到輸入框。',true);
    msg('正在檢查並還原備份…');
    try{
      var decoded=raw;
      if(raw.startsWith('BC1.')){
        if(typeof DecompressionStream==='undefined')throw Error('這個瀏覽器不支援壓縮資料解碼，請更新瀏覽器');
        var bin=atob(raw.slice(4).replace(/\s+/g,''));
        var bytes=Uint8Array.from(bin,function(ch){return ch.charCodeAt(0);});
        var unzipped=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        decoded=await new Response(unzipped).text();
      }
      var x=JSON.parse(decoded.replace(/^\uFEFF/,''));
      if(!valid(x) || !x.body.length)throw Error('資料格式不符或缺少測量紀錄');
      if(!confirm('找到 '+x.body.length+' 筆體態紀錄、'+x.days.length+' 筆每日營養、'+x.workouts.length+' 筆訓練。確定存入私人 Supabase？'))return;
      await begin(x);
    }catch(e){msg('備份碼匯入失敗：'+e.message,true);}
  };
  window.cloudImportFile=async function(input){
    var f=input.files && input.files[0]; if(!f)return;
    try{
      var x=JSON.parse((await f.text()).replace(/^\uFEFF/,''));
      if(!valid(x) || !x.body.length)throw Error('這不是完整的體態導航站備份，或缺少測量資料');
      if(!confirm('確定將「'+f.name+'」的 '+x.body.length+' 筆體態紀錄匯入你的私人雲端嗎？'))return;
      await begin(x);
    }catch(e){msg('匯入失敗：'+e.message,true);}
    finally{input.value='';}
  };
  window.cloudImportLegacy=async function(){
    var old=legacyData();
    if(!old)return msg('這個瀏覽器沒有找到舊的本機紀錄。請使用 JSON 備份匯入。',true);
    if(confirm('將本機舊紀錄上傳到你的私人 Supabase？'))await begin(old);
  };
  window.cloudStartFresh=async function(e){
    e.preventDefault();
    var f=$('cloudFreshForm'),body={
      date:f.elements.date.value, device:'H3',weight:Number(f.elements.weight.value),
      bf:Number(f.elements.bf.value),smm:Number(f.elements.smm.value||0),
      fat:null,visceral:null,score:null,source:'手動建立',note:''
    };
    if(!body.date || !(body.weight>=30 && body.weight<=300) || !(body.bf>0 && body.bf<80)){
      msg('請填入有效的日期、體重及體脂率。',true);return;
    }
    if(!f.elements.smm.value) body.smm=null;
    var fresh=structuredClone(INITIAL);
    fresh.body=[body];fresh.days=[{date:body.date,kcal:0,protein:0,carbs:0,fat:0,sugar:0,sodium:0,
      burn:null,active:null,exercise:null,status:'當日進行中',note:'',source:'手動新增'}];
    await begin(fresh);
  };
  window.cloudDownloadDraft=function(){
    var draft=readDraft();
    if(draft && draft.data) download('體態導航站_未同步備份_'+today()+'.json',JSON.stringify(draft.data,null,2),'application/json;charset=utf-8');
    else exportJSON();
  };
  window.cloudUseRemote=async function(){
    if(!confirm('將顯示最新雲端版本；本機未同步紀錄將被捨棄。請先下載本機備份！確定繼續？'))return;
    clearDraft();blocked=false;queued=false;await openAccount();
  };
  window.cloudForceLocal=async function(){
    if(!confirm('警告：這將以本機完整資料覆蓋雲端目前版本，可能刪除另一台裝置的新紀錄。你確定已備份並要覆蓋嗎？'))return;
    try{
      var r=await pull();
      blocked=false;queued=false;remoteVersion=r?r.updated_at:null;
      if(!r){await begin(D);return;}
      rememberDraft();queued=true;app();void sync();
    }catch(e){onConflict('無法讀取最新版：'+e.message);}
  };
  async function start(){
    if(!window.supabase || !window.supabase.createClient){
      show('cloudLogin');msg('無法載入 Supabase 程式庫。請確認網路並重新整理。',true);return;
    }
    client=window.supabase.createClient(URL,KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    show('cloudLoading');
    client.auth.onAuthStateChange(function(ev,session){
      if(ev==='PASSWORD_RECOVERY'){recovery=true;show('cloudRecovery');msg('請設定新密碼。',false);return;}
      if(ev==='SIGNED_OUT'){ user=null;remoteVersion=null;queued=false;blocked=false;show('cloudLogin');return; }
      if(ev==='SIGNED_IN' && session && !user && !recovery)setTimeout(function(){void openAccount();},0);
    });
    try{
      var r=await client.auth.getSession();
      if(r.error)throw Error(r.error.message);
      if(recovery)return;
      if(r.data.session)await openAccount();
      else{show('cloudLogin');msg('請使用剛才建立的 Supabase 使用者帳號登入。',false);}
    }catch(e){show('cloudLogin');msg('無法建立登入連線：'+e.message,true);}
    document.addEventListener('visibilitychange',function(){if(!document.hidden)void refresh();});
    window.addEventListener('focus',function(){void refresh();});
    setInterval(function(){void refresh();},60000);
  }
  window.addEventListener('load',function(){void start();});
})();
