/**
 * Portfolio frontend backed by secured ASP.NET APIs.
 */

'use strict';

let state = {
  data: null,
  isAdmin: false,
  username: '',
  csrfToken: '',
  currentPage: 'home'
};

document.addEventListener('DOMContentLoaded', boot);

async function boot() {
  try {
    await refreshCsrfToken();
    await loadState();
    bindNav();
    bindAdmin();
    bindScroll();
    renderAll();
    updateAdminUi();
    navigateTo('home', false);
  } catch (error) {
    console.error(error);
    setAdminStatus('The site could not load server data. Check the backend and refresh.', 'error');
  }
}

async function loadState() {
  const [content, auth] = await Promise.all([
    apiGet('/api/content'),
    apiGet('/api/auth/me')
  ]);

  state.data = normalizeData(content);
  state.isAdmin = Boolean(auth.authenticated);
  state.username = auth.username || '';
}

function normalizeData(data) {
  const content = data || {};
  content.profile = content.profile || {};
  content.sections = content.sections || {};
  content.education = Array.isArray(content.education) ? content.education : [];
  content.experience = Array.isArray(content.experience) ? content.experience : [];
  content.skills = Array.isArray(content.skills) ? content.skills : [];
  content.certifications = Array.isArray(content.certifications) ? content.certifications : [];
  content.projects = Array.isArray(content.projects) ? content.projects : [];

  content.profile.highlights = Array.isArray(content.profile.highlights) ? content.profile.highlights : [];
  content.profile.about = Array.isArray(content.profile.about) ? content.profile.about : [];
  content.profile.heroTag = content.profile.heroTag || 'Networking & Cybersecurity';
  content.profile.title = content.profile.title || 'IT Analyst & Networking / Cybersecurity Student';
  content.profile.subtitle = content.profile.subtitle || 'Passionate about building secure, reliable infrastructure and solving complex technical challenges.';
  content.profile.contactIntro = content.profile.contactIntro || "I'm currently open to new opportunities in IT, networking, and cybersecurity. Whether you have a role to discuss or just want to connect, feel free to reach out.";
  content.profile.status = content.profile.status || 'Open to Opportunities';
  content.profile.resumeUrl = content.profile.resumeUrl || '';
  content.profile.resumeFileName = content.profile.resumeFileName || '';
  content.profile.photoUrl = content.profile.photoUrl || '';
  content.profile.photoFileName = content.profile.photoFileName || '';

  content.sections.aboutLabel = content.sections.aboutLabel || 'Who I Am';
  content.sections.aboutTitle = content.sections.aboutTitle || 'About Me';
  content.sections.experienceLabel = content.sections.experienceLabel || 'Career';
  content.sections.experienceTitle = content.sections.experienceTitle || 'Experience';
  content.sections.skillsLabel = content.sections.skillsLabel || 'Expertise';
  content.sections.skillsTitle = content.sections.skillsTitle || 'Skills';
  content.sections.projectsLabel = content.sections.projectsLabel || 'My Work';
  content.sections.projectsTitle = content.sections.projectsTitle || 'Projects';
  content.sections.contactLabel = content.sections.contactLabel || "Let's Connect";
  content.sections.contactTitle = content.sections.contactTitle || 'Contact';
  content.sections.certLabel = content.sections.certLabel || 'Credentials';
  content.sections.certTitle = content.sections.certTitle || 'Certifications';

  if (!content.education.length) {
    content.education = [{ institution: '', degree: '', period: '' }];
  }

  return content;
}

function bindNav() {
  document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', () => navigateTo(link.dataset.page));
  });
}

function bindScroll() {
  window.addEventListener('scroll', () => {
    const nav = document.querySelector('nav');
    if (nav) nav.classList.toggle('scrolled', window.scrollY > 20);
  }, { passive: true });
}

function bindAdmin() {
  const adminBtn = document.getElementById('adminBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const overlay = document.getElementById('loginModal');
  const passInput = document.getElementById('loginPass');
  const userInput = document.getElementById('loginUser');
  const skillInput = document.getElementById('newSkillInput');

  if (adminBtn) {
    adminBtn.addEventListener('click', () => {
      if (state.isAdmin) {
        navigateTo('admin');
      } else {
        openModal();
      }
    });
  }

  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  if (overlay) {
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeModal();
    });
  }

  if (passInput) {
    passInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') doLogin();
    });
  }

  if (userInput) {
    userInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') doLogin();
    });
  }

  if (skillInput) {
    skillInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') addSkill();
    });
  }

  bindFileDropzone('resumeDropzone', 'resumeFileInput', handleResumeUpload);
  bindFileDropzone('photoDropzone', 'photoFileInput', handlePhotoUpload);
}

function bindFileDropzone(dropzoneId, inputId, handler) {
  const dropzone = document.getElementById(dropzoneId);
  const input = document.getElementById(inputId);
  if (!dropzone || !input) return;

  dropzone.addEventListener('click', () => {
    if (requireAdmin()) input.click();
  });

  dropzone.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && requireAdmin()) {
      event.preventDefault();
      input.click();
    }
  });

  dropzone.addEventListener('dragover', event => {
    if (!state.isAdmin) return;
    event.preventDefault();
    dropzone.classList.add('drag-over');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('drag-over');
  });

  dropzone.addEventListener('drop', async event => {
    if (!requireAdmin()) return;
    event.preventDefault();
    dropzone.classList.remove('drag-over');
    const file = event.dataTransfer && event.dataTransfer.files ? event.dataTransfer.files[0] : null;
    if (file) await handler(file);
  });

  input.addEventListener('change', async event => {
    const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
    if (file) await handler(file);
    input.value = '';
  });
}

function navigateTo(id, animate = true) {
  if (id === 'admin' && !state.isAdmin) {
    openModal();
    return;
  }

  if (id === state.currentPage && animate) return;
  state.currentPage = id;

  document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(link => link.classList.remove('active'));

  const page = document.getElementById(id);
  const navLink = document.querySelector(`.nav-links a[data-page="${id}"]`);

  if (page) page.classList.add('active');
  if (navLink) navLink.classList.add('active');

  setTimeout(() => {
    if (page) {
      page.querySelectorAll('.fade-in').forEach(el => el.classList.add('visible'));
    }
  }, 60);

  renderPage(id);
}

function renderAll() {
  renderHome();
  renderAbout();
  renderSkills();
  renderProjects();
  renderContact();
  renderAdminPanel();
}

function renderPage(id) {
  if (id === 'skills') renderSkills();
  if (id === 'projects') renderProjects();
  if (id === 'admin') renderAdminPanel();
}

function renderHome() {
  const profile = state.data.profile;
  setEl('heroTag', profile.heroTag);

  const heroName = document.getElementById('heroName');
  if (heroName) heroName.innerHTML = formatHeroName(profile.name);

  setEl('heroSub', profile.subtitle);

  const highlights = document.getElementById('heroHighlights');
  if (highlights) {
    highlights.innerHTML = profile.highlights.map(item => `
      <div class="hero-highlight-card">
        <strong>${escHtml(item.title || '')}</strong>
        <span>${escHtml(item.text || '')}</span>
      </div>
    `).join('');
  }
}

function renderAbout() {
  const { profile, education, experience, sections } = state.data;
  setEl('aboutSectionLabel', sections.aboutLabel);
  setEl('aboutSectionTitle', sections.aboutTitle);
  setEl('experienceSectionLabel', sections.experienceLabel);
  setEl('experienceSectionTitle', sections.experienceTitle);

  const aboutText = document.getElementById('aboutText');
  if (aboutText) {
    aboutText.innerHTML = profile.about.map(text => `<p>${escHtml(text)}</p>`).join('');
  }

  setEl('detailLocation', profile.location);
  setEl('detailEmail', profile.email);
  setEl('detailPhone', profile.phone);
  setEl('detailStatus', profile.status);

  const avatar = document.getElementById('aboutAvatar');
  if (avatar) {
    avatar.innerHTML = profile.photoUrl
      ? `<img src="${escAttr(profile.photoUrl)}" alt="${escAttr(profile.name || 'Profile photo')}">`
      : escHtml(getInitials(profile.name));
  }

  const edu = education[0] || {};
  const eduBlock = document.getElementById('eduBlock');
  if (eduBlock) {
    eduBlock.innerHTML = `
      <h4>${escHtml(edu.institution || '')}</h4>
      <p class="edu-degree">${escHtml(edu.degree || '')}</p>
      <p class="edu-period">${escHtml(edu.period || '')}</p>
    `;
  }

  const expList = document.getElementById('expList');
  if (expList) {
    expList.innerHTML = experience.map(item => `
      <div class="exp-item">
        <div class="exp-header">
          <div>
            <div class="exp-title">${escHtml(item.title || '')}</div>
            <div class="exp-company">${escHtml(item.company || '')} - ${escHtml(item.location || '')}</div>
          </div>
          <span class="exp-date">${escHtml(item.period || '')}</span>
        </div>
        <ul class="exp-bullets">
          ${(item.bullets || []).map(bullet => `<li>${escHtml(bullet)}</li>`).join('')}
        </ul>
      </div>
    `).join('');
  }
}

function renderSkills() {
  const { skills, certifications, sections } = state.data;
  setEl('skillsSectionLabel', sections.skillsLabel);
  setEl('skillsSectionTitle', sections.skillsTitle);
  setEl('certSectionLabel', sections.certLabel);
  setEl('certSectionTitle', sections.certTitle);

  const grid = document.getElementById('skillsGrid');
  if (grid) {
    grid.innerHTML = skills.map((skill, index) => `
      <div class="skill-chip">
        <span class="skill-label">${escHtml(skill)}</span>
        <button class="skill-remove" onclick="removeSkill(${index})" aria-label="Remove skill">x</button>
      </div>
    `).join('');
  }

  const certGrid = document.getElementById('certificationsGrid');
  if (certGrid) {
    certGrid.innerHTML = certifications.map(cert => `
      <div class="cert-card">
        <p class="cert-name">${escHtml(cert.name || '')}</p>
        <p class="cert-meta">${escHtml(cert.issuer || '')}${cert.date ? ` · ${escHtml(cert.date)}` : ''}</p>
        ${cert.url ? `<a class="project-link" href="${escAttr(cert.url)}" target="_blank" rel="noopener noreferrer">View Credential</a>` : ''}
      </div>
    `).join('');
  }
}

function renderProjects() {
  const { projects, sections } = state.data;
  setEl('projectsSectionLabel', sections.projectsLabel);
  setEl('projectsSectionTitle', sections.projectsTitle);

  const grid = document.getElementById('projectsGrid');
  if (!grid) return;

  grid.innerHTML = projects.map((project, index) => `
    <div class="project-card">
      <button class="project-remove btn-danger" onclick="removeProject(${index})">Remove</button>
      <span class="project-tag">${escHtml(project.tag || '')}</span>
      <h3>${escHtml(project.title || '')}</h3>
      <p>${escHtml(project.desc || '')}</p>
      ${project.url ? `<div class="project-actions"><a class="project-link" href="${escAttr(project.url)}" target="_blank" rel="noopener noreferrer">View Project</a></div>` : ''}
    </div>
  `).join('');
}

function renderContact() {
  const { profile, sections } = state.data;
  setEl('contactSectionLabel', sections.contactLabel);
  setEl('contactSectionTitle', sections.contactTitle);
  setEl('contactEmail', profile.email);
  setEl('contactPhone', profile.phone);
  setEl('contactLocation', profile.location);
  setEl('contactIntroText', profile.contactIntro);
  setEl('resumeUrlDisplay', profile.resumeFileName ? `Uploaded: ${profile.resumeFileName}` : 'No resume uploaded yet.');
  setEl('liName', profile.name);
  setEl('liHeadline', profile.title);

  const liBtn = document.getElementById('liBtn');
  if (liBtn) liBtn.href = profile.linkedin || '#';
}

function renderAdminPanel() {
  setAdminStatus(state.isAdmin ? `Signed in as ${state.username}.` : 'Sign in to edit this portfolio securely on the server.');

  toggleAdminInputs(state.isAdmin);

  const { profile, sections, education, skills, certifications, projects, experience } = state.data;
  setInputValue('adminAboutLabel', sections.aboutLabel);
  setInputValue('adminAboutTitle', sections.aboutTitle);
  setInputValue('adminExperienceLabel', sections.experienceLabel);
  setInputValue('adminExperienceTitle', sections.experienceTitle);
  setInputValue('adminSkillsLabel', sections.skillsLabel);
  setInputValue('adminSkillsTitle', sections.skillsTitle);
  setInputValue('adminProjectsLabel', sections.projectsLabel);
  setInputValue('adminProjectsTitle', sections.projectsTitle);
  setInputValue('adminContactLabel', sections.contactLabel);
  setInputValue('adminContactTitle', sections.contactTitle);
  setInputValue('adminCertLabel', sections.certLabel);
  setInputValue('adminCertTitle', sections.certTitle);

  setInputValue('adminName', profile.name);
  setInputValue('adminHeroTag', profile.heroTag);
  setInputValue('adminTitle', profile.title);
  setInputValue('adminSubtitle', profile.subtitle);
  setInputValue('adminStatusText', profile.status);
  setInputValue('adminHighlights', profile.highlights.map(item => `${item.title} | ${item.text}`).join('\n'));
  setInputValue('adminAbout', profile.about.join('\n\n'));
  setInputValue('adminContactIntro', profile.contactIntro);
  setInputValue('adminEmail', profile.email);
  setInputValue('adminPhone', profile.phone);
  setInputValue('adminLocation', profile.location);
  setInputValue('adminLinkedin', profile.linkedin);

  const edu = education[0] || {};
  setInputValue('adminEduInstitution', edu.institution || '');
  setInputValue('adminEduDegree', edu.degree || '');
  setInputValue('adminEduPeriod', edu.period || '');

  setInputValue('adminSkills', skills.join('\n'));
  setInputValue('adminCertifications', certifications.map(cert => [cert.name, cert.issuer, cert.date || '', cert.url || ''].join(' | ')).join('\n'));
  setInputValue('adminProjects', projects.map(project => [project.tag, project.title, project.desc, project.url || ''].join(' | ')).join('\n'));
  setInputValue('adminExperience', experience.map(formatExperienceBlock).join('\n\n'));
  setInputValue('adminUsername', state.username || '');
}

function toggleAdminInputs(enabled) {
  document.querySelectorAll('#adminDashboard input, #adminDashboard textarea, #adminDashboard button').forEach(el => {
    el.disabled = !enabled;
  });
}

function addSkill() {
  if (!requireAdmin()) return;
  const input = document.getElementById('newSkillInput');
  const skill = input ? input.value.trim() : '';
  if (!skill) return;
  state.data.skills.push(skill);
  input.value = '';
  persistContent('Skill added.');
}

function removeSkill(index) {
  if (!requireAdmin()) return;
  state.data.skills.splice(index, 1);
  persistContent('Skill removed.');
}

function addProject() {
  if (!requireAdmin()) return;
  const title = val('newProjTitle');
  const tag = val('newProjTag') || 'Project';
  const desc = val('newProjDesc');
  const url = val('newProjUrl');
  if (!title || !desc) return;
  state.data.projects.push({ tag, title, desc, url });
  clearFields(['newProjTitle', 'newProjTag', 'newProjDesc', 'newProjUrl']);
  persistContent('Project added.');
}

function removeProject(index) {
  if (!requireAdmin()) return;
  state.data.projects.splice(index, 1);
  persistContent('Project removed.');
}

function downloadResume() {
  const { resumeUrl, resumeFileName } = state.data.profile;
  if (!resumeUrl) {
    alert('No resume uploaded yet.');
    return;
  }

  const link = document.createElement('a');
  link.href = resumeUrl;
  link.download = resumeFileName || 'resume.pdf';
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function handleResumeUpload(file) {
  if (!requireAdmin()) return;
  const result = await uploadFile('/api/admin/uploads/resume', file);
  state.data.profile.resumeUrl = result.url;
  state.data.profile.resumeFileName = result.fileName;
  await persistContent('Resume uploaded.');
}

async function handlePhotoUpload(file) {
  if (!requireAdmin()) return;
  const result = await uploadFile('/api/admin/uploads/photo', file);
  state.data.profile.photoUrl = result.url;
  state.data.profile.photoFileName = result.fileName;
  await persistContent('Profile photo uploaded.');
}

function clearResumeFile() {
  if (!requireAdmin()) return;
  state.data.profile.resumeUrl = '';
  state.data.profile.resumeFileName = '';
  persistContent('Resume removed.');
}

function clearPhotoFile() {
  if (!requireAdmin()) return;
  state.data.profile.photoUrl = '';
  state.data.profile.photoFileName = '';
  persistContent('Profile photo removed.');
}

function openModal() {
  const modal = document.getElementById('loginModal');
  if (modal) {
    modal.classList.add('open');
    setTimeout(() => {
      const userInput = document.getElementById('loginUser');
      if (userInput) userInput.focus();
    }, 250);
  }
}

function closeModal() {
  const modal = document.getElementById('loginModal');
  if (modal) modal.classList.remove('open');
  hideLoginError();
  clearFields(['loginUser', 'loginPass']);
}

async function doLogin() {
  try {
    const payload = {
      username: val('loginUser'),
      password: val('loginPass')
    };

    const auth = await apiPost('/api/auth/login', payload);
    state.isAdmin = Boolean(auth.authenticated);
    state.username = auth.username || '';
    await refreshCsrfToken();
    updateAdminUi();
    closeModal();
    navigateTo('admin');
  } catch (error) {
    showLoginError(error.message || 'Login failed.');
  }
}

async function doLogout() {
  try {
    await apiPost('/api/auth/logout', {});
    state.isAdmin = false;
    state.username = '';
    await refreshCsrfToken();
    updateAdminUi();
    navigateTo('home');
  } catch (error) {
    setAdminStatus(error.message || 'Could not log out.', 'error');
  }
}

function updateAdminUi() {
  document.body.classList.toggle('admin-mode', state.isAdmin);
  document.body.classList.toggle('admin-mode-on', state.isAdmin);

  const adminBtn = document.getElementById('adminBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (adminBtn) adminBtn.style.display = state.isAdmin ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = state.isAdmin ? 'inline' : 'none';

  const note = document.getElementById('adminSecurityNote');
  if (note) {
    note.textContent = 'This admin panel is now server-backed. Changes are stored securely on the host and protected by authenticated API access.';
  }

  renderAdminPanel();
}

function saveSectionText() {
  if (!requireAdmin()) return;
  state.data.sections.aboutLabel = val('adminAboutLabel') || 'Who I Am';
  state.data.sections.aboutTitle = val('adminAboutTitle') || 'About Me';
  state.data.sections.experienceLabel = val('adminExperienceLabel') || 'Career';
  state.data.sections.experienceTitle = val('adminExperienceTitle') || 'Experience';
  state.data.sections.skillsLabel = val('adminSkillsLabel') || 'Expertise';
  state.data.sections.skillsTitle = val('adminSkillsTitle') || 'Skills';
  state.data.sections.projectsLabel = val('adminProjectsLabel') || 'My Work';
  state.data.sections.projectsTitle = val('adminProjectsTitle') || 'Projects';
  state.data.sections.contactLabel = val('adminContactLabel') || "Let's Connect";
  state.data.sections.contactTitle = val('adminContactTitle') || 'Contact';
  state.data.sections.certLabel = val('adminCertLabel') || 'Credentials';
  state.data.sections.certTitle = val('adminCertTitle') || 'Certifications';
  persistContent('Section headings updated.');
}

function saveProfileBasics() {
  if (!requireAdmin()) return;
  state.data.profile.name = val('adminName');
  state.data.profile.heroTag = val('adminHeroTag') || 'Networking & Cybersecurity';
  state.data.profile.title = val('adminTitle');
  state.data.profile.subtitle = val('adminSubtitle');
  state.data.profile.status = val('adminStatusText');
  state.data.profile.highlights = splitLines(val('adminHighlights'))
    .map(line => {
      const [title, ...rest] = line.split('|').map(part => part.trim());
      return { title, text: rest.join(' | ') };
    })
    .filter(item => item.title && item.text);
  persistContent('Profile content saved.');
}

function saveAboutContact() {
  if (!requireAdmin()) return;
  state.data.profile.about = splitParagraphs(val('adminAbout'));
  state.data.profile.contactIntro = val('adminContactIntro');
  state.data.profile.email = val('adminEmail');
  state.data.profile.phone = val('adminPhone');
  state.data.profile.location = val('adminLocation');
  state.data.profile.linkedin = val('adminLinkedin');
  persistContent('About and contact details saved.');
}

function saveEducation() {
  if (!requireAdmin()) return;
  state.data.education = [{
    institution: val('adminEduInstitution'),
    degree: val('adminEduDegree'),
    period: val('adminEduPeriod')
  }];
  persistContent('Education section saved.');
}

function saveSkillsList() {
  if (!requireAdmin()) return;
  state.data.skills = splitLines(val('adminSkills'));
  persistContent('Skills updated.');
}

function saveCertifications() {
  if (!requireAdmin()) return;
  const certs = [];
  for (const line of splitLines(val('adminCertifications'))) {
    const parts = line.split('|').map(part => part.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      setAdminStatus('Each certification line should use at least: Name | Issuer', 'error');
      return;
    }
    const [name, issuer, date = '', ...rest] = parts;
    certs.push({ name, issuer, date, url: rest.join(' | ') });
  }
  state.data.certifications = certs;
  persistContent('Certifications updated.');
}

function saveProjectsList() {
  if (!requireAdmin()) return;
  const projects = [];
  for (const line of splitLines(val('adminProjects'))) {
    const parts = line.split('|').map(part => part.trim());
    if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
      setAdminStatus('Each project line must use at least: Tag | Title | Description', 'error');
      return;
    }
    const [tag, title, desc, ...rest] = parts;
    projects.push({ tag, title, desc, url: rest.join(' | ') });
  }
  state.data.projects = projects;
  persistContent('Projects updated.');
}

function saveExperienceList() {
  if (!requireAdmin()) return;
  const blocks = val('adminExperience').split(/\n\s*\n/).map(block => block.trim()).filter(Boolean);
  const experience = [];

  for (const block of blocks) {
    const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
    if (lines.length < 5) {
      setAdminStatus('Each experience block needs title, company, location, period, and at least one bullet.', 'error');
      return;
    }
    experience.push({
      title: lines[0],
      company: lines[1],
      location: lines[2],
      period: lines[3],
      bullets: lines.slice(4)
    });
  }

  state.data.experience = experience;
  persistContent('Experience updated.');
}

async function saveSecuritySettings() {
  if (!requireAdmin()) return;

  try {
    const newPassword = val('adminNewPassword');
    const confirmPassword = val('adminConfirmPassword');
    if (newPassword !== confirmPassword) {
      setAdminStatus('New password and confirmation do not match.', 'error');
      return;
    }

    const payload = {
      username: val('adminUsername'),
      currentPassword: val('adminCurrentPassword'),
      newPassword
    };

    await apiPost('/api/admin/password', payload);
    state.username = payload.username;
    clearFields(['adminCurrentPassword', 'adminNewPassword', 'adminConfirmPassword']);
    setAdminStatus('Admin credentials updated securely on the server.', 'success');
    await refreshCsrfToken();
  } catch (error) {
    setAdminStatus(error.message || 'Could not update credentials.', 'error');
  }
}

async function persistContent(message) {
  try {
    const saved = await apiPut('/api/admin/content', state.data);
    state.data = normalizeData(saved);
    renderAll();
    setAdminStatus(message, 'success');
  } catch (error) {
    setAdminStatus(error.message || 'Could not save changes.', 'error');
  }
}

function requireAdmin() {
  if (state.isAdmin) return true;
  setAdminStatus('Sign in first to edit the site.', 'error');
  openModal();
  return false;
}

function setAdminStatus(message, type) {
  const status = document.getElementById('adminStatus');
  if (!status) return;
  status.textContent = message;
  status.classList.remove('success', 'error');
  if (type) status.classList.add(type);
}

function showLoginError(message) {
  const err = document.getElementById('loginErr');
  if (err) {
    err.style.display = 'block';
    err.textContent = message;
  }
}

function hideLoginError() {
  const err = document.getElementById('loginErr');
  if (err) {
    err.style.display = 'none';
    err.textContent = 'Invalid credentials. Please try again.';
  }
}

function setEl(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text || '';
}

function setInputValue(id, text) {
  const el = document.getElementById(id);
  if (el) el.value = text || '';
}

function val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function clearFields(ids) {
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

function splitLines(text) {
  return text.split('\n').map(line => line.trim()).filter(Boolean);
}

function splitParagraphs(text) {
  return text.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean);
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function escAttr(str) {
  return escHtml(str).replace(/"/g, '&quot;');
}

function formatHeroName(name) {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Portfolio';
  if (parts.length === 1) return escHtml(parts[0]);
  return `${escHtml(parts.slice(0, -1).join(' '))}<br><span>${escHtml(parts[parts.length - 1])}</span>`;
}

function getInitials(name) {
  return (name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0].toUpperCase())
    .join('') || 'AR';
}

function formatExperienceBlock(item) {
  return [
    item.title || '',
    item.company || '',
    item.location || '',
    item.period || '',
    ...(item.bullets || [])
  ].join('\n');
}

async function refreshCsrfToken() {
  const response = await apiGet('/api/auth/csrf');
  state.csrfToken = response.token;
}

async function apiGet(url) {
  const response = await fetch(url, {
    credentials: 'include'
  });
  return parseResponse(response);
}

async function apiPost(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': state.csrfToken
    },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

async function apiPut(url, body) {
  const response = await fetch(url, {
    method: 'PUT',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-TOKEN': state.csrfToken
    },
    body: JSON.stringify(body)
  });
  return parseResponse(response);
}

async function uploadFile(url, file) {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(url, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'X-CSRF-TOKEN': state.csrfToken
    },
    body: formData
  });
  return parseResponse(response);
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string'
      ? payload
      : payload.message || 'Request failed.';
    throw new Error(message);
  }

  return payload;
}
