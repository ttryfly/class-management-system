/**
 * Frontend UI Controller
 */

const app = {
    // Current state
    currentView: 'dashboard',
    
    // Initialize application
    async init() {
        this.setupNavigation();
        this.setupTimeDisplay();
        
        // Prevent form default submissions
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => e.preventDefault());
        });

        // Check Authentication first
        await this.checkAuth();
        
        // Diagnostic: Check Supabase Connection
        this.testConnection();
    },

    async testConnection() {
        console.log('%c[Supabase 诊断]', 'color: #3ecf8e; font-weight: bold;', '正在检查连接...');
        try {
            const storeObj = window.store || (typeof store !== 'undefined' ? store : null);
            if (!storeObj) throw new Error('Store 对象未定义');
            const result = await storeObj.getCurrentUser();
            console.log('%c[Supabase 诊断]', 'color: #3ecf8e; font-weight: bold;', '连接正常。当前状态:', result ? '已登录' : '未登录');
        } catch (e) {
            console.error('%c[Supabase 诊断]', 'color: #ff4d4f; font-weight: bold;', '连接检测失败:', e.message);
        }
    },
    
    // --- Authentication ---
    async checkAuth() {
        const user = await store.getCurrentUser();
        const appContainer = document.getElementById('appContainer');
        const authContainer = document.getElementById('authContainer');
        
        if (user) {
            // Logged in
            appContainer.style.display = 'flex';
            authContainer.style.display = 'none';
            document.getElementById('currentUsername').textContent = user.username;
            
            // Load app data
            await this.loadInitialData();
            return true;
        } else {
            // Logged out
            appContainer.style.display = 'none';
            authContainer.style.display = 'flex';
            
            // Clean up session specific data/components if needed
            this.closeModal('studentModal');
            this.closeModal('courseModal');
            this.closeModal('purchaseModal');
            this.closeModal('signinModal');
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
    
    async login() {
        const emailInput = document.getElementById('loginEmail').value.trim();
        const passwordInput = document.getElementById('loginPassword').value.trim();
        
        if (!emailInput || !passwordInput) {
            this.showToast('请输入邮箱和密码', 'error');
            return;
        }
        
        const btn = document.querySelector('#loginForm button');
        btn.textContent = '登录中...';
        btn.disabled = true;

        const result = await store.loginUser(emailInput, passwordInput);
        btn.textContent = '登 录';
        btn.disabled = false;

        if (result.success) {
            this.showToast(`欢迎回来！`);
            // Clear inputs
            document.getElementById('loginForm').reset();
            // Load app
            await this.checkAuth();
        } else {
            this.showToast(result.message, 'error');
        }
    },
    
    async register() {
        const emailInput = document.getElementById('regEmail').value.trim();
        const passwordInput = document.getElementById('regPassword').value.trim();
        const confirmInput = document.getElementById('regConfirmPassword').value.trim();
        
        if (!emailInput || !passwordInput || !confirmInput) {
            this.showToast('请完整填写注册信息', 'error');
            return;
        }
        
        if (passwordInput !== confirmInput) {
            this.showToast('两次输入的密码不一致', 'error');
            return;
        }
        
        if (passwordInput.length < 6) {
            this.showToast('密码长度至少需要6位', 'error');
            return;
        }
        
        const btn = document.querySelector('#registerForm button');
        const originalText = btn.textContent;
        btn.textContent = '注册中...';
        btn.disabled = true;

        try {
            const storeObj = window.store || (typeof store !== 'undefined' ? store : null);
            if (!storeObj) throw new Error('数据组件 (store) 加载失败，请尝试刷新页面');
            
            const result = await storeObj.registerUser(emailInput, passwordInput);
            
            if (result.success) {
                if (result.needsConfirmation) {
                    this.showToast('注册已提交！请前往您的邮箱查收确认邮件。', 'success');
                    // Switch back to login form
                    this.toggleAuthMode('login');
                } else {
                    this.showToast('注册成功！正在登录...');
                    // Auto login after registration
                    await store.loginUser(emailInput, passwordInput);
                    document.getElementById('registerForm').reset();
                    await this.checkAuth();
                }
            } else {
                this.showToast(result.message, 'error');
            }
        } catch (err) {
            console.error('Registration UI error:', err);
            const errorMsg = err.message || '发生意外错误';
            this.showToast(`错误: ${errorMsg} (请检查网络或控制台)`, 'error');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },
    
    async logout() {
        if (confirm('确定要退出登录吗？')) {
            await store.logoutUser();
            await this.checkAuth();
            this.showToast('您已安全退出');
        }
    },
    
    // --- Navigation & Views ---
    setupNavigation() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const targetView = e.currentTarget.dataset.view;
                if(targetView) this.switchView(targetView);
            });
        });
    },
    
    async switchView(viewId) {
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
        
        this.currentView = viewId;
        
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
        await this.refreshViewData(viewId);
    },
    
    async refreshViewData(viewId) {
        switch(viewId) {
            case 'dashboard': await this.renderDashboard(); break;
            case 'students': await this.renderStudents(); break;
            case 'courses': await this.renderCourses(); break;
            case 'purchases': await this.renderPurchases(); break;
            case 'signins': await this.renderSignins(); break;
        }
    },
    
    async loadInitialData() {
        // Render initial view
        await this.refreshViewData(this.currentView);
        // Pre-fill dropdowns when needed
        await this.updateDropdowns();
    },

    // --- UI Helpers ---
    setupTimeDisplay() {
        const timeEl = document.getElementById('currentTime');
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
    },
    
    // --- Modals ---
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('show');
            if (modalId === 'purchaseModal' || modalId === 'signinModal') {
                this.updateDropdowns();
                if (modalId === 'signinModal') this.updateSigninPreview();
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

    // --- Data Rendering ---
    
    // 1. Dashboard
    async renderDashboard() {
        const stats = await store.getDashboardStats();
        
        // Stats Cards
        document.getElementById('dash-total-students').textContent = stats.totalStudents;
        document.getElementById('dash-total-courses').textContent = stats.totalCourses;
        document.getElementById('dash-low-balance').textContent = stats.lowBalanceCount;
        
        // Recent Signins
        const tbody = document.getElementById('dash-recent-signins');
        if (stats.recentSignins.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem;">暂无近期签到记录</td></tr>`;
            return;
        }
        
        tbody.innerHTML = stats.recentSignins.map(s => `
            <tr>
                <td class="font-bold">${s.studentName}</td>
                <td>${s.courseName}</td>
                <td><span class="badge badge-danger">-${s.hoursDeducted} 课时</span></td>
                <td style="color:var(--text-muted)">${this.formatDate(s.date)}</td>
            </tr>
        `).join('');
    },
    
    // 2. Students
    async renderStudents() {
        const students = await store.getStudents();
        const courses = await store.getCourses();
        const purchases = await store.getPurchases();
        const signins = await store.getSignins();
        const tbody = document.getElementById('table-students');
        
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-users-slash"></i><p>暂无学员数据，点击右上角添加。</p></td></tr>`;
            return;
        }
        
        tbody.innerHTML = students.map(s => {
            const balanceClass = Number(s.balance) <= 3 ? 'text-danger font-bold' : 'text-success font-bold';
            
            // Map course IDs to names
            const enrolledCourseNames = (s.courses || []).map(courseId => {
                const courseInfo = courses.find(c => c.id === courseId);
                return courseInfo ? courseInfo.name : '未知课程';
            });
            const coursesDisplay = enrolledCourseNames.length > 0 ? enrolledCourseNames.join(', ') : '-';
            
            // Calculate Totals
            const purchasedItems = purchases
                .filter(p => p.studentId === s.id)
                .reduce((sum, p) => sum + Number(p.hoursBought), 0);
                
            const totalDeducted = signins
                .filter(record => record.studentId === s.id)
                .reduce((sum, record) => sum + Number(record.hoursDeducted), 0);
                
            // Since initial balance wasn't stored explicitly, we can derive the total historical additions 
            // (initial + purchases) by using the conservation formula: 
            // Total Added = Current Balance + Total Deducted
            const totalBought = (Number(s.balance) || 0) + totalDeducted;
            
            return `
            <tr>
                <td class="font-bold">${s.name}</td>
                <td>${s.phone}</td>
                <td>${coursesDisplay}</td>
                <td style="color:var(--secondary)">+${totalBought}</td>
                <td style="color:var(--danger)">-${totalDeducted}</td>
                <td><span class="${balanceClass}">${s.balance || 0}</span> 课时</td>
                <td style="color:var(--text-muted)">${this.formatDate(s.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="app.editStudent('${s.id}')">编辑</button>
                    <button class="btn btn-sm btn-secondary" onclick="app.exportStudentHistory('${s.id}')">导出</button>
                    <button class="btn btn-sm btn-secondary" style="color:var(--danger)" onclick="app.deleteStudent('${s.id}')">删除</button>
                </td>
            </tr>
        `}).join('');
    },
    
    async saveStudent() {
        const id = document.getElementById('studentId').value;
        const name = document.getElementById('studentName').value.trim();
        const phone = document.getElementById('studentPhone').value.trim();
        const balance = document.getElementById('studentBalance').value;
        const initialCourse = document.getElementById('studentCourse').value;
        
        if(!name || !phone) {
            this.showToast('请填写完整必填信息', 'error');
            return;
        }
        
        if (id) {
            // Edit basic info only
            await store.updateStudent(id, { name, phone });
            this.showToast('学员信息更新成功');
        } else {
            // Add
            const newStudentData = { name, phone, balance: Number(balance) || 0 };
            if (initialCourse) {
                newStudentData.courses = [initialCourse];
            }
            await store.addStudent(newStudentData);
            this.showToast('新学员添加成功');
        }
        
        this.closeModal('studentModal');
        await this.refreshViewData('students');
        await this.updateDropdowns();
    },

    async editStudent(id) {
        const students = await store.getStudents();
        const student = students.find(s => s.id === id);
        if(student) {
            document.getElementById('studentId').value = student.id;
            document.getElementById('studentName').value = student.name;
            document.getElementById('studentPhone').value = student.phone;
            
            // Hide balance and initial course input when editing
            document.getElementById('studentBalanceGroup').style.display = 'none';
            document.getElementById('studentCourseGroup').style.display = 'none';
            document.getElementById('studentModalTitle').textContent = '编辑学员';
            
            this.openModal('studentModal');
            
            // Re-show balance and course on next modal open
            const resetModal = () => {
                document.getElementById('studentBalanceGroup').style.display = 'block';
                document.getElementById('studentCourseGroup').style.display = 'block';
                document.getElementById('studentModalTitle').textContent = '添加学员';
            };
            document.getElementById('studentModal').addEventListener('click', (e) => {
                if(e.target.classList.contains('modal-close') || e.target.textContent === '取消') {
                    resetModal();
                }
            }, {once: true});
            document.querySelector('#studentModal .btn-primary').addEventListener('click', resetModal, {once: true});
        }
    },
    
    async deleteStudent(id) {
        if(confirm('确定要删除此学员吗？此操作不可逆。')) {
            await store.deleteStudent(id);
            this.showToast('学员已删除');
            await this.refreshViewData('students');
            await this.updateDropdowns();
        }
    },
    
    async exportStudentHistory(id) {
        const students = await store.getStudents();
        const student = students.find(s => s.id === id);
        if (!student) return;

        const courses = await store.getCourses();
        const allPurchases = await store.getPurchases();
        const allSignins = await store.getSignins();
        
        const purchases = allPurchases.filter(p => p.studentId === id);
        const signins = allSignins.filter(s => s.studentId === id);

        // Combine and map records
        const records = [
            ...purchases.map(p => ({
                type: '充值购课',
                courseName: (courses.find(c => c.id === p.courseId) || {}).name || '未知课程',
                change: `+${p.hoursBought} 课时`,
                date: p.date
            })),
            ...signins.map(s => ({
                type: '签到扣课',
                courseName: (courses.find(c => c.id === s.courseId) || {}).name || '未知课程',
                change: `-${s.hoursDeducted} 课时`,
                date: s.date
            }))
        ];

        // Sort by date descending
        records.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Generate CSV content
        // Adding UTF-8 BOM so Excel opens it correctly with Chinese characters
        let csvContent = '\uFEFF'; 
        
        // Add a summary header row
        csvContent += `"学员档案：","${student.name}"\n`;
        csvContent += `"联系电话：","${student.phone || '-'}"\n`;
        csvContent += `"当前剩余课时：","${student.balance || 0} 课时"\n`;
        const nowStr = this.formatDate(new Date().toISOString());
        csvContent += `"导出时间：","${nowStr}"\n\n`;

        csvContent += '"记录类型","涉及课程","变动情况","发生时间"\n';
        
        records.forEach(r => {
            const dateStr = this.formatDate(r.date);
            // Escape quotes just in case course name has commas
            const safeCourse = `"${r.courseName.replace(/"/g, '""')}"`;
            csvContent += `"${r.type}",${safeCourse},"${r.change}","${dateStr}"\n`;
        });

        // Trigger download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `${student.name}_课时记录.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast(`已导出 ${student.name} 的课时记录`);
    },
    
    // 3. Courses
    async renderCourses() {
        const courses = await store.getCourses();
        const tbody = document.getElementById('table-courses');
        
        if (courses.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="empty-state"><i class="fa-solid fa-book-open"></i><p>暂无课程数据，点击右上角添加。</p></td></tr>`;
            return;
        }
        
        tbody.innerHTML = courses.map(c => `
            <tr>
                <td class="font-bold">${c.name}</td>
                <td><span class="badge badge-primary">${c.defaultHours} 课时</span></td>
                <td style="color:var(--text-muted)">${c.description || '-'}</td>
                <td style="color:var(--text-muted)">${this.formatDate(c.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="app.editCourse('${c.id}')">编辑</button>
                    <button class="btn btn-sm btn-secondary" style="color:var(--danger)" onclick="app.deleteCourse('${c.id}')">删除</button>
                </td>
            </tr>
        `).join('');
    },

    async saveCourse() {
        const id = document.getElementById('courseId').value;
        const name = document.getElementById('courseName').value.trim();
        const hours = document.getElementById('courseHours').value;
        const defaultHours = Number(hours) || 1;
        const description = document.getElementById('courseDesc').value.trim();
        
        if(!name) {
            this.showToast('请填写课程名称', 'error');
            return;
        }
        
        if (id) {
            await store.updateCourse(id, { name, defaultHours, description });
            this.showToast('课程信息更新成功');
        } else {
            await store.addCourse({ name, defaultHours, description });
            this.showToast('新课程添加成功');
        }
        
        this.closeModal('courseModal');
        await this.refreshViewData('courses');
        await this.updateDropdowns();
    },

    async editCourse(id) {
        const courses = await store.getCourses();
        const course = courses.find(c => c.id === id);
        if(course) {
            document.getElementById('courseId').value = course.id;
            document.getElementById('courseName').value = course.name;
            document.getElementById('courseHours').value = course.defaultHours;
            document.getElementById('courseDesc').value = course.description;
            
            document.getElementById('courseModalTitle').textContent = '编辑课程';
            this.openModal('courseModal');
            
            const resetModal = () => document.getElementById('courseModalTitle').textContent = '添加课程';
            document.getElementById('courseModal').addEventListener('click', (e) => {
                if(e.target.classList.contains('modal-close') || e.target.textContent === '取消') resetModal();
            }, {once: true});
            document.querySelector('#courseModal .btn-primary').addEventListener('click', resetModal, {once: true});
        }
    },

    async deleteCourse(id) {
        if(confirm('确定要删除此课程吗？')) {
            await store.deleteCourse(id);
            this.showToast('课程已删除');
            await this.refreshViewData('courses');
            await this.updateDropdowns();
        }
    },
    
    // 4. Purchases
    async renderPurchases() {
        const purchases = await store.getPurchases();
        const students = await store.getStudents();
        const courses = await store.getCourses();
        const tbody = document.getElementById('table-purchases');
        
        if (purchases.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="fa-solid fa-receipt"></i><p>暂无购课记录哦。</p></td></tr>`;
            return;
        }
        
        tbody.innerHTML = purchases.map(p => {
            const student = students.find(s => s.id === p.studentId);
            const course = courses.find(c => c.id === p.courseId);
            return `
            <tr>
                <td class="font-bold">${student ? student.name : '未知学员'}</td>
                <td>${course ? course.name : '未知课程'}</td>
                <td><span class="badge badge-success">+${p.hoursBought} 课时</span></td>
                <td style="color:var(--text-muted)">${this.formatDate(p.date)}</td>
            </tr>
            `;
        }).join('');
    },

    async savePurchase() {
        const studentId = document.getElementById('purchaseStudent').value;
        const courseId = document.getElementById('purchaseCourse').value;
        const hoursBought = Number(document.getElementById('purchaseHours').value);
        
        if(!studentId || !courseId || hoursBought <= 0) {
            this.showToast('请完整填写充值信息', 'error');
            return;
        }
        
        const result = await store.addPurchase({ studentId, courseId, hoursBought });
        if (result.success) {
            this.showToast(`充值成功，已增加 ${hoursBought} 课时`);
            this.closeModal('purchaseModal');
            await this.refreshViewData('purchases');
        } else {
            this.showToast(result.message, 'error');
        }
    },
    
    // 5. Sign-ins
    async renderSignins() {
        const signins = await store.getSignins();
        const students = await store.getStudents();
        const courses = await store.getCourses();
        const tbody = document.getElementById('table-signins');
        
        if (signins.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="empty-state"><i class="fa-solid fa-calendar-times"></i><p>暂无签到记录。</p></td></tr>`;
            return;
        }
        
        tbody.innerHTML = signins.map(s => {
            const student = students.find(st => st.id === s.studentId);
            const course = courses.find(c => c.id === s.courseId);
            return `
            <tr>
                <td class="font-bold">${student ? student.name : '未知学员'}</td>
                <td>${course ? course.name : '未知课程'}</td>
                <td><span class="badge badge-danger">-${s.hoursDeducted} 课时</span></td>
                <td style="color:var(--text-muted)">${this.formatDate(s.date)}</td>
            </tr>
            `;
        }).join('');
    },

    async saveSignin() {
        const studentId = document.getElementById('signinStudent').value;
        const courseId = document.getElementById('signinCourse').value;
        const hoursDeducted = Number(document.getElementById('signinHours').value);
        
        if(!studentId || !courseId || hoursDeducted <= 0) {
            this.showToast('请完整填写签到信息', 'error');
            return;
        }
        
        const btn = document.querySelector('#signinModal .btn-danger');
        btn.textContent = '签到中...';
        btn.disabled = true;

        const result = await store.addSignin({ studentId, courseId, hoursDeducted });
        
        if(result.success) {
            this.showToast(result.message);
            this.closeModal('signinModal');
            await this.refreshViewData('signins');
        } else {
            this.showToast(result.message, 'error');
        }
        
        btn.textContent = '确认扣除并签到';
        btn.disabled = false;
    },
    
    // Utilities
    async updateDropdowns() {
        const students = await store.getStudents();
        const courses = await store.getCourses();
        
        const studentOpts = `<option value="" disabled selected>请选择学员</option>` + 
            students.map(s => `<option value="${s.id}">${s.name} (余 ${s.balance || 0} 课时)</option>`).join('');
            
        const courseOpts = `<option value="" disabled selected>请选择课程</option>` + 
            courses.map(c => `<option value="${c.id}" data-hours="${c.defaultHours}">${c.name}</option>`).join('');
            
        // Setup initial student course dropdown
        const stCourse = document.getElementById('studentCourse');
        if(stCourse) stCourse.innerHTML = `<option value="">不报课</option>` + courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
        // Setup Purchase dropdowns
        const pStudent = document.getElementById('purchaseStudent');
        const pCourse = document.getElementById('purchaseCourse');
        if(pStudent) pStudent.innerHTML = studentOpts;
        if(pCourse) pCourse.innerHTML = courseOpts;
        
        // Setup Signin dropdowns
        const sStudent = document.getElementById('signinStudent');
        const sCourse = document.getElementById('signinCourse');
        if(sStudent) {
            sStudent.innerHTML = studentOpts;
            
            // Listen to student change to auto-fill their enrolled course
            sStudent.addEventListener('change', (e) => {
                const studentId = e.target.value;
                const student = students.find(s => s.id === studentId);
                
                if(student && student.courses && student.courses.length > 0) {
                    // Auto select the first enrolled course
                    const courseId = student.courses[0];
                    if(sCourse.querySelector(`option[value="${courseId}"]`)) {
                        sCourse.value = courseId;
                        // Manually trigger the course change event to update default hours
                        sCourse.dispatchEvent(new Event('change'));
                    }
                }
                
                this.updateSigninPreview();
            });
        }
        
        if(sCourse) {
            sCourse.innerHTML = courseOpts;
            // Listen to course change to auto-fill default hours
            sCourse.addEventListener('change', async (e) => {
                // If the user manually resets to "请选择课程", do nothing special except update preview
                if (!e.target.value) {
                    await this.updateSigninPreview();
                    return;
                }
                
                const selectedOption = e.target.options[e.target.selectedIndex];
                const defaultHours = selectedOption.dataset.hours;
                if(defaultHours) {
                    document.getElementById('signinHours').value = defaultHours;
                    await this.updateSigninPreview();
                }
            });
        }
    },
    
    async updateSigninPreview() {
        const studentId = document.getElementById('signinStudent').value;
        const hoursInput = document.getElementById('signinHours').value;
        const hoursDeducted = Number(hoursInput) || 0;
        
        const balanceEl = document.getElementById('signinPreviewBalance');
        const afterEl = document.getElementById('signinPreviewAfter');
        
        if(studentId) {
            const students = await store.getStudents();
            const student = students.find(s => s.id === studentId);
            if(student) {
                const currentBalance = Number(student.balance) || 0;
                balanceEl.textContent = `${currentBalance} 课时`;
                
                const afterBalance = currentBalance - hoursDeducted;
                afterEl.textContent = `${afterBalance} 课时`;
                afterEl.className = afterBalance < 0 ? 'font-bold text-danger' : 'font-bold text-success';
                return;
            }
        }
        
        balanceEl.textContent = '0 课时';
        afterEl.textContent = '0 课时';
        afterEl.className = 'font-bold';
    }
};

// Auto-init on load
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
