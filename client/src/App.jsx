import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';

const SERVER_URL = 'http://192.168.0.105:5000';
const API_URL = `${SERVER_URL}/api/assets`;

// --- 1. MAIN DASHBOARD VIEW ---
function AssetDashboard() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState('');
  const [source, setSource] = useState('manual');
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAssets = async (query = '') => {
    try {
      const url = query ? `${API_URL}?search=${encodeURIComponent(query)}` : API_URL;
      const res = await fetch(url);
      const data = await res.json();
      setAssets(data);
    } catch {
      setErrorMsg('Cannot reach server. Check Wi-Fi and backend status.');
    }
  };

  useEffect(() => {
    fetchAssets(search);
  }, [search]);

  // Handle file selection + instant preview
  const handleFileChange = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) {
      setPhoto(null);
      setPreviewUrl('');
      return;
    }

    // Client-side validation for instant feedback
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      setErrorMsg('Invalid file type. Only JPEG, PNG, WEBP, or GIF images are allowed.');
      setPhoto(null);
      setPreviewUrl('');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('File is too large (max 5 MB). Please choose a smaller image.');
      setPhoto(null);
      setPreviewUrl('');
      e.target.value = '';
      return;
    }

    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  // Save new asset (POST)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!assetId.trim() || !category.trim()) {
      setErrorMsg('Both Asset ID and Category are required.');
      return;
    }
    if (!photo) {
      setErrorMsg('Please select or capture an asset photograph.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('asset_id', assetId.trim());
    formData.append('category', category.trim());
    formData.append('source', source);
    formData.append('photo', photo);

    try {
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setAssetId('');
        setCategory('');
        setSource('manual');
        setPhoto(null);
        setPreviewUrl('');
        e.target.reset();
        fetchAssets(search);
      } else {
        setErrorMsg(data.error || 'Failed to save asset.');
      }
    } catch {
      setErrorMsg('Network error while uploading asset.');
    } finally {
      setSubmitting(false);
    }
  };

    // Delete asset (DELETE)
  const handleDelete = async (e, id, assetCode) => {
    e.preventDefault(); // Prevents opening the detail page when tapping Delete
    e.stopPropagation();

    if (!window.confirm(`Delete asset "${assetCode}"?`)) return;

    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchAssets(search);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to delete asset.');
      }
    } catch {
      setErrorMsg('Network error while deleting asset.');
    }
  };

  return (
    <div>
      {/* Clean Mobile Heading Spacing */}
      <h1 style={{ fontSize: '2rem', lineHeight: '1.25', marginBottom: '1.5rem' }}>
        Warehouse Asset Tracker
      </h1>

      {/* Visible On-Screen Error Banner */}
      {errorMsg && (
        <div
          role="alert"
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            border: '1px solid #f87171',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontWeight: '500',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Add Asset Form (noValidate lets our custom error banner show on empty submit) */}
      <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '12px', marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Asset ID (e.g., WH-1001)"
          value={assetId}
          onChange={(e) => setAssetId(e.target.value)}
          style={{ padding: '10px', fontSize: '16px' }}
        />
        <input
          type="text"
          placeholder="Category (e.g., Laptop, Scanner)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ padding: '10px', fontSize: '16px' }}
        />
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          style={{ padding: '10px', fontSize: '16px' }}
        >
          <option value="manual">Manual Entry</option>
          <option value="automated">Automated</option>
        </select>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          onChange={handleFileChange}
        />

        {/* Instant Image Preview Before Submitting */}
        {previewUrl && (
          <div style={{ textAlign: 'center', border: '1px dashed #888', padding: '10px', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#aaa' }}>Photo Preview:</p>
            <img
              src={previewUrl}
              alt="Selected asset preview"
              style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px', objectFit: 'contain' }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{ padding: '12px', fontSize: '16px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {submitting ? 'Uploading...' : 'Add Asset'}
        </button>
      </form>

      <h2>Inventory List ({assets.length})</h2>
      <input
        type="text"
        placeholder="Search by Asset ID..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px', fontSize: '16px', marginBottom: '1rem' }}
      />

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {assets.map((asset) => (
          <li key={asset.id} style={{ marginBottom: '10px' }}>
            <Link
              to={`/assets/${encodeURIComponent(asset.asset_id)}`}
              style={{
                border: '1px solid #555',
                borderRadius: '8px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '15px',
                textDecoration: 'none',
                color: 'inherit',
              }}
            >
              {asset.photo_path && (
                <img
                  src={`${SERVER_URL}/uploads/${asset.photo_path}`}
                  alt={asset.asset_id}
                  style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '4px' }}
                />
              )}
              <div style={{ flex: 1 }}>
                <strong>{asset.asset_id}</strong> — {asset.category}
                <br />
                <small>Source: {asset.source}</small>
              </div>
              <span style={{ fontSize: '18px', opacity: 0.7 }}>›</span>
                            <button
                type="button"
                onClick={(e) => handleDelete(e, asset.id, asset.asset_id)}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 10px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

// --- 2. DEDICATED DETAIL PAGE (/assets/:assetId) ---
function AssetDetail() {
  const { assetId } = useParams();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchOne = async () => {
      try {
        const res = await fetch(`${API_URL}/${encodeURIComponent(assetId)}`);
        const data = await res.json();
        if (res.ok) {
          setAsset(data);
        } else {
          setError(data.error || 'Asset not found.');
        }
      } catch {
        setError('Failed to load asset details.');
      }
    };
    fetchOne();
  }, [assetId]);

  if (error) {
    return (
      <div>
        <Link to="/" style={{ display: 'inline-block', marginBottom: '1rem' }}>← Back to Inventory</Link>
        <p style={{ color: '#f87171' }}>{error}</p>
      </div>
    );
  }

  if (!asset) return <p>Loading asset details...</p>;

  // Format SQLite timestamp cleanly
  const timestamp = asset.created_at || asset.timestamp || 'Recorded on server';

  return (
    <div>
      <Link to="/" style={{ display: 'inline-block', marginBottom: '1.25rem', fontSize: '16px' }}>
        ← Back to Inventory
      </Link>

      <h1 style={{ fontSize: '1.75rem', lineHeight: '1.25', marginBottom: '1rem' }}>
        {asset.asset_id}
      </h1>

      {asset.photo_path && (
        <img
          src={`${SERVER_URL}/uploads/${asset.photo_path}`}
          alt={asset.asset_id}
          style={{
            width: '100%',
            maxHeight: '420px',
            objectFit: 'contain',
            borderRadius: '8px',
            border: '1px solid #555',
            marginBottom: '1.25rem',
            backgroundColor: '#111',
          }}
        />
      )}

      <div style={{ border: '1px solid #555', borderRadius: '8px', padding: '16px', lineHeight: '1.8' }}>
        <div><strong>Asset ID:</strong> {asset.asset_id}</div>
        <div><strong>Category:</strong> {asset.category}</div>
        <div><strong>Entry Source:</strong> {asset.source}</div>
        <div><strong>Server Timestamp:</strong> {timestamp}</div>
      </div>
    </div>
  );
}

// --- 3. ROUTER WRAPPER ---
export default function App() {
  return (
    <BrowserRouter>
      <div style={{ maxWidth: '600px', margin: '1.5rem auto', padding: '0 1rem', fontFamily: 'sans-serif' }}>
        <Routes>
          <Route path="/" element={<AssetDashboard />} />
          <Route path="/assets/:assetId" element={<AssetDetail />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
