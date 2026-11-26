import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useParams } from 'react-router-dom';

// Dynamically resolves to localhost on PC or the laptop's LAN IP when opened from a phone
const SERVER_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:5000`;
const API_URL = `${SERVER_URL}/api/assets`;

// Reusable debounce hook to prevent firing a network request on every keystroke
function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Convert SQLite UTC timestamp ("YYYY-MM-DD HH:MM:SS") to the user's local time
function formatLocalTimestamp(sqliteTimestamp) {
  if (!sqliteTimestamp) return 'Unknown';
  const isoUtc = sqliteTimestamp.includes('T')
    ? sqliteTimestamp
    : `${sqliteTimestamp.replace(' ', 'T')}Z`;
  const date = new Date(isoUtc);
  return Number.isNaN(date.getTime()) ? sqliteTimestamp : date.toLocaleString();
}

// --- 1. MAIN DASHBOARD VIEW ---
function AssetDashboard() {
  const [assets, setAssets] = useState([]);
  const [assetId, setAssetId] = useState('');
  const [category, setCategory] = useState('');
  const [photo, setPhoto] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [search, setSearch] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const fetchAssets = async (query = '') => {
    setLoading(true);
    try {
      const url = query ? `${API_URL}?search=${encodeURIComponent(query)}` : API_URL;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Failed to load assets from server.');
        setAssets([]);
        return;
      }

      setAssets(Array.isArray(data) ? data : []);
    } catch {
      setErrorMsg('Cannot reach server. Ensure the backend is running on port 5000.');
      setAssets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssets(debouncedSearch);
  }, [debouncedSearch]);

  const handleFileChange = (e) => {
    setErrorMsg('');
    const file = e.target.files?.[0];
    if (!file) {
      setPhoto(null);
      setPreviewUrl('');
      return;
    }

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
    formData.append('source', 'manual'); // Worker UI always submits manual entries
    formData.append('photo', photo);

    try {
      const res = await fetch(API_URL, { method: 'POST', body: formData });
      const data = await res.json();

      if (res.ok) {
        setAssetId('');
        setCategory('');
        setPhoto(null);
        setPreviewUrl('');
        e.target.reset();
        fetchAssets(debouncedSearch);
      } else {
        setErrorMsg(data.error || 'Failed to save asset.');
      }
    } catch {
      setErrorMsg('Network error while uploading asset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, assetCode) => {
    if (!window.confirm(`Delete asset "${assetCode}"?`)) return;
    setErrorMsg('');

    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        fetchAssets(debouncedSearch);
      } else {
        setErrorMsg(data.error || 'Failed to delete asset.');
      }
    } catch {
      setErrorMsg('Network error while deleting asset.');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '2rem', lineHeight: '1.25', marginBottom: '1.5rem' }}>
        Warehouse Asset Tracker
      </h1>

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
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          capture="environment"
          onChange={handleFileChange}
        />

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

      {loading ? (
        <p style={{ color: '#888' }}>Loading assets...</p>
      ) : assets.length === 0 ? (
        <p style={{ color: '#888', textAlign: 'center', padding: '1.5rem 0' }}>
          No assets yet.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {assets.map((asset) => (
            <li
              key={asset.id}
              style={{
                border: '1px solid #555',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              {/* Link wraps only the clickable asset info—Delete button sits beside it */}
              <Link
                to={`/assets/${encodeURIComponent(asset.asset_id)}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '15px',
                  flex: 1,
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
              </Link>

              <button
                type="button"
                onClick={() => handleDelete(asset.id, asset.asset_id)}
                style={{
                  backgroundColor: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
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
        <Link to="/" style={{ display: 'inline-block', marginBottom: '1rem' }}>
          ← Back to Inventory
        </Link>
        <p style={{ color: '#f87171' }}>{error}</p>
      </div>
    );
  }

  if (!asset) return <p>Loading asset details...</p>;

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
        <div><strong>Recorded At:</strong> {formatLocalTimestamp(asset.created_at)}</div>
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
