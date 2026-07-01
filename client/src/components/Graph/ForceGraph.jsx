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
 * ForceGraph — D3 clustered force-directed graph visualization.
 * Nodes cluster by type and use curved edges.
 */
export default function ForceGraph({ nodes, edges, onNodeClick, config }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  const [activeFilters, setActiveFilters] = useState({
    File: true,
    Module: true,
    Function: true,
    Feature: true,
  });

  const getNodeRadius = useCallback((node, allEdges) => {
    const connections = allEdges.filter(
      (e) => e.source === node.id || e.target === node.id ||
             e.source?.id === node.id || e.target?.id === node.id
    ).length;
    return Math.max(5, Math.min(20, 5 + connections * 1.5));
  }, []);

  const toggleFilter = useCallback((type) => {
    setActiveFilters((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    // Filter nodes and edges by active type filters
    const visibleNodes = nodes.filter((n) => activeFilters[n.type] !== false);
    const visibleNodeIds = new Set(visibleNodes.map((n) => n.id));
    const visibleEdges = edges.filter(
      (e) => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
    );

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

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

    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    const nodesCopy = visibleNodes.map((n) => ({ ...n }));
    const edgesCopy = visibleEdges.map((e) => ({ ...e }));

    // Cluster centers by type for organized layout
    const clusterCenters = {
      File: { x: width * 0.25, y: height * 0.5 },
      Module: { x: width * 0.5, y: height * 0.3 },
      Function: { x: width * 0.75, y: height * 0.5 },
      Feature: { x: width * 0.5, y: height * 0.7 },
    };

    const simulation = d3.forceSimulation(nodesCopy)
      .force('link', d3.forceLink(edgesCopy).id(d => d.id).distance(config.linkDistance || 80))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('x', d3.forceX(d => clusterCenters[d.type]?.x || width / 2).strength(0.15))
      .force('y', d3.forceY(d => clusterCenters[d.type]?.y || height / 2).strength(0.15))
      .force('collision', d3.forceCollide().radius(d => getNodeRadius(d, visibleEdges) + 8));

    simulationRef.current = simulation;

    // Curved edges
    const link = g.append('g').selectAll('path')
      .data(edgesCopy).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', '#30363D')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.5);

    const node = g.append('g').selectAll('circle')
      .data(nodesCopy).enter().append('circle')
      .attr('r', d => getNodeRadius(d, visibleEdges))
      .attr('fill', d => NODE_COLORS[d.type] || '#8B949E')
      .attr('stroke', d => NODE_COLORS[d.type] || '#8B949E')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => { if (onNodeClick) onNodeClick(d); })
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition().duration(200)
          .attr('r', getNodeRadius(d, visibleEdges) + 3)
          .attr('stroke-opacity', 0.8)
          .style('filter', 'url(#glow)');

        tooltip.classed('visible', true)
          .html(`<strong>${d.name}</strong><br/><span style="color:#8B949E">${d.type} · ${d.filePath || ''}</span>`)
          .style('left', `${event.pageX + 12}px`)
          .style('top', `${event.pageY - 20}px`);
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .transition().duration(200)
          .attr('r', getNodeRadius(d, visibleEdges))
          .attr('stroke-opacity', 0.3)
          .style('filter', null);
        tooltip.classed('visible', false);
      })
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x; d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
      );

    let labels = null;
    if (config.showLabels) {
      labels = g.append('g').selectAll('text')
        .data(nodesCopy).enter().append('text')
        .text(d => d.name)
        .attr('font-size', 10)
        .attr('fill', '#8B949E')
        .attr('text-anchor', 'middle')
        .attr('dy', d => getNodeRadius(d, visibleEdges) + 14)
        .attr('pointer-events', 'none')
        .style('font-family', 'Inter, sans-serif');
    }

    let tooltip = d3.select('.graph-tooltip');
    if (tooltip.empty()) tooltip = d3.select('body').append('div').attr('class', 'graph-tooltip');

    simulation.on('tick', () => {
      link.attr('d', (d) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });
      node.attr('cx', d => d.x).attr('cy', d => d.y);
      if (labels) labels.attr('x', d => d.x).attr('y', d => d.y);
    });

    svg.style('opacity', 0).transition().duration(500).style('opacity', 1);

    return () => {
      simulation.stop();
      tooltip.classed('visible', false);
    };
  }, [nodes, edges, config, activeFilters, getNodeRadius, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] relative">
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
            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: activeFilters[type] ? '#fff' : color }} />
            {type}
          </button>
        ))}
      </div>
      <svg ref={svgRef} className="w-full h-full" style={{ background: '#0D1117' }} />
    </div>
  );
}
