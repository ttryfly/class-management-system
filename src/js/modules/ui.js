/**
 * UI Module
 */
import { helpers } from '../utils/helpers.js';
import { store } from '../api/store.js';

export const ui = {
    // --- Navigation & Views ---
    setupNavigation(app) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                if(targetView) this.switchView(targetView, app);
            });
        });
    },
    
    async switchView(viewId, app) {
        if (!viewId) return;
        
        // Update nav styling
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.view === viewId) item.classList.add('active');
        });
        
        // Update view visibility
        document.querySelectorAll('.view-section').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`view-${viewId}`).classList.add('active');
        
        app.currentView = viewId;
        
        // Update Header Title
        const titles = {
            'dashboard': '数据看板',
            'students': '学员管理',
            'courses': '课程管理',
            'purchases': '购课记录',
            'signins': '签到记录'
        };
        document.getElementById('headerTitle').textContent = titles[viewId] || '课时管理系统';
        
        // Refresh data for the specific view
        await app.refreshViewData(viewId);
    },
    
    // --- Modals ---
    openModal(modalId, app) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            if (modalId === 'purchaseModal' || modalId === 'signinModal') {
                app.updateDropdowns();
                if (modalId === 'signinModal') app.updateSigninPreview();
            }
        }
    },
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            // Check if form exists and reset
            const form = modal.querySelector('form');
            if(form) form.reset();
            
            // Clear specific hidden ids
            if(modalId === 'studentModal') document.getElementById('studentId').value = '';
            if(modalId === 'courseModal') document.getElementById('courseId').value = '';
        }
    },

    // --- Loading Overlay (New utility) ---
    setLoading(isLoading) {
        // Implementation could involve a spinner overlay
        console.log(isLoading ? 'Loading...' : 'Done');
    }
};
