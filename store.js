/**
 * Data Management Layer using Supabase
 */

const SUPABASE_URL = 'https://ubfrulsdwanoowkiwkcf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LCEmx_UPJWwp61k2nlSh3Q_8qgPDF-8';

// Initial state for the supabase client
let supabase;

class Store {
    constructor() {
        this.currentUser = null;
        this.initialized = false;
        this.initSupabase();
    }

    initSupabase() {
        try {
            if (!window.supabase) {
                console.warn('Store: Supabase SDK 未在 window 对象中发现。');
                return;
            }
            supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
            this.initialized = !!supabase;
            console.log('Store: Supabase 客户端初始化成功');
        } catch (e) {
            console.error('Store: Supabase 初始化过程中发生错误:', e);
        }
    }

    checkInitialized() {
        if (!this.initialized) {
            // Re-attempt init if we missed it earlier
            this.initSupabase();
            if (!this.initialized) {
                throw new Error('Supabase 客户端尚未就绪');
            }
        }
    }

    // --- Authentication ---
    async getCurrentUser() {
        try {
            this.checkInitialized();
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (session) {
                this.currentUser = {
                    id: session.user.id,
                    email: session.user.email,
                    username: session.user.user_metadata?.username || session.user.email.split('@')[0]
                };
                return this.currentUser;
            }
        } catch(e) {
            console.error('getCurrentUser Error:', e);
        }
        this.currentUser = null;
        return null;
    }

    async registerUser(email, password) {
        try {
            this.checkInitialized();
            console.log('Starting Supabase signUp for:', email);
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        username: email.split('@')[0]
                    }
                }
            });
            if (error) throw error;
            
            return { 
                success: true, 
                session: data.session,
                user: data.user,
                needsConfirmation: !data.session && data.user
            };
        } catch (err) {
            console.error('Registration error:', err);
            return { success: false, message: err.message || '注册失败' };
        }
    }

    async loginUser(email, password) {
        try {
            this.checkInitialized();
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            if (error) throw error;
            await this.getCurrentUser();
            return { success: true };
        } catch (err) {
            let msg = err.message || '登录失败';
            if (msg.includes('Invalid login credentials')) msg = '邮箱或密码错误';
            return { success: false, message: msg };
        }
    }

    async logoutUser() {
        try {
            this.checkInitialized();
            await supabase.auth.signOut();
        } catch(e) { console.error(e); }
        this.currentUser = null;
    }

    // --- Students ---
    async getStudents() {
        try {
            this.checkInitialized();
            const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(s => ({ ...s, courses: s.current_courses || [] }));
        } catch(e) { console.error(e); return []; }
    }

    async addStudent(studentData) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return;
            const payload = {
                user_id: this.currentUser.id,
                name: studentData.name,
                phone: studentData.phone,
                balance: studentData.balance || 0,
                current_courses: studentData.courses || []
            };
            const { error } = await supabase.from('students').insert([payload]);
            if (error) throw error;
        } catch(e) { console.error(e); }
    }

    async updateStudent(id, studentData) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return;
            const payload = { name: studentData.name, phone: studentData.phone };
            const { error } = await supabase.from('students').update(payload).eq('id', id);
            if (error) throw error;
        } catch(e) { console.error(e); }
    }

    async deleteStudent(id) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return;
            const { error } = await supabase.from('students').delete().eq('id', id);
            if (error) throw error;
        } catch(e) { console.error(e); }
    }

    // --- Courses ---
    async getCourses() {
        try {
            this.checkInitialized();
            const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(c => ({ ...c, defaultHours: c.default_hours }));
        } catch(e) { console.error(e); return []; }
    }

    async addCourse(courseData) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return;
            const payload = {
                user_id: this.currentUser.id,
                name: courseData.name,
                default_hours: courseData.defaultHours || 1,
                description: courseData.description || ''
            };
            const { error } = await supabase.from('courses').insert([payload]);
            if (error) throw error;
        } catch(e) { console.error(e); }
    }

    async updateCourse(id, courseData) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return;
            const payload = {
                name: courseData.name,
                default_hours: courseData.defaultHours || 1,
                description: courseData.description || ''
            };
            const { error } = await supabase.from('courses').update(payload).eq('id', id);
            if (error) throw error;
        } catch(e) { console.error(e); }
    }

    async deleteCourse(id) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return;
            const { error } = await supabase.from('courses').delete().eq('id', id);
            if (error) throw error;
        } catch(e) { console.error(e); }
    }

    // --- Purchases ---
    async getPurchases() {
        try {
            this.checkInitialized();
            const { data, error } = await supabase.from('purchases').select('*').order('date', { ascending: false });
            if (error) throw error;
            return data.map(p => ({
                ...p,
                studentId: p.student_id,
                courseId: p.course_id,
                hoursBought: p.hours_bought
            }));
        } catch(e) { console.error(e); return []; }
    }

    async addPurchase(purchaseData) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return { success: false, message: '未登录' };
            
            const payload = {
                user_id: this.currentUser.id,
                student_id: purchaseData.studentId,
                course_id: purchaseData.courseId,
                hours_bought: purchaseData.hoursBought,
                date: purchaseData.date || new Date().toISOString()
            };
            const { error: insertError } = await supabase.from('purchases').insert([payload]);
            if (insertError) throw insertError;

            const { data: student } = await supabase.from('students').select('balance, current_courses').eq('id', purchaseData.studentId).single();
            if (student) {
                const newBalance = Number(student.balance) + Number(purchaseData.hoursBought);
                let newCourses = student.current_courses || [];
                if (!newCourses.includes(purchaseData.courseId)) {
                    newCourses.push(purchaseData.courseId);
                }
                const { error: upError } = await supabase.from('students').update({
                    balance: newBalance,
                    current_courses: newCourses
                }).eq('id', purchaseData.studentId);
                if (upError) throw upError;
            }
            return { success: true };
        } catch (err) {
            console.error(err);
            return { success: false, message: '充值记录失败' };
        }
    }

    // --- Sign-ins ---
    async getSignins() {
        try {
            this.checkInitialized();
            const { data, error } = await supabase.from('signins').select('*').order('date', { ascending: false });
            if (error) throw error;
            return data.map(s => ({
                ...s,
                studentId: s.student_id,
                courseId: s.course_id,
                hoursDeducted: s.hours_deducted
            }));
        } catch(e) { console.error(e); return []; }
    }

    async addSignin(signinData) {
        try {
            this.checkInitialized();
            if (!this.currentUser) return { success: false, message: '未登录' };
            
            const { data: student } = await supabase.from('students').select('balance').eq('id', signinData.studentId).single();
            if (!student) throw new Error("找不到该学员");
            
            const currentBalance = Number(student.balance);
            if (currentBalance < signinData.hoursDeducted) {
                return { success: false, message: `扣除失败：学员剩余课时不足 (${currentBalance})` };
            }

            const payload = {
                user_id: this.currentUser.id,
                student_id: signinData.studentId,
                course_id: signinData.courseId,
                hours_deducted: signinData.hoursDeducted,
                date: signinData.date || new Date().toISOString()
            };
            const { error: insertError } = await supabase.from('signins').insert([payload]);
            if (insertError) throw insertError;

            const newBalance = currentBalance - signinData.hoursDeducted;
            const { error: upError } = await supabase.from('students').update({ balance: newBalance }).eq('id', signinData.studentId);
            if (upError) throw upError;

            return { success: true, message: '签到成功，已扣减课时' };
        } catch (err) {
            console.error(err);
            return { success: false, message: err.message || '签到失败' };
        }
    }

    // --- Dashboard Stats Derived ---
    async getDashboardStats() {
        try {
            this.checkInitialized();
            const [students, courses, signins] = await Promise.all([
                this.getStudents(),
                this.getCourses(),
                this.getSignins()
            ]);
            
            const totalStudents = students.length;
            const totalCourses = courses.length;
            const lowBalanceCount = students.filter(s => s.balance <= 3).length;
            
            const recentSignins = signins
                .slice(0, 5)
                .map(s => {
                    const st = students.find(x => x.id === s.studentId);
                    const cu = courses.find(x => x.id === s.courseId);
                    return {
                        ...s,
                        studentName: st ? st.name : '已删除学员',
                        courseName: cu ? cu.name : '已删除课程'
                    }
                });
                
            return { totalStudents, totalCourses, lowBalanceCount, recentSignins };
        } catch(e) { console.error(e); return { totalStudents: 0, totalCourses: 0, lowBalanceCount: 0, recentSignins: [] }; }
    }
}

// Global Export
window.store = new Store();
// Keep local constant for script internal use
const store = window.store;
