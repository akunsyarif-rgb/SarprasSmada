/**
 * ui-common.js
 *
 * Komponen kecil yang dipakai lintas halaman: Badge, StatusBadge, Spinner,
 * ErrorBanner, Modal, Header, NavTabs, LoginScreen, ChangePasswordModal.
 */

function Badge(props) {
  return React.createElement('span', { className: 'badge ' + (props.className || 'badge-gray') }, props.children);
}

function StatusBadge(props) {
  var status = props.status;
  var label = CONFIG.REPORT_STATUS_LABELS[status] || status;
  return React.createElement(Badge, { className: reportStatusBadgeClass(status) }, label);
}

function RoleBadge(props) {
  var role = props.role;
  return React.createElement(Badge, { className: 'badge-outline' }, CONFIG.ROLE_LABELS[role] || role);
}

function Spinner() {
  return React.createElement('div', { className: 'spinner' }, 'Memuat...');
}

function ErrorBanner(props) {
  if (!props.message) {
    return null;
  }
  return React.createElement('div', { className: 'error-banner' }, props.message);
}

function SuccessBanner(props) {
  if (!props.message) {
    return null;
  }
  return React.createElement('div', { className: 'success-banner' }, props.message);
}

function Modal(props) {
  return React.createElement(
    'div',
    { className: 'modal-overlay', onClick: function (e) { if (e.target === e.currentTarget) { props.onClose(); } } },
    React.createElement(
      'div',
      { className: 'modal-box' },
      React.createElement(
        'div',
        { className: 'modal-header' },
        React.createElement('h3', null, props.title),
        React.createElement('button', { className: 'btn-icon', onClick: props.onClose }, '✕')
      ),
      React.createElement('div', { className: 'modal-body' }, props.children)
    )
  );
}

function Header(props) {
  var user = props.user;
  var _React$useState = React.useState(false),
    menuOpen = _React$useState[0],
    setMenuOpen = _React$useState[1];

  return React.createElement(
    'header',
    { className: 'app-header' },
    React.createElement('div', { className: 'app-title' }, 'SIGAP SARPRAS'),
    React.createElement(
      'div',
      { className: 'header-user', onClick: function () { setMenuOpen(!menuOpen); } },
      React.createElement('span', null, user.full_name),
      React.createElement(RoleBadge, { role: user.role }),
      menuOpen && React.createElement(
        'div',
        { className: 'header-menu' },
        React.createElement('button', { onClick: props.onChangePassword }, 'Ganti Password'),
        React.createElement('button', { onClick: props.onLogout }, 'Keluar')
      )
    )
  );
}

function NavTabs(props) {
  return React.createElement(
    'nav',
    { className: 'nav-tabs' },
    props.tabs.map(function (tab) {
      return React.createElement(
        'button',
        {
          key: tab.key,
          className: 'nav-tab' + (props.active === tab.key ? ' active' : ''),
          onClick: function () { props.onChange(tab.key); }
        },
        tab.label
      );
    })
  );
}

function LoginScreen(props) {
  var _email = React.useState(''), email = _email[0], setEmail = _email[1];
  var _password = React.useState(''), password = _password[0], setPassword = _password[1];
  var _loading = React.useState(false), loading = _loading[0], setLoading = _loading[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    Api.login(email, password)
      .then(function (session) {
        setLoading(false);
        props.onLogin(session);
      })
      .catch(function (err) {
        setLoading(false);
        setError(err.message);
      });
  }

  return React.createElement(
    'div',
    { className: 'login-screen' },
    React.createElement(
      'form',
      { className: 'login-card', onSubmit: handleSubmit },
      React.createElement('h1', null, 'SIGAP SARPRAS'),
      React.createElement('p', { className: 'login-subtitle' }, 'Sistem Informasi Gerak Cepat Pelaporan Sarana Prasarana'),
      React.createElement(ErrorBanner, { message: error }),
      React.createElement('label', null, 'Email'),
      React.createElement('input', {
        type: 'email',
        value: email,
        required: true,
        autoComplete: 'username',
        onChange: function (e) { setEmail(e.target.value); }
      }),
      React.createElement('label', null, 'Password'),
      React.createElement('input', {
        type: 'password',
        value: password,
        required: true,
        autoComplete: 'current-password',
        onChange: function (e) { setPassword(e.target.value); }
      }),
      React.createElement('button', { type: 'submit', className: 'btn-primary', disabled: loading }, loading ? 'Memproses...' : 'Masuk')
    )
  );
}

function ChangePasswordModal(props) {
  var _old = React.useState(''), oldPassword = _old[0], setOldPassword = _old[1];
  var _new = React.useState(''), newPassword = _new[0], setNewPassword = _new[1];
  var _confirm = React.useState(''), confirmPassword = _confirm[0], setConfirmPassword = _confirm[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _loading = React.useState(false), loading = _loading[0], setLoading = _loading[1];

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password baru tidak cocok.');
      return;
    }
    setLoading(true);
    Api.changePassword(props.sessionToken, oldPassword, newPassword)
      .then(function () {
        setLoading(false);
        props.onDone();
      })
      .catch(function (err) {
        setLoading(false);
        setError(err.message);
      });
  }

  return React.createElement(
    Modal,
    { title: 'Ganti Password', onClose: props.onClose },
    React.createElement(
      'form',
      { onSubmit: handleSubmit, className: 'form-vertical' },
      React.createElement(ErrorBanner, { message: error }),
      React.createElement('label', null, 'Password Lama'),
      React.createElement('input', { type: 'password', required: true, value: oldPassword, onChange: function (e) { setOldPassword(e.target.value); } }),
      React.createElement('label', null, 'Password Baru (minimal 8 karakter)'),
      React.createElement('input', { type: 'password', required: true, minLength: 8, value: newPassword, onChange: function (e) { setNewPassword(e.target.value); } }),
      React.createElement('label', null, 'Konfirmasi Password Baru'),
      React.createElement('input', { type: 'password', required: true, value: confirmPassword, onChange: function (e) { setConfirmPassword(e.target.value); } }),
      React.createElement('button', { type: 'submit', className: 'btn-primary', disabled: loading }, loading ? 'Menyimpan...' : 'Simpan')
    )
  );
}
