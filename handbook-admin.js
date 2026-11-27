(() => {
  'use strict';
  const root = document.getElementById('pdAdminHandbook');
  const sectionPicker = root.querySelector('[data-handbook-section]');
  const title = root.querySelector('[data-handbook-title]');
  const toolbar = root.querySelector('[data-handbook-tools]');
  const editor = root.querySelector('[data-handbook-editor]');
  const status = root.querySelector('[data-handbook-status]');
  const save = root.querySelector('[data-handbook-save]');
  const reload = root.querySelector('[data-handbook-reload]');
  const fields = root.querySelector('[data-handbook-fields]');
  let current;
  let directory;
  let busy = false;
  let dirty = false;
  let savedRange;
  let request;

  function message(text, error = false) {
    status.textContent = text;
    status.dataset.kind = error ? 'error' : '';
  }

  function controls() {
    sectionPicker.disabled = busy || !directory;
    title.disabled = busy || !current;
    toolbar.disabled = busy || !current;
    editor.contentEditable = String(!busy && Boolean(current));
    save.disabled = busy || !current || !dirty;
    reload.disabled = busy;
  }

  function markDirty() {
    dirty = true;
    if (!busy) message('Есть несохранённые изменения');
    controls();
  }

  function applyRow(row, preserveDetails = false) {
    const open = preserveDetails ? [...editor.querySelectorAll('details')].map(node => node.open) : [];
    current = row;
    title.value = row.title;
    editor.innerHTML = row.body_html;
    if (open.length) editor.querySelectorAll('details').forEach((node, i) => { node.open = Boolean(open[i]); });
    savedRange = null;
    dirty = false;
  }

  function renderOptions() {
    sectionPicker.replaceChildren(...directory.map(row => new Option(row.title, row.slug)));
  }

  async function load(slug, confirmChanges = true) {
    if (busy || (confirmChanges && dirty && !window.confirm('Сбросить несохранённые изменения?'))) {
      if (current) sectionPicker.value = current.slug;
      return;
    }
    busy = true;
    controls();
    message('Загрузка…');
    try {
      if (!directory) {
        const rows = await PolicePublicData.handbook();
        if (!rows.length) throw Error('В справочнике нет разделов');
        directory = rows;
        renderOptions();
        fields.hidden = false;
      }
      const selected = slug || directory.find(row => row.slug === 'uk')?.slug || directory[0].slug;
      applyRow(await PolicePublicData.handbookSection(selected));
      sectionPicker.value = selected;
      message('');
    } catch (error) {
      if (current) sectionPicker.value = current.slug;
      message(error.message || 'Не удалось загрузить раздел', true);
    } finally {
      busy = false;
      controls();
    }
  }

  async function publish() {
    if (busy || !dirty || !current || !title.reportValidity()) return;
    busy = true;
    controls();
    message('Публикация…');
    try {
      const result = await request('/api/portal/admin/handbook/' + current.slug,'PUT',{
        title:title.value.trim(),body_html:editor.innerHTML,version:current.version
      });
      applyRow(result.section, true);
      directory.find(row => row.slug === current.slug).title = current.title;
      renderOptions();
      sectionPicker.value = current.slug;
      message('Раздел опубликован');
    } catch (error) {
      message(error.message || 'Не удалось опубликовать раздел', true);
    } finally {
      busy = false;
      controls();
    }
  }

  function rememberSelection() {
    const selection = window.getSelection();
    if (selection.rangeCount && editor.contains(selection.anchorNode) && editor.contains(selection.focusNode)) {
      savedRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function restoreSelection() {
    editor.focus({preventScroll:true});
    const selection = window.getSelection();
    if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
      selection.removeAllRanges();
      selection.addRange(savedRange);
    } else if (!editor.contains(selection.anchorNode)) {
      selection.selectAllChildren(editor);
      selection.collapseToEnd();
    }
  }

  function exec(command, value) {
    document.execCommand(command,false,value);
    rememberSelection();
    markDirty();
  }

  function httpsUrl(prompt) {
    const raw = window.prompt(prompt,'https://');
    if (raw === null) return;
    let url;
    try { url = new URL(raw); } catch { /* Report malformed input below. */ }
    if (!url || url.protocol !== 'https:' || url.username || url.password) {
      message('Введите корректную HTTPS-ссылку',true);
      return;
    }
    return url.href;
  }

  function insert(node) {
    exec('insertHTML',node.outerHTML);
  }

  function insertSpoiler() {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const node = range.startContainer;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    const block = element.closest('p,h2,h3,h4,h5,h6,pre,blockquote,summary');
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = 'Скрытый текст';
    const body = document.createElement(range.collapsed ? 'p' : 'div');
    if (range.collapsed) body.textContent = 'Текст блока';
    else body.append(range.extractContents());
    details.append(summary,body);

    // insertHTML flattens the summary in Chromium's editing host.
    if (block && editor.contains(block)) block.after(details);
    else range.insertNode(details);
    selection.selectAllChildren(body);
    rememberSelection();
    markDirty();
  }

  function tool(command, value) {
    if (busy || !current) return;
    if (command === 'link') {
      const href = httpsUrl('Адрес ссылки');
      if (!href) return;
      restoreSelection();
      if (window.getSelection().isCollapsed) {
        const anchor = document.createElement('a');
        anchor.href = href;
        anchor.textContent = href;
        insert(anchor);
      } else {
        exec('createLink',href);
      }
      return;
    }
    if (command === 'image') {
      const src = httpsUrl('Адрес изображения');
      if (!src) return;
      const alt = window.prompt('Описание изображения','');
      if (alt === null) return;
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      restoreSelection();
      insert(img);
      return;
    }

    restoreSelection();
    switch (command) {
      case 'spoiler':
        insertSpoiler();
        break;
      case 'tab': {
        const tab = document.createElement('span');
        tab.className = 'handbook-tab';
        tab.textContent = '\t';
        insert(tab);
        break;
      }
      case 'foreColor':
      case 'hiliteColor':
        document.execCommand('styleWithCSS',false,true);
        exec(command,value);
        document.execCommand('styleWithCSS',false,false);
        break;
      default:
        exec(command,value);
    }
  }

  document.addEventListener('selectionchange',rememberSelection);
  toolbar.addEventListener('mousedown',event => {
    if (event.target.closest('button')) event.preventDefault();
  });
  toolbar.addEventListener('click',event => {
    const button = event.target.closest('button[data-command]');
    if (button) tool(button.dataset.command,button.dataset.value);
  });
  toolbar.addEventListener('change',event => {
    const control = event.target;
    if (!control.dataset.command || !control.value) return;
    tool(control.dataset.command,control.value);
    if (control instanceof HTMLSelectElement) control.selectedIndex = 0;
  });
  editor.addEventListener('keydown',event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      (save.disabled ? reload : save).focus();
      return;
    }
    if (event.key === 'Tab' && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      tool('tab');
    }
  });
  editor.addEventListener('paste',event => {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain');
    if (text) exec('insertText',text);
  });
  editor.addEventListener('drop',event => event.preventDefault());
  editor.addEventListener('input',markDirty);
  title.addEventListener('input',markDirty);
  sectionPicker.addEventListener('change',() => load(sectionPicker.value));
  save.addEventListener('click',publish);
  reload.addEventListener('click',() => load(current?.slug));
  window.addEventListener('beforeunload',event => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = true;
  });

  window.PoliceHandbookAdmin = {
    init(send) {
      request = send;
      if (!current && !busy) load(undefined,false);
    }
  };
})();
