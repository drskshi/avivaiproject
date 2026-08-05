/**
 * Cart stored in localStorage until checkout creates a server order.
 * Item shape: { ticketTypeCode, name, price, attendees: [...] }
 */
const Cart = {
  key: 'o2_cart',

  get() {
    try {
      return JSON.parse(localStorage.getItem(this.key) || '[]');
    } catch {
      return [];
    }
  },

  save(items) {
    localStorage.setItem(this.key, JSON.stringify(items));
    this.updateBadge();
  },

  add(item) {
    const items = this.get();
    items.push(item);
    this.save(items);
  },

  remove(index) {
    const items = this.get();
    items.splice(index, 1);
    this.save(items);
  },

  clear() {
    localStorage.removeItem(this.key);
    this.updateBadge();
  },

  count() {
    return this.get().length;
  },

  updateBadge() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = String(this.count());
    });
  },
};

window.Cart = Cart;
document.addEventListener('DOMContentLoaded', () => Cart.updateBadge());
