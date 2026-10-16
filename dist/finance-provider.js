function financeProvider() {
  const f = financeDB();
  if (!f.provider) {
    const legacy = f.templates.find(t => t.issuer?.trim()) || {};
    f.provider = { name: legacy.issuer || '', cnpj: legacy.issuerCnpj || '', phone: legacy.issuerContact || '', address: '', email: '', website: '', ie: '',
      logoName: legacy.logoName || '', logoKey: legacy.logoName ? 'logo:' + legacy.id : '', configured: Boolean(legacy.issuer?.trim() && legacy.issuerCnpj?.trim()) };
    save();
  }
  return f.provider;
}

function financeProviderSettings() {
  if (current.role !== 'Administrador') return toast('Somente administradores podem alterar a prestadora.');
  const provider = financeProvider(); let logo = null;
  showModal('Dados padrão da prestadora', `
    <p class="note">Estes dados serão usados em todas as novas OS e notas, independentemente do modelo escolhido.</p>
    ${financeInput('name', 'Razão social / nome da prestadora', provider.name, 'required maxlength="150"')}
    <div class="formgrid">${financeInput('cnpj', 'CNPJ da prestadora', provider.cnpj, 'required maxlength="18"')}${financeInput('ie', 'Inscrição estadual / municipal', provider.ie, 'maxlength="60"')}</div>
    ${financeInput('address', 'Endereço completo', provider.address, 'maxlength="300"')}
    <div class="formgrid">${financeInput('phone', 'Telefone / WhatsApp', provider.phone, 'maxlength="100"')}${financeInput('email', 'E-mail', provider.email, 'type="email" maxlength="120"')}</div>
    ${financeInput('website', 'Site', provider.website, 'maxlength="120"')}
    <label>Logotipo padrão (PNG ou JPG, até 500 KB)<input type="file" id="providerlogo" accept="image/png,image/jpeg"></label>
    <p class="muted" id="providerlogoname" style="font-size:12px">${esc(provider.logoName || 'Sem logotipo cadastrado.')}</p>`, async values => {
    const button = $('#form .primary'); button.disabled = true;
    try {
      if (current.role !== 'Administrador') throw Error('Somente administradores podem alterar a prestadora.');
      values.name = values.name.trim();
      if (!values.name) throw Error('Informe o nome da prestadora.');
      if (!validCnpj(values.cnpj)) throw Error('Informe um CNPJ válido para a prestadora.');
      let logoKey = provider.logoKey || '';
      if (logo) { logoKey = 'provider-logo:' + crypto.randomUUID(); await financeFile(logoKey, logo.bytes); }
      financeDB().provider = { ...values, logoKey, logoName: logo?.name || provider.logoName || '', configured: true };
      save(); $('#modal').close(); controladoria(); toast('Prestadora salva como padrão para os novos documentos.');
    } catch (e) { $('#formerror').textContent = e.message; }
    finally { button.disabled = false; }
  });
  $('#providerlogo').onchange = async e => {
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 500 * 1024) throw Error('O logotipo deve ter até 500 KB.');
      const bytes = await file.arrayBuffer(), check = await PDFLib.PDFDocument.create();
      if (file.type === 'image/png') await check.embedPng(bytes);
      else if (file.type === 'image/jpeg') await check.embedJpg(bytes);
      else throw Error('Use PNG ou JPG.');
      logo = { bytes, name: file.name }; $('#providerlogoname').textContent = file.name; $('#formerror').textContent = '';
    } catch (e) { logo = null; $('#formerror').textContent = e.message; }
  };
}

function financeProviderPanel() {
  const p = financeProvider();
  return `<section class="panel provider-panel"><div><div class="eyebrow">PRESTADORA PADRÃO · OS E NOTA</div><h2>${esc(p.name || 'Cadastre a empresa prestadora')}</h2><p>${p.configured ? `CNPJ: ${esc(p.cnpj)}${p.phone ? ' · ' + esc(p.phone) : ''}` : 'O administrador configura uma vez para todos os novos documentos.'}</p><small>${p.logoName ? 'Logotipo: ' + esc(p.logoName) : 'Sem logotipo cadastrado'}</small></div>${current.role === 'Administrador' ? '<button class="btn" id="provider-settings">Configurar prestadora</button>' : '<small>Cadastro gerenciado pelo administrador</small>'}</section>`;
}
