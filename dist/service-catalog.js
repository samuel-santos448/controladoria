function serviceCatalogDB() { if (!db.serviceCatalog) { db.serviceCatalog = []; save(); } return db.serviceCatalog; }
function serviceMoney(cents) { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100); }
function serviceParsePrice(value) {
  const raw = String(value).trim().replace(',', '.');
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(raw)) throw Error('Informe um valor positivo ou zero, com até duas casas decimais.');
  const [whole, fraction = ''] = raw.split('.'); return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
function serviceNormalizeLine(value) {
  const name = String(value.name || '').trim(), description = String(value.description || '').trim();
  if (!name || !description) throw Error('Preencha o nome e a descrição de cada serviço.');
  if (name.length > 120 || description.length > 2000) throw Error('Use até 120 caracteres no nome e 2000 na descrição.');
  const unitCents = serviceParsePrice(value.price), quantity = Number(value.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 9999) throw Error('A quantidade de cada serviço deve ser de 1 a 9999.');
  const totalCents = unitCents * quantity;
  if (!Number.isSafeInteger(totalCents)) throw Error('Valor do serviço excede o limite permitido.');
  return { catalogId: value.catalogId || '', name, description, unitCents, quantity, totalCents };
}
function serviceCatalogPage() {
  const catalog = serviceCatalogDB();
  $('#content').innerHTML = heading('Catálogo de serviços', 'Sua base de conhecimento: padronize descrições e valores para as OS e notas.', `<button class="btn primary" id="newservice">${icon('plus')} Cadastrar serviço</button>`) + `
    <section class="panel"><div class="tools"><span class="muted" style="font-size:13px">${catalog.length} serviço(s) cadastrado(s)</span><input class="search" id="service-search" placeholder="Buscar nome ou descrição" aria-label="Buscar serviços"></div><div class="tablewrap"><table><thead><tr><th>SERVIÇO / DESCRIÇÃO</th><th>VALOR PADRÃO</th><th>AÇÕES</th></tr></thead><tbody id="catalogrows"></tbody></table></div></section>
    <p class="note">Os valores são trazidos automaticamente ao adicionar serviços nos documentos. Alterações no catálogo não modificam PDFs ou serviços já incluídos em uma emissão.</p>`;
  function rows(query = '') {
    const filtered = catalog.filter(s => (s.name + ' ' + s.description).toLocaleLowerCase('pt-BR').includes(query.toLocaleLowerCase('pt-BR')));
    $('#catalogrows').innerHTML = filtered.map(s => `<tr><td style="white-space:normal;min-width:240px"><b>${esc(s.name)}</b><small style="line-height:1.6;white-space:pre-wrap;max-width:620px">${esc(s.description)}</small></td><td>${serviceMoney(s.unitCents)}</td><td><div class="document-actions"><button class="link" data-edit-service="${s.id}">Editar</button><button class="link danger-link" data-delete-service="${s.id}">Excluir</button></div></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Nenhum serviço encontrado. Cadastre os serviços da sua assistência para começar.</td></tr>';
    document.querySelectorAll('[data-edit-service]').forEach(b => b.onclick = () => serviceCatalogEdit(b.dataset.editService));
    document.querySelectorAll('[data-delete-service]').forEach(b => b.onclick = () => serviceCatalogDelete(b.dataset.deleteService));
  }
  $('#newservice').onclick = () => serviceCatalogEdit(); $('#service-search').oninput = e => rows(e.target.value); rows();
}
function serviceCatalogEdit(id) {
  const existing = serviceCatalogDB().find(s => s.id === id), item = existing || { name: '', description: '', unitCents: 0 };
  showModal(existing ? 'Editar serviço' : 'Cadastrar serviço', `${financeInput('name', 'Nome do serviço', item.name, 'required maxlength="120"')}<label>Descrição padrão<textarea name="description" required maxlength="2000" rows="5">${esc(item.description)}</textarea></label>${financeInput('price', 'Valor padrão (R$)', existing ? (item.unitCents / 100).toFixed(2) : '', 'type="number" min="0" step="0.01" required')}`, values => {
    try {
      const line = serviceNormalizeLine({ ...values, quantity: 1 });
      if (serviceCatalogDB().some(s => s.id !== id && s.name.toLocaleLowerCase('pt-BR') === line.name.toLocaleLowerCase('pt-BR'))) throw Error('Já existe um serviço com este nome no catálogo.');
      const record = { name: line.name, description: line.description, unitCents: line.unitCents };
      if (existing) Object.assign(existing, record); else serviceCatalogDB().push({ ...record, id: crypto.randomUUID() });
      save(); $('#modal').close(); serviceCatalogPage(); toast('Serviço salvo no catálogo.');
    } catch (e) { $('#formerror').textContent = e.message; }
  });
}
function serviceCatalogDelete(id) {
  const item = serviceCatalogDB().find(s => s.id === id); if (!item) return;
  showModal('Excluir serviço do catálogo', `<p>Excluir <strong>${esc(item.name)}</strong> do catálogo?</p><p class="note">Os documentos já gerados serão preservados.</p>`, () => {
    db.deletedServices ??= []; db.deletedServices.push(item); db.serviceCatalog = serviceCatalogDB().filter(s => s.id !== id); save(); $('#modal').close(); serviceCatalogPage(); toast('Serviço removido do catálogo.');
  }); $('#form .primary').textContent = 'Excluir serviço'; $('#form .primary').classList.add('danger');
}

function serviceDocumentEditor() {
  let lines = [], deviceCount = 1;
  const catalog = serviceCatalogDB();
  $('#documentservices').innerHTML = `<div class="service-picker"><label>Adicionar serviço do catálogo<select id="catalog-service"><option value="">Selecione um serviço</option>${catalog.map(s => `<option value="${s.id}">${esc(s.name)} · ${serviceMoney(s.unitCents)}</option>`).join('')}</select></label><div class="document-actions"><button type="button" class="btn" id="addcatalogservice">Adicionar do catálogo</button><button type="button" class="btn" id="addmanualservice">+ Serviço avulso</button></div><small>É possível adicionar vários serviços e ajustar a descrição, quantidade ou valor para esta emissão.</small></div><div id="document-service-lines"></div><p class="note" id="service-device-count"></p><div class="service-total">Total dos serviços <strong id="service-total">${serviceMoney(0)}</strong></div><p class="error" id="serviceerror" role="alert"></p>`;
  function calculate() {
    $('#service-device-count').textContent = `Cálculo por dispositivo: ${deviceCount} dispositivo(s). Cada serviço começa com essa quantidade; ajuste se ele foi aplicado a menos dispositivos.`;
    let total = 0, valid = true;
    for (const line of lines) {
      try { const normalized = serviceNormalizeLine(line); total += normalized.totalCents; $(`[data-line-total="${line.rowId}"]`).textContent = serviceMoney(normalized.totalCents); }
      catch { valid = false; $(`[data-line-total="${line.rowId}"]`).textContent = 'Preencha os campos'; }
    }
    $('#service-total').textContent = serviceMoney(total) + (valid ? '' : ' (parcial)');
    $('#form [name="amount"]').value = valid ? (total / 100).toFixed(2) : '';
  }
  function render() {
    $('#document-service-lines').innerHTML = lines.map((line, i) => `<section class="service-line"><div class="service-line-head"><b>Serviço ${i + 1} · ${line.catalogId ? 'Catálogo' : 'Avulso'}</b><button type="button" class="link danger-link" data-remove-line="${line.rowId}">Remover</button></div><label>Nome do serviço<input data-line="${line.rowId}" data-field="name" value="${esc(line.name)}" required maxlength="120"></label><label>Descrição<textarea data-line="${line.rowId}" data-field="description" required maxlength="2000" rows="3">${esc(line.description)}</textarea></label><div class="formgrid"><label>Quantidade<input type="number" min="1" max="9999" step="1" data-line="${line.rowId}" data-field="quantity" value="${esc(line.quantity)}" required></label><label>Valor unitário (R$)<input type="number" min="0" step="0.01" data-line="${line.rowId}" data-field="price" value="${esc(line.price)}" required></label></div>${!line.catalogId?`<button type="button" class="link" data-save-line="${line.rowId}">Salvar este serviço no catálogo</button>`:''}<p class="service-subtotal">Subtotal: <strong data-line-total="${line.rowId}"></strong></p></section>`).join('') || '<p class="empty" style="padding:22px">Adicione pelo menos um serviço do catálogo ou um serviço avulso.</p>';
    document.querySelectorAll('[data-line]').forEach(input => input.oninput = () => { const line = lines.find(l => l.rowId === input.dataset.line); line[input.dataset.field] = input.value; calculate(); });
    document.querySelectorAll('[data-save-line]').forEach(button => button.onclick = () => {try{const line=lines.find(l=>l.rowId===button.dataset.saveLine),item=serviceNormalizeLine(line);if(catalog.some(s=>s.name.toLocaleLowerCase('pt-BR')===item.name.toLocaleLowerCase('pt-BR')))throw Error('Já existe um serviço com este nome no catálogo.');const record={id:crypto.randomUUID(),name:item.name,description:item.description,unitCents:item.unitCents};catalog.push(record);line.catalogId=record.id;save();const selected=$('#catalog-service').value;$('#catalog-service').innerHTML='<option value="">Selecione um serviço</option>'+catalog.map(s=>`<option value="${s.id}">${esc(s.name)} · ${serviceMoney(s.unitCents)}</option>`).join('');$('#catalog-service').value=selected;$('#serviceerror').textContent='';render();toast('Serviço salvo no catálogo.')}catch(e){$('#serviceerror').textContent=e.message}});
    document.querySelectorAll('[data-remove-line]').forEach(button => button.onclick = () => { lines = lines.filter(l => l.rowId !== button.dataset.removeLine); render(); });
    calculate();
  }
  $('#addcatalogservice').onclick = () => {
    const service = catalog.find(s => s.id === $('#catalog-service').value);
    if (!service) { $('#serviceerror').textContent = 'Selecione um serviço do catálogo.'; return; }
    lines.push({ rowId: crypto.randomUUID(), catalogId: service.id, name: service.name, description: service.description, price: (service.unitCents / 100).toFixed(2), quantity: deviceCount });
    $('#serviceerror').textContent = ''; render();
  };
  $('#addmanualservice').onclick = () => { lines.push({ rowId: crypto.randomUUID(), catalogId: '', name: '', description: '', price: '', quantity: deviceCount }); $('#serviceerror').textContent = ''; render(); };
  render();
  return { setDeviceCount(count) {
    if(!Number.isInteger(count)||count<1)return;
    if(count!==deviceCount){deviceCount=count;lines.forEach(line=>line.quantity=count);render();}
  }, snapshot() {
    if (!lines.length) throw Error('Adicione pelo menos um serviço do catálogo ou um serviço avulso.');
    const services = lines.map(serviceNormalizeLine), totalCents = services.reduce((sum, line) => sum + line.totalCents, 0);
    if (!Number.isSafeInteger(totalCents)) throw Error('O total excede o limite permitido.');
    return { services, totalCents };
  } };
}
