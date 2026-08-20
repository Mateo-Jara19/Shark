(() => {
  'use strict';

  const TABLE = 'ventas_blue_sharks';
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
    message: $('#formMessage')
  };

  const money = new Intl.NumberFormat('es-EC', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  });

  const config = window.BLUE_SHARKS_CONFIG || {};
  const configReady =
    typeof config.supabaseUrl === 'string' &&
    typeof config.supabaseAnonKey === 'string' &&
    !config.supabaseUrl.includes('REEMPLAZA') &&
    !config.supabaseAnonKey.includes('REEMPLAZA');

  let db = null;

  function setMessage(text = '', type = '') {
    els.message.textContent = text;
    els.message.className = 'form-message';
    if (type) els.message.classList.add(type);
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

  async function saveOrder(event) {
    event.preventDefault();
    setMessage();

    if (!els.form.reportValidity()) return;

    if (!db) {
      setMessage('Los pedidos están temporalmente no disponibles. Inténtalo nuevamente en unos minutos.', 'is-error');
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
    els.submit.querySelector('span').textContent = 'Registrando pedido...';

    try {
      const { error } = await db.from(TABLE).insert(payload);
      if (error) throw error;

      setMessage('¡Pedido registrado! Gracias por elegir Blue Sharks 🦈', 'is-success');
      els.form.reset();
      els.producto.value = 'Blue Sharks Clásico';
      els.cantidad.value = 1;
      updateTotals();
    } catch (error) {
      console.error(error);
      setMessage('No pudimos registrar tu pedido en este momento. Inténtalo nuevamente.', 'is-error');
    } finally {
      els.submit.disabled = false;
      els.submit.querySelector('span').textContent = 'Confirmar pedido';
    }
  }

  function chooseProduct(product) {
    if (!(product in PRICES)) return;
    els.producto.value = product;
    updateTotals();
    document.querySelector('#pedido').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function initDatabase() {
    if (!configReady || !window.supabase?.createClient) return;
    db = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
  }

  els.producto.addEventListener('change', updateTotals);
  els.cantidad.addEventListener('input', updateTotals);
  els.form.addEventListener('submit', saveOrder);
  $$('.mini-button').forEach(button => {
    button.addEventListener('click', () => chooseProduct(button.dataset.product));
  });

  updateTotals();
  initDatabase();
})();
