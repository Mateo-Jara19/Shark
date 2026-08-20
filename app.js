(() => {
  'use strict';

  const TABLE = 'ventas_blue_sharks';
  const TIMEZONE = 'America/Guayaquil';
  const PRICES = Object.freeze({
    'Blue Sharks Clásico': 1.75,
    'Blue Sharks Extra Picante': 2.00,
    'Blue Sharks Mix': 2.25
  });

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const els = {
    form: $('#saleForm'),
    cliente: $('#cliente'),
    ciudad: $('#ciudad'),
    producto: $('#producto'),
    cantidad: $('#cantidad'),
    precio: $('#precio'),
    metodoPago: $('#metodo_pago'),
    totalDisplay: $('#totalDisplay'),
    submit: $('#submitSale'),
    message: $('#formMessage'),
    dbStatus: $('#dbStatus'),
    dbStatusText: $('#dbStatusText'),
    salesBody: $('#salesBody'),
    refreshSales: $('#refreshSales'),
    statRevenue: $('#statRevenue'),
    statUnits: $('#statUnits'),
    statOrders: $('#statOrders'),
    statAverage: $('#statAverage'),
    recordCount: $('#recordCount')
  };

  const money = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });

  const dateEcuador = new Intl.DateTimeFormat('es-EC', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const config = window.BLUE_SHARKS_CONFIG || {};
  const configReady =
    typeof config.supabaseUrl === 'string' &&
    typeof config.supabaseAnonKey === 'string' &&
    !config.supabaseUrl.includes('REEMPLAZA') &&
    !config.supabaseAnonKey.includes('REEMPLAZA');

  let db = null;

  function setStatus(type, text) {
    els.dbStatus.classList.remove('is-online', 'is-offline');
    if (type) els.dbStatus.classList.add(type);
    els.dbStatusText.textContent = text;
  }

  function setMessage(text = '', type = '') {
    els.message.textContent = text;
    els.message.className = 'form-message';
    if (type) els.message.classList.add(type);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getCurrentPrice() {
    return PRICES[els.producto.value] ?? 0;
  }

  function getCurrentTotal() {
    const qty = Math.max(1, Number(els.cantidad.value) || 1);
    return Number((getCurrentPrice() * qty).toFixed(2));
  }

  function updateTotals() {
    const price = getCurrentPrice();
    els.precio.value = price.toFixed(2);
    els.totalDisplay.textContent = money.format(getCurrentTotal());
  }

  function formatEcuadorDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : dateEcuador.format(date).replace(',', '');
  }

  function renderStats(rows) {
    const revenue = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
    const units = rows.reduce((sum, row) => sum + Number(row.cantidad || 0), 0);
    const orders = rows.length;
    const average = orders ? revenue / orders : 0;

    els.statRevenue.textContent = money.format(revenue);
    els.statUnits.textContent = String(units);
    els.statOrders.textContent = String(orders);
    els.statAverage.textContent = money.format(average);
    els.recordCount.textContent = `${orders} ${orders === 1 ? 'registro' : 'registros'}`;
  }

  function renderSales(rows) {
    renderStats(rows);

    if (!rows.length) {
      els.salesBody.innerHTML = '<tr class="empty-row"><td colspan="8">Todavía no hay ventas registradas.</td></tr>';
      return;
    }

    els.salesBody.innerHTML = rows.slice(0, 20).map((row) => `
      <tr>
        <td>${escapeHtml(row.id)}</td>
        <td>${escapeHtml(formatEcuadorDate(row.created_at))}</td>
        <td>${escapeHtml(row.cliente)}</td>
        <td>${escapeHtml(row.ciudad)}</td>
        <td>${escapeHtml(row.producto)}</td>
        <td>${escapeHtml(row.cantidad)}</td>
        <td>${escapeHtml(money.format(Number(row.total || 0)))}</td>
        <td>${escapeHtml(row.metodo_pago)}</td>
      </tr>
    `).join('');
  }

  async function loadSales() {
    if (!db) {
      renderStats([]);
      els.salesBody.innerHTML = '<tr class="empty-row"><td colspan="8">Configura Supabase para visualizar las ventas.</td></tr>';
      return;
    }

    els.refreshSales.disabled = true;
    try {
      const { data, error } = await db
        .from(TABLE)
        .select('id, created_at, cliente, ciudad, producto, cantidad, precio, total, metodo_pago')
        .order('created_at', { ascending: false });

      if (error) throw error;
      renderSales(data || []);
      setStatus('is-online', 'Supabase conectado');
    } catch (error) {
      console.error(error);
      setStatus('is-offline', 'Error de conexión');
      els.salesBody.innerHTML = '<tr class="empty-row"><td colspan="8">No se pudieron cargar las ventas. Revisa la configuración de Supabase.</td></tr>';
    } finally {
      els.refreshSales.disabled = false;
    }
  }

  async function saveSale(event) {
    event.preventDefault();
    setMessage();

    if (!els.form.reportValidity()) return;

    if (!db) {
      setMessage('Primero debes colocar el Project URL y la Publishable Key en supabase-config.js.', 'is-error');
      return;
    }

    const quantity = Number(els.cantidad.value);
    const price = getCurrentPrice();
    const total = Number((price * quantity).toFixed(2));

    const payload = {
      cliente: els.cliente.value.trim(),
      ciudad: els.ciudad.value,
      producto: els.producto.value,
      cantidad: quantity,
      precio: price,
      total,
      metodo_pago: els.metodoPago.value
    };

    els.submit.disabled = true;
    els.submit.querySelector('span').textContent = 'Guardando...';

    try {
      const { error } = await db.from(TABLE).insert(payload);
      if (error) throw error;

      setMessage('Venta registrada correctamente en Supabase ✓', 'is-success');
      els.form.reset();
      els.producto.value = 'Blue Sharks Clásico';
      els.cantidad.value = 1;
      updateTotals();
      await loadSales();
    } catch (error) {
      console.error(error);
      setMessage(`No se pudo guardar la venta: ${error.message || 'revisa Supabase'}`, 'is-error');
      setStatus('is-offline', 'Error de conexión');
    } finally {
      els.submit.disabled = false;
      els.submit.querySelector('span').textContent = 'Registrar venta';
    }
  }

  function chooseProduct(product) {
    if (!PRICES[product]) return;
    els.producto.value = product;
    updateTotals();
    document.querySelector('#pedido').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function initDatabase() {
    if (!configReady) {
      setStatus('is-offline', 'Falta configurar Supabase');
      els.salesBody.innerHTML = '<tr class="empty-row"><td colspan="8">La página está lista. Falta pegar tus credenciales públicas en supabase-config.js.</td></tr>';
      return;
    }

    if (!window.supabase?.createClient) {
      setStatus('is-offline', 'No cargó Supabase JS');
      return;
    }

    db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    setStatus('', 'Conectando...');
    loadSales();
  }

  els.producto.addEventListener('change', updateTotals);
  els.cantidad.addEventListener('input', updateTotals);
  els.form.addEventListener('submit', saveSale);
  els.refreshSales.addEventListener('click', loadSales);
  $$('.mini-button').forEach((button) => button.addEventListener('click', () => chooseProduct(button.dataset.product)));

  updateTotals();
  initDatabase();
})();
