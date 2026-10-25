import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowRight, Bell, Check, ChevronDown, Clock3, Droplets, Search,
  HeartPulse, MapPin, Menu, MessageSquare, Phone, Plus, Radio, ShieldCheck,
  UserRound, Users, X
} from 'lucide-react';
import './styles.css';
import { changeMyPassword, createDonor, createRequest, findDonors, getCurrentUser, getDashboardStats, listAdminUsers, listRequests, login, logout, normalizeRequest, registerAccount, updateMyProfile, updateRequestStatus, verifyRequest } from './api';
import { getLanguageLabel, translations } from './i18n';

const initialRequests = [
  { id: 'KR-0241', patient: 'Paciente emergência', blood: 'O+', location: 'Dili, Timor-Leste', urgency: 'Urgente', status: 'Verifikadu', time: '8 min ago', donors: 18 },
  { id: 'KR-0240', patient: 'Maria da Costa', blood: 'A-', location: 'Hospital de Baucau', urgency: 'Normal', status: 'Pendente', time: '42 min ago', donors: 0 },
  { id: 'KR-0239', patient: 'João Soares', blood: 'B+', location: 'Baucau, Timor-Leste', urgency: 'Urgente', status: 'Verifikadu', time: '1 hr ago', donors: 11 },
];

const navItems = [
  ['overview', 'Vizaun jerál'],
  ['requests', 'Pedidos raan'],
  ['donors', 'Doadores'],
];

function formatDashboardDate(date = new Date()) {
  return new Intl.DateTimeFormat('pt-PT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date).toUpperCase();
}

function App() {
  const [active, setActive] = useState('overview');
  const [requests, setRequests] = useState(initialRequests);
  const [showRequest, setShowRequest] = useState(false);
  const [showDonor, setShowDonor] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [dataSource, setDataSource] = useState('demo');
  const [stats, setStats] = useState(null);
  const [language, setLanguage] = useState(() => localStorage.getItem('konekta_language') || 'tet');
  const t = translations[language];
  const [openMenu, setOpenMenu] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [notifications, setNotifications] = useState([
    { id: 1, type: 'urgent', title: 'Pedido raan foun iha Dili', body: 'O+ presiza ajuda iha Hospital Nacional.', time: 'Agora', read: false },
    { id: 2, type: 'thanks', title: 'Obrigadu ba ita nia ajuda', body: 'Ita nia disponibilidade ajuda komunidade.', time: 'Semaina kotuk', read: false },
    { id: 3, type: 'system', title: 'Perfil verifikadu', body: 'Informasaun ita nian seguru ona.', time: '2 semana kotuk', read: true },
  ]);
  const unreadCount = notifications.filter((item) => !item.read).length;
  const [user, setUser] = useState(getCurrentUser);
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [showLanding, setShowLanding] = useState(() => !getCurrentUser());

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const closeMenus = (event) => {
      if (!event.target.closest('.dropdown')) setOpenMenu(null);
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeMenus);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    listRequests()
      .then((rows) => {
        setRequests(rows.map(normalizeRequest));
        setDataSource('api');
      })
      .catch(() => {
        setDataSource('demo');
      });
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    if (user.role === 'admin') getDashboardStats().then(setStats).catch(() => setStats(null));
    return undefined;
  }, [user, requests.length]);

  const handleVerifyRequest = async (id) => {
    const selected = requests.find((request) => request.id === id);
    if (selected?.apiId) {
      try {
        const verified = await verifyRequest(selected.apiId);
        setRequests((current) => current.map((request) =>
          request.id === id ? normalizeRequest(verified) : request
        ));
        setToast('Pedido verifikadu. Notifikasaun ba doadores prontu.');
        return;
      } catch (error) {
        setToast(`Verifikasaun la konsege: ${error.message}`);
        return;
      }
    }
    setRequests((current) => current.map((request) =>
      request.id === id ? { ...request, status: 'Verifikadu', donors: 16 } : request
    ));
    setToast('Demo mode: pedido verifikadu lokalmente.');
  };

  const handleRequestStatus = async (request, status) => {
    if (request.apiId) {
      try {
        const updated = await updateRequestStatus(request.apiId, status);
        setRequests((current) => current.map((item) => item.id === request.id ? normalizeRequest(updated) : item));
        setSelectedRequest(null);
        setToast(status === 'Fulfilled' ? 'Pedido kompletu ona.' : 'Pedido kansela ona.');
        return;
      } catch (error) {
        setToast(`Atualizasaun la konsege: ${error.message}`);
        return;
      }
    }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status } : item));
    setSelectedRequest(null);
    setToast(dataSource === 'demo' ? 'Demo mode: status atualizadu lokalmente.' : 'Status atualizadu.');
  };

  const addRequest = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      patientName: form.get('patient'),
      bloodType: form.get('blood'),
      hospitalName: form.get('location'),
      urgency: form.get('urgency'),
    };
    try {
      const saved = await createRequest(values);
      setRequests((current) => [normalizeRequest(saved), ...current]);
      setDataSource('api');
      setShowRequest(false);
      setToast('Pedido rai ona no guarda iha sistema.');
      return;
    } catch (error) {
      if (error.message.includes('Authentication') || error.message.includes('session')) {
        setShowRequest(false);
        setShowLogin(true);
        setToast('Tama uluk atu guarda pedido iha sistema.');
        return;
      }
      // Keep the competition demo usable when MySQL is not configured.
    }
    const request = {
      id: `KR-${String(241 + requests.length).padStart(4, '0')}`,
      patient: values.patientName || 'Paciente foun',
      blood: values.bloodType,
      location: values.hospitalName,
      urgency: values.urgency,
      status: 'Pendente',
      time: 'Agora',
      donors: 0,
    };
    setRequests((current) => [request, ...current]);
    setShowRequest(false);
    setToast('Demo mode: pedido rai lokalmente. Liga API atu guarda permanente.');
  };

  const navItems = user?.role === 'donor'
    ? [['donor-portal', t.donorPortal], ['donors', t.donors]]
    : user?.role === 'recipient'
      ? [['overview', t.myRequests], ['requests', t.searchDonors]]
      : [['overview', t.overview], ['requests', t.requests], ['donors', t.donors], ['users', t.users]];
  const pageTitle = active === 'settings' ? 'Kontas no seguransa' : navItems.find(([id]) => id === active)?.[1] || t.overview;

  if (showLanding && !user) {
    return <><Landing t={t} onLogin={() => setShowLogin(true)} onRegister={() => setShowRegister(true)} onExplore={() => setShowLanding(false)} onLanguage={(code) => { setLanguage(code); localStorage.setItem('konekta_language', code); }} />{showLogin && <Modal title={t.loginTitle} onClose={() => setShowLogin(false)}><LoginForm onDone={(session) => { localStorage.setItem('konekta_token', session.token); localStorage.setItem('konekta_user', JSON.stringify(session.user)); setUser(session.user); setShowLogin(false); setShowLanding(false); setToast(`Bemvindu, ${session.user.full_name}.`); }} t={t} /></Modal>}{showRegister && <Modal title={t.registerAccount} onClose={() => setShowRegister(false)}><AccountForm onDone={(session) => { localStorage.setItem('konekta_token', session.token); localStorage.setItem('konekta_user', JSON.stringify(session.user)); setUser(session.user); setShowRegister(false); setShowLanding(false); setToast(t.accountCreated); }} t={t} /></Modal>}</>;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Droplets size={22} fill="currentColor" /></div>
          <div><strong>Konekta<span>Raan</span></strong><small>Hamutuk ita salva moris</small></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)}><X size={18} /></button>
        </div>
        <div className="role-label">{t.panel}</div>
        <nav>
          {navItems.map(([id, label], index) => (
            <button key={id} className={`nav-item ${active === id ? 'active' : ''}`} onClick={() => { setActive(id); setMobileNav(false); }}>
              {index === 0 ? <Activity size={19} /> : index === 1 ? <HeartPulse size={19} /> : <Users size={19} />}
              {label}
              {id === 'requests' && <span className="nav-badge">3</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="offline-card"><span className="status-dot" /> {t.online}<small>{t.synced}</small></div>
          <div className="profile"><div className="avatar">{(user?.full_name || 'KR').slice(0, 2).toUpperCase()}</div><div><b>{user?.full_name || 'Konekta Raan'}</b><small>{user?.role || 'visitor'}</small></div><ChevronDown size={16} /></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMobileNav(true)}><Menu size={22} /></button>
          <div><div className="eyebrow">{formatDashboardDate()}</div><h1>{pageTitle}</h1></div>
          <div className="top-actions">
            <div className="dropdown">
              <button className={`lang-toggle ${openMenu === 'language' ? 'is-open' : ''}`} aria-expanded={openMenu === 'language'} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === 'language' ? null : 'language'); }}>
                {getLanguageLabel(language)} <ChevronDown size={14} />
              </button>
              {openMenu === 'language' && <div className="dropdown-menu language-menu">
                {Object.entries({ tet: 'Tetum', por: 'Português', eng: 'English' }).map(([code, label]) => <button key={code} className={language === code ? 'selected' : ''} onClick={() => { setLanguage(code); localStorage.setItem('konekta_language', code); setOpenMenu(null); }}>{label}{language === code && <Check size={14} />}</button>)}
              </div>}
            </div>
            {user ? <div className="dropdown"><button className={`user-chip ${openMenu === 'profile' ? 'is-open' : ''}`} aria-expanded={openMenu === 'profile'} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === 'profile' ? null : 'profile'); }}><span className={`role-avatar role-${user.role}`}>{user.role === 'donor' ? 'D' : user.role === 'hospital' ? 'H' : 'C'}</span><span className="user-chip-name">{user.full_name || user.name}</span><ChevronDown size={13} /></button>{openMenu === 'profile' && <div className="dropdown-menu profile-menu"><div className="profile-menu-heading"><span className={`avatar small-avatar role-avatar role-${user.role}`}>{user.role === 'donor' ? 'D' : user.role === 'hospital' ? 'H' : 'C'}</span><div><b>{user.full_name || user.name}</b><small>{user.role}</small></div></div><button onClick={() => { setActive('settings'); setOpenMenu(null); }}>Kontas no seguransa <ChevronDown size={14} className="settings-arrow" /></button><button onClick={() => { logout(); setUser(null); setShowLanding(true); setOpenMenu(null); setActive('overview'); setToast(t.sessionClosed); }}>{t.logout}<ArrowRight size={14} /></button></div>}</div> : <button className="login-button" onClick={() => setShowLogin(true)}><UserRound size={15} /> {t.login}</button>}
            <div className="dropdown"><button className={`notification notification-button ${openMenu === 'notifications' ? 'is-open' : ''}`} aria-label="Open notifications" aria-expanded={openMenu === 'notifications'} onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === 'notifications' ? null : 'notifications'); }}><Bell size={19} />{unreadCount > 0 && <i />}</button>{openMenu === 'notifications' && <NotificationMenu notifications={notifications} unreadCount={unreadCount} onRead={(id) => setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))} onReadAll={() => setNotifications((current) => current.map((item) => ({ ...item, read: true })))} t={t} />}</div>
          </div>
        </header>

        {active === 'overview' && <Overview requests={requests} onNew={() => setShowRequest(true)} onVerify={handleVerifyRequest} onDonor={() => setShowDonor(true)} dataSource={dataSource} stats={stats} t={t} />}
        {active === 'requests' && <Requests requests={requests} onNew={() => setShowRequest(true)} onVerify={handleVerifyRequest} onSelect={setSelectedRequest} t={t} />}
        {active === 'donors' && <DonorDirectory onDonor={() => setShowDonor(true)} t={t} />}
        {active === 'users' && <AdminUsers t={t} />}
        {active === 'donor-portal' && <DonorPortalConnected user={user} t={t} notifications={notifications} onRead={(id) => setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item))} onUserUpdated={(nextUser) => { setUser(nextUser); localStorage.setItem('konekta_user', JSON.stringify(nextUser)); }} onSaved={setToast} />}
        {active === 'settings' && <Settings user={user} t={t} onSaved={(message) => setToast(message)} onUserUpdated={(nextUser) => { setUser(nextUser); localStorage.setItem('konekta_user', JSON.stringify(nextUser)); }} />}
      </main>

      {showRequest && <Modal title={t.submitRequest} onClose={() => setShowRequest(false)}><RequestForm onSubmit={addRequest} t={t} /></Modal>}
      {showLogin && <Modal title={t.loginTitle} onClose={() => setShowLogin(false)}><LoginForm onDone={(session) => { localStorage.setItem('konekta_token', session.token); localStorage.setItem('konekta_user', JSON.stringify(session.user)); setUser(session.user); setShowLogin(false); setToast(`Bemvindu, ${session.user.full_name}.`); }} t={t} /></Modal>}
      {showDonor && <Modal title={t.registerDonor} onClose={() => setShowDonor(false)}><DonorForm t={t} onDone={async (values) => {
        try {
          await createDonor(values);
          setShowDonor(false);
          setToast(t.savedDonor);
        } catch (error) {
          setToast(`Rejistu la konsege: ${error.message}`);
        }
      }} /></Modal>}
      {selectedRequest && <RequestDetail request={selectedRequest} t={t} onClose={() => setSelectedRequest(null)} onVerify={handleVerifyRequest} onStatus={handleRequestStatus} />}
      {toast && <div className="toast"><Check size={18} />{toast}</div>}
    </div>
  );
}

function Landing({ t, onLogin, onRegister, onExplore, onLanguage }) { return <div className="landing"><header className="landing-nav"><div className="landing-brand"><div className="brand-mark"><Droplets size={22} fill="currentColor" /></div><strong>Konekta<span>Raan</span></strong></div><nav><a href="#how-it-works">Oinsá servisu</a><a href="#impact">Impaktu</a><a href="#about">Kona-ba ami</a></nav><div className="landing-actions"><button className="landing-lang" onClick={() => onLanguage('por')}>PT</button><button className="landing-login" onClick={onLogin}><UserRound size={15} /> {t.login}</button></div></header><main><section className="landing-hero"><div className="hero-copy"><span className="eyebrow hero-eyebrow">REDE DOADORES TIMOR-LESTE</span><h1>Hamutuk ita<br /><em>salva moris.</em></h1><p>Konekta Raan liga hospital, doadores, no komunidade atu hetan raan iha tempu loos — ho seguransa, rapidez, no laran.</p><div className="hero-actions"><button className="primary-button hero-button" onClick={onLogin}>Tama ba plataforma <ArrowRight size={17} /></button><button className="hero-secondary" onClick={onExplore}><Activity size={17} /> Haree demo</button></div><div className="trust-row"><div className="trust-avatars"><i>JS</i><i>MA</i><i>LC</i><i>+</i></div><span><b>486 doadores</b><br />iha rede agora</span></div></div><div className="hero-visual"><div className="hero-glow" /><div className="hero-card main-hero-card"><div className="hero-card-top"><span className="live-dot">SISTEMA ONLINE</span><Bell size={17} /></div><div className="hero-drop"><Droplets size={45} fill="currentColor" /></div><h3>Pedido urgente</h3><p>Hospital Nacional Guido Valadares</p><div className="hero-request"><b>O+</b><span>Presiza doadores<br /><small>Dili · Agora</small></span><Check size={19} /></div></div><div className="floating-card floating-match"><span className="float-icon"><Check size={14} /></span><div><b>Match konfirmadu</b><small>José responde agora</small></div></div><div className="floating-card floating-saved"><HeartPulse size={17} /><b>128</b><small>moris apoiadu</small></div></div></section><section className="landing-stats" id="impact"><div><b>486</b><span>Doadores ativos</span></div><div><b>74</b><span>Match ohin</span></div><div><b>128</b><span>Moris apoiadu</span></div><div><b>13</b><span>Hospital partner</span></div></section><section className="landing-section" id="how-it-works"><div className="section-intro"><span className="eyebrow">SIMPLES. HUMANO. EFETIVU.</span><h2>Husi pedido ba ajuda<br /><em>iha dalan tolu.</em></h2><p>Teknolojia ne'ebé servisu ba ema, la'ós ema ba teknolojia.</p></div><div className="steps"><div className="step"><span>01</span><div className="step-icon"><FileTextIcon /></div><h3>Submete pedido</h3><p>Ema ne'ebé presiza raan hatete tipu raan no lokalizasaun.</p></div><div className="step"><span>02</span><div className="step-icon"><Users size={22} /></div><h3>Konekta doadores</h3><p>Sistema buka doadores verifikadu iha área ne'ebé besik.</p></div><div className="step"><span>03</span><div className="step-icon"><HeartPulse size={22} /></div><h3>Salva moris</h3><p>Notifikasaun web no SMS ajuda ema responde iha tempu loos.</p></div></div></section><section className="landing-cta" id="about"><div><span className="eyebrow light">ITA NIA MISSAUN</span><h2>Raan ida bele<br /><em>muda moris ida.</em></h2><p>Hamutuk ita haburas komunidade ida ne'ebé prontu atu ajuda malu.</p></div><button className="light-button" onClick={onRegister}>Kria konta agora <ArrowRight size={16} /></button></section></main><footer className="landing-footer"><span>© {new Date().getFullYear()} Konekta Raan</span><span>Hamutuk ita salva moris.</span></footer></div>; }
function FileTextIcon() { return <Activity size={22} />; }
function PasswordForm({ onSaved }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const save = async (event) => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage('Password foun la hanesan.');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      await changeMyPassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSaved('Password troka ona.');
      setMessage('Password troka ho susesu.');
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  };
  return <form className="password-form" onSubmit={save}><label>Password agora<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required autoComplete="current-password" /></label><label>Password foun<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} required autoComplete="new-password" /></label><label>Konfirma password foun<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={12} required autoComplete="new-password" /></label>{message && <p className={`password-message ${message.includes('susesu') ? 'success' : ''}`}>{message}</p>}<button className="primary-button" type="submit" disabled={saving}>{saving ? 'Hela atualiza...' : 'Troka password'}</button></form>;
}
function Settings({ user, onSaved, onUserUpdated }) {
  const [fullName, setFullName] = useState(user.full_name || user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [emailAlerts, setEmailAlerts] = useState(user.notification_web_enabled !== false);
  const [smsAlerts, setSmsAlerts] = useState(user.notification_sms_enabled !== false);
  const [available, setAvailable] = useState(user.donor_available !== false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const nextUser = await updateMyProfile({
        fullName,
        email,
        notificationWebEnabled: emailAlerts,
        notificationSmsEnabled: smsAlerts,
        availability: available,
      });
      onUserUpdated(nextUser);
      setSaved(true);
      onSaved('Preferénsia guarda iha sistema.');
    } catch (error) {
      onSaved(`Atualizasaun la konsege: ${error.message}`);
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(false), 2500);
    }
  };
  return <div className="content settings-content"><section className="welcome-row"><div><p className="welcome">Kontas no seguransa</p><p className="muted">Jere ita nia informasaun no preferénsia.</p></div><div className={`settings-saved ${saved ? 'visible' : ''}`}><Check size={14} /> Guarda ona</div></section><div className="settings-layout"><form className="panel settings-form" onSubmit={save}><div className="settings-section-heading"><div className={`settings-avatar role-avatar role-${user.role}`}>{user.role === 'donor' ? 'D' : user.role === 'hospital' ? 'H' : 'C'}</div><div><h2>{fullName}</h2><span className="role-label-inline">{user.role}</span></div><button className="secondary-button" type="button" disabled>Troka foto</button></div><div className="settings-fields"><label>Naran kompletu<input value={fullName} onChange={(event) => setFullName(event.target.value)} required /></label><label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Tipu konta<select value={user.role} disabled><option value={user.role}>{user.role}</option></select></label></div><div className="settings-section"><div><h3>Notifikasaun</h3><p className="muted">Hili oinsá ita hakarak simu alerta.</p></div><SettingToggle label="Notifikasaun web" description="Alerta pedido raan foun" checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} /><SettingToggle label="SMS fallback" description="Simu SMS bainhira internet la iha" checked={smsAlerts} onChange={() => setSmsAlerts(!smsAlerts)} /></div>{user.role === 'donor' && <div className="settings-section"><div><h3>Disponibilidade</h3><p className="muted">Permite hospital haree ita iha matching.</p></div><SettingToggle label="Disponivel atu ajuda" description={available ? 'Ita bele simu pedidos' : 'Ita la simu pedidos'} checked={available} onChange={() => setAvailable(!available)} /></div>}<button className="primary-button save-settings" type="submit" disabled={saving}>{saving ? 'Hela guarda...' : saved ? 'Guarda ona' : 'Guarda mudansa'}</button></form><aside className="settings-side"><div className="panel security-card"><div className="security-icon"><ShieldCheck size={22} /></div><h2>Kontas seguru</h2><p>Ita nia informasaun pessoal protejidu ho seguransa no deit uza ba koordinasaun raan.</p>  <PasswordForm onSaved={onSaved} /></div><div className="panel danger-card"><h2>Sessáun</h2><p className="muted">Ita tama hela ho konta {user.role}.</p><button className="logout-settings" type="button" onClick={() => { logout(); window.location.reload(); }}><ArrowRight size={15} /> Sai husi konta</button></div></aside></div></div>;
}
function SettingsLegacy({ user, t, onSaved }) { const [saved, setSaved] = useState(false); const [emailAlerts, setEmailAlerts] = useState(true); const [smsAlerts, setSmsAlerts] = useState(true); const [available, setAvailable] = useState(true); const save = (event) => { event.preventDefault(); setSaved(true); onSaved('Preferénsia guarda lokalmente.'); setTimeout(() => setSaved(false), 2500); }; return <div className="content settings-content"><section className="welcome-row"><div><p className="welcome">Kontas no seguransa</p><p className="muted">Jere ita nia informasaun no preferénsia.</p></div><div className={`settings-saved ${saved ? 'visible' : ''}`}><Check size={14} /> Guarda ona</div></section><div className="settings-layout"><form className="panel settings-form" onSubmit={save}><div className="settings-section-heading"><div className={`settings-avatar role-avatar role-${user.role}`}>{user.role === 'donor' ? 'D' : user.role === 'hospital' ? 'H' : 'C'}</div><div><h2>{user.full_name || user.name}</h2><span className="role-label-inline">{user.role}</span></div><button className="secondary-button" type="button">Troka foto</button></div><div className="settings-fields"><label>Naran kompletu<input defaultValue={user.full_name || user.name} /></label><label>Email<input type="email" defaultValue={user.email} /></label><label>Tipu konta<select defaultValue={user.role} disabled><option value="coordinator">Koordenadór</option><option value="hospital">Hospital</option><option value="donor">Doador</option></select></label></div><div className="settings-section"><div><h3>Notifikasaun</h3><p className="muted">Hili oinsá ita hakarak simu alerta.</p></div><SettingToggle label="Notifikasaun web" description="Alerta pedido raan foun" checked={emailAlerts} onChange={() => setEmailAlerts(!emailAlerts)} /><SettingToggle label="SMS fallback" description="Simu SMS bainhira internet la iha" checked={smsAlerts} onChange={() => setSmsAlerts(!smsAlerts)} /></div>{user.role === 'donor' && <div className="settings-section"><div><h3>Disponibilidade</h3><p className="muted">Permite hospital haree ita iha matching.</p></div><SettingToggle label="Disponivel atu ajuda" description={available ? 'Ita bele simu pedidos' : 'Ita la simu pedidos'} checked={available} onChange={() => setAvailable(!available)} /></div>}<button className="primary-button save-settings" type="submit">{saved ? <Check size={16} /> : null}{saved ? 'Guarda ona' : 'Guarda mudansa'}</button></form><aside className="settings-side"><div className="panel security-card"><div className="security-icon"><ShieldCheck size={22} /></div><h2>Kontas seguru</h2><p>Ita nia informasaun pessoal protejidu ho seguransa no deit uza ba koordinasaun raan.</p><button className="text-button">Troka password <ArrowRight size={15} /></button></div><div className="panel danger-card"><h2>Sessáun</h2><p className="muted">Ita tama hela ho konta {user.role}.</p><button className="logout-settings" onClick={() => { localStorage.removeItem('konekta_token'); localStorage.removeItem('konekta_user'); window.location.reload(); }}><ArrowRight size={15} /> Sai husi konta</button></div></aside></div></div>; }
function SettingToggle({ label, description, checked, onChange }) { return <button type="button" className="setting-toggle-row" onClick={onChange}><span><b>{label}</b><small>{description}</small></span><span className={`availability-toggle ${checked ? 'on' : ''}`}><span /></span></button>; }
function Overview({ requests, onNew, onVerify, onDonor, dataSource, stats, t }) {
  const liveStats = stats || { activeRequests: 12, availableDonors: 486, matchedDonors: 74, smsQueued: 218 };
  return <div className="content">
    <section className="welcome-row"><div><p className="welcome">{t.welcome} <span>👋</span></p><p className="muted">{t.overviewSub} <span className={`data-source ${dataSource}`}>{dataSource === 'api' ? t.live : t.demo}</span></p></div><button className="primary-button" onClick={onNew}><Plus size={18} /> {t.newRequest}</button></section>
    <section className="stats-grid">
      <Stat icon={<HeartPulse />} label={t.activeRequests} value={liveStats.activeRequests} change={stats ? t.live : '+3'} tone="coral" />
      <Stat icon={<Users />} label={t.availableDonors} value={liveStats.availableDonors} change={stats ? t.live : '+28'} tone="blue" />
      <Stat icon={<Radio />} label={t.matchesToday} value={liveStats.matchedDonors} change={stats ? t.live : '+12%'} tone="yellow" />
      <Stat icon={<MessageSquare />} label={t.smsSent} value={liveStats.smsQueued} change={stats ? t.live : '+18%'} tone="green" />
    </section>
    <section className="grid-main">
      <div className="panel request-panel"><div className="panel-heading"><div><h2>Pedidos raan foun</h2><p className="muted">Akompanha pedidu ne'ebé presiza atensaun</p></div><button className="text-button" onClick={() => onNew()}>Haree hotu <ArrowRight size={16} /></button></div>
        <div className="request-list">{requests.slice(0, 3).map((request) => <RequestRow key={request.id} request={request} onVerify={onVerify} />)}</div>
      </div>
      <div className="panel impact-panel"><div className="panel-heading"><div><h2>Impaktu ita-nia rede</h2><p className="muted">Ita salva moris hamutuk</p></div><HeartPulse className="panel-icon" size={22} /></div><div className="impact-number">128 <span>moris apoiadu</span></div><div className="progress-label"><span>Objetivu mensal</span><b>78%</b></div><div className="progress"><span /></div><p className="impact-note"><span>↗</span> Diak liu 24% husi fulan kotuk</p><div className="mini-people"><div className="stacked-avatars"><i>JS</i><i>MA</i><i>LC</i><i>+8</i></div><span>+11 doadores foun semana ne'e</span></div></div>
    </section>
    <section className="lower-grid"><div className="panel tips-panel"><div className="panel-heading"><div><h2>Atividade ne'ebé presiza</h2><p className="muted">Labele husik oportunidade</p></div><Clock3 size={21} className="panel-icon" /></div><div className="tip-row"><div className="tip-icon"><ShieldCheck size={21} /></div><div><b>Verifika pedidos pendente</b><p className="muted">2 pedidos hein verifikasaun</p></div><button className="round-arrow" onClick={() => onVerify(requests.find(r => r.status === 'Pendente')?.id)}><ArrowRight size={17} /></button></div><div className="tip-row"><div className="tip-icon sms"><MessageSquare size={20} /></div><div><b>Rejistu doadores iha komunidade</b><p className="muted">Aumenta cobertura iha Dili</p></div><button className="round-arrow" onClick={onDonor}><ArrowRight size={17} /></button></div></div><div className="panel channels-panel"><div className="panel-heading"><div><h2>Kanál notifikasaun</h2><p className="muted">Alcance doadores iha tempu real</p></div></div><div className="channel"><span className="channel-icon web"><Bell size={18} /></span><div><b>Web push</b><small>Ativu · 312 doadores</small></div><strong>64%</strong></div><div className="channel"><span className="channel-icon sms"><MessageSquare size={18} /></span><div><b>SMS fallback</b><small>Ativu · 174 doadores</small></div><strong>36%</strong></div></div></section>
  </div>;
}

function Stat({ icon, label, value, change, tone }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div><p>{label}</p><strong>{value}</strong><small className="positive">{change} <span>vs semana kotuk</span></small></div></div>; }
function RequestRow({ request, onVerify, onSelect }) { return <div className="request-row request-row-clickable" onClick={() => onSelect?.(request)}><div className={`blood-badge ${request.blood.replace('+', 'pos').replace('-', 'neg')}`}>{request.blood}</div><div className="request-info"><div><b>{request.patient}</b><span className={`urgency ${request.urgency === 'Urgente' ? 'urgent' : ''}`}>{request.urgency}</span></div><p><MapPin size={13} /> {request.location}</p><small>{request.id} · {request.time}</small></div><div className="request-status"><span className={`status-pill ${request.status === 'Verifikadu' ? 'verified' : request.status === 'Pendente' ? 'pending' : 'complete'}`}>{request.status === 'Verifikadu' && <Check size={13} />}{request.status}</span>{request.status === 'Verifikadu' ? <small><Users size={13} /> {request.donors} matches</small> : request.status === 'Pendente' ? <button className="verify-button" onClick={(event) => { event.stopPropagation(); onVerify(request.id); }}>Verifika</button> : null}</div></div>; }
function Requests({ requests, onNew, onVerify, onSelect, t }) { const [query, setQuery] = useState(''); const [filter, setFilter] = useState('Hotu'); const filters = [['Hotu', 'Hotu'], ['Pendente', t.pending], ['Verifikadu', t.verified], ['Fulfilled', 'Kompletu']]; const visible = requests.filter((request) => (filter === 'Hotu' || request.status === filter) && `${request.patient} ${request.location} ${request.blood} ${request.id}`.toLowerCase().includes(query.toLowerCase())); return <div className="content"><section className="welcome-row"><div><p className="welcome">{t.requests}</p><p className="muted">{t.requestsPageSub}</p></div><button className="primary-button" onClick={onNew}><Plus size={18} /> {t.newRequest}</button></section><div className="panel full-panel"><div className="panel-heading request-toolbar"><div><h2>{t.requests}</h2><p className="muted">{visible.length} / {requests.length} pedidos iha sistema</p></div><div className="request-tools"><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buka pedido..." /></label><div className="dropdown"><button className="filter-button" onClick={() => setFilter(filter === 'Hotu' ? 'Pendente' : 'Hotu')}>{filters.find(([value]) => value === filter)?.[1]} <ChevronDown size={15} /></button></div></div></div><div className="filter-tabs">{filters.map(([value, label]) => <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="request-list">{visible.length ? visible.map((request) => <RequestRow key={request.id} request={request} onVerify={onVerify} onSelect={onSelect} />) : <div className="empty-state"><Search size={24} /><b>La hetan pedido</b><span>Tenta buka ho liafuan seluk.</span></div>}</div></div></div>; }
function RequestDetail({ request, t, onClose, onVerify, onStatus }) { return <div className="modal-backdrop"><div className="modal detail-modal"><div className="modal-header"><div><span className="eyebrow">DETALHE PEDIDO</span><h2>{request.id}</h2></div><button className="icon-button" onClick={onClose}><X size={19} /></button></div><div className="detail-hero"><div className={`blood-badge ${request.blood.replace('+', 'pos').replace('-', 'neg')}`}>{request.blood}</div><div><h3>{request.patient}</h3><span className={`urgency ${request.urgency === 'Urgente' ? 'urgent' : ''}`}>{request.urgency}</span></div></div><div className="detail-grid"><div><small>HOSPITAL</small><b><MapPin size={14} />{request.location}</b></div><div><small>STATUS</small><b>{request.status}</b></div><div><small>DATA</small><b>{request.time}</b></div><div><small>MATCHES</small><b><Users size={14} />{request.donors}</b></div></div><div className="detail-actions">{request.status === 'Pendente' && <button className="primary-button" onClick={() => onVerify(request.id)}><ShieldCheck size={16} /> Verifika agora</button>}{request.status === 'Verifikadu' && <><button className="success-button" onClick={() => onStatus(request, 'Fulfilled')}><Check size={16} /> Marka kompletu</button><button className="cancel-button" onClick={() => onStatus(request, 'Cancelled')}><X size={16} /> Kansela</button></>}</div></div></div>; }
function AdminUsers({ t }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  useEffect(() => { listAdminUsers().then(setUsers).catch((requestError) => setError(requestError.message)); }, []);
  return <div className="content"><section className="welcome-row"><div><p className="welcome">{t.users}</p><p className="muted">{t.usersSub}</p></div></section><div className="panel user-list">{error && <div className="form-error">{error}</div>}{users.map((item) => <div className="donor-result" key={item.id}><span className={`role-avatar role-${item.role}`}>{item.role.slice(0, 1).toUpperCase()}</span><div><b>{item.full_name}</b><small>{item.email} · {item.municipality || '—'}</small></div><span className="role-label-inline">{item.role}</span></div>)}{!error && users.length === 0 && <p className="muted">{t.loading}</p>}</div></div>;
}
function DonorDirectory({ onDonor, t }) {
  const [bloodType, setBloodType] = useState('O+');
  const [municipality, setMunicipality] = useState('');
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState('');
  const search = async (event) => {
    event.preventDefault();
    try {
      setResults(await findDonors(bloodType, municipality));
      setMessage('');
    } catch (error) {
      setResults([]);
      setMessage(error.message);
    }
  };
  return <div className="content"><section className="welcome-row"><div><p className="welcome">{t.donorNetwork}</p><p className="muted">{t.donorNetworkSub}</p></div><button className="primary-button" onClick={onDonor}><Plus size={18} /> {t.registerDonor}</button></section><div className="panel donor-search-panel"><div className="panel-heading"><div><h2>{t.findDonors}</h2><p className="muted">{t.findDonorsSub}</p></div><Search size={22} /></div><form className="form donor-search-form" onSubmit={search}><div className="form-row"><label>{t.bloodType}<select value={bloodType} onChange={(event) => setBloodType(event.target.value)}>{['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((type) => <option key={type}>{type}</option>)}</select></label><label>{t.municipality}<input value={municipality} onChange={(event) => setMunicipality(event.target.value)} placeholder="Dili" /></label></div><button className="primary-button" type="submit"><Search size={16} /> {t.search}</button></form>{message && <div className="form-error">{message}</div>}<div className="donor-results">{results.map((donor) => <div className="donor-result" key={donor.id}><span className="blood-badge">{donor.blood_type}</span><div><b>{donor.full_name}</b><small>{donor.municipality} · {donor.phone}</small></div><span className="available-label">{t.available}</span></div>)}{!message && results.length === 0 && <p className="muted">{t.searchHint}</p>}</div></div></div>;
}
function NotificationMenu({ notifications, unreadCount, onRead, onReadAll, t }) { const [filter, setFilter] = useState('all'); const items = filter === 'unread' ? notifications.filter((item) => !item.read) : notifications; return <div className="dropdown-menu notification-menu"><div className="notification-menu-head"><div><b>Notifikasaun</b><small>{unreadCount} foun</small></div>{unreadCount > 0 && <button onClick={onReadAll}>Lee hotu</button>}</div><div className="notification-filters"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Hotu</button><button className={filter === 'unread' ? 'active' : ''} onClick={() => setFilter('unread')}>Foun ({unreadCount})</button></div><div className="notification-list">{items.length ? items.map((item) => <button className={`notification-item ${item.read ? 'read' : 'unread'}`} key={item.id} onClick={() => onRead(item.id)}><span className={`notification-item-icon ${item.type}`}><Bell size={15} /></span><span><b>{item.title}</b><small>{item.body}</small><em>{item.time}</em></span>{!item.read && <i />}</button>) : <div className="notification-empty"><Check size={20} /><span>La iha notifikasaun foun</span></div>}</div></div>; }
function DonorPortal({ t, notifications, onRead }) { const [available, setAvailable] = useState(true); const [read, setRead] = useState(false); return <div className="content donor-portal-content"><section className="portal-header"><div><span className="eyebrow">PORTAL DOADOR</span><p className="welcome">Bondia, José <span>👋</span></p><p className="muted">Ita bele ajuda salva moris ohin.</p></div><div className="portal-avatar">JS</div></section><div className="availability-card"><div className="availability-copy"><div className="availability-icon"><HeartPulse size={21} /></div><div><b>{available ? 'Disponivel atu ajuda' : 'La disponivel agora'}</b><p>{available ? 'Ita bele simu pedidos raan.' : 'Ita sei la simu alerta foun.'}</p></div></div><button className={`availability-toggle ${available ? 'on' : ''}`} aria-label="Toggle availability" onClick={() => setAvailable(!available)}><span /></button></div><div className="portal-grid"><section className="portal-main"><div className="portal-section-heading"><div><h2>Alerta urgente</h2><p className="muted">Presiza doador O+ iha Dili</p></div><span className="live-dot">Agora</span></div><div className="urgent-alert"><div className="urgent-blood">O+</div><div className="urgent-copy"><b>Hospital Nacional Guido Valadares</b><p><MapPin size={13} /> Dili · 2.4 km husi ita</p><small>Presiza 3 doadores · Responde iha 18 min</small></div><button className="respond-button" onClick={() => setRead(true)}>{read ? <Check size={17} /> : <ArrowRight size={17} />}</button></div><div className="portal-section-heading history-heading"><div><h2>Atividade foin lalais</h2><p className="muted">Ita nia kontribuisaun</p></div><button className="text-button">Haree hotu <ArrowRight size={15} /></button></div><div className="donor-history"><div className="history-icon"><Check size={17} /></div><div><b>Disponibilidade atualizadu</b><small>Agora · Web</small></div><span>Ativu</span></div><div className="donor-history"><div className="history-icon blood-history"><Droplets size={17} /></div><div><b>Doasaun ikus</b><small>12 Setembru 2026 · HNGV</small></div><span>Diak</span></div></section><aside className="portal-side"><div className="portal-section-heading"><div><h2>Notifikasaun</h2><p className="muted">Atualizasaun importante</p></div><span className="notification-count">{notifications.filter((item) => !item.read).length}</span></div>{notifications.slice(0, 2).map((item) => <button key={item.id} className={`inbox-item ${item.read ? '' : 'unread'}`} onClick={() => onRead(item.id)}><span className={`inbox-icon ${item.type}`}><Bell size={16} /></span><div><b>{item.title}</b><small>{item.time} · {item.body}</small></div></button>)}<div className="portal-tip"><ShieldCheck size={18} /><div><b>Haree ita nia seguransa</b><p>Informasaun ita nian protejidu no deit uza ba koordinasaun raan.</p></div></div></aside></div></div>; }
function DonorPortalConnected({ user, notifications, onRead, onUserUpdated, onSaved }) {
  const [available, setAvailable] = useState(user?.donor_available !== false);
  const [read, setRead] = useState(false);
  const [saving, setSaving] = useState(false);
  const toggleAvailability = async () => {
    const nextAvailable = !available;
    setAvailable(nextAvailable);
    setSaving(true);
    try {
      const nextUser = await updateMyProfile({
        fullName: user.full_name || user.name,
        email: user.email,
        notificationWebEnabled: user.notification_web_enabled !== false,
        notificationSmsEnabled: user.notification_sms_enabled !== false,
        availability: nextAvailable,
      });
      onUserUpdated(nextUser);
      onSaved(nextAvailable ? 'Disponibilidade ativu.' : 'Disponibilidade dezativu.');
    } catch (error) {
      setAvailable(!nextAvailable);
      onSaved(`Disponibilidade la konsege atualiza: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };
  return <div className="content donor-portal-content"><section className="portal-header"><div><span className="eyebrow">PORTAL DOADOR</span><p className="welcome">Bondia, {user?.full_name || user?.name || 'doador'} <span>👋</span></p><p className="muted">Ita bele ajuda salva moris ohin.</p></div><div className="portal-avatar">{(user?.full_name || 'Doador').slice(0, 2).toUpperCase()}</div></section><div className="availability-card"><div className="availability-copy"><div className="availability-icon"><HeartPulse size={21} /></div><div><b>{available ? 'Disponivel atu ajuda' : 'La disponivel agora'}</b><p>{available ? 'Ita bele simu pedidos raan.' : 'Ita sei la simu alerta foun.'}</p></div></div><button className={`availability-toggle ${available ? 'on' : ''}`} aria-label="Toggle availability" disabled={saving} onClick={toggleAvailability}><span /></button></div><div className="portal-grid"><section className="portal-main"><div className="portal-section-heading"><div><h2>Alerta urgente</h2><p className="muted">Presiza doador O+ iha Dili</p></div><span className="live-dot">Agora</span></div><div className="urgent-alert"><div className="urgent-blood">O+</div><div className="urgent-copy"><b>Hospital Nacional Guido Valadares</b><p><MapPin size={13} /> Dili · 2.4 km husi ita</p><small>Presiza 3 doadores · Responde iha 18 min</small></div><button className="respond-button" onClick={() => setRead(true)}>{read ? <Check size={17} /> : <ArrowRight size={17} />}</button></div><div className="portal-section-heading history-heading"><div><h2>Atividade foin lalais</h2><p className="muted">Ita nia kontribuisaun</p></div><button className="text-button">Haree hotu <ArrowRight size={15} /></button></div><div className="donor-history"><div className="history-icon"><Check size={17} /></div><div><b>Disponibilidade atualizadu</b><small>Agora · Web</small></div><span>{available ? 'Ativu' : 'Pausa'}</span></div><div className="donor-history"><div className="history-icon blood-history"><Droplets size={17} /></div><div><b>Doasaun ikus</b><small>12 Setembru 2026 · HNGV</small></div><span>Diak</span></div></section><aside className="portal-side"><div className="portal-section-heading"><div><h2>Notifikasaun</h2><p className="muted">Atualizasaun importante</p></div><span className="notification-count">{notifications.filter((item) => !item.read).length}</span></div>{notifications.slice(0, 2).map((item) => <button key={item.id} className={`inbox-item ${item.read ? '' : 'unread'}`} onClick={() => onRead(item.id)}><span className={`inbox-icon ${item.type}`}><Bell size={16} /></span><div><b>{item.title}</b><small>{item.time} · {item.body}</small></div></button>)}<div className="portal-tip"><ShieldCheck size={18} /><div><b>Haree ita nia seguransa</b><p>Informasaun ita nian protejidu no deit uza ba koordinasaun raan.</p></div></div></aside></div></div>;
}
function Modal({ title, onClose, children }) { return <div className="modal-backdrop"><div className="modal"><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }
function RequestForm({ onSubmit, t }) { return <form onSubmit={onSubmit} className="form"><label>{t.patientName}<input name="patient" placeholder="Ez. Maria da Costa" required /></label><div className="form-row"><label>{t.bloodType}<select name="blood" defaultValue="O+"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label><label>{t.urgency}<select name="urgency" defaultValue="Urgente"><option value="Urgente">{t.urgent}</option><option value="Normal">{t.normal}</option></select></label></div><label>{t.hospitalLocation}<input name="location" defaultValue="Hospital Nacional Guido Valadares" required /></label><div className="consent"><input type="checkbox" required /> <span>{t.consentRequest}</span></div><button className="primary-button submit-button" type="submit">{t.submitRequest} <ArrowRight size={17} /></button></form>; }
function DonorForm({ onDone, t }) { return <form onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); onDone({ fullName: form.get('fullName'), bloodType: form.get('bloodType'), municipality: form.get('municipality'), phone: form.get('phone'), consent: true }); }} className="form"><label>{t.fullName}<input name="fullName" placeholder="Ez. José da Silva" required /></label><div className="form-row"><label>{t.bloodType}<select name="bloodType" defaultValue="O+"><option>O+</option><option>O-</option><option>A+</option><option>A-</option><option>B+</option><option>B-</option><option>AB+</option><option>AB-</option></select></label><label>{t.municipality}<select name="municipality" defaultValue="Dili"><option>Dili</option><option>Baucau</option><option>Ermera</option><option>Maliana</option></select></label></div><label>{t.phone}<input name="phone" type="tel" placeholder="+670 7xxx xxxx" required /></label><div className="consent"><input type="checkbox" required /> <span>{t.consentDonor}</span></div><button className="primary-button submit-button" type="submit">{t.register} <Check size={17} /></button></form>; }
function AccountForm({ onDone, t }) {
  const [role, setRole] = useState('donor');
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const session = await registerAccount({
        role,
        fullName: form.get('fullName'),
        email: form.get('email'),
        password: form.get('password'),
        sex: form.get('sex'),
        dateOfBirth: form.get('dateOfBirth'),
        weightKg: form.get('weightKg'),
        heightCm: form.get('heightCm'),
        bloodType: form.get('bloodType'),
        municipality: form.get('municipality'),
        phone: form.get('phone'),
      });
      onDone(session);
    } catch (registrationError) {
      setError(registrationError.message);
    }
  };
  return <form onSubmit={submit} className="form"><p className="muted">{t.registerSub}</p><div className="account-type-grid"><button type="button" className={`account-type ${role === 'donor' ? 'selected' : ''}`} onClick={() => setRole('donor')}><Droplets size={18} /><span><b>{t.donorAccount}</b><small>{t.donorAccountSub}</small></span></button><button type="button" className={`account-type ${role === 'recipient' ? 'selected' : ''}`} onClick={() => setRole('recipient')}><HeartPulse size={18} /><span><b>{t.recipientAccount}</b><small>{t.recipientAccountSub}</small></span></button></div><label>{t.fullName}<input name="fullName" required /></label><div className="form-row"><label>{t.sex}<select name="sex" defaultValue="Prefer not to say"><option>Female</option><option>Male</option><option>Other</option><option>Prefer not to say</option></select></label><label>{t.dateOfBirth}<input name="dateOfBirth" type="date" required /></label></div><div className="form-row"><label>{t.bloodType}<select name="bloodType" defaultValue="O+">{['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map((type) => <option key={type}>{type}</option>)}</select></label><label>{t.municipality}<input name="municipality" required /></label></div><div className="form-row"><label>{t.weight}<input name="weightKg" type="number" min="30" max="250" step="0.1" required /></label><label>{t.height}<input name="heightCm" type="number" min="100" max="250" step="0.1" required /></label></div><div className="form-row"><label>{t.email}<input name="email" type="email" required /></label><label>{t.phone}<input name="phone" type="tel" required /></label></div><label>{t.password}<input name="password" type="password" minLength="12" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button submit-button" type="submit">{t.registerAccount} <ArrowRight size={17} /></button></form>;
}

function LoginForm({ onDone, t }) { const [error, setError] = useState(''); const [accountType, setAccountType] = useState('donor'); const accountOptions = [{ value: 'admin', label: t.adminAccount, icon: ShieldCheck, description: t.adminAccountSub }, { value: 'recipient', label: t.recipientAccount, icon: HeartPulse, description: t.recipientAccountSub }, { value: 'donor', label: t.donorAccount, icon: Droplets, description: t.donorAccountSub }]; return <form onSubmit={async (event) => { event.preventDefault(); setError(''); const form = new FormData(event.currentTarget); try { const session = await login(form.get('email'), form.get('password')); if (session.user.role !== accountType) { setError(`Konta ne'e mak ${session.user.role}, la'ós ${accountOptions.find((item) => item.value === accountType)?.label}.`); return; } onDone(session); } catch (loginError) { setError(loginError.message); } }} className="form"><p className="muted">{t.loginSub}</p><div className="account-type-grid">{accountOptions.map(({ value, label, icon: Icon, description }) => <button type="button" key={value} className={`account-type ${accountType === value ? 'selected' : ''}`} onClick={() => setAccountType(value)}><Icon size={18} /><span><b>{label}</b><small>{description}</small></span>{accountType === value && <Check size={14} />}</button>)}</div><label>{t.email}<input name="email" type="email" required /></label><label>{t.password}<input name="password" type="password" required /></label>{error && <div className="form-error">{error}</div>}<button className="primary-button submit-button" type="submit">{t.login} <ArrowRight size={17} /></button></form>; }

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js?v=2', { updateViaCache: 'none' }).catch(() => {}));
createRoot(document.getElementById('root')).render(<App />);
