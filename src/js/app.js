/**
 * Application Controller (ES Module)
 */
import { store } from './api/store.js';
import { helpers } from './utils/helpers.js';
import { auth } from './modules/auth.js';
import { ui } from './modules/ui.js';
import { renderer } from './modules/renderer.js';

const app = {
    currentView: 'dashboard',
    ui: ui,
    auth: auth,
    
    // Initialize application
    async init() {
        ui.setupNavigation(this);
        helpers.setupTimeDisplay('currentTime');
        
        // Prevent form default submissions
        document.querySelectorAll('form').forEach(form => {
            form.addEventListener('submit', (e) => e.preventDefault());
        });

        // Check Authentication first
        await auth.checkAuth(this);
        
        // Diagnostic: Check Supabase Connection
        this.testConnection();
        
        // Global access for UI simple calls (optional but helps compatibility)
        window.app = this;
    },

    async testConnection() {
        console.log('%c[Supabase 诊断]', 'color: #3ecf8e; font-weight: bold;', '正在检查连接...');
        try {
            const user = await store.getCurrentUser();
            console.log('%c[Supabase 诊断]', 'color: #3ecf8e; font-weight: bold;', '连接正常。当前状态:', user ? '已登录' : '未登录');
        } catch (e) {
            console.error('%c[Supabase 诊断]', 'color: #ff4d4f; font-weight: bold;', '连接检测失败:', e.message);
        }
    },
    
    // Proxy methods for UI events that still use inline handlers or are called from modules
    openModal(id) { ui.openModal(id, this); },
    closeModal(id) { ui.closeModal(id); },
    switchView(viewId) { ui.switchView(viewId, this); },
    login() { auth.login(this); },
    register() { auth.register(this); },
    logout() { auth.logout(this); },
    toggleAuthMode(mode) { auth.toggleAuthMode(mode); },

    // Data Actions
    async loadInitialData() {
        await this.refreshViewData(this.currentView);
        await this.updateDropdowns();
    },

    async refreshViewData(viewId) {
        switch(viewId) {
            case 'dashboard': await renderer.renderDashboard(); break;
            case 'students': await renderer.renderStudents(this); break;
            case 'courses': await renderer.renderCourses(this); break;
            case 'purchases': await renderer.renderPurchases(); break;
            case 'signins': await renderer.renderSignins(); break;
        }
    },

    // --- Action Handlers ---
    async saveStudent() {
        const id = document.getElementById('studentId').value;
        const name = document.getElementById('studentName').value.trim();
        const phone = document.getElementById('studentPhone').value.trim();
        const balance = document.getElementById('studentBalance').value;
        const initialCourse = document.getElementById('studentCourse').value;
        
        if(!name || !phone) {
            helpers.showToast('请填写完整必填信息', 'error');
            return;
        }
        
        if (id) {
            await store.updateStudent(id, { name, phone });
            helpers.showToast('学员信息更新成功');
        } else {
            const newStudentData = { name, phone, balance: Number(balance) || 0 };
            if (initialCourse) {
                newStudentData.courses = [initialCourse];
            }
            await store.addStudent(newStudentData);
            helpers.showToast('新学员添加成功');
        }
        
        ui.closeModal('studentModal');
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
            
            document.getElementById('studentBalanceGroup').style.display = 'none';
            document.getElementById('studentCourseGroup').style.display = 'none';
            document.getElementById('studentModalTitle').textContent = '编辑学员';
            
            ui.openModal('studentModal', this);
            
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
        }
    },
    
    async deleteStudent(id) {
        if(confirm('确定要删除此学员吗？此操作不可逆。')) {
            await store.deleteStudent(id);
            helpers.showToast('学员已删除');
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

        records.sort((a, b) => new Date(b.date) - new Date(a.date));

        let csvContent = '\uFEFF'; 
        csvContent += `"学员档案：","${student.name}"\n`;
        csvContent += `"联系电话：","${student.phone || '-'}"\n`;
        csvContent += `"当前剩余课时：","${student.balance || 0} 课时"\n`;
        const nowStr = helpers.formatDate(new Date().toISOString());
        csvContent += `"导出时间：","${nowStr}"\n\n`;
        csvContent += '"记录类型","涉及课程","变动情况","发生时间"\n';
        
        records.forEach(r => {
            const dateStr = helpers.formatDate(r.date);
            const safeCourse = `"${r.courseName.replace(/"/g, '""')}"`;
            csvContent += `"${r.type}",${safeCourse},"${r.change}","${dateStr}"\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `${student.name}_课时记录.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        helpers.showToast(`已导出 ${student.name} 的课时记录`);
    },

    async saveCourse() {
        const id = document.getElementById('courseId').value;
        const name = document.getElementById('courseName').value.trim();
        const hours = document.getElementById('courseHours').value;
        const defaultHours = Number(hours) || 1;
        const description = document.getElementById('courseDesc').value.trim();
        
        if(!name) {
            helpers.showToast('请填写课程名称', 'error');
            return;
        }
        
        if (id) {
            await store.updateCourse(id, { name, defaultHours, description });
            helpers.showToast('课程信息更新成功');
        } else {
            await store.addCourse({ name, defaultHours, description });
            helpers.showToast('新课程添加成功');
        }
        
        ui.closeModal('courseModal');
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
            ui.openModal('courseModal', this);
        }
    },

    async deleteCourse(id) {
        if(confirm('确定要删除此课程吗？')) {
            await store.deleteCourse(id);
            helpers.showToast('课程已删除');
            await this.refreshViewData('courses');
            await this.updateDropdowns();
        }
    },

    async savePurchase() {
        const studentId = document.getElementById('purchaseStudent').value;
        const courseId = document.getElementById('purchaseCourse').value;
        const hoursBought = Number(document.getElementById('purchaseHours').value);
        
        if(!studentId || !courseId || hoursBought <= 0) {
            helpers.showToast('请完整填写充值信息', 'error');
            return;
        }
        
        const result = await store.addPurchase({ studentId, courseId, hoursBought });
        if (result.success) {
            helpers.showToast(`充值成功，已增加 ${hoursBought} 课时`);
            ui.closeModal('purchaseModal');
            await this.refreshViewData('purchases');
        } else {
            helpers.showToast(result.message, 'error');
        }
    },

    async saveSignin() {
        const studentId = document.getElementById('signinStudent').value;
        const courseId = document.getElementById('signinCourse').value;
        const hoursDeducted = Number(document.getElementById('signinHours').value);
        
        if(!studentId || !courseId || hoursDeducted <= 0) {
            helpers.showToast('请完整填写签到信息', 'error');
            return;
        }
        
        const btn = document.querySelector('#signinModal .btn-danger');
        btn.textContent = '签到中...';
        btn.disabled = true;

        const result = await store.addSignin({ studentId, courseId, hoursDeducted });
        
        if(result.success) {
            helpers.showToast(result.message);
            ui.closeModal('signinModal');
            await this.refreshViewData('signins');
        } else {
            helpers.showToast(result.message, 'error');
        }
        
        btn.textContent = '确认扣除并签到';
        btn.disabled = false;
    },

    // UI Dropdowns Update
    async updateDropdowns() {
        const students = await store.getStudents();
        const courses = await store.getCourses();
        
        const studentOpts = `<option value="" disabled selected>请选择学员</option>` + 
            students.map(s => `<option value="${s.id}">${s.name} (余 ${s.balance || 0} 课时)</option>`).join('');
            
        const courseOpts = `<option value="" disabled selected>请选择课程</option>` + 
            courses.map(c => `<option value="${c.id}" data-hours="${c.defaultHours}">${c.name}</option>`).join('');
            
        const stCourse = document.getElementById('studentCourse');
        if(stCourse) stCourse.innerHTML = `<option value="">不报课</option>` + courses.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
            
        const pStudent = document.getElementById('purchaseStudent');
        const pCourse = document.getElementById('purchaseCourse');
        if(pStudent) pStudent.innerHTML = studentOpts;
        if(pCourse) pCourse.innerHTML = courseOpts;
        
        const sStudent = document.getElementById('signinStudent');
        const sCourse = document.getElementById('signinCourse');
        if(sStudent) {
            sStudent.innerHTML = studentOpts;
            sStudent.onchange = (e) => {
                const studentId = e.target.value;
                const student = students.find(s => s.id === studentId);
                if(student && student.courses && student.courses.length > 0) {
                    const courseId = student.courses[0];
                    if(sCourse.querySelector(`option[value="${courseId}"]`)) {
                        sCourse.value = courseId;
                        sCourse.dispatchEvent(new Event('change'));
                    }
                }
                this.updateSigninPreview();
            };
        }
        
        if(sCourse) {
            sCourse.innerHTML = courseOpts;
            sCourse.onchange = async (e) => {
                const selectedOption = e.target.options[e.target.selectedIndex];
                const defaultHours = selectedOption.dataset.hours;
                if(defaultHours) {
                    document.getElementById('signinHours').value = defaultHours;
                    await this.updateSigninPreview();
                }
            };
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

export default app;
