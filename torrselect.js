/* Lampa TorrSelect plugin
   Replaces TorrServer URL text inputs with dropdowns 192.168.0.100-199:8090
   Usage: host this .js somewhere raw and add URL as plugin in Lampa.
*/

(function(){

  // Настройки
  const PORT = 8090;
  const NET_PREFIX = '192.168.0.'; // можно изменить при необходимости
  const RANGE_START = 100;
  const RANGE_END = 199;
  const STORAGE_MAIN = 'lampa_torrselect_main';
  const STORAGE_BACK = 'lampa_torrselect_back';

  // Вспомогательные функции
  function mkOption(ip, selectedVal){
    const opt = document.createElement('option');
    opt.value = `http://${ip}:${PORT}`;
    opt.textContent = ip;
    if(opt.value === selectedVal) opt.selected = true;
    return opt;
  }

  function buildSelect(id, storedValue){
    const sel = document.createElement('select');
    sel.id = id;
    sel.setAttribute('aria-label', id);
    sel.tabIndex = 0;
    sel.style.minWidth = '260px';
    sel.style.fontSize = '18px';
    sel.style.padding = '6px';
    // пустой элемент (вдруг нужен)
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = '— выбрать IP —';
    sel.appendChild(empty);

    for(let i = RANGE_START; i <= RANGE_END; i++){
      const ip = NET_PREFIX + i;
      sel.appendChild(mkOption(ip, storedValue));
    }

    return sel;
  }

  function findTorrInputs(){
    // Попытки найти поля, которые используют разные плагины
    const inputs = Array.from(document.querySelectorAll('input[type="text"], input[type="url"], textarea'));
    const matches = inputs.filter(i=>{
      const v = (i.value || '') + ' ' + (i.placeholder || '') + ' ' + (i.getAttribute('name')||'') + ' ' + (i.getAttribute('id')||'');
      return /torr|torrserve|torrserver|torrserv|tserv|tserver|torserver/i.test(v);
    });
    // Если явно не нашли, попробуем найти элементы с текущим IP-образцом (http://192.168....:8090)
    if(matches.length === 0){
      const re = /http:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}/;
      const cand = inputs.filter(i => re.test(i.value || '') || re.test(i.placeholder || ''));
      return cand;
    }
    return matches;
  }

  function dispatchChange(el, val){
    try{
      el.value = val;
      el.dispatchEvent(new Event('input', {bubbles:true}));
      el.dispatchEvent(new Event('change', {bubbles:true}));
    }catch(e){
      try{ el.value = val; }catch(_){}
    }
  }

  function injectUI(container){
    // если уже вставлено — обновляем
    if(document.getElementById('torrselect_wrap')) return;

    const storedMain = localStorage.getItem(STORAGE_MAIN) || '';
    const storedBack = localStorage.getItem(STORAGE_BACK) || '';

    const wrap = document.createElement('div');
    wrap.id = 'torrselect_wrap';
    wrap.style.cssText = 'margin:12px;padding:10px;border-radius:8px;background:rgba(0,0,0,0.03);max-width:760px;';
    wrap.innerHTML = '<div style="font-weight:600;margin-bottom:8px">TorrSelect — быстрый выбор IP TorrServer</div>';

    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.gap = '8px';

    const mainBlock = document.createElement('div');
    mainBlock.style.display='flex'; mainBlock.style.flexDirection='column';
    const mainLabel = document.createElement('label'); mainLabel.textContent='Основной TorrServer:';
    const mainSel = buildSelect('torrselect_main', storedMain);
    mainBlock.appendChild(mainLabel); mainBlock.appendChild(mainSel);

    const backBlock = document.createElement('div');
    backBlock.style.display='flex'; backBlock.style.flexDirection='column';
    const backLabel = document.createElement('label'); backLabel.textContent='Дополнительный TorrServer:';
    const backSel = buildSelect('torrselect_back', storedBack);
    backBlock.appendChild(backLabel); backBlock.appendChild(backSel);

    const actions = document.createElement('div');
    actions.style.display='flex'; actions.style.flexDirection='column'; actions.style.gap='6px';
    const swapBtn = document.createElement('button');
    swapBtn.textContent = 'Поменять местами';
    swapBtn.tabIndex = 0;
    swapBtn.style.padding='8px 10px';
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Подставить в поля Lampa';
    applyBtn.tabIndex = 0;
    applyBtn.style.padding='8px 10px';

    actions.appendChild(swapBtn);
    actions.appendChild(applyBtn);

    row.appendChild(mainBlock);
    row.appendChild(backBlock);
    row.appendChild(actions);

    wrap.appendChild(row);

    // Подвставка helper
    const hint = document.createElement('div');
    hint.style.marginTop='8px';
    hint.style.fontSize='12px';
    hint.style.opacity='0.85';
    hint.textContent = 'Выберите IP и нажмите "Подставить в поля Lampa". Пульт/D-pad работает с селектом.';
    wrap.appendChild(hint);

    (container || document.body).appendChild(wrap);

    // обработчики
    function onSelChange(){
      const m = document.getElementById('torrselect_main');
      const b = document.getElementById('torrselect_back');
      localStorage.setItem(STORAGE_MAIN, m.value);
      localStorage.setItem(STORAGE_BACK, b.value);
    }
    mainSel.addEventListener('change', onSelChange);
    backSel.addEventListener('change', onSelChange);

    swapBtn.addEventListener('click', ()=>{
      const a = mainSel.value;
      const b = backSel.value;
      mainSel.value = b;
      backSel.value = a;
      onSelChange();
    });

    applyBtn.addEventListener('click', ()=>{
      applyToLampaFields(mainSel.value, backSel.value);
    });

    // Авто-инъекция если в localStorage уже есть значения
    if(storedMain || storedBack){
      setTimeout(()=>applyToLampaFields(storedMain, storedBack), 200);
    }
  }

  function applyToLampaFields(mainVal, backVal){
    // Ищем поля Lampa (обычно там два поля: основной и дополнительный)
    const found = findTorrInputs();
    if(found.length >= 2){
      // Если есть >=2, заполняем первые два
      dispatchChange(found[0], mainVal);
      dispatchChange(found[1], backVal);
      showToast('TorrSelect: значения подставлены в поля (найдено 2 поля).');
      return;
    }
    // если найдено 1 поле — подставим основной в первый, дополнитель в соседнее если есть
    if(found.length === 1){
      dispatchChange(found[0], mainVal);
      showToast('TorrSelect: значение подставлено в найденное поле.');
      return;
    }
    // Если не нашли поля — попробуем найти элементы настроек по меткам и заменить их, либо просто сохранить в localStorage
    // Сохраним в localStorage, Lampa может читать эти ключи (если нет — пользователь нажмёт Применить вручную)
    localStorage.setItem(STORAGE_MAIN, mainVal);
    localStorage.setItem(STORAGE_BACK, backVal);
    showToast('TorrSelect: не удалось найти поля Lampa. Значения сохранены локально — нажмите "Применить" в настройках TorrServer вручную.');
  }

  function showToast(text){
    try{
      const t = document.createElement('div');
      t.textContent = text;
      t.style.cssText = 'position:fixed;right:12px;bottom:12px;padding:10px 12px;background:rgba(0,0,0,0.8);color:#fff;border-radius:6px;z-index:999999;font-size:14px';
      document.body.appendChild(t);
      setTimeout(()=>{ t.style.transition='opacity .4s'; t.style.opacity='0'; setTimeout(()=>t.remove(),450); }, 2400);
    }catch(e){}
  }

  // Следим за появлением страницы настроек и вставляем UI
  function observeSettings(){
    // Попробуем расположить UI рядом с настройками плагинов/парсеров, если возможно
    const root = document.body;
    const mo = new MutationObserver((mut)=>{
      // Ищем контейнер настроек — часто классы отличаются, поэтому ищем заголовок "Настройки" или "Парсер" и вставляем рядом
      const headings = Array.from(document.querySelectorAll('h1,h2,h3,div,span,label'));
      const target = headings.find(h => /настройк|парсер|parser|plugins|расширен/i.test(h.textContent || ''));
      if(target){
        // если найден и UI ещё не вставлен — вставим ниже него
        const container = target.parentElement || document.body;
        if(!document.getElementById('torrselect_wrap')){
          injectUI(container);
        }
      }else{
        // если UI ещё не создан — вставляем в конец body (гарантированно)
        if(!document.getElementById('torrselect_wrap')){
          // но делаем это не слишком агрессивно — только если явно в интерфейсе Lampa (по URL или title)
          if(/lampa|лампа|torr/i.test(document.title || window.location.href)){
            injectUI(document.querySelector('body') || document.body);
          }
        }
      }
    });
    mo.observe(root, {childList:true, subtree:true});
    // Первичный запуск
    setTimeout(()=>{ if(!document.getElementById('torrselect_wrap')) injectUI(); }, 800);
  }

  // Запуск
  try {
    observeSettings();
    // также экспонируем функцию в window на всякий случай
    window.TorrSelect = {
      apply: applyToLampaFields,
      buildSelect: buildSelect
    };
  } catch(e){
    console.error('TorrSelect init error', e);
  }

})();
