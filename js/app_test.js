
document.addEventListener('DOMContentLoaded', () => {
    
    const themeToggle = document.getElementById('theme-toggle');
    const htmlElement = document.documentElement;
    const themeIcon = themeToggle.querySelector('i');

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        htmlElement.setAttribute('data-theme', savedTheme);
        updateThemeIcon(savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            htmlElement.setAttribute('data-theme', 'dark');
            updateThemeIcon('dark');
        }
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const currentTheme = htmlElement.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            htmlElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            updateThemeIcon(newTheme);
        });
    }

    function updateThemeIcon(theme) {
        if (!themeIcon) return;
        if (theme === 'dark') {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
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

    const protectedPages = ['dashboard.html', 'profile.html', 'skill-dna.html', 'messages.html', 'notifications.html', 'discover.html', 'matches.html', 'feed.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';

    function checkAuthState() {
        const sessionStr = localStorage.getItem('knexa_session');
        const user = sessionStr ? JSON.parse(sessionStr) : null;
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
                    <button id="logout-btn" class="btn btn-outline">Logout</button>
                `;

                document.getElementById('logout-btn')?.addEventListener('click', () => {
                    localStorage.removeItem('knexa_session');
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
    
    checkAuthState();            
            const themeToggleBtn = document.getElementById('theme-toggle');
            if (themeToggleBtn) {
                themeToggleBtn.addEventListener('click', () => {
                    const htmlElement = document.documentElement;
                    const currentTheme = htmlElement.getAttribute('data-theme');
                    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
                    htmlElement.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);
                    
                    const themeIcon = themeToggleBtn.querySelector('i');
                    if (themeIcon) {
                        if (newTheme === 'dark') {
                            themeIcon.classList.remove('fa-moon');
                            themeIcon.classList.add('fa-sun');
                        } else {
                            themeIcon.classList.remove('fa-sun');
                            themeIcon.classList.add('fa-moon');
                        }
                    }
                });
            }

    
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        let email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

            try {
                let query = supabase.from('profiles').select('*').eq('password', password);
                
                if (!email.includes('@')) {
                    query = query.eq('username', email);
                } else {
                    query = query.eq('email', email);
                }
                
                const { data, error } = await query.single();
                
                if (error || !data) {
                    throw new Error("Invalid login credentials");
                }
                
                localStorage.setItem('knexa_session', JSON.stringify(data));
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
        const username = document.getElementById('signup-username').value;
        const email = document.getElementById('signup-email').value;
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

            const newUserId = crypto.randomUUID();

            const { data: insertedData, error: profileError } = await supabase
                .from('profiles')
                .insert([{
                    id: newUserId,
                    password: password,
                    full_name: name,
                    username: username,
                    email: email,
                    country: country,
                    avatar_url: avatarUrl,
                    bio: '',
                    followers_count: 0,
                    following_count: 0,
                    connections_count: 0,
                    skills_shared_count: 0,
                    skills_learning_count: 0
                }])
                .select()
                .single();

            if (profileError) {
                console.error("Error creating profile:", profileError);
                alert("Account created, but there was an issue saving your profile details.");
            } else {
                localStorage.setItem('knexa_session', JSON.stringify(insertedData));
                alert('Signed up successfully! Welcome to KNEXA.');
                window.location.href = 'dashboard.html';
            }
            
        } catch (error) {
            let msg = 'Error signing up.';
            if (error.message.includes('already registered')) msg = 'This email is already registered.';
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
});
