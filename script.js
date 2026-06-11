// ─── AUTH ───────────────────────────────────────────────────────────────────
const USER = 'subu';
const PASS = 'subu@1214';

// Auto-login: stay logged in until manual logout
window.addEventListener('DOMContentLoaded', () => {
  ['username', 'password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') login();
    });
  });

  if (localStorage.getItem('subu_logged_in') === 'true') {
    showApp();
  }
});

function login() {
  const u = document.getElementById('username').value.trim();
  const p = document.getElementById('password').value;
  const msg = document.getElementById('msg');
  if (u === USER && p === PASS) {
    msg.textContent = '';
    localStorage.setItem('subu_logged_in', 'true');
    showApp();
  } else {
    msg.textContent = '❌ Invalid username or password';
  }
}

function showApp() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'block';
  recordDailyVisit();
  render();
  updateStreakPill();
  initNotifications();
  startReminderLoop();
  checkDailyNotification();
}

function logout() {
  // Only logout when user manually clicks — clears session
  localStorage.setItem('subu_logged_in', 'false');
  stopReminderLoop();
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('appPage').style.display = 'none';
  document.getElementById('username').value = '';
  document.getElementById('password').value = '';
  document.getElementById('msg').textContent = '';
}

// ─── STORAGE ─────────────────────────────────────────────────────────────────
function loadTasks() {
  return JSON.parse(localStorage.getItem('subu_tasks') || '[]');
}
function saveTasks(tasks) {
  localStorage.setItem('subu_tasks', JSON.stringify(tasks));
}

// ─── DAILY VISIT TRACKING ────────────────────────────────────────────────────
// activeDays: Set of 'YYYY-MM-DD' strings where user logged in OR completed a task
function loadActiveDays() {
  return new Set(JSON.parse(localStorage.getItem('subu_active_days') || '[]'));
}
function saveActiveDays(set) {
  localStorage.setItem('subu_active_days', JSON.stringify([...set]));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function recordDailyVisit() {
  const days = loadActiveDays();
  days.add(todayKey());
  saveActiveDays(days);
  updateStreakPill();
}

// ─── STREAK CALCULATION ──────────────────────────────────────────────────────
function calcStreak() {
  const days = loadActiveDays();
  if (days.size === 0) return { current: 0, longest: 0, total: days.size };

  // Sort days descending
  const sorted = [...days].sort((a, b) => b.localeCompare(a));
  const today = todayKey();
  const yesterday = dateOffset(-1);

  // Current streak: must include today or yesterday to be "active"
  let current = 0;
  if (days.has(today) || days.has(yesterday)) {
    let check = days.has(today) ? today : yesterday;
    while (days.has(check)) {
      current++;
      check = offsetFromKey(check, -1);
    }
  }

  // Longest streak
  let longest = 0, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i], sorted[i - 1]);
    if (diff === 1) { run++; longest = Math.max(longest, run); }
    else { run = 1; }
  }
  longest = Math.max(longest, run, current);

  return { current, longest, total: days.size };
}

function dateOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function offsetFromKey(key, n) {
  const d = new Date(key + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  // Returns |days| between two 'YYYY-MM-DD' strings
  return Math.round(Math.abs((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000));
}

function updateStreakPill() {
  const { current } = calcStreak();
  document.getElementById('streakCount').textContent = current;
}

// ─── STREAK MODAL ────────────────────────────────────────────────────────────
let calYear, calMonth;

function openStreakModal() {
  const { current, longest, total } = calcStreak();
  const tasks = loadTasks();
  const doneTasks = tasks.filter(t => t.done).length;

  document.getElementById('streakModalCount').textContent = current;
  document.getElementById('statLongest').textContent = longest;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statDone').textContent = doneTasks;

  const subs = [
    'Keep going, you\'re on fire! 🔥',
    'Every day counts. Don\'t break the chain!',
    'Consistency builds greatness 💪',
    'You\'re crushing it!'
  ];
  document.getElementById('streakModalSub').textContent = current > 0
    ? subs[current % subs.length]
    : 'Complete a task today to start your streak!';

  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  renderCalendar();
  document.getElementById('streakModal').style.display = 'flex';
}

function closeStreakModal() {
  document.getElementById('streakModal').style.display = 'none';
}

function calPrev() {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar();
}
function calNext() {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar();
}

function renderCalendar() {
  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  document.getElementById('calMonthLabel').textContent = `${monthNames[calMonth]} ${calYear}`;

  const activeDays = loadActiveDays();
  const today = todayKey();
  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  // Day headers
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    const h = document.createElement('div');
    h.className = 'cal-day-header';
    h.textContent = d;
    grid.appendChild(h);
  });

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    const e = document.createElement('div');
    e.className = 'cal-day empty';
    grid.appendChild(e);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${calYear}-${String(calMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cell = document.createElement('div');
    let cls = 'cal-day';
    if (activeDays.has(key)) cls += ' active';
    if (key === today) cls += ' today';
    cell.className = cls;
    cell.textContent = d;
    grid.appendChild(cell);
  }
}

// ─── FILTER STATE ────────────────────────────────────────────────────────────
let currentFilter = 'all';
function setFilter(f, btn) {
  currentFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  render();
}

// ─── ADD TASK ────────────────────────────────────────────────────────────────
function addTask() {
  const text = document.getElementById('task').value.trim();
  const deadline = document.getElementById('deadline').value;
  const priority = document.getElementById('priority').value;
  const desc = document.getElementById('taskDesc').value.trim();
  const category = document.getElementById('category').value.trim();

  if (!text) { alert('Please enter a task title.'); return; }

  const tasks = loadTasks();
  tasks.push({
    id: Date.now(),
    text, desc, deadline, priority, category,
    done: false,
    createdAt: new Date().toISOString(),
    evidence: null
  });
  saveTasks(tasks);

  document.getElementById('task').value = '';
  document.getElementById('taskDesc').value = '';
  document.getElementById('deadline').value = '';
  document.getElementById('category').value = '';
  document.getElementById('priority').value = 'medium';

  render();
  showToast('Task added!', '✅');
}

// ─── DELETE ──────────────────────────────────────────────────────────────────
function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  const tasks = loadTasks().filter(t => t.id !== id);
  saveTasks(tasks);
  render();
  showToast('Task deleted', '🗑️');
}

// ─── RENDER ──────────────────────────────────────────────────────────────────
function render() {
  const tasks = loadTasks();
  const list = document.getElementById('list');
  const search = (document.getElementById('searchBox')?.value || '').toLowerCase();
  const now = new Date();

  const filtered = tasks.filter(t => {
    if (currentFilter === 'pending' && t.done) return false;
    if (currentFilter === 'done' && !t.done) return false;
    if (search && !t.text.toLowerCase().includes(search) &&
        !(t.category || '').toLowerCase().includes(search)) return false;
    return true;
  });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📭</div>
      <p>No tasks found. Add one above!</p>
    </div>`;
    return;
  }

  filtered.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.deadline && b.deadline) return new Date(a.deadline) - new Date(b.deadline);
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  list.innerHTML = '';
  filtered.forEach(t => {
    const isOverdue = !t.done && t.deadline && new Date(t.deadline) < now;
    const deadlineStr = t.deadline
      ? new Date(t.deadline).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
      : 'No deadline';

    let classes = `task-item priority-${t.priority}`;
    if (t.done) classes += ' done';
    if (isOverdue) classes += ' overdue';

    const priorityEmoji = { high: '🔴', medium: '🟡', low: '🟢' }[t.priority];
    const priorityLabel = t.priority.charAt(0).toUpperCase() + t.priority.slice(1);

    const badges = `
      <span class="badge badge-${t.priority}">${priorityEmoji} ${priorityLabel}</span>
      ${t.category ? `<span class="badge badge-category">🏷️ ${esc(t.category)}</span>` : ''}
      ${t.done ? `<span class="badge badge-done">✅ Done</span>` : ''}
      ${isOverdue ? `<span class="badge badge-overdue">⚠️ Overdue</span>` : ''}
    `;

    const actions = t.done
      ? `<button class="btn-sm btn-view-evidence" onclick="viewEvidence(${t.id})">📎 View Evidence</button>
         <button class="btn-sm btn-delete" onclick="deleteTask(${t.id})">🗑️ Delete</button>`
      : `<button class="btn-sm btn-complete" onclick="openEvidenceModal(${t.id})">✅ Mark Complete</button>
         <button class="btn-sm btn-delete" onclick="deleteTask(${t.id})">🗑️ Delete</button>`;

    const item = document.createElement('li');
    item.className = classes;
    item.innerHTML = `
      <div class="task-top">
        <span class="task-title">${esc(t.text)}</span>
        <div class="task-badges">${badges}</div>
      </div>
      ${t.desc ? `<p class="task-desc">${esc(t.desc)}</p>` : ''}
      <div class="task-meta">
        <span>⏰ ${deadlineStr}</span>
        <span>📅 Added ${new Date(t.createdAt).toLocaleDateString('en-IN')}</span>
        ${t.completedAt ? `<span>✅ Completed ${new Date(t.completedAt).toLocaleDateString('en-IN')}</span>` : ''}
      </div>
      <div class="task-actions">${actions}</div>
    `;
    list.appendChild(item);
  });
}

// ─── EVIDENCE MODAL ──────────────────────────────────────────────────────────
let evidenceTargetId = null;

function openEvidenceModal(id) {
  evidenceTargetId = id;
  const t = loadTasks().find(x => x.id === id);
  document.getElementById('evidenceTaskName').textContent = t.text;
  document.getElementById('evidenceFile').value = '';
  document.getElementById('evidenceNote').value = '';
  document.getElementById('evidencePreview').style.display = 'none';
  document.getElementById('previewImg').style.display = 'none';
  document.getElementById('previewImg').src = '';
  document.getElementById('previewFileName').textContent = '';
  document.getElementById('evidenceModal').style.display = 'flex';
}

function closeEvidenceModal() {
  document.getElementById('evidenceModal').style.display = 'none';
  evidenceTargetId = null;
}

function previewEvidence() {
  const file = document.getElementById('evidenceFile').files[0];
  if (!file) return;
  document.getElementById('evidencePreview').style.display = 'block';
  document.getElementById('previewFileName').textContent = '📎 ' + file.name;
  if (file.type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      const img = document.getElementById('previewImg');
      img.src = e.target.result;
      img.style.display = 'block';
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('previewImg').style.display = 'none';
  }
}

function submitEvidence() {
  if (!evidenceTargetId) return;
  const file = document.getElementById('evidenceFile').files[0];
  const note = document.getElementById('evidenceNote').value.trim();

  const finalize = (evidenceData) => {
    const tasks = loadTasks();
    const t = tasks.find(x => x.id === evidenceTargetId);
    if (t) {
      t.done = true;
      t.completedAt = new Date().toISOString();
      t.evidence = {
        note, fileName: file ? file.name : null,
        fileType: file ? file.type : null,
        fileData: evidenceData,
        submittedAt: new Date().toISOString()
      };
    }
    saveTasks(tasks);

    // Record this day as active (task completed!)
    recordDailyVisit();
    updateStreakPill();

    // Streak milestone toast
    const { current } = calcStreak();
    if (current > 0 && current % 7 === 0) {
      showToast(`🔥 ${current}-day streak! Amazing!`, '🏆');
    } else {
      showToast('Task marked complete!', '🎉');
    }

    closeEvidenceModal();
    render();

    // Browser notification for completion
    if (Notification.permission === 'granted') {
      new Notification('✅ Task Completed!', {
        body: `"${t.text}" — ${current} day streak! 🔥`
      });
    }
  };

  if (file) {
    const reader = new FileReader();
    reader.onload = e => finalize(e.target.result);
    reader.readAsDataURL(file);
  } else {
    if (!note) { alert('Please upload a file or add a note as evidence.'); return; }
    finalize(null);
  }
}

// ─── VIEW EVIDENCE ───────────────────────────────────────────────────────────
function viewEvidence(id) {
  const t = loadTasks().find(x => x.id === id);
  if (!t) return;
  document.getElementById('viewTaskName').textContent = t.text;
  const ev = t.evidence;
  let html = '';
  if (ev) {
    if (ev.fileData && ev.fileType && ev.fileType.startsWith('image/')) {
      html += `<img src="${ev.fileData}" alt="Evidence" style="max-width:100%;border-radius:8px;border:1px solid #eee;margin-bottom:10px;">`;
    }
    if (ev.fileName) {
      html += `<p class="file-name-label">📎 ${esc(ev.fileName)}</p>`;
      if (ev.fileData && !ev.fileType.startsWith('image/')) {
        html += `<a href="${ev.fileData}" download="${ev.fileName}" class="btn-sm btn-view-evidence" style="display:inline-block;margin-top:8px;text-decoration:none">⬇️ Download File</a>`;
      }
    }
    if (ev.note) {
      html += `<div style="background:#f7f9ff;border-radius:8px;padding:12px 14px;margin-top:10px;font-size:13px;color:#333"><strong>Note:</strong><br>${esc(ev.note)}</div>`;
    }
    if (ev.submittedAt) {
      html += `<p style="font-size:12px;color:#999;margin-top:8px">Submitted: ${new Date(ev.submittedAt).toLocaleString('en-IN')}</p>`;
    }
  } else {
    html = '<p style="color:#aaa;font-size:14px">No evidence submitted.</p>';
  }
  document.getElementById('viewEvidenceContent').innerHTML = html;
  document.getElementById('viewEvidenceModal').style.display = 'flex';
}

function closeViewModal() {
  document.getElementById('viewEvidenceModal').style.display = 'none';
}

// ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
function initNotifications() {
  if (!('Notification' in window)) return;
  const badge = document.getElementById('notifStatus');
  if (Notification.permission === 'granted') {
    badge.classList.add('on');
    badge.textContent = '🔔 Notifications ON';
  } else {
    badge.textContent = '🔕 Enable Notifications';
  }
}

function toggleNotifications() {
  if (!('Notification' in window)) { alert('Notifications not supported.'); return; }
  if (Notification.permission === 'granted') {
    showToast('Notifications already enabled!', '🔔');
  } else {
    Notification.requestPermission().then(p => {
      const badge = document.getElementById('notifStatus');
      if (p === 'granted') {
        badge.classList.add('on');
        badge.textContent = '🔔 Notifications ON';
        showToast('Notifications enabled!', '🔔');
      } else {
        showToast('Notifications denied by browser.', '❌');
      }
    });
  }
}

// ─── DAILY DUOLINGO-STYLE NOTIFICATION ───────────────────────────────────────
function checkDailyNotification() {
  if (Notification.permission !== 'granted') return;

  const today = new Date().toDateString();
  const lastDaily = localStorage.getItem('subu_daily_notif');
  if (lastDaily === today) return; // Already shown today

  const tasks = loadTasks();
  const pending = tasks.filter(t => !t.done);
  const overdue = pending.filter(t => t.deadline && new Date(t.deadline) < new Date());
  const todayTasks = pending.filter(t => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const { current } = calcStreak();

  // Main daily greeting notification
  let title = '📋 Good morning, Subu!';
  let body = '';

  if (todayTasks.length > 0) {
    title = `📋 You have ${todayTasks.length} task(s) due today!`;
    body = todayTasks.slice(0, 2).map(t => `• ${t.text}`).join('\n');
    if (todayTasks.length > 2) body += `\n...and ${todayTasks.length - 2} more`;
  } else if (pending.length > 0) {
    title = `📋 ${pending.length} pending task(s), Subu!`;
    body = 'Open the app to check what needs to be done.';
  } else {
    title = '🎉 All tasks done, Subu!';
    body = 'Great work! Add new tasks to keep going.';
  }

  if (current > 0) body += `\n🔥 ${current}-day streak — keep it up!`;

  new Notification(title, { body, icon: '' });
  localStorage.setItem('subu_daily_notif', today);

  // Missed tasks notification (tasks due yesterday that were not done)
  checkMissedTasksNotification();
}

function checkMissedTasksNotification() {
  if (Notification.permission !== 'granted') return;
  const lastMissedCheck = localStorage.getItem('subu_missed_check');
  const today = new Date().toDateString();
  if (lastMissedCheck === today) return;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const tasks = loadTasks();

  const missed = tasks.filter(t => {
    if (t.done || !t.deadline) return false;
    const d = new Date(t.deadline);
    return d < new Date() && d.toDateString() === yesterday.toDateString();
  });

  if (missed.length > 0) {
    setTimeout(() => {
      new Notification(`⚠️ You missed ${missed.length} task(s) yesterday!`, {
        body: missed.slice(0, 3).map(t => `• ${t.text}`).join('\n')
      });
    }, 3000); // Slight delay so it's a separate notification
  }

  localStorage.setItem('subu_missed_check', today);
}

// ─── REMINDER LOOP ───────────────────────────────────────────────────────────
let reminderInterval = null;

function startReminderLoop() {
  stopReminderLoop();
  reminderInterval = setInterval(() => {
    if (Notification.permission !== 'granted') return;
    const tasks = loadTasks();
    const now = new Date();
    tasks.forEach(t => {
      if (t.done || !t.deadline) return;
      const d = new Date(t.deadline);
      const diffMin = (d - now) / 60000;

      // 24hr before
      if (diffMin >= 1439 && diffMin < 1441) {
        new Notification('⏰ Task due tomorrow!', { body: t.text });
      }
      // 1hr before
      if (diffMin >= 59 && diffMin < 61) {
        new Notification('🚨 Task due in 1 hour!', { body: t.text });
      }
      // Deadline reached
      if (diffMin >= -1 && diffMin < 1) {
        new Notification('❗ Deadline reached!', { body: `"${t.text}" is due now!` });
      }
    });
  }, 60000);
}

function stopReminderLoop() {
  if (reminderInterval) { clearInterval(reminderInterval); reminderInterval = null; }
}

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, icon = 'ℹ️') {
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.textContent = icon + ' ' + msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px',
    background: '#1a1a2e', color: '#fff',
    padding: '12px 20px', borderRadius: '10px',
    fontSize: '14px', fontWeight: '500',
    boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    zIndex: '999', opacity: '0',
    transition: 'opacity .3s'
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; });
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 2800);
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

document.addEventListener('click', e => {
  if (e.target.id === 'evidenceModal') closeEvidenceModal();
  if (e.target.id === 'viewEvidenceModal') closeViewModal();
  if (e.target.id === 'streakModal') closeStreakModal();
});
