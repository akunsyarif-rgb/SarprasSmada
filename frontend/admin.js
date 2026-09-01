/**
 * admin.js
 *
 * Tab Admin: pengelolaan data master (lokasi, kategori, fasilitas, owner)
 * dan pengguna. Seluruh mutasi di sini hanya diterima backend dari peran
 * ADMIN (lihat apps-script/api/MasterDataApi.gs, UserApi.gs) — komponen ini
 * hanya dirender ketika currentUser.role === 'ADMIN' (lihat app.js), tapi
 * otorisasi SESUNGGUHNYA tetap di server, bukan di sini.
 */

/**
 * Manager generik untuk entitas bernama sederhana (category_name/owner_name
 * + description) — dipakai Kategori dan Owner, yang strukturnya identik.
 */
function NamedEntityManager(props) {
  var _items = React.useState([]), items = _items[0], setItems = _items[1];
  var _loading = React.useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _name = React.useState(''), name = _name[0], setName = _name[1];
  var _desc = React.useState(''), desc = _desc[0], setDesc = _desc[1];

  function reload() {
    setLoading(true);
    props.api.list(props.sessionToken)
      .then(function (data) { setItems(data); setLoading(false); })
      .catch(function (err) { setError(err.message); setLoading(false); });
  }
  React.useEffect(reload, []);

  function handleCreate(e) {
    e.preventDefault();
    setError('');
    var payload = {};
    payload[props.nameField] = name;
    payload.description = desc;
    props.api.create(props.sessionToken, payload)
      .then(function () { setName(''); setDesc(''); reload(); })
      .catch(function (err) { setError(err.message); });
  }

  function handleDeactivate(id) {
    if (!confirm('Nonaktifkan data ini?')) { return; }
    props.api.deactivate(props.sessionToken, id)
      .then(reload)
      .catch(function (err) { setError(err.message); });
  }

  return React.createElement(
    'div',
    { className: 'admin-section' },
    React.createElement('h3', null, props.title),
    React.createElement(ErrorBanner, { message: error }),
    React.createElement(
      'form',
      { className: 'inline-form', onSubmit: handleCreate },
      React.createElement('input', { type: 'text', placeholder: 'Nama', required: true, value: name, onChange: function (e) { setName(e.target.value); } }),
      React.createElement('input', { type: 'text', placeholder: 'Keterangan (opsional)', value: desc, onChange: function (e) { setDesc(e.target.value); } }),
      React.createElement('button', { type: 'submit', className: 'btn-primary' }, 'Tambah')
    ),
    loading ? React.createElement(Spinner) : React.createElement(
      'table',
      { className: 'data-table' },
      React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Nama'), React.createElement('th', null, 'Keterangan'), React.createElement('th', null, ''))),
      React.createElement('tbody', null, items.map(function (item) {
        return React.createElement(
          'tr',
          { key: item[props.idField] },
          React.createElement('td', null, item[props.nameField]),
          React.createElement('td', null, item.description || '-'),
          React.createElement('td', null, React.createElement('button', { className: 'btn-danger-outline', onClick: function () { handleDeactivate(item[props.idField]); } }, 'Nonaktifkan'))
        );
      }))
    )
  );
}

function LocationManager(props) {
  var _items = React.useState([]), items = _items[0], setItems = _items[1];
  var _loading = React.useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _name = React.useState(''), name = _name[0], setName = _name[1];
  var _type = React.useState(''), type = _type[0], setType = _type[1];
  var _parent = React.useState(''), parentId = _parent[0], setParentId = _parent[1];

  function reload() {
    setLoading(true);
    Api.listLocations(props.sessionToken)
      .then(function (data) { setItems(data); setLoading(false); })
      .catch(function (err) { setError(err.message); setLoading(false); });
  }
  React.useEffect(reload, []);

  function handleCreate(e) {
    e.preventDefault();
    setError('');
    Api.createLocation(props.sessionToken, { location_name: name, location_type: type, parent_id: parentId || undefined })
      .then(function () { setName(''); setType(''); setParentId(''); reload(); })
      .catch(function (err) { setError(err.message); });
  }

  function handleDeactivate(id) {
    if (!confirm('Nonaktifkan lokasi ini?')) { return; }
    Api.deactivateLocation(props.sessionToken, id).then(reload).catch(function (err) { setError(err.message); });
  }

  return React.createElement(
    'div',
    { className: 'admin-section' },
    React.createElement('h3', null, 'Lokasi'),
    React.createElement(ErrorBanner, { message: error }),
    React.createElement(
      'form',
      { className: 'inline-form', onSubmit: handleCreate },
      React.createElement('input', { type: 'text', placeholder: 'Nama lokasi', required: true, value: name, onChange: function (e) { setName(e.target.value); } }),
      React.createElement('input', { type: 'text', placeholder: 'Jenis (mis. GEDUNG/LANTAI/RUANG)', required: true, value: type, onChange: function (e) { setType(e.target.value); } }),
      React.createElement(
        'select',
        { value: parentId, onChange: function (e) { setParentId(e.target.value); } },
        React.createElement('option', { value: '' }, '-- Lokasi induk (opsional) --'),
        items.map(function (l) { return React.createElement('option', { key: l.location_id, value: l.location_id }, l.location_path); })
      ),
      React.createElement('button', { type: 'submit', className: 'btn-primary' }, 'Tambah')
    ),
    loading ? React.createElement(Spinner) : React.createElement(
      'table',
      { className: 'data-table' },
      React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Jalur Lokasi'), React.createElement('th', null, 'Jenis'), React.createElement('th', null, ''))),
      React.createElement('tbody', null, items.map(function (item) {
        return React.createElement(
          'tr',
          { key: item.location_id },
          React.createElement('td', null, item.location_path),
          React.createElement('td', null, item.location_type),
          React.createElement('td', null, React.createElement('button', { className: 'btn-danger-outline', onClick: function () { handleDeactivate(item.location_id); } }, 'Nonaktifkan'))
        );
      }))
    )
  );
}

function FacilityManager(props) {
  var _items = React.useState([]), items = _items[0], setItems = _items[1];
  var _loading = React.useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _name = React.useState(''), name = _name[0], setName = _name[1];
  var _category = React.useState(''), categoryId = _category[0], setCategoryId = _category[1];

  function reload() {
    setLoading(true);
    Api.listFacilities(props.sessionToken)
      .then(function (data) { setItems(data); setLoading(false); })
      .catch(function (err) { setError(err.message); setLoading(false); });
  }
  React.useEffect(reload, []);

  function handleCreate(e) {
    e.preventDefault();
    setError('');
    Api.createFacility(props.sessionToken, { facility_name: name, category_id: categoryId })
      .then(function () { setName(''); setCategoryId(''); reload(); })
      .catch(function (err) { setError(err.message); });
  }

  function handleDeactivate(id) {
    if (!confirm('Nonaktifkan fasilitas ini?')) { return; }
    Api.deactivateFacility(props.sessionToken, id).then(reload).catch(function (err) { setError(err.message); });
  }

  var categoriesById = indexById(props.categories, 'category_id');

  return React.createElement(
    'div',
    { className: 'admin-section' },
    React.createElement('h3', null, 'Fasilitas / Aset'),
    React.createElement(ErrorBanner, { message: error }),
    React.createElement(
      'form',
      { className: 'inline-form', onSubmit: handleCreate },
      React.createElement('input', { type: 'text', placeholder: 'Nama fasilitas', required: true, value: name, onChange: function (e) { setName(e.target.value); } }),
      React.createElement(
        'select',
        { required: true, value: categoryId, onChange: function (e) { setCategoryId(e.target.value); } },
        React.createElement('option', { value: '' }, '-- Kategori --'),
        props.categories.map(function (c) { return React.createElement('option', { key: c.category_id, value: c.category_id }, c.category_name); })
      ),
      React.createElement('button', { type: 'submit', className: 'btn-primary' }, 'Tambah')
    ),
    loading ? React.createElement(Spinner) : React.createElement(
      'table',
      { className: 'data-table' },
      React.createElement('thead', null, React.createElement('tr', null, React.createElement('th', null, 'Nama'), React.createElement('th', null, 'Kategori'), React.createElement('th', null, ''))),
      React.createElement('tbody', null, items.map(function (item) {
        return React.createElement(
          'tr',
          { key: item.facility_id },
          React.createElement('td', null, item.facility_name),
          React.createElement('td', null, categoriesById[item.category_id] ? categoriesById[item.category_id].category_name : item.category_id),
          React.createElement('td', null, React.createElement('button', { className: 'btn-danger-outline', onClick: function () { handleDeactivate(item.facility_id); } }, 'Nonaktifkan'))
        );
      }))
    )
  );
}

function UsersManager(props) {
  var _items = React.useState([]), items = _items[0], setItems = _items[1];
  var _loading = React.useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _email = React.useState(''), email = _email[0], setEmail = _email[1];
  var _fullName = React.useState(''), fullName = _fullName[0], setFullName = _fullName[1];
  var _role = React.useState('SISWA'), role = _role[0], setRole = _role[1];
  var _passwordFor = React.useState(null), passwordFor = _passwordFor[0], setPasswordFor = _passwordFor[1];
  var _newPassword = React.useState(''), newPassword = _newPassword[0], setNewPassword = _newPassword[1];

  function reload() {
    setLoading(true);
    Api.listUsers(props.sessionToken)
      .then(function (data) { setItems(data); setLoading(false); })
      .catch(function (err) { setError(err.message); setLoading(false); });
  }
  React.useEffect(reload, []);

  function handleCreate(e) {
    e.preventDefault();
    setError('');
    Api.createUser(props.sessionToken, { email: email, full_name: fullName, role: role })
      .then(function () { setEmail(''); setFullName(''); setRole('SISWA'); reload(); })
      .catch(function (err) { setError(err.message); });
  }

  function handleDeactivate(id) {
    if (!confirm('Nonaktifkan pengguna ini?')) { return; }
    Api.deactivateUser(props.sessionToken, id).then(reload).catch(function (err) { setError(err.message); });
  }

  function handleSetPassword(e) {
    e.preventDefault();
    setError('');
    Api.setPassword(props.sessionToken, passwordFor.user_id, newPassword)
      .then(function () { setPasswordFor(null); setNewPassword(''); reload(); })
      .catch(function (err) { setError(err.message); });
  }

  return React.createElement(
    'div',
    { className: 'admin-section' },
    React.createElement('h3', null, 'Pengguna'),
    React.createElement(ErrorBanner, { message: error }),
    React.createElement(
      'form',
      { className: 'inline-form', onSubmit: handleCreate },
      React.createElement('input', { type: 'email', placeholder: 'Email', required: true, value: email, onChange: function (e) { setEmail(e.target.value); } }),
      React.createElement('input', { type: 'text', placeholder: 'Nama lengkap', required: true, value: fullName, onChange: function (e) { setFullName(e.target.value); } }),
      React.createElement(
        'select',
        { value: role, onChange: function (e) { setRole(e.target.value); } },
        Object.keys(CONFIG.ROLES).map(function (r) { return React.createElement('option', { key: r, value: r }, CONFIG.ROLE_LABELS[r]); })
      ),
      React.createElement('button', { type: 'submit', className: 'btn-primary' }, 'Tambah')
    ),
    React.createElement('p', { className: 'muted-note' }, 'Pengguna baru belum punya password — klik "Set Password" untuk menetapkan password awal.'),
    loading ? React.createElement(Spinner) : React.createElement(
      'table',
      { className: 'data-table' },
      React.createElement('thead', null, React.createElement('tr', null,
        React.createElement('th', null, 'Nama'), React.createElement('th', null, 'Email'), React.createElement('th', null, 'Peran'), React.createElement('th', null, '')
      )),
      React.createElement('tbody', null, items.map(function (item) {
        return React.createElement(
          'tr',
          { key: item.user_id },
          React.createElement('td', null, item.full_name),
          React.createElement('td', null, item.email),
          React.createElement('td', null, CONFIG.ROLE_LABELS[item.role] || item.role),
          React.createElement(
            'td',
            null,
            React.createElement('button', { className: 'btn-outline', onClick: function () { setPasswordFor(item); } }, 'Set Password'),
            ' ',
            React.createElement('button', { className: 'btn-danger-outline', onClick: function () { handleDeactivate(item.user_id); } }, 'Nonaktifkan')
          )
        );
      }))
    ),
    passwordFor && React.createElement(
      Modal,
      { title: 'Set Password — ' + passwordFor.full_name, onClose: function () { setPasswordFor(null); } },
      React.createElement(
        'form',
        { className: 'form-vertical', onSubmit: handleSetPassword },
        React.createElement('label', null, 'Password Baru (minimal 8 karakter)'),
        React.createElement('input', { type: 'password', required: true, minLength: 8, value: newPassword, onChange: function (e) { setNewPassword(e.target.value); } }),
        React.createElement('button', { type: 'submit', className: 'btn-primary' }, 'Simpan')
      )
    )
  );
}

function AdminTab(props) {
  var _section = React.useState('categories'), section = _section[0], setSection = _section[1];

  var sections = [
    { key: 'locations', label: 'Lokasi' },
    { key: 'categories', label: 'Kategori' },
    { key: 'facilities', label: 'Fasilitas' },
    { key: 'owners', label: 'Owner' },
    { key: 'users', label: 'Pengguna' }
  ];

  return React.createElement(
    'div',
    { className: 'tab-content' },
    React.createElement(NavTabs, { tabs: sections, active: section, onChange: setSection }),
    section === 'locations' && React.createElement(LocationManager, { sessionToken: props.sessionToken }),
    section === 'categories' && React.createElement(NamedEntityManager, {
      title: 'Kategori', sessionToken: props.sessionToken, nameField: 'category_name', idField: 'category_id',
      api: { list: Api.listCategories, create: Api.createCategory, deactivate: Api.deactivateCategory }
    }),
    section === 'facilities' && React.createElement(FacilityManager, { sessionToken: props.sessionToken, categories: props.categories }),
    section === 'owners' && React.createElement(NamedEntityManager, {
      title: 'Owner / Penanggung Jawab', sessionToken: props.sessionToken, nameField: 'owner_name', idField: 'owner_id',
      api: { list: Api.listOwners, create: Api.createOwner, deactivate: Api.deactivateOwner }
    }),
    section === 'users' && React.createElement(UsersManager, { sessionToken: props.sessionToken })
  );
}
