/**
 * Utility Helper Functions
 */

export const helpers = {
    // --- UI Helpers ---
    setupTimeDisplay(elementId) {
        const timeEl = document.getElementById(elementId);
        if (!timeEl) return;
        
        const update = () => {
            const now = new Date();
            timeEl.textContent = now.toLocaleString('zh-CN', { 
                year: 'numeric', month: '2-digit', day: '2-digit', 
                hour: '2-digit', minute: '2-digit' 
            });
        };
        update();
        setInterval(update, 60000);
    },
    
    formatDate(isoString) {
        if (!isoString) return '-';
        const d = new Date(isoString);
        return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    },

    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-circle-xmark';
        toast.innerHTML = `
            <i class="fa-solid ${icon}"></i>
            <div class="toast-body">${message}</div>
        `;
        
        container.appendChild(toast);
        
        // Remove after 3s
        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
};
