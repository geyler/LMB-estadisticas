/**
 * Offline Sync Engine for Liga Metropolitana de Béisbol (LMB)
 * Manages offline game stat recording & auto-sync when back online
 */

const LMB_OFFLINE_KEY = 'LMB_OFFLINE_QUEUE';

const OfflineSync = {
  getQueue() {
    try {
      const data = localStorage.getItem(LMB_OFFLINE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveQueue(queue) {
    try {
      localStorage.setItem(LMB_OFFLINE_KEY, JSON.stringify(queue));
      this.updateUIBadge();
    } catch (e) {
      console.error("Error al guardar cola offline", e);
    }
  },

  enqueue(endpoint, payload) {
    const queue = this.getQueue();
    queue.push({
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      endpoint,
      payload
    });
    this.saveQueue(queue);
    console.log("Acción guardada offline en cola local:", payload);

    if (navigator.onLine) {
      this.syncNow();
    }
  },

  async syncNow() {
    const queue = this.getQueue();
    if (!queue.length || !navigator.onLine) return;

    console.log("Iniciando sincronización offline de", queue.length, "eventos...");

    try {
      const response = await fetch('api/sync.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue })
      });
      const data = await response.json();

      if (data.success) {
        console.log("Sincronización exitosa:", data.message);
        this.saveQueue([]); // Clear queue
        if (window.App && typeof window.App.refreshCurrentView === 'function') {
          window.App.refreshCurrentView();
        }
        if (window.App && typeof window.App.showSnackbar === 'function') {
          window.App.showSnackbar('⚡ Datos locales sincronizados con el servidor.');
        }
      }
    } catch (e) {
      console.warn("Fallo de sincronización online. Se reintentará luego.", e);
    }
  },

  updateUIBadge() {
    const queueCount = this.getQueue().length;
    if (window.App && typeof window.App.showSnackbar === 'function') {
      if (!navigator.onLine) {
        window.App.showSnackbar(`📴 Modo sin conexión activo (${queueCount} pendientes)`);
      }
    }
  },

  init() {
    window.addEventListener('online', () => {
      this.updateUIBadge();
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      this.updateUIBadge();
    });

    this.updateUIBadge();

    // Auto retry sync every 20 seconds when online
    setInterval(() => {
      if (navigator.onLine && this.getQueue().length > 0) {
        this.syncNow();
      }
    }, 20000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  OfflineSync.init();
});
