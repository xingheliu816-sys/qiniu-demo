'use client';

import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition } from 'cytoscape';
import type { GraphData, GraphNode, GraphEdge } from '@/lib/api';

// 节点类型 → 颜色
const NODE_COLOR: Record<string, string> = {
  character: '#7b9bbf',    // 蓝灰
  location: '#7fb87f',     // 绿
  event: '#e89a5c',        // 橙
  plot: '#a48ad4',         // 紫
  conflict: '#d97570',     // 红
  clue: '#e7c768',         // 黄
  faction: '#6fb5b8',      // 青
  object: '#a5876e',       // 棕
  theme: '#c9a8d8',        // 淡紫
};

// importance → 节点大小
function importanceSize(imp?: string): number {
  switch (imp) {
    case 'high': return 56;
    case 'low': return 24;
    case 'medium':
    default: return 38;
  }
}

// strength → 边宽
function strengthWidth(s?: string): number {
  switch (s) {
    case 'high': return 3;
    case 'low': return 1;
    case 'medium':
    default: return 2;
  }
}

interface Props {
  data: GraphData;
  /** 节点类型过滤（空集合 → 全部） */
  typeFilter?: Set<string>;
  /** 章节过滤（空集合 → 全部） */
  chapterFilter?: Set<number>;
  onNodeClick?: (node: GraphNode) => void;
  onEdgeClick?: (edge: GraphEdge) => void;
}

export default function RelationshipGraphCanvas({ data, typeFilter, chapterFilter, onNodeClick, onEdgeClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // 初始化 cytoscape 实例（只创建一次）
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: [
        {
          selector: 'node',
          style: {
            'label': 'data(label)',
            'text-valign': 'bottom',
            'text-halign': 'center',
            'text-margin-y': 4,
            'font-size': 11,
            'color': '#2f2a25',
            'background-color': 'data(color)',
            'border-width': 2,
            'border-color': '#ffffff',
            'width': 'data(size)',
            'height': 'data(size)',
            'text-wrap': 'wrap',
            'text-max-width': '100',
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#c94f2d',
          },
        },
        {
          selector: 'node.faded',
          style: { 'opacity': 0.2 },
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(width)',
            'line-color': '#c8cdd4',
            'target-arrow-color': '#c8cdd4',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'font-size': 9,
            'color': '#86807a',
            'opacity': 0.85,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#c94f2d',
            'target-arrow-color': '#c94f2d',
            'width': 4,
            'opacity': 1,
          },
        },
        {
          selector: 'edge.faded',
          style: { 'opacity': 0.1 },
        },
      ],
      layout: { name: 'cose', animate: false, fit: true, padding: 40 },
      wheelSensitivity: 0.2,
      minZoom: 0.15,
      maxZoom: 3,
    });

    cyRef.current = cy;

    cy.on('tap', 'node', (evt) => {
      const id = evt.target.id();
      const node = (data.nodes || []).find(n => n.id === id);
      if (node && onNodeClick) onNodeClick(node);
    });

    cy.on('tap', 'edge', (evt) => {
      const id = evt.target.id();
      const edge = (data.edges || []).find(e => e.id === id);
      if (edge && onEdgeClick) onEdgeClick(edge);
    });

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 数据 / 过滤变化时刷新元素
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const nodes: GraphNode[] = data.nodes || [];
    const edges: GraphEdge[] = data.edges || [];

    const passType = (n: GraphNode) =>
      !typeFilter || typeFilter.size === 0 || typeFilter.has(n.type);
    const passChapter = (n: GraphNode) => {
      if (!chapterFilter || chapterFilter.size === 0) return true;
      const refs = n.source_refs || [];
      if (refs.length === 0) return true; // 全局节点保留
      return refs.some(r => {
        const cid = typeof r.chapter_id === 'string' ? parseInt(r.chapter_id, 10) : (r.chapter_id as number);
        return chapterFilter.has(cid);
      });
    };

    const visibleNodeIds = new Set(
      nodes.filter(n => passType(n) && passChapter(n)).map(n => n.id)
    );

    const elements: ElementDefinition[] = [];
    for (const n of nodes) {
      const visible = visibleNodeIds.has(n.id);
      elements.push({
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          color: NODE_COLOR[n.type] || '#a0a8b0',
          size: importanceSize(n.importance),
        },
        classes: visible ? '' : 'faded',
      });
    }
    for (const e of edges) {
      const visible = visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target);
      if (!e.source || !e.target) continue;
      // 跳过引用了不存在节点的边
      if (!nodes.find(n => n.id === e.source) || !nodes.find(n => n.id === e.target)) continue;
      elements.push({
        data: {
          id: e.id || `${e.source}__${e.target}`,
          source: e.source,
          target: e.target,
          label: e.label || '',
          width: strengthWidth(e.strength),
        },
        classes: visible ? '' : 'faded',
      });
    }

    cy.elements().remove();
    cy.add(elements);
    cy.layout({ name: 'cose', animate: false, fit: true, padding: 40 }).run();
  }, [data, typeFilter, chapterFilter]);

  return (
    <div ref={containerRef} className="w-full h-full bg-paper/30 rounded-xl" />
  );
}

export const NODE_TYPE_COLORS = NODE_COLOR;
