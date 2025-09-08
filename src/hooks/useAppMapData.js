import { useState, useCallback } from 'react';
import { fetchContainers as getContainers, fetchChildren as getChildren, setPosition } from '../api';

// Hook to manage loading and storing container nodes
export default function useAppMapData() {
  const [nodes, setNodes] = useState([]);

  // Load top-level containers
  const loadContainers = useCallback(async () => {
    const data = await getContainers();
    if (!data) return;
    setNodes(
      data.map((c) => ({
        id: c.id,
        name: c.name || '',
        description: c.description || '',
        x: c.position?.x ?? Math.random() * 1000,
        y: c.position?.y ?? Math.random() * 1000,
      }))
    );
  }, []);

  // Load child containers around a parent
  const loadChildren = useCallback(async (id, parentPos) => {
    const children = await getChildren(id);
    if (!children) return;
    const angleStep = (2 * Math.PI) / Math.max(children.length, 1);
    const processed = children.map((c, i) => ({
      id: c.id,
      name: c.name || '',
      description: c.description || '',
      x: c.position?.x ?? parentPos.x + Math.cos(i * angleStep) * 150,
      y: c.position?.y ?? parentPos.y + Math.sin(i * angleStep) * 150,
    }));
    setNodes((prev) => {
      const existing = new Set(prev.map((n) => n.id));
      const newNodes = processed.filter((n) => !existing.has(n.id));
      return [...prev, ...newNodes];
    });
  }, []);

  // Update a node's position, optionally persisting to backend
  const updateNodePosition = useCallback((id, x, y, persist = false) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, x, y } : n)));
    if (persist) {
      try {
        setPosition(id, id, { x, y });
      } catch (err) {
        console.error('Failed to save position', err);
      }
    }
  }, []);

  return { nodes, loadContainers, loadChildren, updateNodePosition };
}
