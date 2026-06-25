/**
 * AuthStepModal — Firebase account connect step in the startup queue.
 * Wraps AuthModal content in the queue's consistent card size.
 */
import AuthModal from './AuthModal';

export default function AuthStepModal({ open, onClose, onSuccess }) {
  if (!open) return null;
  // AuthModal already renders its own backdrop + card; just pass through
  return (
    <AuthModal
      mode="login"
      onClose={onClose}
      onSuccess={onSuccess}
      queueMode={true}
    />
  );
}
