import { supabase } from './supabase-config.js';

document.addEventListener('DOMContentLoaded', () => {
    
    const htmlElement = document.documentElement;

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
        setTimeout(() => updateThemeIcon(savedTheme), 0);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            htmlElement.setAttribute('data-theme', 'dark');
            setTimeout(() => updateThemeIcon('dark'), 0);
        }
    }

    document.addEventListener('click', (e) => {
        const btn = e.target.closest('#theme-toggle');
        if (btn) {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        }
    });

    function updateThemeIcon(theme) {
        const icon = document.querySelector('#theme-toggle i');
        if (!icon) return;
        if (theme === 'dark') {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        } else {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }

    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('nav-menu');

    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => {
            hamburger.classList.toggle('active');
            navMenu.classList.toggle('active');
        });

        document.querySelectorAll('.nav-links a, .nav-actions a').forEach(link => {
            link.addEventListener('click', () => {
                hamburger.classList.remove('active');
                navMenu.classList.remove('active');
            });
        });
    }

    const navbar = document.querySelector('.navbar');
    
    if (navbar) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        });
    }

    const sections = document.querySelectorAll('section');
    const navLinks = document.querySelectorAll('.nav-links a');

    window.addEventListener('scroll', () => {
        let current = '';
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.clientHeight;
            if (pageYOffset >= (sectionTop - 200)) {
                current = section.getAttribute('id');
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === `#${current}`) {
                link.classList.add('active');
            }
        });
    });

    const reveals = document.querySelectorAll('.reveal');

    function reveal() {
        const windowHeight = window.innerHeight;
        const elementVisible = 150;

        reveals.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            
            if (elementTop < windowHeight - elementVisible) {
                element.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', reveal);
    
    reveal();

    const searchInput = document.querySelector('.search-input');
    const searchBtn = document.querySelector('.search-btn');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (searchInput.value.trim() !== '') {
                searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                setTimeout(() => {
                    searchBtn.innerHTML = 'Search';
                    searchInput.value = '';
                    console.log('Search triggered');
                }, 1000);
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                searchBtn.click();
            }
        });
    }

    const protectedPages = ['dashboard.html', 'profile.html', 'skill-dna.html', 'messages.html', 'notifications.html', 'discover.html', 'matches.html', 'feed.html', 'communities.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    async function checkAuthState() {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user || null;
        const navActions = document.querySelector('.nav-actions');

        if (user) {
            console.log('User is logged in:', user.email);
            
            if (currentPage === 'login.html' || currentPage === 'signup.html') {
                window.location.href = 'dashboard.html';
            }

            if (navActions) {
                const themeBtn = navActions.querySelector('#theme-toggle')?.outerHTML || '';
                navActions.innerHTML = `
                    ${themeBtn}
                    <a href="messages.html" class="btn btn-outline" style="border:none; padding: 0.5rem; position:relative;" title="Messages">
                        <i class="fas fa-envelope"></i>
                        <span id="nav-msg-badge" style="display:none; position:absolute; top:2px; right:2px; width:10px; height:10px; background-color:#ef4444; border-radius:50%; border:2px solid var(--color-bg-main);"></span>
                    </a>
                    <a href="profile.html" class="btn btn-primary" style="padding: 0.5rem 1rem;">Profile</a>
                    <button id="logout-btn" class="btn btn-outline" style="margin-left: 0.5rem;">Logout</button>
                `;

                checkUnreadMessages(user.id);

                document.getElementById('logout-btn')?.addEventListener('click', async () => {
                    await supabase.auth.signOut();
                    window.location.href = 'index.html';
                });
            }
        } else {
            console.log('User is logged out.');
            
            if (protectedPages.includes(currentPage)) {
                window.location.href = 'login.html';
            }

            if (navActions && currentPage === 'index.html') {
                const themeBtn = navActions.querySelector('#theme-toggle')?.outerHTML || '';
                navActions.innerHTML = `
                    ${themeBtn}
                    <a href="login.html" class="btn btn-outline">Log In</a>
                    <a href="signup.html" class="btn btn-primary">Sign Up</a>
                `;
            }
            
            document.querySelectorAll('a').forEach(link => {
                const href = link.getAttribute('href');
                if (href) {
                    const targetPage = href.split('/').pop().split('?')[0].split('#')[0];
                    if (protectedPages.includes(targetPage)) {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            window.location.href = 'login.html';
                        });
                    }
                }
            });
        }
    }
    
    async function checkUnreadMessages(userId) {
        const lastChecked = localStorage.getItem('last_messages_check') || '2000-01-01T00:00:00Z';
        try {
            const { data, error } = await supabase
                .from('messages')
                .select('id')
                .eq('receiver_id', userId)
                .gt('created_at', lastChecked)
                .limit(1);
            
            if (data && data.length > 0) {
                const badge = document.getElementById('nav-msg-badge');
                if (badge) badge.style.display = 'block';
            }
        } catch (e) {
            console.error("Error checking unread messages:", e);
        }
    }

    checkAuthState();

    
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

            try {
                if (!email.includes('@')) {
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles').select('email').eq('username', email).single();
                    if (profileError || !profile?.email) throw new Error('Invalid login credentials');
                    email = profile.email;
                }

                const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error || !authData.user) throw new Error('Invalid login credentials');
                window.location.href = 'dashboard.html';
            } catch (error) {
                let msg = 'Error logging in.';
                if (error.message.includes('Invalid login credentials')) msg = 'Incorrect email/username or password.';
                alert(msg);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
    });

    document.getElementById('forgot-password-link')?.addEventListener('click', async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById('login-email').value;
        if (!emailInput) {
            alert('Please enter your email address in the field first.');
            return;
        }
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(emailInput);
            if (error) throw error;
            alert('Password reset email sent! Please check your inbox.');
        } catch (error) {
            alert('Error sending reset email: ' + error.message);
        }
    });

    document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('signup-name').value;
        const username = document.getElementById('signup-username').value.trim();
        const email = document.getElementById('signup-email').value.trim().toLowerCase();
        const country = document.getElementById('signup-country').value;
        const gender = document.getElementById('signup-gender').value;
        const password = document.getElementById('signup-password').value;
        const confirmPassword = document.getElementById('signup-confirm-password').value;
        
        if (password !== confirmPassword) {
            alert('Passwords do not match. Please try again.');
            return;
        }
        if (password.length < 6) {
            alert('Password must be at least 6 characters long.');
            return;
        }

        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;

        try {
            let avatarUrl = '';

            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: { data: { full_name: name, username, country, gender } }
            });
            if (authError || !authData.user) throw authError || new Error('Unable to create account');

            if (authData.session) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert({
                    id: authData.user.id,
                    full_name: name,
                    username: username,
                    email: email,
                    country: country,
                    gender: gender,
                    avatar_url: avatarUrl,
                    bio: '',
                    followers_count: 0,
                    following_count: 0,
                    connections_count: 0,
                    skills_shared_count: 0,
                    skills_learning_count: 0
                }, { onConflict: 'id' });

            if (profileError) {
                console.error("Error creating profile:", profileError);
                throw profileError;
            } else {
                alert('Signed up successfully! Welcome to KNEXA.');
                window.location.href = 'dashboard.html';
            }
            } else {
                alert('Account created. Please confirm your email, then log in.');
                window.location.href = 'login.html';
            }
        } catch (error) {
            console.error('[KNEXA SIGNUP ERROR]', error);
            const errorMessage = error?.message || 'Unknown Supabase error';
            let msg = errorMessage;
            if (/already registered|already exists/i.test(errorMessage)) msg = 'This email is already registered.';
            if (/breached|leaked|compromised/i.test(errorMessage)) msg = 'Choose a new password that has not been used on another website.';
            if (/signups? not allowed|email signups are disabled/i.test(errorMessage)) msg = 'Email signup is disabled in Supabase. Enable Email under Authentication > Providers.';
            if (/rate limit|too many requests|email.*limit/i.test(errorMessage)) msg = 'Supabase email rate limit reached. Wait before trying again, use a different test email, or configure custom SMTP for larger testing.';
            if (/username/i.test(errorMessage) && /duplicate|unique|already exists/i.test(errorMessage)) msg = 'This username is already taken.';
            alert(msg);
        } finally {
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }
    });

    async function loadTrendingSkills() {
        const skillsGrid = document.querySelector('.skills-grid');
        if (!skillsGrid) return;

        try {
            console.log("Fetching trending skills from Supabase...");
            const { data: allLearning, error } = await supabase
                .from('skills_learning')
                .select('skill_name, category');
            
            if (error) {
                console.warn("Could not fetch data from Supabase:", error.message);
                return;
            }

            if (allLearning && allLearning.length > 0) {
                const skillCounts = {};
                allLearning.forEach(skill => {
                    const name = skill.skill_name.trim();
                    if (!skillCounts[name]) {
                        skillCounts[name] = { count: 0, category: skill.category || 'General' };
                    }
                    skillCounts[name].count++;
                });

                const sortedSkills = Object.keys(skillCounts)
                    .map(name => ({
                        skill_name: name,
                        category: skillCounts[name].category,
                        learner_count: skillCounts[name].count
                    }))
                    .sort((a, b) => b.learner_count - a.learner_count)
                    .slice(0, 6);

                skillsGrid.innerHTML = '';
                
                const getIconForCategory = (category) => {
                    const cat = category ? category.toLowerCase() : '';
                    if (cat.includes('program')) return 'fas fa-code';
                    if (cat.includes('design')) return 'fas fa-pen-nib';
                    if (cat.includes('photo') || cat.includes('video')) return 'fas fa-camera';
                    if (cat.includes('market')) return 'fas fa-bullhorn';
                    if (cat.includes('speak') || cat.includes('commun')) return 'fas fa-microphone';
                    return 'fas fa-star';
                };

                sortedSkills.forEach((skill, index) => {
                    const delayClass = index === 0 ? '' : `reveal-delay-${index}`;
                    const card = document.createElement('div');
                    card.className = `skill-card reveal active ${delayClass}`;
                    card.innerHTML = `
                        <div class="skill-header">
                            <span class="skill-category">${skill.category}</span>
                            <i class="${getIconForCategory(skill.category)} skill-icon"></i>
                        </div>
                        <h3>${skill.skill_name}</h3>
                        <div class="skill-stats">
                            <span><i class="fas fa-users"></i> ${skill.learner_count} learners</span>
                            <span class="trend up"><i class="fas fa-arrow-up"></i> Trending</span>
                        </div>
                    `;
                    skillsGrid.appendChild(card);
                });
            } else {
                console.log("No skills found in database. Using static content.");
            }
        } catch (error) {
            console.warn("Unexpected error connecting to Supabase:", error);
        }
    }

    loadTrendingSkills();
    
    async function setupNotifications() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        
        function isElementVisible(el) {
            if (!el) return false;
            const rect = el.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
                rect.right <= (window.innerWidth || document.documentElement.clientWidth)
            );
        }

        function showNotification(msg, actions = null, requesterId = null) {
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
                document.body.appendChild(toastContainer);
            }
            
            const toast = document.createElement('div');
            toast.style.cssText = 'background: var(--color-primary); color: white; padding: 1rem 1.5rem; border-radius: var(--border-radius-md); box-shadow: var(--shadow-lg); animation: slideInRight 0.3s ease-out; font-weight: 500; display: flex; flex-direction: column; gap: 0.5rem;';
            
            let html = `<div><i class="fas fa-bell" style="margin-right: 0.5rem;"></i> ${msg}</div>`;
            if (actions) {
                html += `<div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">`;
                actions.forEach(action => {
                    const idAttr = action.id ? `id="${action.id}"` : '';
                    const style = `background: ${action.bg || 'rgba(255,255,255,0.2)'}; color: white; border: none; padding: 0.25rem 0.75rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem;`;
                    html += `<button ${idAttr} onclick="${action.onClick}" style="${style}">${action.label}</button>`;
                });
                html += `</div>`;
            }
            
            toast.innerHTML = html;
            
            if (!actions) {
                toast.style.cursor = 'pointer';
                toast.onclick = () => { window.location.href = 'discover.html'; }; 
            }
            
            toastContainer.appendChild(toast);
            
            let scrollHandler = null;
            if (requesterId && window.location.pathname.includes('discover.html')) {
                const reviewBtnId = `review-btn-${requesterId}`;
                const cardId = `user-card-${requesterId}`;
                
                const updateVisibility = () => {
                    const btn = document.getElementById(reviewBtnId);
                    const card = document.getElementById(cardId);
                    if (btn) {
                        if (card && isElementVisible(card)) {
                            btn.style.display = 'none';
                        } else {
                            btn.style.display = 'block';
                        }
                    }
                };
                
                updateVisibility();
                scrollHandler = updateVisibility;
                window.addEventListener('scroll', scrollHandler);
            }

            setTimeout(() => {
                if(document.body.contains(toast)) {
                    toast.style.opacity = '0';
                    toast.style.transition = 'opacity 0.3s ease-out';
                    setTimeout(() => {
                        toast.remove();
                        if (scrollHandler) window.removeEventListener('scroll', scrollHandler);
                    }, 300);
                }
            }, 8000);
        }

        window.respondToConnectionToast = async (id, status, btnElement) => {
            if (btnElement) {
                const toast = btnElement.closest('div') ? btnElement.closest('div').parentElement : null;
                if (toast) toast.remove();
            }
            if (status === 'rejected') {
                await supabase.from('connections').delete().eq('id', id);
            } else {
                await supabase.from('connections').update({ status }).eq('id', id);
            }
        };

        const { count, error } = await supabase.from('connections').select('*', { count: 'exact', head: true })
            .eq('receiver_id', user.id).eq('status', 'pending');
            
        if (!error && count && count > 0) {
            showNotification(`You have ${count} pending connection request(s)!`);
        }

        supabase.channel('public:connections')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'connections', filter: `receiver_id=eq.${user.id}` }, payload => {
                const connId = payload.new.id;
                const reqId = payload.new.requester_id;
                showNotification('You received a new connection request!', [
                    { label: 'Accept', bg: '#10b981', onClick: `window.respondToConnectionToast('${connId}', 'accepted', this)` },
                    { label: 'Decline', bg: '#ef4444', onClick: `window.respondToConnectionToast('${connId}', 'rejected', this)` },
                    { id: `review-btn-${reqId}`, label: 'Review', bg: '#3b82f6', onClick: `window.location.href='discover.html?reviewId=${reqId}'` }
                ], reqId);
            })
            .subscribe();
    }
    
    setupNotifications();
});
