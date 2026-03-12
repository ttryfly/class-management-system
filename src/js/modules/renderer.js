/**
 * View Rendering Module
 */
import { store } from '../api/store.js';
import { helpers } from '../utils/helpers.js';

export const renderer = {
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
                <td style="color:var(--text-muted)">${helpers.formatDate(s.date)}</td>
            </tr>
        `).join('');
    },
    
    // 2. Students
    async renderStudents(app) {
        const students = await store.getStudents();
        const courses = await store.getCourses();
        const purchases = await store.getPurchases();
        const signins = await store.getSignins();
        const tbody = document.getElementById('table-students');
        
        if (students.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state"><i class="fa-solid fa-users-slash"></i><p>暂无学员数据，点击右上角添加。</p></td></tr>`;
            return;
        }
        
        // Note: Global app reference for event handlers should be handled carefully
        // For now, we'll keep the string-based onclicks but they will need to be fixed
        // as ES modules don't export to global scope by default.
        // Better: Attachment of listeners in JS.
        
        tbody.innerHTML = students.map(s => {
            const balanceClass = Number(s.balance) <= 3 ? 'text-danger font-bold' : 'text-success font-bold';
            
            const enrolledCourseNames = (s.courses || []).map(courseId => {
                const courseInfo = courses.find(c => c.id === courseId);
                return courseInfo ? courseInfo.name : '未知课程';
            });
            const coursesDisplay = enrolledCourseNames.length > 0 ? enrolledCourseNames.join(', ') : '-';
            
            const purchasedItems = purchases
                .filter(p => p.studentId === s.id)
                .reduce((sum, p) => sum + Number(p.hoursBought), 0);
                
            const totalDeducted = signins
                .filter(record => record.studentId === s.id)
                .reduce((sum, record) => sum + Number(record.hoursDeducted), 0);
                
            const totalBought = (Number(s.balance) || 0) + totalDeducted;
            
            return `
            <tr>
                <td class="font-bold">${s.name}</td>
                <td>${s.phone}</td>
                <td>${coursesDisplay}</td>
                <td style="color:var(--secondary)">+${totalBought}</td>
                <td style="color:var(--danger)">-${totalDeducted}</td>
                <td><span class="${balanceClass}">${s.balance || 0}</span> 课时</td>
                <td style="color:var(--text-muted)">${helpers.formatDate(s.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary action-edit-student" data-id="${s.id}">编辑</button>
                    <button class="btn btn-sm btn-secondary action-export-student" data-id="${s.id}">导出</button>
                    <button class="btn btn-sm btn-secondary action-delete-student" data-id="${s.id}" style="color:var(--danger)">删除</button>
                </td>
            </tr>
        `}).join('');
        
        // Attach listeners (replacing inline onclicks)
        tbody.querySelectorAll('.action-edit-student').forEach(btn => {
            btn.onclick = () => app.editStudent(btn.dataset.id);
        });
        tbody.querySelectorAll('.action-export-student').forEach(btn => {
            btn.onclick = () => app.exportStudentHistory(btn.dataset.id);
        });
        tbody.querySelectorAll('.action-delete-student').forEach(btn => {
            btn.onclick = () => app.deleteStudent(btn.dataset.id);
        });
    },
    
    // 3. Courses
    async renderCourses(app) {
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
                <td style="color:var(--text-muted)">${helpers.formatDate(c.createdAt)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary action-edit-course" data-id="${c.id}">编辑</button>
                    <button class="btn btn-sm btn-secondary action-delete-course" data-id="${c.id}" style="color:var(--danger)">删除</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.action-edit-course').forEach(btn => {
            btn.onclick = () => app.editCourse(btn.dataset.id);
        });
        tbody.querySelectorAll('.action-delete-course').forEach(btn => {
            btn.onclick = () => app.deleteCourse(btn.dataset.id);
        });
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
                <td style="color:var(--text-muted)">${helpers.formatDate(p.date)}</td>
            </tr>
            `;
        }).join('');
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
                <td style="color:var(--text-muted)">${helpers.formatDate(s.date)}</td>
            </tr>
            `;
        }).join('');
    }
};
