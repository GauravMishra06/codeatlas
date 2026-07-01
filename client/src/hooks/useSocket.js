import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Custom hook for Socket.io real-time communication.
 * Connects to the backend, joins the repo room, and listens
 * for PR and ingestion events.
 *
 * @param {string} repoId - MongoDB ObjectId of the current repo.
 * @returns {{ socket: object|null, toast: string|null }}
 */
export default function useSocket(repoId) {
  const socketRef = useRef(null);
  const [toast, setToast] = useState(null);
  const queryClient = useQueryClient();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  /**
   * Clear the toast message after a timeout.
   */
  const showToast = useCallback((message, duration = 5000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => {
    if (!repoId) return;

    // Connect to Socket.io server
    const socket = io(apiUrl, {
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Join the repo-specific room
      socket.emit('join:repo', repoId);
    });

    // Listen for PR received events
    socket.on('pr:received', (data) => {
      showToast(`📥 PR #${data.prNumber} received: ${data.title}`);
    });

    // Listen for PR analyzed events
    socket.on('pr:analyzed', (data) => {
      showToast(`✅ PR #${data.prNumber} analyzed — ${data.impactedModules?.length || 0} modules impacted`);
      // Refetch PRs and graph data
      queryClient.invalidateQueries({ queryKey: ['prs', repoId] });
      queryClient.invalidateQueries({ queryKey: ['graph', repoId] });
    });

    // Listen for repo ingestion complete
    socket.on('repo:ingested', (data) => {
      showToast(`🧠 Repository ingested — ${data.nodeCount} nodes created`);
      queryClient.invalidateQueries({ queryKey: ['graph', repoId] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [repoId, apiUrl, queryClient, showToast]);

  return { socket: socketRef.current, toast };
}
