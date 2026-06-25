import { useEffect, useState } from 'react';
import { store } from '../store/store';
import ConfirmDialog from './ConfirmDialog';

export default function BackupReminderGate({ open: openProp, onClose: onCloseProp } = {}) {
  const [open, setOpen] = useState(false);
  const [daysSince, setDaysSince] = useState(0);

  useEffect(() => {
    // Controlled externally
    if (openProp !== undefined) {
      setOpen(openProp);
      return;
    }
    // Self-managed (legacy fallback)
    const autoBackup = store.get('autoBackup') ?? true;
    if (!autoBackup) return;

    const last = store.get('lastBackupTime');
    if (!last) {
      store.set('lastBackupTime', new Date().toISOString());
      return;
    }

    const elapsedDays = (Date.now() - new Date(last)) / 86400000;
    if (elapsedDays < 7) return;

    const today = new Date().toDateString();
    if (store.get('backupReminderSnoozed') === today) return;

    const timer = window.setTimeout(() => {
      setDaysSince(Math.floor(elapsedDays));
      setOpen(true);
    }, 3000);

    return () => window.clearTimeout(timer);
  }, [openProp]);

  const snooze = () => {
    store.set('backupReminderSnoozed', new Date().toDateString());
    setOpen(false);
    onCloseProp?.();
  };

  const goToSettings = () => {
    setOpen(false);
    onCloseProp?.();
    window.location.href = '/settings';
  };

  return (
    <ConfirmDialog
      open={open}
      title="KUETx Backup Reminder"
      message={`It's been ${daysSince} days since your last backup. Your data is stored only in this browser, so a lost device or cleared cache means lost data. Go to Settings to download a backup now?`}
      confirmLabel="Go to Settings"
      cancelLabel="Later"
      confirmTone="primary"
      onConfirm={goToSettings}
      onCancel={snooze}
    />
  );
}