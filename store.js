/**
 * Data Management Layer using Supabase
 */

const SUPABASE_URL = 'https://ubfrulsdwanoowkiwkcf.supabase.co';
const SUPABASE_KEY = 'sb_publishable_LCEmx_UPJWwp61k2nlSh3Q_8qgPDF-8';
// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

class Store {
    constructor() {
        this.currentUser = null;
    }

    // --- Authentication ---
    async getCurrentUser() {
        try {
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
            console.error(e);
        }
        this.currentUser = null;
        return null;
    }

    async registerUser(email, password) {
        try {
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
            
            // If data.session is null, it means email confirmation is required
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
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            if (error) throw error;
            // Fetch session immediately to establish context
            await this.getCurrentUser();
            return { success: true };
        } catch (err) {
            // Translate common auth errors
            let msg = err.message || '登录失败';
            if (msg.includes('Invalid login credentials')) msg = '邮箱或密码错误';
            return { success: false, message: msg };
        }
    }

    async logoutUser() {
        await supabase.auth.signOut();
        this.currentUser = null;
    }

    // --- Students ---
    async getStudents() {
        const { data, error } = await supabase.from('students').select('*').order('created_at', { ascending: false });
        if (error) { console.error('Error fetching students:', error); return []; }
        
        // Map current_courses to courses array to match old API
        return data.map(s => ({
            ...s,
            courses: s.current_courses || []
        }));
    }

    async addStudent(studentData) {
        if (!this.currentUser) return;
        const payload = {
            user_id: this.currentUser.id,
            name: studentData.name,
            phone: studentData.phone,
            balance: studentData.balance || 0,
            current_courses: studentData.courses || []
        };
        const { error, data } = await supabase.from('students').insert([payload]);
        if (error) console.error(error);
    }

    async updateStudent(id, studentData) {
        if (!this.currentUser) return;
        const payload = {
            name: studentData.name,
            phone: studentData.phone
        };
        const { error } = await supabase.from('students').update(payload).eq('id', id);
        if (error) console.error(error);
    }

    async deleteStudent(id) {
        if (!this.currentUser) return;
        const { error } = await supabase.from('students').delete().eq('id', id);
        if (error) console.error(error);
    }

    // --- Courses ---
    async getCourses() {
        const { data, error } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
        if (error) { console.error('Error fetching courses:', error); return []; }
        return data.map(c => ({
            ...c,
            defaultHours: c.default_hours
        }));
    }

    async addCourse(courseData) {
        if (!this.currentUser) return;
        const payload = {
            user_id: this.currentUser.id,
            name: courseData.name,
            default_hours: courseData.defaultHours || 1,
            description: courseData.description || ''
        };
        const { error } = await supabase.from('courses').insert([payload]);
        if (error) console.error(error);
    }

    async updateCourse(id, courseData) {
        if (!this.currentUser) return;
        const payload = {
            name: courseData.name,
            default_hours: courseData.defaultHours || 1,
            description: courseData.description || ''
        };
        const { error } = await supabase.from('courses').update(payload).eq('id', id);
        if (error) console.error(error);
    }

    async deleteCourse(id) {
        if (!this.currentUser) return;
        const { error } = await supabase.from('courses').delete().eq('id', id);
        if (error) console.error(error);
    }

    // --- Purchases ---
    async getPurchases() {
        const { data, error } = await supabase.from('purchases').select('*').order('date', { ascending: false });
        if (error) { console.error('Error fetching purchases:', error); return []; }
        return data.map(p => ({
            ...p,
            studentId: p.student_id,
            courseId: p.course_id,
            hoursBought: p.hours_bought
        }));
    }

    async addPurchase(purchaseData) {
        if (!this.currentUser) return { success: false, message: '未登录' };
        try {
            // Insert Purchase Record
            const payload = {
                user_id: this.currentUser.id,
                student_id: purchaseData.studentId,
                course_id: purchaseData.courseId,
                hours_bought: purchaseData.hoursBought,
                date: purchaseData.date || new Date().toISOString()
            };
            const { error: insertError } = await supabase.from('purchases').insert([payload]);
            if (insertError) throw insertError;

            // Fetch student to update balance
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
        const { data, error } = await supabase.from('signins').select('*').order('date', { ascending: false });
        if (error) { console.error('Error fetching signins:', error); return []; }
        return data.map(s => ({
            ...s,
            studentId: s.student_id,
            courseId: s.course_id,
            hoursDeducted: s.hours_deducted
        }));
    }

    async addSignin(signinData) {
        if (!this.currentUser) return { success: false, message: '未登录' };
        try {
            // Fetch student balance first
            const { data: student } = await supabase.from('students').select('balance').eq('id', signinData.studentId).single();
            if (!student) throw new Error("找不到该学员");
            
            const currentBalance = Number(student.balance);
            if (currentBalance < signinData.hoursDeducted) {
                return { success: false, message: `扣除失败：学员剩余课时不足 (${currentBalance})` };
            }

            // Record Signin
            const payload = {
                user_id: this.currentUser.id,
                student_id: signinData.studentId,
                course_id: signinData.courseId,
                hours_deducted: signinData.hoursDeducted,
                date: signinData.date || new Date().toISOString()
            };
            const { error: insertError } = await supabase.from('signins').insert([payload]);
            if (insertError) throw insertError;

            // Update Balance
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
        // Parallel fetch for speed
        const [students, courses, signins] = await Promise.all([
            this.getStudents(),
            this.getCourses(),
            this.getSignins()
        ]);
        
        const totalStudents = students.length;
        const totalCourses = courses.length;
        const lowBalanceCount = students.filter(s => s.balance <= 3).length;
        
        // Map recent 5 signins with names
        const recentSignins = signins
            .slice(0, 5) // Already sorted descending by getSignins
            .map(s => {
                const st = students.find(x => x.id === s.studentId);
                const cu = courses.find(x => x.id === s.courseId);
                return {
                    ...s,
                    studentName: st ? st.name : '已删除学员',
                    courseName: cu ? cu.name : '已删除课程'
                }
            });
            
        return {
            totalStudents,
            totalCourses,
            lowBalanceCount,
            recentSignins
        };
    }
}

const store = new Store();
