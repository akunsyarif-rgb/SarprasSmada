/**
 * reports.js
 *
 * Tab Laporan: daftar laporan, form buat laporan baru, detail laporan
 * (riwayat + ubah status), untuk seluruh peran yang login (lihat catatan di
 * ReportsTab soal keterbatasan RBAC saat ini).
 */

function ReportForm(props) {
  var locations = props.locations, categories = props.categories, facilities = props.facilities, owners = props.owners;
  var _location = React.useState(''), locationId = _location[0], setLocationId = _location[1];
  var _category = React.useState(''), categoryId = _category[0], setCategoryId = _category[1];
  var _facility = React.useState(''), facilityId = _facility[0], setFacilityId = _facility[1];
  var _owner = React.useState(''), ownerId = _owner[0], setOwnerId = _owner[1];
  var _condition = React.useState(''), condition = _condition[0], setCondition = _condition[1];
  var _description = React.useState(''), description = _description[0], setDescription = _description[1];
  var _impact = React.useState(''), impactLevel = _impact[0], setImpactLevel = _impact[1];
  var _safety = React.useState(''), safetyRisk = _safety[0], setSafetyRisk = _safety[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _loading = React.useState(false), loading = _loading[0], setLoading = _loading[1];

  var facilitiesForCategory = facilities.filter(function (f) { return !categoryId || f.category_id === categoryId; });

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    Api.createReport(props.sessionToken, {
      location_id: locationId,
      category_id: categoryId,
      facility_id: facilityId || undefined,
      owner_id: ownerId || undefined,
      condition: condition,
      description: description,
      impact_level: impactLevel,
      safety_risk: safetyRisk
    })
      .then(function (report) {
        setLoading(false);
        props.onCreated(report);
      })
      .catch(function (err) {
        setLoading(false);
        setError(err.message);
      });
  }

  return React.createElement(
    'form',
    { className: 'form-vertical', onSubmit: handleSubmit },
    React.createElement(ErrorBanner, { message: error }),

    React.createElement('label', null, 'Lokasi *'),
    React.createElement(
      'select',
      { required: true, value: locationId, onChange: function (e) { setLocationId(e.target.value); } },
      React.createElement('option', { value: '' }, '-- Pilih lokasi --'),
      locations.map(function (l) { return React.createElement('option', { key: l.location_id, value: l.location_id }, l.location_path || l.location_name); })
    ),

    React.createElement('label', null, 'Kategori *'),
    React.createElement(
      'select',
      { required: true, value: categoryId, onChange: function (e) { setCategoryId(e.target.value); setFacilityId(''); } },
      React.createElement('option', { value: '' }, '-- Pilih kategori --'),
      categories.map(function (c) { return React.createElement('option', { key: c.category_id, value: c.category_id }, c.category_name); })
    ),

    React.createElement('label', null, 'Fasilitas/Aset (opsional)'),
    React.createElement(
      'select',
      { value: facilityId, onChange: function (e) { setFacilityId(e.target.value); } },
      React.createElement('option', { value: '' }, '-- Tidak terikat fasilitas tertentu --'),
      facilitiesForCategory.map(function (f) { return React.createElement('option', { key: f.facility_id, value: f.facility_id }, f.facility_name); })
    ),

    React.createElement('label', null, 'Penanggung Jawab (opsional)'),
    React.createElement(
      'select',
      { value: ownerId, onChange: function (e) { setOwnerId(e.target.value); } },
      React.createElement('option', { value: '' }, '-- Belum ditentukan --'),
      owners.map(function (o) { return React.createElement('option', { key: o.owner_id, value: o.owner_id }, o.owner_name); })
    ),

    React.createElement('label', null, 'Kondisi Singkat'),
    React.createElement('input', { type: 'text', value: condition, placeholder: 'mis. AC bocor, saklar lampu rusak', onChange: function (e) { setCondition(e.target.value); } }),

    React.createElement('label', null, 'Deskripsi Lengkap *'),
    React.createElement('textarea', { required: true, rows: 4, value: description, onChange: function (e) { setDescription(e.target.value); } }),

    React.createElement('label', null, 'Tingkat Dampak'),
    React.createElement(
      'select',
      { value: impactLevel, onChange: function (e) { setImpactLevel(e.target.value); } },
      React.createElement('option', { value: '' }, '-- Tidak diisi --'),
      React.createElement('option', { value: 'RENDAH' }, 'Rendah'),
      React.createElement('option', { value: 'SEDANG' }, 'Sedang'),
      React.createElement('option', { value: 'TINGGI' }, 'Tinggi')
    ),

    React.createElement('label', null, 'Risiko Keselamatan'),
    React.createElement(
      'select',
      { value: safetyRisk, onChange: function (e) { setSafetyRisk(e.target.value); } },
      React.createElement('option', { value: '' }, '-- Tidak diisi --'),
      React.createElement('option', { value: 'YA' }, 'Ya'),
      React.createElement('option', { value: 'TIDAK' }, 'Tidak')
    ),

    React.createElement('button', { type: 'submit', className: 'btn-primary', disabled: loading }, loading ? 'Mengirim...' : 'Kirim Laporan')
  );
}

function ReportDetail(props) {
  var report = props.report;
  var _history = React.useState([]), history = _history[0], setHistory = _history[1];
  var _notes = React.useState(''), notes = _notes[0], setNotes = _notes[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _loading = React.useState(false), loading = _loading[0], setLoading = _loading[1];

  React.useEffect(function () {
    Api.listReportHistory(props.sessionToken, report.report_id).then(setHistory).catch(function (err) { setError(err.message); });
  }, [report.report_id]);

  var canManage = CONFIG.WORKFLOW_ROLES.indexOf(props.currentUser.role) !== -1;
  var next = nextReportStatus(report.status);

  function handleChangeStatus() {
    if (!next) { return; }
    setError('');
    setLoading(true);
    Api.changeReportStatus(props.sessionToken, report.report_id, next, notes)
      .then(function (updated) {
        setLoading(false);
        props.onUpdated(updated);
      })
      .catch(function (err) {
        setLoading(false);
        setError(err.message);
      });
  }

  var locationName = props.locationsById[report.location_id] ? props.locationsById[report.location_id].location_path : report.location_id;
  var categoryName = props.categoriesById[report.category_id] ? props.categoriesById[report.category_id].category_name : report.category_id;

  return React.createElement(
    Modal,
    { title: report.report_number, onClose: props.onClose },
    React.createElement(ErrorBanner, { message: error }),
    React.createElement('div', { className: 'detail-row' }, React.createElement(StatusBadge, { status: report.status })),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Lokasi: '), locationName),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Kategori: '), categoryName),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Kondisi: '), report.condition || '-'),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Deskripsi: '), report.description),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Dampak: '), report.impact_level || '-'),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Risiko Keselamatan: '), report.safety_risk || '-'),
    React.createElement('div', { className: 'detail-row' }, React.createElement('strong', null, 'Dibuat: '), formatDateTime(report.created_at)),

    canManage && next && React.createElement(
      'div',
      { className: 'status-change-box' },
      React.createElement('label', null, 'Ubah status ke: ' + (CONFIG.REPORT_STATUS_LABELS[next] || next)),
      React.createElement('input', { type: 'text', placeholder: 'Catatan (opsional)', value: notes, onChange: function (e) { setNotes(e.target.value); } }),
      React.createElement('button', { className: 'btn-primary', disabled: loading, onClick: handleChangeStatus }, loading ? 'Menyimpan...' : 'Ubah Status')
    ),

    React.createElement('h4', null, 'Riwayat'),
    React.createElement(
      'ul',
      { className: 'history-list' },
      history.map(function (h) {
        return React.createElement(
          'li',
          { key: h.history_id },
          React.createElement('strong', null, h.action + ': '),
          (h.previous_status || '(baru)') + ' → ' + h.new_status,
          React.createElement('div', { className: 'history-meta' }, formatDateTime(h.created_at) + (h.notes ? ' — ' + h.notes : ''))
        );
      })
    )
  );
}

function ReportsTab(props) {
  var _reports = React.useState([]), reports = _reports[0], setReports = _reports[1];
  var _filter = React.useState(''), statusFilter = _filter[0], setStatusFilter = _filter[1];
  var _loading = React.useState(true), loading = _loading[0], setLoading = _loading[1];
  var _error = React.useState(''), error = _error[0], setError = _error[1];
  var _showForm = React.useState(false), showForm = _showForm[0], setShowForm = _showForm[1];
  var _selected = React.useState(null), selected = _selected[0], setSelected = _selected[1];

  function reload() {
    setLoading(true);
    Api.listReports(props.sessionToken, statusFilter || undefined)
      .then(function (data) { setReports(data); setLoading(false); })
      .catch(function (err) { setError(err.message); setLoading(false); });
  }

  React.useEffect(reload, [statusFilter]);

  var locationsById = indexById(props.locations, 'location_id');
  var categoriesById = indexById(props.categories, 'category_id');

  return React.createElement(
    'div',
    { className: 'tab-content' },
    React.createElement(
      'div',
      { className: 'tab-toolbar' },
      React.createElement(
        'select',
        { value: statusFilter, onChange: function (e) { setStatusFilter(e.target.value); } },
        React.createElement('option', { value: '' }, 'Semua Status'),
        Object.keys(CONFIG.REPORT_STATUS).map(function (key) {
          return React.createElement('option', { key: key, value: key }, CONFIG.REPORT_STATUS_LABELS[key]);
        })
      ),
      React.createElement('button', { className: 'btn-primary', onClick: function () { setShowForm(true); } }, '+ Buat Laporan')
    ),
    React.createElement(ErrorBanner, { message: error }),
    React.createElement(
      'p',
      { className: 'muted-note' },
      'Catatan: daftar ini menampilkan seluruh laporan aktif ke semua peran yang login — pembatasan tampilan per pelapor/owner belum diimplementasikan di backend (PHASE 5, lihat docs/DEVELOPMENT_ROADMAP.md).'
    ),
    loading ? React.createElement(Spinner) : React.createElement(
      'div',
      { className: 'report-list' },
      reports.length === 0 && React.createElement('p', null, 'Belum ada laporan.'),
      reports.map(function (r) {
        return React.createElement(
          'div',
          { key: r.report_id, className: 'report-card', onClick: function () { setSelected(r); } },
          React.createElement('div', { className: 'report-card-top' },
            React.createElement('strong', null, r.report_number),
            React.createElement(StatusBadge, { status: r.status })
          ),
          React.createElement('div', null, locationsById[r.location_id] ? locationsById[r.location_id].location_path : r.location_id),
          React.createElement('div', { className: 'muted-note' }, categoriesById[r.category_id] ? categoriesById[r.category_id].category_name : r.category_id),
          React.createElement('div', { className: 'report-card-desc' }, r.description)
        );
      })
    ),
    showForm && React.createElement(
      Modal,
      { title: 'Buat Laporan Baru', onClose: function () { setShowForm(false); } },
      React.createElement(ReportForm, {
        sessionToken: props.sessionToken,
        locations: props.locations,
        categories: props.categories,
        facilities: props.facilities,
        owners: props.owners,
        onCreated: function () { setShowForm(false); reload(); }
      })
    ),
    selected && React.createElement(ReportDetail, {
      report: selected,
      sessionToken: props.sessionToken,
      currentUser: props.currentUser,
      locationsById: locationsById,
      categoriesById: categoriesById,
      onClose: function () { setSelected(null); },
      onUpdated: function (updated) { setSelected(updated); reload(); }
    })
  );
}
