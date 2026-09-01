import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import { ownerHandleUrl } from '../utils/ownerHandle';
import './Hardware.css';

export type HardwareDevice = {
  id: string;
  serial: string;
  topic: string;
  createdAt: string;
};

const HardwareRegistry: React.FC = () => {
  const navigate = useNavigate();
  const [serial, setSerial] = useState('');
  const [devices, setDevices] = useState<HardwareDevice[]>([]);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await adminAPI.listHardware();
    setDevices(res.data.devices || []);
  }, []);

  useEffect(() => {
    load().catch((err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error || 'Failed to load hardware');
    });
  }, [load]);

  const onRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setBusy(true);
    try {
      const res = await adminAPI.registerHardware(serial);
      const rec = res.data as HardwareDevice;
      setStatus(`Topic ${rec.topic} · ${ownerHandleUrl(rec.serial)}`);
      setSerial('');
      await load();
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } };
      setError(ax.response?.data?.error || 'Register failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page hardware-page">
      <header className="admin-header-bar">
        <div className="header-top">
          <button type="button" onClick={() => navigate('/')} className="btn btn-ghost">
            ← Back
          </button>
        </div>
        <h1 className="neon-title">Hardware registry</h1>
        <p className="muted">Register a serial to get an MQTT topic under serpico/hard-data/hw/</p>
      </header>

      <form onSubmit={onRegister} className="admin-panel hardware-form">
        {error ? <p className="error-message">{error}</p> : null}
        {status ? <p className="hardware-ok">{status}</p> : null}
        <div className="field">
          <label htmlFor="hw-serial">Serial number</label>
          <input
            id="hw-serial"
            value={serial}
            onChange={(e) => setSerial(e.target.value)}
            placeholder="SN-1001"
            autoComplete="off"
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Registering…' : 'Register'}
        </button>
      </form>

      <div className="hardware-list">
        {devices.length === 0 ? (
          <p className="muted">No hardware registered yet.</p>
        ) : (
          devices.map((d) => (
            <button
              key={d.id}
              type="button"
              className="module-card admin-panel"
              onClick={() => navigate(`/hardware/${d.id}`)}
            >
              <h2>{d.serial}</h2>
              <p className="muted">
                <code>{d.topic}</code>
              </p>
              <p className="muted">
                <code>{ownerHandleUrl(d.serial)}</code>
              </p>
            </button>
          ))
        )}
      </div>
    </div>
  );
};

export default HardwareRegistry;
