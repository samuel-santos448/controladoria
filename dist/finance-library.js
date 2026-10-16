function financeMigrateModels(finance) {
  if (finance.creationCardsVersion === 1) return;
  // Recover the original presets removed through the previous ambiguous cards.
  const deleted = finance.deletedTemplates || [];
  for (const id of ['default-os', 'default-nf']) {
    if (finance.templates.some(t => t.id === id)) continue;
    const index = deleted.findIndex(t => t.id === id);
    if (index !== -1) finance.templates.push(deleted.splice(index, 1)[0]);
  }
  finance.creationCardsVersion = 1;
  save();
}

function controladoria() {
  const finance = financeDB();
  $('#content').innerHTML = heading('Controladoria', 'Crie seus modelos e use-os para gerar documentos de lotes ou equipamentos.', `<button class="btn primary" id="newdocument">${icon('plus')} Novo documento</button>`) + `
    <div class="tabletitle"><h2>Criar modelo</h2></div>
    <div class="finance-templates" id="templatecreation">
      <section class="panel finance-template"><span class="eyebrow">ORDEM DE SERVIÇO</span><h2>Modelo de ordem de serviço</h2><p>Configure cabeçalho, logotipo e textos para suas OS.</p><div class="actions"><button class="btn primary" data-create-template-kind="OS">${icon('plus')} Criar modelo de OS</button></div></section>
      <section class="panel finance-template"><span class="eyebrow">NOTA FISCAL · RASCUNHO</span><h2>Modelo de nota fiscal</h2><p>Configure a apresentação do rascunho de nota, sem validade fiscal.</p><div class="actions"><button class="btn primary" data-create-template-kind="NF">${icon('plus')} Criar modelo de nota</button></div></section>
    </div>
    <div class="tabletitle" style="margin-top:30px"><div><h2>Modelos salvos</h2><p class="muted" style="font-size:12px;margin-top:7px">Edite ou exclua os modelos cadastrados. As opções de criação acima permanecem disponíveis.</p></div></div>
    <section class="panel"><div class="tablewrap"><table><thead><tr><th>MODELO</th><th>TIPO</th><th>PADRÃO</th><th>AÇÕES</th></tr></thead><tbody>
      ${finance.templates.map(t => `<tr><td><b>${esc(t.name)}</b><small>${esc(t.issuer || 'Cabeçalho, logotipo e textos configuráveis')}</small></td><td>${t.kind === 'OS' ? 'Ordem de serviço' : 'Rascunho de nota'}</td><td>${financeDefaultTemplate(t.kind)?.id === t.id ? '<span class="badge">Modelo padrão</span>' : `<button class="link" data-default-template="${t.id}">Definir como padrão</button>`}</td><td><div class="document-actions"><button class="link" data-template="${t.id}">Editar</button><button class="link danger-link" data-delete-template="${t.id}">Excluir</button><button class="btn" data-use-template="${t.id}">Usar modelo →</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nenhum modelo salvo. Use uma das opções de criação acima.</td></tr>'}
    </tbody></table></div></section>
    ${finance.deletedTemplates?.length ? '<button class="link" id="restoretemplate" style="margin-top:14px">Restaurar último modelo excluído</button>' : ''}
    <div class="tabletitle" style="margin-top:30px"><h2>Documentos gerados</h2><small>${finance.documents.length} documento(s)</small></div>
    <section class="panel"><div class="tablewrap"><table><thead><tr><th>DOCUMENTO</th><th>SOLICITANTE</th><th>REPRESENTANTE</th><th>DATA</th><th>RESPONSÁVEL</th><th></th></tr></thead><tbody>${finance.documents.slice().reverse().map(d => `<tr><td><b>${esc(d.number)}</b><small>${d.kind === 'OS' ? 'Ordem de serviço' : 'Rascunho de nota'}</small></td><td>${esc(d.company)}<small>${esc(d.cnpj)}</small></td><td>${esc(d.representative)}<small>${esc(d.contact)}</small></td><td>${fmt(d.date)}</td><td>${esc(d.responsible)}</td><td><button class="link" data-download="${d.id}">Baixar PDF ↓</button></td></tr>`).join('') || '<tr><td colspan="6" class="empty">Nenhum documento gerado.</td></tr>'}</tbody></table></div></section>
    <p class="note">Os modelos e PDFs ficam apenas neste navegador. A opção de nota gera um rascunho para conferência, sem emissão ou autorização fiscal.</p>`;
  document.querySelectorAll('[data-create-template-kind]').forEach(b => b.onclick = () => financeTemplate(undefined, b.dataset.createTemplateKind));
  document.querySelectorAll('[data-template]').forEach(b => b.onclick = () => financeTemplate(b.dataset.template));
  document.querySelectorAll('[data-delete-template]').forEach(b => b.onclick = () => financeDeleteTemplate(b.dataset.deleteTemplate));
  document.querySelectorAll('[data-use-template]').forEach(b => b.onclick = () => financeDocument(b.dataset.useTemplate));
  document.querySelectorAll('[data-default-template]').forEach(b => b.onclick = () => {
    const t = finance.templates.find(t => t.id === b.dataset.defaultTemplate);
    finance.defaultTemplates ??= {}; finance.defaultTemplates[t.kind] = t.id;
    save(); controladoria(); toast('Modelo padrão atualizado.');
  });
  if ($('#restoretemplate')) $('#restoretemplate').onclick = financeRestoreTemplate;
  $('#newdocument').onclick = () => financeDocument();
  document.querySelectorAll('[data-download]').forEach(b => b.onclick = async () => {
    try {
      const bytes = await financeFile('doc:' + b.dataset.download);
      if (!bytes) throw Error('PDF não encontrado neste navegador.');
      financeDownload(bytes, financeFilename(finance.documents.find(d => d.id === b.dataset.download)));
    } catch (e) { financeError(e); }
  });
}
