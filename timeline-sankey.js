// Initialize the visualization once the page has loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Constants
    const width = window.innerWidth - 20;
    // Adjust height based on viewport size 
    const height = Math.max(600, window.innerHeight - 250);
    const margin = {
      top: 30,
      right: 400, // Increased right margin to make room for the info panel
      bottom: 50, 
      left: 100    // Increased left margin to make room for project labels
    };
    const duration = 500;
    
    // Load D3.js
    const d3 = await import('https://cdn.jsdelivr.net/npm/d3@6/+esm');
    
    // Load data
    const projectData = await loadProjectData();
    
    // Process data
    const graph = processData(projectData, d3);
    
    // Calculate dynamic sizing based on dataset size
    const totalNodes = graph.nodes.length;
    const dynamicHeight = Math.max(height, 150 + (totalNodes * 40)); 
    
    // Create time scale
    const timeScale = createTimeScale(d3, graph, width, margin);
    
    // Create layout
    const layout = createLayout(timeScale, dynamicHeight, margin, totalNodes);
    
    // Apply layout to graph
    const layoutedGraph = layout(graph);
    
    // Create visualization with dynamic height
    const svg = createVisualization(d3, width, dynamicHeight, layoutedGraph, margin, timeScale, duration);
    
    // Add to the page
    document.getElementById('visualization').appendChild(svg);
    
  } catch (error) {
    console.error('Error initializing visualization:', error);
    const errorElement = document.createElement('div');
    errorElement.className = 'error';
    errorElement.textContent = `Failed to initialize visualization: ${error.message}`;
    document.getElementById('visualization').appendChild(errorElement);
  }
});

// Load project data from a local file
async function loadProjectData() {
  // Add a timestamp to prevent caching
  const timestamp = new Date().getTime();
  const response = await fetch(`project-data.json?t=${timestamp}`);
  if (!response.ok) {
    throw new Error(`Error loading project data: ${response.statusText}`);
  }
  return response.json();
}

// Extract unique skills from project data
function extractUniqueSkills(projects) {
  const skillsSet = new Set();
  
  projects.forEach(project => {
    if (project.skills && Array.isArray(project.skills)) {
      project.skills.forEach(skill => skillsSet.add(skill));
    }
  });
  
  return Array.from(skillsSet).sort();
}

// Populate the skills filter panel
function populateSkillsFilter(skills) {
  const container = document.getElementById('skills-filter-container');
  if (!container) return;
  
  skills.forEach(skill => {
    const checkbox = document.createElement('label');
    checkbox.className = 'skill-checkbox';
    
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.value = skill;
    input.id = `skill-${skill.replace(/\s+/g, '-').toLowerCase()}`;
    
    checkbox.appendChild(input);
    checkbox.appendChild(document.createTextNode(skill));
    container.appendChild(checkbox);
  });
}

// Position nodes based on time - all nodes evenly distributed vertically
function createLayout(timeScale, height, margin, totalNodes) {
  return function(graph) {
    // Define height factors for different categories
    const categoryHeightFactors = {
      "XS": 0.25,  // Smallest height
      "S": 0.6,   // Small height
      "M": 1.0,   // Medium height 
      "L": 1.6,   // Large height
      "XL": 2.1   // Extra large height
    };
    
    // Calculate node positions based on time scale
    const baseNodeHeight = Math.min(25, Math.max(12, 500 / totalNodes)); // Base height 
    const nodePadding = Math.min(20, Math.max(5, 300 / totalNodes)); // Adjust padding based on total count
    const maxHeight = height - margin.top - margin.bottom - 30; // Reduced extra padding
    
    // Distribute nodes evenly across the vertical space
    const nodeCount = graph.nodes.length;
    
    // First, calculate total vertical space needed accounting for different node heights
    let totalNodeSpace = 0;
    graph.nodes.forEach(node => {
      const heightFactor = categoryHeightFactors[node.category] || 1.0;
      const nodeHeight = baseNodeHeight * heightFactor;
      totalNodeSpace += nodeHeight;
    });
    
    // Add space for padding between nodes
    const totalVerticalSpace = totalNodeSpace + (nodeCount - 1) * nodePadding;
    const startY = (maxHeight - totalVerticalSpace) / 50; // Change to center the nodes vertically
    
    // Position nodes
    let currentY = startY;
    graph.nodes.forEach((node, index) => {
      // Horizontal position based on dates (length represents duration)
      node.x0 = timeScale(node.startDate);
      node.x1 = timeScale(node.endDate);
      
      // Vertical position with height based on category
      const heightFactor = categoryHeightFactors[node.category] || 1.0;
      const nodeHeight = baseNodeHeight * heightFactor;
      
      node.y0 = currentY;
      node.y1 = currentY + nodeHeight;
      
      // Update currentY for next node
      currentY += nodeHeight + nodePadding;
    });
    
    // Set link widths based on value
    graph.links.forEach(link => {
      // Proportional width based on value
      link.width = Math.max(1, link.value / 5);
    });
    
    return graph;
  };
}

// Process the data to create the graph structure needed for visualization
function processData(projectData, d3) {
  // Add this line to get current date
  const today = new Date();
  // If no project data is available yet, return a minimal structure
  if (!projectData) {
    return { nodes: [], links: [], minDate: new Date(), maxDate: new Date() };
  }
  
  // Parse dates and create a time scale
  const parseDate = d3.timeParse("%Y-%m-%d");
  
  // Process projects
  const projects = projectData.projects.map(p => ({
    ...p,
    startDate: parseDate(p.startDate),
    endDate: p.endDate ? parseDate(p.endDate) : today,
    // Flag to track if endDate was defined
    hasDefinedEndDate: !!p.endDate
  }));
  
  // Get min and max dates for the time scale
  const minDate = d3.min(projects, d => d.startDate);
  const maxDate = d3.max(projects, d => d.endDate);
  
  // Create nodes array with x position based on dates
  const nodes = projects.map((project, i) => {
    return {
      id: project.id,
      name: project.name,
      index: i,
      startDate: project.startDate,
      endDate: project.endDate,
      duration: project.duration,
      category: project.category,
      phase: project.phase,
      description: project.description,
      skills: project.skills || [], // Include skills data if it exists, otherwise use an empty array
      // Assign a unique color to each project
      color: d3.interpolateSpectral(i / projects.length),
      value: project.duration, // Use duration as the node value
      hasDefinedEndDate: project.hasDefinedEndDate,
      sourceLinks: [], // Initialize empty arrays for links
      targetLinks: []
    };
  });
  
  // Create links from connections
  const links = projectData.connections ? projectData.connections.map((conn, i) => {
    const source = nodes.find(n => n.id === conn.source);
    const target = nodes.find(n => n.id === conn.target);
    
    if (!source || !target) {
      console.error(`Connection references unknown project: ${conn.source} -> ${conn.target}`);
      return null;
    }
    
    return {
      source,
      target,
      value: conn.value,
      gradient: `gradient-${i}`,
      path: `path-${i}`
    };
  }).filter(link => link !== null) : [];
  
  // Assign links to nodes
  links.forEach(link => {
    link.source.sourceLinks.push(link);
    link.target.targetLinks.push(link);
  });
  
  return { nodes, links, minDate, maxDate };
}

// Calculate a time scale based on the graph data
function createTimeScale(d3, graph, width, margin) {
  // If no data or no date range, create a default scale
  if (!graph || !graph.minDate || !graph.maxDate || graph.minDate.getTime() === graph.maxDate.getTime()) {
    const defaultStart = new Date(2023, 5, 1);  // June 1, 2023
    const defaultEnd = new Date(2025, 11, 31);  // Dec 31, 2025
    return d3.scaleTime()
      .domain([defaultStart, defaultEnd])
      .range([0, width - margin.left - margin.right]);
  }
  
  // Add some padding to the date range
  const timePadding = (graph.maxDate - graph.minDate) * 0.03;
  const startDate = new Date(graph.minDate.getTime() - timePadding);
  const endDate = new Date(graph.maxDate.getTime() + timePadding);
  
  return d3.scaleTime()
    .domain([startDate, endDate])
    .range([0, width - margin.left - margin.right]);
}

// Create the SVG visualization
function createVisualization(d3, width, height, graph, margin, timeScale, duration) {
  // Store application state
  let state = {
    selectedNode: null,
    filteredSkills: [],
    visibleNodes: new Set(graph.nodes.map(n => n.id)),
    
    isNodeVisible: function(node) {
      return this.visibleNodes.has(node.id);
    },
    
    updateVisibleNodes: function() {
      if (this.filteredSkills.length === 0) {
        this.visibleNodes = new Set(graph.nodes.map(n => n.id));
      } else {
        this.visibleNodes = new Set(
          graph.nodes
            .filter(node => 
              node.skills && 
              node.skills.some(skill => this.filteredSkills.includes(skill))
            )
            .map(n => n.id)
        );
      }
    }
  };
  
  const svg = d3.create("svg")
    .attr("width", width)
    .attr("height", height);
  
  const defs = svg.append("defs");
  
  // Add definitions for the linear gradients for nodes
  const nodeGradients = defs.selectAll("linearGradient.node-gradient")
    .data(graph.nodes)
    .join("linearGradient")
    .attr("class", "node-gradient")
    .attr("id", d => `node-gradient-${d.id}`)
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", d => d.x0)
    .attr("x2", d => d.x1);
  
  // Add two stops to each gradient - one with the node color and one that's gray
  nodeGradients.append("stop")
    .attr("offset", "0%")
    .attr("stop-color", d => d.color);
  
  nodeGradients.append("stop")
    .attr("offset", "100%")
    .attr("stop-color", "#f8f8f8");  // Light gray
  
  // Add definitions for the linear gradients for links - only if there are links
  if (graph.links.length > 0) {
    const gradients = defs.selectAll("linearGradient.link-gradient")
      .data(graph.links)
      .join("linearGradient")
      .attr("class", "link-gradient")
      .attr("id", d => d.gradient)
      .attr("gradientUnits", "userSpaceOnUse")
      .attr("x1", d => d.source.x1) // End of source node
      .attr("y1", d => (d.source.y0 + d.source.y1) / 2)
      .attr("x2", d => d.target.x0) // Start of target node
      .attr("y2", d => (d.target.y0 + d.target.y1) / 2);
      
    gradients.append("stop").attr("offset", 0.0).attr("stop-color", d => d.source.color);
    gradients.append("stop").attr("offset", 1.0).attr("stop-color", d => d.target.color);
  }
    
  // Add a background rect to catch clicks on empty space
  const background = svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "transparent")
    .on("click", function() {
      // Only handle background clicks, not clicks on nodes
      if (state.selectedNode) {
        // Reset all nodes that were part of the animation chain
        if (window.animatedNodes) {
          window.animatedNodes.forEach(nodeId => {
            const animatedNode = graph.nodes.find(n => n.id === nodeId);
            if (animatedNode) {
              resetNode(animatedNode);
            }
          });
        }
        
        // Reset the selected node
        resetNode(state.selectedNode);
        resetLinks();
        hideInfoPanel();
        state.selectedNode = null;
      }
    });

  // Add a g.view for holding the diagram
  const view = svg.append("g")
    .classed("view", true)
    .attr("transform", `translate(${margin.left}, ${margin.top})`);
  
  // Add time axis
  const timeAxis = d3.axisBottom(timeScale)
    .ticks(d3.timeMonth.every(1))
    .tickFormat(d3.timeFormat("%b %Y"));
  
  view.append("g")
    .attr("class", "time-axis")
    .attr("transform", `translate(0, ${height - margin.top - margin.bottom - 390})`) // Moved up by 390px
    .call(timeAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.8em")
    .attr("dy", ".15em")
    .attr("transform", "rotate(-45)");
  
  // Define the nodes
  const nodes = view.selectAll("rect.node")
    .data(graph.nodes)
    .join("rect")
    .classed("node", true)
    .attr("id", d => `node-${d.id}`)
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .attr("width", d => Math.max(5, d.x1 - d.x0)) // Ensure a minimum width
    .attr("height", d => Math.max(1, d.y1 - d.y0))
    .attr("rx", 5) // Rounded corners
    .attr("ry", 5)
    .attr("fill", d => `url(#node-gradient-${d.id})`) // Use gradient instead of solid color
    .attr("opacity", 0.9)
    .attr("stroke", d => d3.rgb(d.color).darker())
    .attr("stroke-width", 1);
  
  // Add titles for node hover effects
  nodes.append("title").text(d => 
    `${d.name}\nDuration: ${d.duration}\nCategory: ${d.category}\n${d3.timeFormat("%b %d, %Y")(d.startDate)} - ${d.hasDefinedEndDate ? d3.timeFormat("%b %d, %Y")(d.endDate) : "Ongoing"}`);
  
  // Add text labels to the left of nodes
  view.selectAll("text.node-label")
    .data(graph.nodes)
    .join("text")
    .classed("node-label", true)
    .attr("id", d => `node-label-${d.id}`)
    .attr("x", d => d.x0 - 5) // Position just to the left of the node
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("fill", "#333") // Dark text for better visibility
    .attr("text-anchor", "end") // Right-align text
    .attr("font-size", 11)
    .attr("font-family", "Arial, sans-serif")
    .text(d => d.name);
  
  // Only create links if there are any connections
  let gradientLinks = null;
  let setDash; // Declare setDash in the current scope so it's accessible
  
  if (graph.links.length > 0) {
    // Create a custom link curve that adjusts based on the distance between nodes
    const createLinkPath = (d) => {
      const sourceX = d.source.x1;
      const sourceY = (d.source.y0 + d.source.y1) / 2;
      const targetX = d.target.x0;
      const targetY = (d.target.y0 + d.target.y1) / 2;
      
      // Control points for curve
      // Adjust these to control the curve shape
      const xDist = targetX - sourceX;
      const controlPointOffset = Math.min(80, xDist * 0.4);
      
      // Define the curve path
      return `M ${sourceX},${sourceY} 
              C ${sourceX + controlPointOffset},${sourceY} 
                ${targetX - controlPointOffset},${targetY} 
                ${targetX},${targetY}`;
    };
    
    // Define the gray links
    const links = view.selectAll("path.link")
      .data(graph.links)
      .join("path")
      .classed("link", true)
      .attr("d", createLinkPath)
      .attr("stroke", "lightgrey")
      .attr("stroke-opacity", 0.1)
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("fill", "none");
    
    // Add <title> hover effect on links
    links.append("title").text(d => 
      `${d.source.name} → ${d.target.name}`);
      
    // Define the dash behavior for colored gradients
    setDash = function(link) {
      let el = view.select(`#${link.path}`);
      if (!el.empty()) {
        let length = el.node().getTotalLength();
        el.attr("stroke-dasharray", `${length} ${length}`)
          .attr("stroke-dashoffset", length);
      }
    };
    
    gradientLinks = view.selectAll("path.gradient-link")
      .data(graph.links)
      .join("path")
      .classed("gradient-link", true)
      .attr("id", d => d.path)
      .attr("d", createLinkPath)
      .attr("stroke", d => `url(#${d.gradient})`)
      .attr("stroke-opacity", 0)
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("fill", "none")
      .each(setDash);
  }
  
  // Node highlighting function
  function highlightNode(node) {
    if (!state.isNodeVisible(node)) return;
    
    d3.select(`#node-${node.id}`)
      .transition()
      .duration(200)
      .attr("opacity", 1)
      .attr("stroke-width", 2);
    
    // Also highlight the label
    d3.select(`#node-label-${node.id}`)
      .transition()
      .duration(200)
      .attr("font-weight", "bold")
      .attr("fill", "#000");
      
    // Highlight the connector line
    d3.select(`#node-connector-${node.id}`)
      .transition()
      .duration(200)
      .attr("stroke", "#999")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "none");
    
    // Animate the node gradient
    defs.select(`#node-gradient-${node.id}`)
      .selectAll("stop")
      .transition()
      .duration(duration)
      .attr("offset", function(d, i) {
        return i === 0 ? "100%" : "100%";  // Both stops move to 100%
      });
  }
  
  // Reset node appearance
  function resetNode(node) {
    d3.select(`#node-${node.id}`)
      .transition()
      .duration(200)
      .attr("opacity", state.isNodeVisible(node) ? 0.9 : 0.2)
      .attr("stroke-width", 1);
    
    // Reset label
    d3.select(`#node-label-${node.id}`)
      .transition()
      .duration(200)
      .attr("font-weight", "normal")
      .attr("fill", "#333")
      .attr("opacity", state.isNodeVisible(node) ? 1 : 0.2);
      
    // Reset connector line
    d3.select(`#node-connector-${node.id}`)
      .transition()
      .duration(200)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", state.isNodeVisible(node) ? 1 : 0.2);
    
    // Reset gradient
    defs.select(`#node-gradient-${node.id}`)
      .selectAll("stop")
      .transition()
      .duration(200)
      .attr("offset", function(d, i) {
        return i === 0 ? "0%" : "100%";  // Reset to original positions
      });
  }
  
  // Reset all nodes
  function resetAllNodes() {
    nodes
      .transition()
      .duration(200)
      .attr("opacity", d => state.isNodeVisible(d) ? 0.9 : 0.2)
      .attr("stroke-width", 1);
    
    // Reset all labels
    d3.selectAll("text.node-label")
      .transition()
      .duration(200)
      .attr("font-weight", "normal")
      .attr("fill", "#333")
      .attr("opacity", d => state.isNodeVisible(d) ? 1 : 0.2);
      
    // Reset all connector lines
    d3.selectAll("line.node-label-connector")
      .transition()
      .duration(200)
      .attr("stroke", "#ccc")
      .attr("stroke-width", 0.5)
      .attr("stroke-dasharray", "2,2")
      .attr("opacity", d => state.isNodeVisible(d) ? 1 : 0.2);
    
    // Reset all gradients
    defs.selectAll("linearGradient.node-gradient")
      .selectAll("stop")
      .transition()
      .duration(200)
      .attr("offset", function(d, i) {
        return i === 0 ? "0%" : "100%";
      });
      
    // Reset links
    resetLinks();
  }
  
  // Link animation function
  function animateLinksFromNode(node, depth = 0) {
    // Limit recursion depth for safety
    if (depth > 10) return;
    
    if (!state.isNodeVisible(node) || !node.sourceLinks || node.sourceLinks.length === 0) {
      return;
    }
    
    // Find visible outgoing links
    let visibleLinks = node.sourceLinks.filter(link => state.isNodeVisible(link.target));
    
    if (visibleLinks.length === 0) return;
    
    // Keep track of all nodes in the animation chain
    if (!window.animatedNodes) {
      window.animatedNodes = new Set();
    }
    window.animatedNodes.add(node.id);
    
    // For each visible link, animate it
    visibleLinks.forEach(link => {
      // Add target node to the animated set
      window.animatedNodes.add(link.target.id);
      
      // Animate the link
      view.select(`#${link.path}`)
        .attr("stroke-opacity", 0.8)
        .transition()
        .duration(duration)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0)
        .on("end", () => {
          if (state.selectedNode) {
            // Highlight the target node
            highlightNode(link.target);
            
            // Continue the animation chain if the target has outgoing links
            // Use setTimeout to create a slight delay between levels
            setTimeout(() => {
              // Continue animation with the next node in the chain
              animateLinksFromNode(link.target, depth + 1);
            }, 200);
          }
        });
    });
  }
  
  // Reset all links
  function resetLinks() {
    if (!gradientLinks) return;
    
    gradientLinks
      .interrupt() // Stop any ongoing transitions
      .attr("stroke-opacity", 0)
      .each(setDash);
      
    // Clear the set of animated nodes
    window.animatedNodes = new Set();
  }
  
  // Show the information panel with node details
  function showInfoPanel(node) {
    const dateFormat = d3.timeFormat("%b %d, %Y");
    
    // Get the panel
    const panel = document.getElementById('info-panel');
    
    // Set node color indicator
    const colorIndicator = panel.querySelector('.node-color-indicator');
    colorIndicator.style.backgroundColor = node.color;
    
    // Populate the panel with node information
    document.getElementById('node-name').textContent = node.name;
    document.getElementById('node-id').textContent = node.id;
    document.getElementById('node-start-date').textContent = dateFormat(node.startDate);
    document.getElementById('node-end-date').textContent = node.hasDefinedEndDate ? dateFormat(node.endDate) : "-";
    document.getElementById('node-duration').textContent = node.duration;
    document.getElementById('node-category').textContent = node.category;
    document.getElementById('node-phase').textContent = `${node.phase || '1'}`;

    // Display skills as tags
    const skillsElement = document.getElementById('node-skills');
    skillsElement.innerHTML = '';

    if (node.skills && node.skills.length > 0) {
      node.skills.forEach(skill => {
        const skillTag = document.createElement('span');
        skillTag.className = 'skill-tag';
        skillTag.textContent = skill;
        skillsElement.appendChild(skillTag);
      });
    } else {
      skillsElement.textContent = 'None specified';
    }

    // Format description text for longer content
    const descriptionElement = document.getElementById('node-description');
    descriptionElement.textContent = node.description || 'No description available';
    
    // Show connections information
    const connectionsElement = document.getElementById('node-connections');
    connectionsElement.innerHTML = '';
    
    if (node.sourceLinks.length === 0 && node.targetLinks.length === 0) {
      connectionsElement.textContent = 'None';
    } else {
      // Create a list of incoming connections
      if (node.targetLinks.length > 0) {
        const incomingHeader = document.createElement('div');
        incomingHeader.textContent = 'Incoming:';
        incomingHeader.style.fontWeight = 'bold';
        incomingHeader.style.marginTop = '15px';
        connectionsElement.appendChild(incomingHeader);
        
        const incomingList = document.createElement('ul');
        incomingList.style.marginTop = '3px';
        incomingList.style.paddingLeft = '15px';
        incomingList.style.marginBottom = '3px';
        
        node.targetLinks.forEach(link => {
          const item = document.createElement('li');
          item.textContent = `${link.source.name}`;
          item.style.marginBottom = '2px';
          incomingList.appendChild(item);
        });
        
        connectionsElement.appendChild(incomingList);
      }
      
      // Create a list of outgoing connections
      if (node.sourceLinks.length > 0) {
        const outgoingHeader = document.createElement('div');
        outgoingHeader.textContent = 'Outgoing:';
        outgoingHeader.style.fontWeight = 'bold';
        outgoingHeader.style.marginTop = '15px';
        connectionsElement.appendChild(outgoingHeader);
        
        const outgoingList = document.createElement('ul');
        outgoingList.style.marginTop = '3px';
        outgoingList.style.paddingLeft = '15px';
        outgoingList.style.marginBottom = '0';
        
        node.sourceLinks.forEach(link => {
          const item = document.createElement('li');
          item.textContent = `${link.target.name}`;
          item.style.marginBottom = '2px';
          outgoingList.appendChild(item);
        });
        
        connectionsElement.appendChild(outgoingList);
      }
    }
    
    // Show the panel
    panel.style.display = 'block';
    
    // Set up the close button
    const closeButton = panel.querySelector('.close-button');
    closeButton.onclick = function(event) {
      event.stopPropagation();
      hideInfoPanel();
      
      // Also deselect the node
      if (state.selectedNode) {
        resetNode(state.selectedNode);
        resetLinks();
        state.selectedNode = null;
      }
    };
  }
  
  // Hide the information panel
  function hideInfoPanel() {
    const panel = document.getElementById('info-panel');
    panel.style.display = 'none';
  }
  
  // Handle node click
  function handleNodeClick(event, node) {
    event.stopPropagation();
    
    if (!state.isNodeVisible(node)) return;
    
    if (state.selectedNode === node) {
      // Deselect if clicking the same node
      state.selectedNode = null;
      
      // Reset all nodes that were part of the animation chain
      if (window.animatedNodes) {
        window.animatedNodes.forEach(nodeId => {
          const animatedNode = graph.nodes.find(n => n.id === nodeId);
          if (animatedNode) {
            resetNode(animatedNode);
          }
        });
      }
      
      resetNode(node);
      resetLinks();
      hideInfoPanel();
    } else {
      // If another node is selected, reset it and all connected nodes
      if (state.selectedNode) {
        // Reset all nodes that were part of the animation chain
        if (window.animatedNodes) {
          window.animatedNodes.forEach(nodeId => {
            const animatedNode = graph.nodes.find(n => n.id === nodeId);
            if (animatedNode) {
              resetNode(animatedNode);
            }
          });
        }
        
        resetNode(state.selectedNode);
        resetLinks();
      }
      
      // Select the clicked node
      state.selectedNode = node;
      highlightNode(node);
      
      // Wait for the gradient animation to finish, then animate links
      setTimeout(() => {
        animateLinksFromNode(node);
      }, duration + 100);
      
      // Show info panel
      showInfoPanel(node);
    }
  }
  
  // Handle node mouse over
  function handleNodeMouseOver(event, node) {
    if (!state.isNodeVisible(node) || state.selectedNode) return;
    
    highlightNode(node);
  }
  
  // Handle node mouse out
  function handleNodeMouseOut(event, node) {
    if (!state.isNodeVisible(node) || state.selectedNode === node) return;
    
    resetNode(node);
  }
  
  // Add mouse events to nodes
  nodes
    .on("mouseover", handleNodeMouseOver)
    .on("mouseout", handleNodeMouseOut)
    .on("click", handleNodeClick);
  
  // Filter functions
  function applyFilter() {
    const selectedSkills = getSelectedSkills();
    
    state.filteredSkills = selectedSkills;
    state.updateVisibleNodes();
    
    // Update node visibility
    nodes
      .transition()
      .duration(200)
      .attr("opacity", d => state.isNodeVisible(d) ? 0.9 : 0.2)
      .attr("stroke-width", d => state.isNodeVisible(d) ? 1 : 0.5);
    
    // Also update labels
    d3.selectAll("text.node-label")
      .transition()
      .duration(200)
      .attr("opacity", d => state.isNodeVisible(d) ? 1 : 0.2);
    
    // And connector lines
    d3.selectAll("line.node-label-connector")
      .transition()
      .duration(200)
      .attr("opacity", d => state.isNodeVisible(d) ? 1 : 0.2);
    
    // Update links if they exist
    if (graph.links.length > 0) {
      view.selectAll("path.link")
        .transition()
        .duration(200)
        .attr("stroke-opacity", d => 
          state.isNodeVisible(d.source) && state.isNodeVisible(d.target) ? 0.04 : 0.01);
    }
    
    // If selected node is no longer visible, deselect it
    if (state.selectedNode && !state.isNodeVisible(state.selectedNode)) {
      resetNode(state.selectedNode);
      resetLinks();
      hideInfoPanel();
      state.selectedNode = null;
    }
  }
  
  function clearFilter() {
    // Uncheck all checkboxes
    document.querySelectorAll('#skills-filter-container input[type="checkbox"]')
      .forEach(checkbox => checkbox.checked = false);
    
    state.filteredSkills = [];
    state.updateVisibleNodes();
    
    // Reset all nodes
    resetAllNodes();
    
    // Reset any links
    if (graph.links.length > 0) {
      view.selectAll("path.link")
        .transition()
        .duration(200)
        .attr("stroke-opacity", 0.04);
    }
  }
  
  function getSelectedSkills() {
    const checkboxes = document.querySelectorAll('#skills-filter-container input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(checkbox => checkbox.value);
  }
  
  // Set up filter handlers
  const applyButton = document.getElementById('apply-filters');
  const clearButton = document.getElementById('clear-filters');
  
  if (applyButton) {
    applyButton.addEventListener('click', applyFilter);
  }
  
  if (clearButton) {
    clearButton.addEventListener('click', clearFilter);
  }
  
  // Populate skills filter
  const uniqueSkills = extractUniqueSkills(graph.nodes);
  populateSkillsFilter(uniqueSkills);
  
  return svg.node();
}