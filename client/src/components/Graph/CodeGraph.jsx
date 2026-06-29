import { useEffect, useRef, useCallback } from 'react';
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
 * CodeGraph — D3 force-directed graph visualization.
 * Renders nodes and edges as an interactive SVG with zoom/pan.
 *
 * @param {{ nodes: Array, edges: Array, onNodeClick: Function, config: object }} props
 */
export default function CodeGraph({ nodes, edges, onNodeClick, config }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);

  /**
   * Calculate node radius proportional to its connection count.
   * @param {object} node
   * @param {Array} allEdges
   * @returns {number}
   */
  const getNodeRadius = useCallback((node, allEdges) => {
    const connections = allEdges.filter(
      (e) => e.source === node.id || e.target === node.id ||
             e.source?.id === node.id || e.target?.id === node.id
    ).length;
    return Math.max(5, Math.min(20, 5 + connections * 1.5));
  }, []);

  useEffect(() => {
    if (!svgRef.current || !nodes.length) return;

    const svg = d3.select(svgRef.current);
    const container = containerRef.current;
    const width = container?.clientWidth || 800;
    const height = container?.clientHeight || 600;

    // Clear previous render
    svg.selectAll('*').remove();

    svg.attr('width', width).attr('height', height);

    // Create a group for zoom/pan
    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Deep copy nodes and edges to avoid D3 mutation issues
    const nodesCopy = nodes.map((n) => ({ ...n }));
    const edgesCopy = edges.map((e) => ({ ...e }));

    // Force simulation
    const simulation = d3
      .forceSimulation(nodesCopy)
      .force(
        'link',
        d3
          .forceLink(edgesCopy)
          .id((d) => d.id)
          .distance(config.linkDistance || 80)
      )
      .force('charge', d3.forceManyBody().strength(config.chargeStrength || -120))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d) => getNodeRadius(d, edges) + 2));

    simulationRef.current = simulation;

    // Draw edges
    const link = g
      .append('g')
      .selectAll('line')
      .data(edgesCopy)
      .enter()
      .append('line')
      .attr('stroke', '#30363D')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', 1);

    // Draw nodes
    const node = g
      .append('g')
      .selectAll('circle')
      .data(nodesCopy)
      .enter()
      .append('circle')
      .attr('r', (d) => getNodeRadius(d, edges))
      .attr('fill', (d) => NODE_COLORS[d.type] || '#8B949E')
      .attr('stroke', (d) => NODE_COLORS[d.type] || '#8B949E')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.3)
      .attr('cursor', 'pointer')
      .on('click', (_event, d) => {
        if (onNodeClick) onNodeClick(d);
      })
      .on('mouseover', function (event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', getNodeRadius(d, edges) + 3)
          .attr('stroke-opacity', 0.8);

        // Show tooltip
        tooltip
          .classed('visible', true)
          .html(
            `<strong>${d.name}</strong><br/>
             <span style="color:#8B949E">${d.type} · ${d.filePath || ''}</span>`
          )
          .style('left', `${event.pageX + 12}px`)
          .style('top', `${event.pageY - 20}px`);
      })
      .on('mouseout', function (_event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr('r', getNodeRadius(d, edges))
          .attr('stroke-opacity', 0.3);

        tooltip.classed('visible', false);
      })
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    // Draw labels
    let labels = null;
    if (config.showLabels) {
      labels = g
        .append('g')
        .selectAll('text')
        .data(nodesCopy)
        .enter()
        .append('text')
        .text((d) => d.name)
        .attr('font-size', 10)
        .attr('fill', '#8B949E')
        .attr('text-anchor', 'middle')
        .attr('dy', (d) => getNodeRadius(d, edges) + 14)
        .attr('pointer-events', 'none')
        .style('font-family', 'Inter, sans-serif');
    }

    // Tooltip div
    let tooltip = d3.select('.graph-tooltip');
    if (tooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'graph-tooltip');
    }

    // Tick handler
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => d.source.x)
        .attr('y1', (d) => d.source.y)
        .attr('x2', (d) => d.target.x)
        .attr('y2', (d) => d.target.y);

      node.attr('cx', (d) => d.x).attr('cy', (d) => d.y);

      if (labels) {
        labels.attr('x', (d) => d.x).attr('y', (d) => d.y);
      }
    });

    // Animate in
    svg.style('opacity', 0).transition().duration(500).style('opacity', 1);

    // Cleanup
    return () => {
      simulation.stop();
      tooltip.classed('visible', false);
    };
  }, [nodes, edges, config, getNodeRadius, onNodeClick]);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[500px] relative">
      <svg
        ref={svgRef}
        className="w-full h-full"
        style={{ background: '#0D1117' }}
      />
    </div>
  );
}
