// A4 business document layout shared by OS and draft invoices.
async function financePDF(data, template) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const doc = await PDFDocument.create(), normal = await doc.embedFont(StandardFonts.Helvetica), bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(.06, .07, .1), blue = rgb(.02, .05, .6), grey = rgb(.43, .44, .46), pale = rgb(.95, .96, .97);
  const left = 36, width = 523.28, bottom = 64, provider = data.providerSnapshot || { name: data.issuer, cnpj: data.issuerCnpj, phone: data.issuerContact };
  const safe = value => String(value ?? '').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '-');
  let page, y, logo, contentTop;
  if (provider.logoKey) {
    const bytes = await financeFile(provider.logoKey);
    if (!bytes) throw Error('Logotipo da prestadora não encontrado. Solicite ao administrador que o cadastre novamente.');
    logo = new Uint8Array(bytes)[0] === 137 ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  }
  function wrap(text, maxWidth, size = 8.5, font = normal) {
    const lines = [];
    for (const paragraph of safe(text).split(/\r?\n/)) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        if (font.widthOfTextAtSize(line + (line ? ' ' : '') + word, size) <= maxWidth) { line += (line ? ' ' : '') + word; continue; }
        if (line) lines.push(line); line = '';
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > maxWidth) { lines.push(line); line = ''; }
          line += char;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function text(value, x, yy, size = 8.5, font = normal, color = ink) { page.drawText(safe(value), { x, y: yy, size, font, color }); }
  function rule(yy) { page.drawLine({ start: { x: left, y: yy }, end: { x: left + width, y: yy }, thickness: .65, color: grey }); }
  function newPage() {
    page = doc.addPage([595.28, 841.89]);
    if (logo) { const scale = Math.min(140 / logo.width, 53 / logo.height); page.drawImage(logo, { x: left, y: 765, width: logo.width * scale, height: logo.height * scale }); }
    let top = 804;
    const company = wrap(provider.name || 'Prestadora de serviços', 325, 11, bold);
    for (const line of company) { text(line, left + width - bold.widthOfTextAtSize(line, 11), top, 11, bold); top -= 14; }
    const details = [provider.address, [provider.phone && 'Fone: ' + provider.phone, provider.email].filter(Boolean).join(' · '), provider.website,
      [provider.cnpj && 'CNPJ: ' + provider.cnpj, provider.ie && 'Inscrição: ' + provider.ie].filter(Boolean).join(' · ')].filter(Boolean);
    for (const detail of details) for (const line of wrap(detail, 340, 7.3)) { text(line, left + width - normal.widthOfTextAtSize(line, 7.3), top, 7.3); top -= 10; }
    const titleY = Math.min(725, top - 24);
    const title = `${data.kind === 'OS' ? 'ORDEM DE SERVIÇO' : 'NOTA DE SERVIÇOS - RASCUNHO'} N° ${data.number}`;
    const size = Math.min(15, width / bold.widthOfTextAtSize(safe(title), 1)); text(title, left, titleY, size, bold, blue);
    if (data.kind !== 'OS') text('SEM VALIDADE FISCAL', left, titleY - 14, 8, bold, rgb(.65, .16, .16));
    const lineY = titleY - (data.kind === 'OS' ? 18 : 29); rule(lineY);
    text('Data de emissão: ' + fmt(data.date), left, lineY - 15, 8);
    text('Responsável: ' + (data.responsible || ''), left, lineY - 28, 8);
    const scope = data.scope === 'lot' ? 'Lote: ' + data.lotId : data.tvId ? 'OS de entrada: ' + data.number : '';
    text(scope, 350, lineY - 15, 8); y = lineY - 48; contentTop = y;
  }
  function ensure(height) { if (y - height < bottom) newPage(); }
  function section(title, value) {
    const lines = wrap(value || '-', width - 18);
    let offset = 0;
    while (offset < lines.length) {
      ensure(48);
      const count = Math.min(lines.length - offset, Math.max(1, Math.floor((y - bottom - 30) / 12)));
      const h = 29 + count * 12;
      page.drawRectangle({ x: left, y: y - h, width, height: h, borderColor: grey, borderWidth: .6 });
      text(title + (offset ? ' (continuação)' : ''), left + 8, y - 13, 8, bold);
      for (let i = 0; i < count; i++) text(lines[offset + i], left + 9, y - 29 - i * 12);
      y -= h + 12; offset += count;
    }
  }
  function client() {
    const fields = [
      [['Nome / razão social', data.company], ['CNPJ', data.cnpj]],
      [['Representante / contato', data.representative], ['Telefone / e-mail', data.contact]],
      [['Endereço', data.clientAddress || '-'], ['Inscrição estadual / municipal', data.clientIe || '-']]
    ];
    const rows = fields.map(row => row.map(([label, value]) => ({ label, lines: wrap(value, width / 2 - 22) })));
    const heights = rows.map(row => Math.max(...row.map(cell => cell.lines.length)) * 11 + 25);
    const height = 23 + heights.reduce((a, b) => a + b, 0); ensure(height + 12);
    page.drawRectangle({ x: left, y: y - height, width, height, borderWidth: .65, borderColor: grey });
    text('EMPRESA SOLICITANTE', left + 8, y - 14, 9, bold); let cursor = y - 27;
    rows.forEach((row, i) => { row.forEach((cell, j) => { const x = left + 10 + j * width / 2; text(cell.label, x, cursor, 7.2, bold); cell.lines.forEach((line, k) => text(line, x, cursor - 13 - k * 11)); }); cursor -= heights[i]; });
    y -= height + 14;
  }
  const columns = [28, 159, 128, 88, 40, 80.28];
  function tableHeader() {
    ensure(48); text('EQUIPAMENTOS / ITENS DO SERVIÇO · '+(data.deviceCount||data.items?.length||1)+' dispositivo(s)', left, y, 9, bold); y -= 12;
    page.drawRectangle({ x: left, y: y - 24, width, height: 24, color: pale, borderColor: grey, borderWidth: .5 });
    let x = left; ['ITEM', 'EQUIPAMENTO', 'NÚMERO DE SÉRIE', 'OS DE ENTRADA', 'QTDE', 'STATUS'].forEach((label, i) => { text(label, x + 5, y - 15, 7, bold); x += columns[i]; }); y -= 24;
  }
  function equipmentTable() {
    tableHeader();
    const items = data.items?.length ? data.items : [{ model: data.equipment || '-', serial: '-', os: data.number, status: '-', quantity: 1 }];
    items.forEach((item, index) => {
      const cells = [String(index + 1), item.model, item.serial, item.os, String(item.quantity || 1), item.status || '-'].map((value, i) => wrap(value, columns[i] - 10, 8));
      let offset = 0, length = Math.max(...cells.map(c => c.length));
      while (offset < length) {
        if (y - 30 < bottom) { newPage(); tableHeader(); }
        const count = Math.min(length - offset, Math.max(1, Math.floor((y - bottom - 12) / 11))), height = count * 11 + 12;
        let x = left;
        cells.forEach((lines, i) => { page.drawRectangle({ x, y: y - height, width: columns[i], height, borderWidth: .4, borderColor: grey }); for (let k = 0; k < count; k++) if (lines[offset + k] !== undefined) text(lines[offset + k], x + 5, y - 14 - k * 11, 8); x += columns[i]; });
        y -= height; offset += count;
      }
    }); y -= 14;
  }
  function serviceTable() {
    const widths = [24, 128, 191, 30, 75, 75.28];
    const money = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
    function header() {
      ensure(50); text('SERVIÇOS PRESTADOS', left, y, 9, bold); y -= 12;
      page.drawRectangle({ x: left, y: y - 24, width, height: 24, color: pale, borderWidth: .5, borderColor: grey });
      let x = left;
      ['ITEM', 'SERVIÇO', 'DESCRIÇÃO', 'QTD', 'VALOR UNIT.', 'SUBTOTAL'].forEach((label, i) => { text(label, x + 4, y - 15, 7, bold); x += widths[i]; });
      y -= 24;
    }
    header();
    data.services.forEach((service, i) => {
      const values = [i + 1, service.name, service.description, service.quantity, money(service.unitCents), money(service.totalCents)];
      const cells = values.map((value, index) => wrap(value, widths[index] - 8, 8));
      const length = Math.max(...cells.map(cell => cell.length)); let offset = 0;
      const fullHeight=length*11+12;
      if(fullHeight<=contentTop-bottom-36&&y-fullHeight<bottom){newPage();header();}
      while (offset < length) {
        if (y - 30 < bottom) { newPage(); header(); }
        const count = Math.min(length - offset, Math.max(1, Math.floor((y - bottom - 12) / 11))), height = count * 11 + 12;
        let x = left;
        cells.forEach((lines, index) => {
          page.drawRectangle({ x, y: y - height, width: widths[index], height, borderColor: grey, borderWidth: .4 });
          for (let k = 0; k < count; k++) if (lines[offset + k] !== undefined) text(lines[offset + k], x + 4, y - 14 - k * 11, 8);
          x += widths[index];
        }); y -= height; offset += count;
      }
    }); y -= 14;
  }
  newPage(); client();
  section('REFERÊNCIA / CONDIÇÕES', `${data.scope === 'lot' ? 'Lote completo: ' + data.lotId : 'Atendimento individual'}${template.terms ? '\n' + template.terms : ''}`);
  equipmentTable();
  if (data.services?.length) serviceTable();
  if (data.service) section(data.services?.length ? 'OBSERVAÇÕES TÉCNICAS' : 'SERVIÇOS EXECUTADOS', data.service);
  if (data.notes) section('OBSERVAÇÕES', data.notes);
  ensure(50); page.drawRectangle({ x: left + width - 200, y: y - 39, width: 200, height: 39, color: pale, borderColor: grey, borderWidth: .7 });
  text('VALOR TOTAL DOS SERVIÇOS', left + width - 190, y - 13, 8, bold); text(data.amount || 'R$ 0,00', left + width - 190, y - 29, 12, bold); y -= 52;
  const pages = doc.getPages();
  pages.forEach((p, i) => { page = p; rule(43); text(`${data.kind === 'OS' ? 'Ordem de serviço' : 'Rascunho sem validade fiscal'} · ${data.number}`, left, 30, 7.5, normal, grey); const label = `Página ${i + 1} de ${pages.length}`; text(label, left + width - normal.widthOfTextAtSize(safe(label), 7.5), 30, 7.5, normal, grey); });
  return doc.save();
}
