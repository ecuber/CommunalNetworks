'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { NetworkNode, NetworkLink } from '../lib/types'
import styles from './D3NetworkGraph.module.css'

interface D3NetworkGraphProps {
  nodes: NetworkNode[]
  links: NetworkLink[]
  nodeColors: Map<string, string>
  onNodeClick?: (node: NetworkNode) => void
  connections?: any[] // For getting connection details
  currentUser?: any
}

export default function D3NetworkGraph({
  nodes,
  links,
  nodeColors,
  onNodeClick,
  connections = [],
  currentUser
}: D3NetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const normalizeCategory = (category: string) => (category?.trim() ? category.trim() : 'Uncategorized')

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || nodes.length === 0) return

    // Clear previous render
    d3.select(svgRef.current).selectAll('*').remove()

    const width = containerRef.current.clientWidth
    const height = containerRef.current.clientHeight

    const svg = d3.select(svgRef.current)
      .attr('width', width)
      .attr('height', height)

    let tooltip = d3.select('body').select(`.${styles.tooltip}`)
    if (tooltip.empty()) {
      tooltip = d3
        .select('body')
        .append('div')
        .attr('class', styles.tooltip)
        .style('opacity', 0)
        .style('position', 'fixed')
        .style('pointer-events', 'none')
        .style('background', '#0B3C61')
        .style('color', '#ffffff')
        .style('padding', '12px')
        .style('border-radius', '10px')
        .style('font-size', '14px')
        .style('z-index', '10000')
        .style('box-shadow', '0 6px 18px rgba(11, 60, 97, 0.25)')
    } else {
      tooltip.style('opacity', 0)
    }

    const graphGroup = svg.append('g')
      .attr('class', styles.graphGroup)

    const getConnectionCategories = (connection: any) =>
      connection.categories && connection.categories.length > 0
        ? connection.categories.map(normalizeCategory)
        : [normalizeCategory(connection.category)]

    const getNodeRadius = (d: any) => {
      switch (d.nodeType) {
        case 'category':
          return 22
        case 'user':
          return 14
        case 'root':
          return 28
        default:
          return Math.sqrt(Math.max(d.group, 0) + 1) * 4 + 6
      }
    }

    const getNodeColor = (d: any) => {
      if (d.nodeType === 'user') {
        return '#D41A69'
      }
      if (d.nodeType === 'root') {
        return '#95C93D'
      }
      if (d.nodeType === 'category') {
        const baseColor = nodeColors.get(d.name) || '#006880'
        const color = d3.color(baseColor)
        if (color) {
          return color.brighter(0.2).formatHex()
        }
        return baseColor
      }
      return nodeColors.get(d.category) || '#006880'
    }

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((d: any) => {
        const baseDistance = 50 * (d.value || 1)
        const sourceNode = typeof d.source === 'object'
          ? (d.source as any)
          : nodes.find(node => node.id === d.source)
        const targetNode = typeof d.target === 'object'
          ? (d.target as any)
          : nodes.find(node => node.id === d.target)

        const sourceType = sourceNode?.nodeType
        const targetType = targetNode?.nodeType

        if (sourceType === 'root' || targetType === 'root') {
          return baseDistance * 0.3
        }

        if ((sourceType === 'category' && targetType === 'user') ||
            (sourceType === 'user' && targetType === 'category')) {
          return baseDistance * 0.7
        }

        return baseDistance
      }))
      .force('charge', d3.forceManyBody().strength((d: any) => {
        if (d.nodeType === 'root') return -4200
        if (d.nodeType === 'category') return -3600
        if (d.nodeType === 'user') return -2600
        return -1600
      }))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => {
        return getNodeRadius(d) + 14 // Add padding for labels
      }))

    // Create links
    const link = graphGroup.append('g')
      .attr('class', styles.links)
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', 'rgba(11, 60, 97, 0.2)')
      .attr('stroke-width', (d: any) => Math.min(d.value || 1.2, 3))
      .attr('marker-end', 'url(#arrowhead)')

    // Create arrow markers
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('svg:path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', 'rgba(11, 60, 97, 0.35)')

    // Create nodes
    const node = graphGroup.append('g')
      .attr('class', styles.nodes)
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d: any) => getNodeRadius(d))
      .attr('fill', (d: any) => getNodeColor(d))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d: any) {
        // Show tooltip
        const nodeData = d as NetworkNode
        let tooltipContent = `<strong>${nodeData.name}</strong><br/>`
        
        if (nodeData.nodeType === 'user' || nodeData.isCurrentUser) {
          tooltipContent += `<span style="color: #ff6b6b;">(You)</span><br/>`
          tooltipContent += `<strong>Role:</strong> Current User<br/>`
          const userConnections = connections.filter((c: any) => c.userId === currentUser?.id)
          tooltipContent += `<strong>Connections:</strong> ${userConnections.length} people added`
        } else if (nodeData.nodeType === 'category') {
          const members = connections.filter((c: any) =>
            getConnectionCategories(c).includes(nodeData.name)
          )
          tooltipContent += `<strong>Group Size:</strong> ${members.length}<br/>`
          if (members.length > 0) {
            const previewMembers = members.slice(0, 6).map((m: any) => m.name)
            tooltipContent += `<strong>Members:</strong> ${previewMembers.join(', ')}`
            if (members.length > 6) {
              tooltipContent += `, +${members.length - 6} more`
            }
          }
        } else if (nodeData.nodeType === 'root') {
          const totalGroups = new Set(
            connections.flatMap((c: any) => getConnectionCategories(c))
          ).size
          const totalPeople = connections.length
          tooltipContent += `<strong>Total Groups:</strong> ${totalGroups}<br/>`
          tooltipContent += `<strong>Total People:</strong> ${totalPeople}`
        } else {
          const personCategories = nodeData.categories && nodeData.categories.length > 0
            ? nodeData.categories
            : [nodeData.category]
          tooltipContent += `<strong>Categories:</strong> ${personCategories.join(', ')}<br/>`
          if (nodeData.userName) {
            tooltipContent += `<strong>Added by:</strong> ${nodeData.userName}`
          }
          
          // Find connection details
          const connection = connections.find((c: any) => c.id === nodeData.id)
          if (connection && connection.mutualConnections && connection.mutualConnections.length > 0) {
            tooltipContent += `<br/><strong>Mutual Connections:</strong> ${connection.mutualConnections.join(', ')}`
          }
        }

        tooltip
          .html(tooltipContent)
          .style('opacity', 1)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')

        // Highlight node
        d3.select(this)
          .attr('stroke', '#FFC60B')
          .attr('stroke-width', 3)
      })
      .on('mousemove', function(event) {
        tooltip
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 10) + 'px')
      })
      .on('mouseout', function() {
        tooltip.style('opacity', 0)
        d3.select(this)
          .attr('stroke', '#fff')
          .attr('stroke-width', 2)
      })
      .on('click', function(event, d: any) {
        event.stopPropagation()
        if (onNodeClick) {
          onNodeClick(d as NetworkNode)
        }
      })

    const dragNode = d3.drag<SVGCircleElement, any>()
      .on('start', (event, d) => {
        event.sourceEvent?.stopPropagation()
        if (!event.active) simulation.alphaTarget(0.3).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        event.sourceEvent?.stopPropagation()
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0)
        d.fx = null
        d.fy = null
      })

    node.call(dragNode as any)

    // Create labels
    const label = graphGroup.append('g')
      .attr('class', styles.labels)
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d: any) => d.name)
      .attr('font-size', '12px')
      .attr('font-family', 'sans-serif')
      .attr('fill', '#333')
      .attr('text-anchor', 'middle')
      .attr('dy', (d: any) => {
        return getNodeRadius(d) + 18
      })
      .style('pointer-events', 'none')
      .style('user-select', 'none')

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })

    // Handle background click
    svg.on('click', function(event) {
      if (event.target === this) {
        if (onNodeClick) {
          onNodeClick(null as any)
        }
      }
    })

    // Handle window resize
    const handleResize = () => {
      if (!containerRef.current) return
      const newWidth = containerRef.current.clientWidth
      const newHeight = containerRef.current.clientHeight
      svg.attr('width', newWidth).attr('height', newHeight)
      simulation.force('center', d3.forceCenter(newWidth / 2, newHeight / 2))
      simulation.alpha(0.3).restart()
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      simulation.stop()
      window.removeEventListener('resize', handleResize)
      svg.on('.zoom', null)
      // Remove tooltip on cleanup
      d3.select('body').select(`.${styles.tooltip}`).remove()
    }
  }, [nodes, links, nodeColors, onNodeClick, connections, currentUser])

  return (
    <div ref={containerRef} className={styles.container}>
      <svg ref={svgRef} className={styles.svg} />
    </div>
  )
}

