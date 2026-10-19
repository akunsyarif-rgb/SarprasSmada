/**
 * app.js
 *
 * Komponen App root: sesi (dikelola SDK Appwrite), routing tab, dan pengambilan data
 * master yang dipakai lintas tab (locations/categories/facilities/owners).
 * Dimuat PALING TERAKHIR (lihat index.html) karena mereferensikan komponen
 * yang didefinisikan di file-file sebelumnya.
 */

function App() {
  var _session = React.useState(null), session = _session[0], setSession = _session[1];
  var _booting = React.useState(true), booting = _booting[0], setBooting = _booting[1];
  var _tab = React.useState('reports'), tab = _tab[0], setTab = _tab[1];
  var _showChangePassword = React.useState(false), showChangePassword = _showChangePassword[0], setShowChangePassword = _showChangePassword[1];

  var _locations = React.useState([]), locations = _locations[0], setLocations = _locations[1];
  var _categories = React.useState([]), categories = _categories[0], setCategories = _categories[1];
  var _facilities = React.useState([]), facilities = _facilities[0], setFacilities = _facilities[1];
  var _owners = React.useState([]), owners = _owners[0], setOwners = _owners[1];
  var _dataError = React.useState(''), dataError = _dataError[0], setDataError = _dataError[1];

  React.useEffect(function () {
    Api.restoreSession().then(function (restored) { setSession(restored); setBooting(false); });
  }, []);

  React.useEffect(function () {
    if (!session) { return; }
    setDataError('');
    Promise.all([
      Api.listLocations(),
      Api.listCategories(),
      Api.listFacilities(),
      Api.listOwners()
    ])
      .then(function (results) {
        setLocations(results[0]);
        setCategories(results[1]);
        setFacilities(results[2]);
        setOwners(results[3]);
      })
      .catch(function (err) {
        setDataError(err.message);
        // Sesi sudah tidak valid di server (401) — kembali ke layar login.
        if (err.code === 401) { setSession(null); }
      });
  }, [session && session.user.user_id]);

  function handleLogin(newSession) {
    setSession(newSession);
  }

  function handleLogout() {
    Api.logout().catch(function () { /* logout tetap lokal walau request gagal */ });
    setSession(null);
  }

  if (booting) {
    return React.createElement(Spinner);
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
      currentUser: user,
      locations: locations,
      categories: categories,
      facilities: facilities,
      owners: owners
    }),
    tab === 'admin' && user.role === CONFIG.ROLES.ADMIN && React.createElement(AdminTab, {
      categories: categories
    }),
    showChangePassword && React.createElement(ChangePasswordModal, {
      onClose: function () { setShowChangePassword(false); },
      onDone: function () { setShowChangePassword(false); alert('Password berhasil diganti.'); }
    })
  );
}

var rootElement = document.getElementById('root');
var root = ReactDOM.createRoot(rootElement);
root.render(React.createElement(App));
