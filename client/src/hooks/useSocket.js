import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useQueryClient } from '@tanstack/react-query';

export default function useSocket(mongoId, githubRepoId, callbacks = {}) {
  const socketRef = useRef(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  const [toast, setToast] = useState(null);
  const [lastPRImpact, setLastPRImpact] = useState(null);
  const queryClient = useQueryClient();
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const showToast = useCallback((message, duration = 5000) => {
    setToast(message);
    setTimeout(() => setToast(null), duration);
  }, []);

  useEffect(() => {
    if (!mongoId) return;

    const socket = io(apiUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:repo', mongoId);
      if (githubRepoId) {
        socket.emit('join:repo:dual', { mongoId, githubRepoId });
      }
    });

    socket.on('pr:received', (data) => {
      showToast(`📥 PR #${data.prNumber} received: ${data.title}`);
    });

    socket.on('pr:analyzed', (data) => {
      showToast(`✅ PR #${data.prNumber} analyzed — ${data.impactedModules?.length || 0} nodes in blast radius`);
      setLastPRImpact({
        prNumber: data.prNumber,
        impactedNodeIds: data.impactedNodeIds || [],
        changedNodeIds: data.changedNodeIds || [],
      });
      callbacksRef.current.onPRAnalyzed?.(data);
      queryClient.invalidateQueries({ queryKey: ['prs', mongoId] });
      queryClient.invalidateQueries({ queryKey: ['graph', mongoId] });
    });

    socket.on('repo:ingested', (data) => {
      showToast(`🧠 Repository mapped — ${data.nodeCount} nodes · ${data.contextDebt || '?'}% context coverage`);
      queryClient.invalidateQueries({ queryKey: ['graph', mongoId] });
      queryClient.invalidateQueries({ queryKey: ['repos'] });
      queryClient.invalidateQueries({ queryKey: ['stats', mongoId] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [mongoId, githubRepoId, apiUrl, queryClient, showToast]);

  return { socket: socketRef.current, toast, lastPRImpact, clearPRImpact: () => setLastPRImpact(null) };
}
