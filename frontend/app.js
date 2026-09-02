/**
 * app.js
 *
 * Komponen App root: sesi (localStorage), routing tab, dan pengambilan data
 * master yang dipakai lintas tab (locations/categories/facilities/owners).
 * Dimuat PALING TERAKHIR (lihat index.html) karena mereferensikan komponen
 * yang didefinisikan di file-file sebelumnya.
 */

function loadStoredSession() {
  try {
    var raw = localStorage.getItem(CONFIG.SESSION_STORAGE_KEY);
    if (!raw) { return null; }
    var session = JSON.parse(raw);
    if (!session || !session.token || !session.expiresAt) { return null; }
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function storeSession(session) {
  localStorage.setItem(CONFIG.SESSION_STORAGE_KEY, JSON.stringify(session));
}

function clearStoredSession() {
  localStorage.removeItem(CONFIG.SESSION_STORAGE_KEY);
}

function App() {
  var _session = React.useState(loadStoredSession), session = _session[0], setSession = _session[1];
  var _tab = React.useState('reports'), tab = _tab[0], setTab = _tab[1];
  var _showChangePassword = React.useState(false), showChangePassword = _showChangePassword[0], setShowChangePassword = _showChangePassword[1];

  var _locations = React.useState([]), locations = _locations[0], setLocations = _locations[1];
  var _categories = React.useState([]), categories = _categories[0], setCategories = _categories[1];
  var _facilities = React.useState([]), facilities = _facilities[0], setFacilities = _facilities[1];
  var _owners = React.useState([]), owners = _owners[0], setOwners = _owners[1];
  var _dataError = React.useState(''), dataError = _dataError[0], setDataError = _dataError[1];

  React.useEffect(function () {
    if (!session) { return; }
    var token = session.token;
    Promise.all([
      Api.listLocations(token),
      Api.listCategories(token),
      Api.listFacilities(token),
      Api.listOwners(token)
    ])
      .then(function (results) {
        setLocations(results[0]);
        setCategories(results[1]);
        setFacilities(results[2]);
        setOwners(results[3]);
      })
      .catch(function (err) {
        setDataError(err.message);
        // Sesi mungkin sudah tidak valid di server walau masih tersimpan
        // lokal (mis. dihapus dari cache lebih awal) — kembalikan ke layar
        // login agar pengguna tidak terjebak di layar kosong.
        if (/sesi/i.test(err.message) || /token/i.test(err.message)) {
          clearStoredSession();
          setSession(null);
        }
      });
  }, [session && session.token]);

  function handleLogin(newSession) {
    storeSession(newSession);
    setSession(newSession);
  }

  function handleLogout() {
    if (session) {
      Api.logout(session.token).catch(function () { /* logout tetap lokal walau request gagal */ });
    }
    clearStoredSession();
    setSession(null);
  }

  if (!session) {
    return React.createElement(LoginScreen, { onLogin: handleLogin });
  }

  var user = session.user;
  var tabs = [{ key: 'reports', label: 'Laporan' }];
  if (user.role === CONFIG.ROLES.ADMIN) {
    tabs.push({ key: 'admin', label: 'Admin' });
  }

  return React.createElement(
    'div',
    { className: 'app-shell' },
    React.createElement(Header, {
      user: user,
      onLogout: handleLogout,
      onChangePassword: function () { setShowChangePassword(true); }
    }),
    React.createElement(NavTabs, { tabs: tabs, active: tab, onChange: setTab }),
    React.createElement(ErrorBanner, { message: dataError }),
    tab === 'reports' && React.createElement(ReportsTab, {
      sessionToken: session.token,
      currentUser: user,
      locations: locations,
      categories: categories,
      facilities: facilities,
      owners: owners
    }),
    tab === 'admin' && user.role === CONFIG.ROLES.ADMIN && React.createElement(AdminTab, {
      sessionToken: session.token,
      categories: categories
    }),
    showChangePassword && React.createElement(ChangePasswordModal, {
      sessionToken: session.token,
      onClose: function () { setShowChangePassword(false); },
      onDone: function () { setShowChangePassword(false); alert('Password berhasil diganti.'); }
    })
  );
}

var rootElement = document.getElementById('root');
var root = ReactDOM.createRoot(rootElement);
root.render(React.createElement(App));
