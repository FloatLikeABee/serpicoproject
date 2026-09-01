import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { adminAPI, API_BASE_URL } from '../services/api';
import {
  adminMqttUrl,
  publishMqttPayload,
  waitForHardwareMessage,
  type HardDataRecord,
} from '../utils/hardDataMqtt';
import type { HardwareDevice } from './HardwareRegistry';
import { ownerHandleUrl } from '../utils/ownerHandle';
import './Hardware.css';

const HardwareDevicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<HardwareDevice | null>(null);
  const [records, setRecords] = useState<HardDataRecord[]>([]);
  const [payload, setPayload] = useState('unit 12 on scene');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const loadDevice = useCallback(async () => {
    if (!id) {
      return;
    }
    const res = await adminAPI.getHardware(id);
    setDevice(res.data);
  }, [id]);

  const loadMessages = useCallback(async () => {
    if (!id) {
      return;
    }
    const res = await adminAPI.getHardwareMessages(id);
    setRecords(res.data.records || []);
  }, [id]);

  useEffect(() => {
    Promise.all([loadDevice(), loadMessages()]).catch((err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error || 'Failed to load device');
    });
  }, [loadDevice, loadMessages]);

  const sendTest = async () => {
    if (!device || !id) {
      return;
    }
    setError('');
    setStatus('');
    setBusy(true);
    try {
      await publishMqttPayload(adminMqttUrl(API_BASE_URL), device.topic, payload);
      const rec = await waitForHardwareMessage(
        `${API_BASE_URL.replace(/\/$/, '')}/admin/hardware/${id}/messages`,
        { topic: device.topic, payload, source: 'mqtt' }
      );
      setStatus(`Stored id ${rec.id}`);
      await loadMessages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'MQTT publish failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page hardware-page">
      <header className="admin-header-bar">
        <div className="header-top">
          <button type="button" onClick={() => navigate('/hardware')} className="btn btn-ghost">
            ← Registry
          </button>
        </div>
        <h1 className="neon-title">{device ? device.serial : 'Hardware'}</h1>
        {device ? (
          <>
            <p className="muted">
              MQTT topic <code className="hardware-topic">{device.topic}</code>
            </p>
            <p className="muted">
              Owner page <code className="hardware-topic">{ownerHandleUrl(device.serial)}</code>
            </p>
          </>
        ) : null}
      </header>

      {error ? <p className="error-message">{error}</p> : null}
      {status ? <p className="hardware-ok">{status}</p> : null}

      <section className="admin-panel hardware-form">
        <div className="field">
          <label htmlFor="hw-payload">Test payload</label>
          <textarea id="hw-payload" value={payload} onChange={(e) => setPayload(e.target.value)} />
        </div>
        <button type="button" className="btn btn-primary" disabled={busy || !device} onClick={() => void sendTest()}>
          {busy ? 'Publishing…' : 'Publish MQTT'}
        </button>
      </section>

      <div className="hardware-table-wrap">
        <table className="hardware-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Source</th>
              <th>Topic</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">
                  No messages on this topic yet.
                </td>
              </tr>
            ) : (
              records.map((rec) => (
                <tr key={rec.id}>
                  <td>{rec.receivedAt}</td>
                  <td>{rec.source}</td>
                  <td>
                    <code>{rec.topic}</code>
                  </td>
                  <td>{rec.payload}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default HardwareDevicePage;
