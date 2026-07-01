import { useEffect, useRef, useCallback, useState } from 'react';
import * as d3 from 'd3';

/**
 * Color mapping for different node types.
 */
const NODE_COLORS = {
  File: '#58A6FF',
  Module: '#3FB950',
  Function: '#BC8CFF',
  Feature: '#E3B341',
};

/**
 * CodeGraph — D3 Hierarchical Flowchart (Collapsible Tree).
 * Left-to-Right orientation with progressive disclosure.
 *
 * @param {{ nodes: Array, edges: Array, onNodeClick: Function, config: object }} props
 */
export default function CodeGraph({ nodes, edges, onNodeClick, config }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);

  const [activeFilters, setActiveFilters] = useState({
    File: true,
    Module: true,
    Function: true,
    Feature: true,
  });

  /**
   * Toggle a node type filter on/off.
   */
  const toggleFilter = useCallback((type) => {
    setActiveFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    // 1. Filter nodes and edges by active type filters
    const visibleNodes = nodes.filter((n) => activeFilters[n.type] !== false);
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    if (visibleNodes.length === 0) return;

    // 2. Build Spanning Tree (BFS) to create strict Hierarchy
    let rootNodeData = visibleNodes.find(n => n.id.startsWith('repo:')) || visibleNodes[0];

    const adj = {};
    visibleEdges.forEach(e => {
      const src = typeof e.source === 'object' ? e.source.id : e.source;
      const tgt = typeof e.target === 'object' ? e.target.id : e.target;
      if (!adj[src]) adj[src] = [];
      adj[src].push(tgt);
    });

    const visited = new Set();
    const treeMap = new Map();
    visibleNodes.forEach(n => treeMap.set(n.id, { ...n, children: [] }));

    const rootId = rootNodeData.id;
    visited.add(rootId);
    const q = [rootId];

    // Build the tree (ignore cross-links for a clean flowchart)
    while(q.length > 0) {
      const currId = q.shift();
      const currNode = treeMap.get(currId);
      
      if (adj[currId]) {
        adj[currId].forEach(childId => {
          if (!visited.has(childId)) {
            visited.add(childId);
            const childNode = treeMap.get(childId);
            if(childNode) {
              currNode.children.push(childNode);
              q.push(childId);
            }
          }
        });
      }
    }

    const rootHierarchy = d3.hierarchy(treeMap.get(rootId));

    // 3. Setup SVG & Container
    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', width).attr('height', height);

    // SVG defs — glow filter
    const defs = svg.append('defs');
    const glowFilter = defs.append('filter').attr('id', 'glow');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'coloredBlur');
    const feMerge = glowFilter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'coloredBlur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    // Initial offset so the root node is somewhat centered-left
    const transform = d3.zoomIdentity.translate(width / 4, height / 2).scale(1);
    svg.call(zoom.transform, transform);

    // D3 Tree Layout Setup (Vertical spacing 40, Horizontal spacing 220)
    const tree = d3.tree().nodeSize([40, 220]);

    // Layer groups
    const gLink = g.append("g")
      .attr("fill", "none")
      .attr("stroke", "#30363D")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", 1.5);

    const gNode = g.append("g")
      .attr("cursor", "pointer")
      .attr("pointer-events", "all");

    // Helper for smooth Bezier curves (Left to Right)
    const diagonal = d3.linkHorizontal().x(d => d.y).y(d => d.x);

    const tooltip = d3.select('.graph-tooltip');
    if (tooltip.empty()) {
      d3.select('body').append('div').attr('class', 'graph-tooltip');
    }

    // Set initial collapse state: Only show Root's immediate children
    rootHierarchy.descendants().forEach((d) => {
      d.id = d.data.id;
      d._children = d.children; 
      if (d.depth > 0) d.children = null; 
    });

    // Initial positioning state
    rootHierarchy.x0 = 0;
    rootHierarchy.y0 = 0;

    // Update function handles Enter/Update/Exit transitions
    function update(source) {
      const nodes = rootHierarchy.descendants();
      const links = rootHierarchy.links();

      // Compute new tree layout
      tree(rootHierarchy);

      const duration = 400;
      const transition = svg.transition().duration(duration);

      // --- NODES ---
      const node = gNode.selectAll("g.node").data(nodes, d => d.id);

      const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", d => `translate(${source.y0},${source.x0})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0)
        .on("click", (event, d) => {
          if (d.children) {
            d._children = d.children;
            d.children = null; // collapse
          } else {
            d.children = d._children;
            d._children = null; // expand
          }
          if (onNodeClick) onNodeClick(d.data);
          update(d);
        })
        .on('mouseover', function (event, d) {
          d3.select(this).select('circle')
            .transition().duration(200)
            .attr('r', 12)
            .attr('stroke-opacity', 0.8)
            .style('filter', 'url(#glow)');

          d3.select('.graph-tooltip')
            .classed('visible', true)
            .html(`<strong>${d.data.name}</strong><br/><span style="color:#8B949E">${d.data.type} · ${d.data.filePath || ''}</span>`)
            .style('left', `${event.pageX + 12}px`)
            .style('top', `${event.pageY - 20}px`);
        })
        .on('mouseout', function () {
          d3.select(this).select('circle')
            .transition().duration(200)
            .attr('r', 8)
            .attr('stroke-opacity', 0.3)
            .style('filter', null);
          d3.select('.graph-tooltip').classed('visible', false);
        });

      nodeEnter.append("circle")
        .attr("r", 8)
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.3)
        .attr("stroke", d => NODE_COLORS[d.data.type] || '#8B949E');

      if (config.showLabels) {
        nodeEnter.append("text")
          .attr("dy", "0.31em")
          .attr("x", d => d._children ? -12 : 12)
          .attr("text-anchor", d => d._children ? "end" : "start")
          .text(d => d.data.name)
          .attr('font-size', 10)
          .attr('fill', '#E6EDF3')
          .style('font-family', 'Inter, sans-serif')
          .clone(true).lower()
          .attr("stroke", "#0D1117").attr("stroke-width", 3);
      }

      // Update node positions
      const nodeUpdate = node.merge(nodeEnter).transition(transition)
        .attr("transform", d => `translate(${d.y},${d.x})`)
        .attr("fill-opacity", 1)
        .attr("stroke-opacity", 1);
        
      // Fill the circle completely if the node is closed (has hidden children)
      nodeUpdate.select("circle")
        .attr("fill", d => (d._children && !d.children) ? (NODE_COLORS[d.data.type] || '#8B949E') : '#161B22');

      // Exit nodes
      node.exit().transition(transition).remove()
        .attr("transform", d => `translate(${source.y},${source.x})`)
        .attr("fill-opacity", 0)
        .attr("stroke-opacity", 0);

      // --- LINKS ---
      const link = gLink.selectAll("path.link").data(links, d => d.target.id);

      const linkEnter = link.enter().append("path")
        .attr("class", "link")
        .attr("d", d => {
          const o = {x: source.x0, y: source.y0};
          return diagonal({source: o, target: o});
        });

      link.merge(linkEnter).transition(transition).attr("d", diagonal);

      link.exit().transition(transition).remove()
        .attr("d", d => {
          const o = {x: source.x, y: source.y};
          return diagonal({source: o, target: o});
        });

      // Stash old positions for transitions
      rootHierarchy.eachBefore(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Trigger initial render
    update(rootHierarchy);

    // Cleanup
    return () => d3.select('.graph-tooltip').classed('visible', false);
  }, [nodes, edges, config, activeFilters, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] relative">
      {/* Type filter bar */}
      <div className="absolute top-4 left-4 z-10 flex gap-2">
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <button
            key={type}
            onClick={() => toggleFilter(type)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border"
            style={{
              backgroundColor: activeFilters[type] ? color : '#161B22',
              color: activeFilters[type] ? '#fff' : '#8B949E',
              borderColor: activeFilters[type] ? color : '#30363D',
              opacity: activeFilters[type] ? 1 : 0.6,
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: activeFilters[type] ? '#fff' : color,
              }}
            />
            {type}
          </button>
        ))}
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: '#0D1117' }}
      />
    </div>
  );
}
