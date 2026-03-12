/**
 * Authentication Module
 */
import { store } from '../api/store.js';
import { helpers } from '../utils/helpers.js';

export const auth = {
    async checkAuth(app) {
        const user = await store.getCurrentUser();
        const appContainer = document.getElementById('appContainer');
        const authContainer = document.getElementById('authContainer');
        
        if (user) {
            // Logged in
            appContainer.style.display = 'flex';
            authContainer.style.display = 'none';
            document.getElementById('currentUsername').textContent = user.username;
            
            // Load app data
            await app.loadInitialData();
            return true;
        } else {
            // Logged out
            appContainer.style.display = 'none';
            authContainer.style.display = 'flex';
            
            // Clean up session specific data/components if needed
            app.ui.closeModal('studentModal');
            app.ui.closeModal('courseModal');
            app.ui.closeModal('purchaseModal');
            app.ui.closeModal('signinModal');
            return false;
        }
    },
    
    toggleAuthMode(mode) {
        const loginForm = document.getElementById('loginForm');
        const regForm = document.getElementById('registerForm');
        const subtitle = document.getElementById('authSubtitle');
        
        if (mode === 'register') {
            loginForm.classList.add('hidden');
            regForm.classList.remove('hidden');
            subtitle.textContent = '创建一个新账户';
        } else {
            loginForm.classList.remove('hidden');
            regForm.classList.add('hidden');
            subtitle.textContent = '请登录您的账户';
        }
        
        // Reset forms
        loginForm.reset();
        regForm.reset();
    },
    
    async login(app) {
        const emailInput = document.getElementById('loginEmail').value.trim();
        const passwordInput = document.getElementById('loginPassword').value.trim();
        
        if (!emailInput || !passwordInput) {
            helpers.showToast('请输入邮箱和密码', 'error');
            return;
        }
        
        const btn = document.querySelector('#loginForm button');
        btn.textContent = '登录中...';
        btn.disabled = true;

        const result = await store.loginUser(emailInput, passwordInput);
        btn.textContent = '登 录';
        btn.disabled = false;

        if (result.success) {
            helpers.showToast(`欢迎回来！`);
            // Clear inputs
            document.getElementById('loginForm').reset();
            // Load app
            await this.checkAuth(app);
        } else {
            helpers.showToast(result.message, 'error');
        }
    },
    
    async register(app) {
        const emailInput = document.getElementById('regEmail').value.trim();
        const passwordInput = document.getElementById('regPassword').value.trim();
        const confirmInput = document.getElementById('regConfirmPassword').value.trim();
        
        if (!emailInput || !passwordInput || !confirmInput) {
            helpers.showToast('请完整填写注册信息', 'error');
            return;
        }
        
        if (passwordInput !== confirmInput) {
            helpers.showToast('两次输入的密码不一致', 'error');
            return;
        }
        
        if (passwordInput.length < 6) {
            helpers.showToast('密码长度至少需要6位', 'error');
            return;
        }
        
        const btn = document.querySelector('#registerForm button');
        const originalText = btn.textContent;
        btn.textContent = '注册中...';
        btn.disabled = true;

        try {
            const result = await store.registerUser(emailInput, passwordInput);
            
            if (result.success) {
                if (result.needsConfirmation) {
                    helpers.showToast('注册已提交！请前往您的邮箱查收确认邮件。', 'success');
                    // Switch back to login form
                    this.toggleAuthMode('login');
                } else {
                    helpers.showToast('注册成功！正在登录...');
                    // Auto login after registration
                    await store.loginUser(emailInput, passwordInput);
                    document.getElementById('registerForm').reset();
                    await this.checkAuth(app);
                }
            } else {
                helpers.showToast(result.message, 'error');
            }
        } catch (err) {
            console.error('Registration UI error:', err);
            const errorMsg = err.message || '发生意外错误';
            helpers.showToast(`错误: ${errorMsg} (请检查网络或控制台)`, 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },
    
    async logout(app) {
        if (confirm('确定要退出登录吗？')) {
            await store.logoutUser();
            await this.checkAuth(app);
            helpers.showToast('您已安全退出');
        }
    }
};
