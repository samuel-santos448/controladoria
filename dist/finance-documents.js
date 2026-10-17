function financeDefaultTemplate(kind){const f=financeDB();return f.templates.find(t=>t.id===f.defaultTemplates?.[kind]&&t.kind===kind)||f.templates.find(t=>t.kind===kind)}

function financeSource(scope, id) {
  const lot = scope === 'lot' ? db.lots.find(l => l.id === id) : null;
  const tv = scope === 'device' ? db.tvs.find(t => t.id === id) : null;
  if (scope === 'lot' && !lot) throw Error('Selecione um lote cadastrado.');
  if (scope === 'device' && !tv) throw Error('Selecione um equipamento cadastrado.');
  const devices = lot ? db.tvs.filter(t => t.lot === lot.id) : [tv];
  if (!devices.length) throw Error('Este lote ainda não possui equipamentos.');
  if (devices.some(t => !String(t.os || '').trim())) throw Error('Todos os equipamentos precisam ter uma OS de entrada.');
  const reference = t => `${t.model} | Série: ${t.serial} | OS: ${t.os}`;
  return {
    number: lot ? lot.id : String(tv.os).trim(),
    equipment: (lot ? [`Lote: ${lot.id} | Origem: ${lot.origin}`, ''] : []).concat(devices.map(reference)).join('\n'),
    service: lot ? devices.filter(t=>t.serviceNotes?.trim()).map(t => `${reference(t)}\n${t.serviceNotes}`).join('\n\n') : tv.serviceNotes || '',
    lotId: lot ? lot.id : tv.lot,
    tvId: tv ? tv.id : '',
    items: devices.map(t=>({model:t.model,serial:t.serial,os:t.os,status:t.status,quantity:1})),
    deviceIds: devices.map(t => t.id)
  };
}

function financeQuickDocument(kind, scope, id) {
  const template = financeDefaultTemplate(kind);
  if (!template) return toast('Cadastre um modelo desse tipo na Controladoria.');
  try { financeSource(scope, id); financeDocument(template.id, { scope, id }); }
  catch (e) { financeError(e); }
}

function financeDocument(templateId, context = {}) {
  const finance = financeDB(), provider=financeProvider();
  if(!provider.configured)return toast(current.role==='Administrador'?'Configure a prestadora na Controladoria antes de gerar documentos.':'Solicite ao administrador o cadastro da prestadora na Controladoria.');
  if(!finance.templates.length)return toast('Cadastre um modelo na Controladoria antes de gerar documentos.');
  const initialTemplate = finance.templates.find(t => t.id === templateId) || financeDefaultTemplate('OS') || finance.templates[0];
  const initialScope = context.scope === 'lot' ? 'lot' : 'device';
  const nextNumber = String(finance.documents.length + 1).padStart(6, '0');
  showModal('Preparar documento', `
    <p class="note">Prestadora padrão: <strong>${esc(provider.name)}</strong><br>CNPJ: ${esc(provider.cnpj)}</p><label>Modelo<select name="template" id="documenttemplate">${finance.templates.map(t => `<option value="${t.id}" ${t.id === initialTemplate.id ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>
    <label>Gerar documento para<select name="scope" id="documentscope"><option value="device" ${initialScope === 'device' ? 'selected' : ''}>Dispositivo específico</option><option value="lot" ${initialScope === 'lot' ? 'selected' : ''}>Lote completo</option></select></label>
    <label id="documenttvlabel">Equipamento / OS de entrada<select name="tvId" id="documenttv"><option value="">Selecione um equipamento</option>${db.tvs.map(t => `<option value="${t.id}" ${initialScope === 'device' && t.id === context.id ? 'selected' : ''}>OS ${esc(t.os)} · ${esc(t.model)} · ${esc(t.serial)}</option>`).join('')}</select></label>
    <label id="documentlotlabel">Lote<select name="lotId" id="documentlot"><option value="">Selecione um lote</option>${db.lots.map(l => `<option value="${esc(l.id)}" ${initialScope === 'lot' && l.id === context.id ? 'selected' : ''}>${esc(l.id)} · ${esc(l.origin)} (${db.tvs.filter(t => t.lot === l.id).length} TVs)</option>`).join('')}</select></label>
    <div class="formgrid">${financeInput('number', 'Número do documento', nextNumber, 'required maxlength="40"')}${financeInput('date', 'Data', today(), 'type="date" required')}</div>
    ${financeInput('company', 'Empresa solicitante', '', 'required maxlength="150"')}
    <div class="formgrid">${financeInput('cnpj', 'CNPJ da solicitante', '', 'required maxlength="18" placeholder="00.000.000/0000-00"')}${financeInput('representative', 'Nome do representante', '', 'required maxlength="120"')}</div>
    ${financeInput('contact', 'Contato do representante', '', 'required maxlength="150" placeholder="Telefone e/ou e-mail"')}
    ${financeInput('clientAddress', 'Endereço da solicitante', '', 'maxlength="300"')}
    ${financeInput('clientIe', 'Inscrição estadual / municipal da solicitante', '', 'maxlength="60"')}
    <label>Equipamentos / referências<textarea name="equipment" rows="4"></textarea></label>
    <h2 style="font-size:17px;margin:24px 0 16px">Serviços prestados</h2><div id="documentservices"></div><label>Observações técnicas do equipamento (opcional)<textarea name="service" rows="4"></textarea></label>
    ${financeInput('amount', 'Valor total do documento (R$)', '', 'type="number" min="0" step="0.01" readonly required')}
    <label>Observações<textarea name="notes" maxlength="2000"></textarea></label>
    <p class="note" id="fiscalnote"></p><p class="error" id="sourceerror" role="alert"></p>
    <small>Responsável pelo preenchimento: ${esc(current.name)}</small>`, async values => {
    const button = $('#form .primary'); button.disabled = true; button.textContent = 'Gerando PDF…';
    try {
      const template = finance.templates.find(t => t.id === values.template);
      if (!template) throw Error('Selecione um modelo válido.');
      if (!['lot', 'device'].includes(values.scope)) throw Error('Selecione o tipo de vínculo do documento.');
      const source = financeSource(values.scope, values.scope === 'lot' ? values.lotId : values.tvId);
      if (template.kind === 'OS') values.number = source.number;
      for (const key of ['number', 'company', 'cnpj', 'representative', 'contact']) {
        values[key] = String(values[key] || '').trim();
        if (!values[key]) throw Error('Preencha todos os campos obrigatórios.');
      }
      if (!validCnpj(values.cnpj)) throw Error('Informe um CNPJ válido.');
      if (template.kind !== 'OS' && finance.documents.some(d => d.kind === template.kind && d.number === values.number)) throw Error('Já existe um documento desse tipo com este número.');
      serviceEditor.setDeviceCount(source.deviceIds.length);
      const serviceSnapshot = serviceEditor.snapshot();
      // Keep record identities and monetary totals canonical in the PDF.
      const data = { ...values, equipment: source.equipment, lotId: source.lotId, tvId: source.tvId, deviceIds: source.deviceIds, items:source.items, deviceCount:source.deviceIds.length, services:serviceSnapshot.services, amountCents:serviceSnapshot.totalCents, providerSnapshot:{...provider}, createdAt:new Date().toISOString(),
        id: crypto.randomUUID(), kind: template.kind, responsible: current.name, createdBy: current.login,
        amount: serviceMoney(serviceSnapshot.totalCents),
        issuer: provider.name, issuerCnpj: provider.cnpj, issuerContact: provider.phone, terms: template.terms };
      const bytes = await financePDF(data, template);
      await financeFile('doc:' + data.id, bytes);
      finance.documents.push(data); save(); $('#modal').close();
      if (page === 'finance') controladoria();
      financeDownload(bytes, financeFilename(data)); toast('PDF gerado e salvo no histórico da Controladoria.');
    } catch (e) { $('#formerror').textContent = e.message; }
    finally { button.disabled = false; button.textContent = 'Gerar e baixar PDF'; }
  });
  $('#form .primary').textContent = 'Gerar e baixar PDF';
  const serviceEditor = serviceDocumentEditor();
  const scopeSelect = $('#documentscope'), tvSelect = $('#documenttv'), lotSelect = $('#documentlot');
  const numberInput = $('#form [name="number"]');
  // References identify the records selected above; service descriptions remain editable.
  $('#form [name="equipment"]').readOnly = true;
  let draftNumber = nextNumber;
  function refresh(copyServices) {
    const isLot = scopeSelect.value === 'lot';
    $('#documenttvlabel').hidden = isLot; $('#documentlotlabel').hidden = !isLot;
    tvSelect.disabled = isLot; tvSelect.required = !isLot;
    lotSelect.disabled = !isLot; lotSelect.required = isLot;
    const isOS = finance.templates.find(t => t.id === $('#documenttemplate').value).kind === 'OS';
    if (!numberInput.readOnly) draftNumber = numberInput.value;
    numberInput.readOnly = isOS;
    let source;
    try { source = financeSource(scopeSelect.value, isLot ? lotSelect.value : tvSelect.value); $('#sourceerror').textContent = ''; }
    catch (e) { $('#sourceerror').textContent = (isLot ? lotSelect.value : tvSelect.value) ? e.message : ''; }
    numberInput.value = isOS ? source?.number || '' : draftNumber;
    numberInput.placeholder = isOS ? 'Selecione o lote ou equipamento' : '';
    $('#fiscalnote').textContent = isOS
      ? isLot ? 'OS consolidada com o identificador do lote. As OS de entrada de cada TV são preservadas nas referências.' : 'A numeração será a mesma OS cadastrada na entrada do equipamento. Reemissões preservam esse número.'
      : 'Rascunho de nota, sem validade fiscal. O valor informado corresponde ao documento completo.';
    if(source)serviceEditor.setDeviceCount(source.deviceIds.length);
    $('#form [name="equipment"]').value = source?.equipment || '';
    if (copyServices) $('#form [name="service"]').value = source?.service || '';
  }
  $('#documenttemplate').onchange = () => refresh(false);
  scopeSelect.onchange = tvSelect.onchange = lotSelect.onchange = () => refresh(true);
  refresh(true);
}
