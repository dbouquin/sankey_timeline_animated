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

// Position nodes based on time - all nodes evenly distributed vertically
function createLayout(timeScale, height, margin, totalNodes) {
  return function(graph) {
    // Define height factors for different categories
    const categoryHeightFactors = {
      "XS": 0.25,  // Smallest height
      "S": 0.6,   // Small height
      "M": 1.0,   // Medium height (baseline)
      "L": 1.6,   // Large height
      "XL": 2.1   // Extra large height
    };
    
    // Calculate node positions based on time scale
    const baseNodeHeight = Math.min(25, Math.max(12, 500 / totalNodes)); // Base height for category "M"
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
    const startY = (maxHeight - totalVerticalSpace) / 50; // Change to 2 to center the nodes vertically
    
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

// Format function for tooltips
function formatDuration(value) {
  return "Duration: " + value + " days";
}

// Process the data to create the graph structure needed for visualization
function processData(projectData, d3) {
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
    endDate: parseDate(p.endDate)
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
      // Assign a unique color to each project
      color: d3.interpolateSpectral(i / projects.length),
      value: project.duration, // Use duration as the node value
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
    const defaultStart = new Date(2023, 0, 1);  // Jan 1, 2023
    const defaultEnd = new Date(2023, 11, 31);  // Dec 31, 2023
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
  const arrow = "→"; // Unicode arrow for link tooltips
  let selectedNode = null; // Track the currently selected node
  const dateFormat = d3.timeFormat("%b %d, %Y"); // Format for displaying dates
  
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
    
  // Add a g.view for holding the diagram
  const view = svg.append("g")
    .classed("view", true)
    .attr("transform", `translate(${margin.left}, ${margin.top})`);
  
  // Add time axis - positioned closer to the nodes to reduce vertical gap
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
    `${d.name}\nDuration: ${d.duration}\nCategory: ${d.category}\n${d3.timeFormat("%b %d, %Y")(d.startDate)} - ${d3.timeFormat("%b %d, %Y")(d.endDate)}`);
  
  // Add text labels to the left of nodes
  view.selectAll("text.node-label")
    .data(graph.nodes)
    .join("text")
    .classed("node-label", true)
    .attr("x", d => d.x0 - 5) // Position just to the left of the node
    .attr("y", d => (d.y0 + d.y1) / 2)
    .attr("dy", "0.35em")
    .attr("fill", "#333") // Dark text for better visibility
    .attr("text-anchor", "end") // Right-align text
    .attr("font-size", 11)
    .attr("font-family", "Arial, sans-serif")
    .text(d => d.name);
    
  // Optional: Add light connecting line between label and node
  view.selectAll("line.node-label-connector")
    .data(graph.nodes)
    .join("line")
    .classed("node-label-connector", true)
    .attr("x1", d => d.x0 - 3)
    .attr("y1", d => (d.y0 + d.y1) / 2)
    .attr("x2", d => d.x0)
    .attr("y2", d => (d.y0 + d.y1) / 2)
    .attr("stroke", "#ccc")
    .attr("stroke-width", 0.5)
    .attr("stroke-dasharray", "2,2");
  
  // Only create links if there are any connections
  let gradientLinks = null; // Make sure gradientLinks is defined in this scope
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
      
      // Define the Bezier curve path
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
      .attr("stroke", "grey")
      .attr("stroke-opacity", 0.05)
      .attr("stroke-width", d => Math.max(1, d.width))
      .attr("fill", "none");
    
    // Add <title> hover effect on links
    links.append("title").text(d => 
      `${d.source.name} ${arrow} ${d.target.name}\nValue: ${d.value}`);
      
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
    
    // Animation functions for when a node is hovered
    function branchAnimate(event, node) {
      // Skip if this is triggered by a mouseout of a selected node
      if (selectedNode === node && event && event.type === 'mouseout') {
        return;
      }
      
      // Highlight the node being hovered
      d3.select(`#node-${node.id}`)
        .transition()
        .duration(200)
        .attr("opacity", 1)
        .attr("stroke-width", 2);
      
      // Also highlight the label
      d3.selectAll("text.node-label")
        .filter(d => d.id === node.id)
        .transition()
        .duration(200)
        .attr("font-weight", "bold")
        .attr("fill", "#000");
        
      // Highlight the connector line
      d3.selectAll("line.node-label-connector")
        .filter(d => d.id === node.id)
        .transition()
        .duration(200)
        .attr("stroke", "#999")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "none");
      
      // Animate the node gradient first
      defs.select(`#node-gradient-${node.id}`)
        .selectAll("stop")
        .transition()
        .duration(duration)
        .attr("offset", function(d, i) {
          return i === 0 ? "100%" : "100%";  // Both stops move to 100%
        })
        // Only animate links AFTER node animation completes
        .on("end", () => {
          // Only animate if the node has outgoing links
          if (node.sourceLinks && node.sourceLinks.length > 0) {
            // Find all outgoing links from this node
            let links = view.selectAll("path.gradient-link")
              .filter((link) => {
                return node.sourceLinks.indexOf(link) !== -1;
              });
            
            // Track the nodes that these links connect to
            let nextNodes = [];
            links.each((link) => {
              nextNodes.push(link.target);
            });
            
            // Animate the gradient along the path
            links.attr("stroke-opacity", 0.8)
              .transition()
              .duration(duration)
              .ease(d3.easeLinear)
              .attr("stroke-dashoffset", 0)
              .on("end", () => {
                // Recursively animate connected nodes (but not if we're deselecting)
                if (selectedNode !== null || event.type !== 'click') {
                  nextNodes.forEach((nextNode) => {
                    branchAnimate.call(null, event, nextNode);
                  });
                }
              });
          }
        });
    }
    
    // Reset animation when mouse leaves a node
    function branchClear() {
      // Don't clear if there's a selected node
      if (selectedNode !== null) {
        return;
      }
      
      // Reset node appearance and gradients
      nodes.transition()
        .duration(200)
        .attr("opacity", 0.9)
        .attr("stroke-width", 1);
      
      // Reset labels
      d3.selectAll("text.node-label")
        .transition()
        .duration(200)
        .attr("font-weight", "normal")
        .attr("fill", "#333");
        
      // Reset connector lines
      d3.selectAll("line.node-label-connector")
        .transition()
        .duration(200)
        .attr("stroke", "#ccc")
        .attr("stroke-width", 0.5)
        .attr("stroke-dasharray", "2,2");
      
      // Reset all node gradients
      defs.selectAll("linearGradient.node-gradient")
        .selectAll("stop")
        .transition()
        .duration(200)
        .attr("offset", function(d, i) {
          return i === 0 ? "0%" : "100%";  // Reset to original positions
        });
      
      // Stop and reset all gradient animations for links
      if (gradientLinks && gradientLinks.size() > 0) {
        gradientLinks.transition();
        gradientLinks.attr("stroke-opacity", 0)
          .each(setDash); // setDash is defined in the same scope
      }
    }
    
    // Handle node click events
    function handleNodeClick(event, node) {
      event.stopPropagation(); // Prevent clicks from bubbling to the SVG
      
      if (selectedNode === node) {
        // If clicking the same node again, deselect it
        selectedNode = null;
        branchClear();
        hideInfoPanel();
      } else {
        // First, clear any existing animations
        branchClear();
        
        // Set this as the selected node
        selectedNode = node;
        
        // Trigger the animation for this node
        branchAnimate.call(this, event, node);
        
        // Show info panel for this node
        showInfoPanel(node, d3);
      }
    }
    
    // Show the information panel with node details
    function showInfoPanel(node, d3) {
      // Get the panel
      const panel = document.getElementById('info-panel');
      
      // Set node color indicator
      const colorIndicator = panel.querySelector('.node-color-indicator');
      colorIndicator.style.backgroundColor = node.color;
      
      // Populate the panel with node information
      document.getElementById('node-name').textContent = node.name;
      document.getElementById('node-id').textContent = node.id;
      document.getElementById('node-start-date').textContent = dateFormat(node.startDate);
      document.getElementById('node-end-date').textContent = dateFormat(node.endDate);
      document.getElementById('node-duration').textContent = node.duration;
      document.getElementById('node-category').textContent = node.category;
      document.getElementById('node-phase').textContent = `${node.phase || '1'}`;
      document.getElementById('node-description').textContent = node.description;
      
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
          incomingHeader.style.marginTop = '5px';
          connectionsElement.appendChild(incomingHeader);
          
          const incomingList = document.createElement('ul');
          incomingList.style.marginTop = '3px';
          incomingList.style.paddingLeft = '15px';
          incomingList.style.marginBottom = '3px';
          
          node.targetLinks.forEach(link => {
            const item = document.createElement('li');
            item.textContent = `${link.source.name} (${link.value})`;
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
      closeButton.onclick = function() {
        hideInfoPanel();
        // Also deselect the node if the panel is closed
        if (selectedNode !== null) {
          const nodeToDeselect = selectedNode;
          selectedNode = null;
          branchClear();
          
          // Reset the specific node that was selected
          d3.select(`#node-${nodeToDeselect.id}`)
            .transition()
            .duration(200)
            .attr("opacity", 0.9)
            .attr("stroke-width", 1);
          
          defs.select(`#node-gradient-${nodeToDeselect.id}`)
            .selectAll("stop")
            .transition()
            .duration(200)
            .attr("offset", function(d, i) {
              return i === 0 ? "0%" : "100%";
            });
        }
      };
    }
    
    // Hide the information panel
    function hideInfoPanel() {
      const panel = document.getElementById('info-panel');
      panel.style.display = 'none';
    }
    
    // Clear selection when clicking on empty space
    svg.on("click", () => {
      if (selectedNode !== null) {
        selectedNode = null;
        branchClear();
        hideInfoPanel();
      }
    });

    // Add mouse interaction
    nodes.on("mouseover", function(event, node) {
      branchAnimate.call(this, event, node);
    })
      .on("mouseout", branchClear)
      .on("click", handleNodeClick);
  } else {
    // If there are no links, still add hover effect to nodes with similar animation
    nodes.on("mouseover", function(event, node) {
      // Skip if this is already the selected node
      if (selectedNode === node) return;
      
      d3.select(this)
        .transition()
        .duration(200)
        .attr("opacity", 1)
        .attr("stroke-width", 2);
      
      // Animate the node gradient
      defs.select(`#node-gradient-${node.id}`)
        .selectAll("stop")
        .transition()
        .duration(duration)
        .attr("offset", function(d, i) {
          return i === 0 ? "100%" : "100%";  // Both stops move to 100%
        });
    })
    .on("mouseout", function(event, node) {
      // Don't reset if this is the selected node
      if (selectedNode === node) return;
      
      d3.select(this)
        .transition()
        .duration(200)
        .attr("opacity", 0.9)
        .attr("stroke-width", 1);
      
      // Reset the node gradient
      defs.select(`#node-gradient-${node.id}`)
        .selectAll("stop")
        .transition()
        .duration(200)
        .attr("offset", function(d, i) {
          return i === 0 ? "0%" : "100%";  // Reset to original positions
        });
    })
    .on("click", function(event, node) {
      event.stopPropagation();
      
      if (selectedNode === node) {
        // Deselect if clicking the same node
        selectedNode = null;
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("opacity", 0.9)
          .attr("stroke-width", 1);
        
        defs.select(`#node-gradient-${node.id}`)
          .selectAll("stop")
          .transition()
          .duration(200)
          .attr("offset", function(d, i) {
            return i === 0 ? "0%" : "100%";  // Reset to original positions
          });
          
        hideInfoPanel();
      } else {
        // First reset any previously selected node
        if (selectedNode !== null) {
          d3.select(`#node-${selectedNode.id}`)
            .transition()
            .duration(200)
            .attr("opacity", 0.9)
            .attr("stroke-width", 1);
          
          defs.select(`#node-gradient-${selectedNode.id}`)
            .selectAll("stop")
            .transition()
            .duration(200)
            .attr("offset", function(d, i) {
              return i === 0 ? "0%" : "100%";  // Reset to original positions
            });
        }
        
        // Select this node
        selectedNode = node;
        
        d3.select(this)
          .transition()
          .duration(200)
          .attr("opacity", 1)
          .attr("stroke-width", 2);
        
        defs.select(`#node-gradient-${node.id}`)
          .selectAll("stop")
          .transition()
          .duration(duration)
          .attr("offset", function(d, i) {
            return i === 0 ? "100%" : "100%";  // Both stops move to 100%
          });
          
        // Show info panel for this node
        showInfoPanel(node, d3);
      }
    });
    
    // Show the information panel with node details
    function showInfoPanel(node, d3) {
      // Get the panel
      const panel = document.getElementById('info-panel');
      
      // Set node color indicator
      const colorIndicator = panel.querySelector('.node-color-indicator');
      colorIndicator.style.backgroundColor = node.color;
      
      // Populate the panel with node information
      document.getElementById('node-name').textContent = node.name;
      document.getElementById('node-id').textContent = node.id;
      document.getElementById('node-start-date').textContent = dateFormat(node.startDate);
      document.getElementById('node-end-date').textContent = dateFormat(node.endDate);
      document.getElementById('node-duration').textContent = node.duration;
      document.getElementById('node-category').textContent = node.category;
      document.getElementById('node-phase').textContent = `${node.phase || '1'}`;
      document.getElementById('node-description').textContent = node.description;
      
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
          incomingHeader.style.marginTop = '5px';
          connectionsElement.appendChild(incomingHeader);
          
          const incomingList = document.createElement('ul');
          incomingList.style.marginTop = '5px';
          incomingList.style.paddingLeft = '20px';
          
          node.targetLinks.forEach(link => {
            const item = document.createElement('li');
            item.textContent = `${link.source.name} (Value: ${link.value})`;
            incomingList.appendChild(item);
          });
          
          connectionsElement.appendChild(incomingList);
        }
        
        // Create a list of outgoing connections
        if (node.sourceLinks.length > 0) {
          const outgoingHeader = document.createElement('div');
          outgoingHeader.textContent = 'Outgoing:';
          outgoingHeader.style.fontWeight = 'bold';
          outgoingHeader.style.marginTop = '10px';
          connectionsElement.appendChild(outgoingHeader);
          
          const outgoingList = document.createElement('ul');
          outgoingList.style.marginTop = '5px';
          outgoingList.style.paddingLeft = '20px';
          
          node.sourceLinks.forEach(link => {
            const item = document.createElement('li');
            item.textContent = `${link.target.name} (Value: ${link.value})`;
            outgoingList.appendChild(item);
          });
          
          connectionsElement.appendChild(outgoingList);
        }
      }
      
      // Show the panel
      panel.style.display = 'block';
      
      // Set up the close button
      const closeButton = panel.querySelector('.close-button');
      closeButton.onclick = function() {
        hideInfoPanel();
        // Also deselect the node if the panel is closed
        if (selectedNode !== null) {
          const nodeToDeselect = selectedNode;
          selectedNode = null;
          
          // Reset the specific node that was selected
          d3.select(`#node-${nodeToDeselect.id}`)
            .transition()
            .duration(200)
            .attr("opacity", 0.9)
            .attr("stroke-width", 1);
          
          defs.select(`#node-gradient-${nodeToDeselect.id}`)
            .selectAll("stop")
            .transition()
            .duration(200)
            .attr("offset", function(d, i) {
              return i === 0 ? "0%" : "100%";
            });
        }
      };
    }
    
    // Hide the information panel
    function hideInfoPanel() {
      const panel = document.getElementById('info-panel');
      panel.style.display = 'none';
    }
    
    // Clear selection when clicking on empty space
    svg.on("click", () => {
      if (selectedNode !== null) {
        const node = selectedNode;
        selectedNode = null;
        
        d3.select(`#node-${node.id}`)
          .transition()
          .duration(200)
          .attr("opacity", 0.9)
          .attr("stroke-width", 1);
        
        defs.select(`#node-gradient-${node.id}`)
          .selectAll("stop")
          .transition()
          .duration(200)
          .attr("offset", function(d, i) {
            return i === 0 ? "0%" : "100%";  // Reset to original positions
          });
          
        hideInfoPanel();
      }
    });
  }
  
  return svg.node();
}

// Initialize the visualization once the page has loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Constants
    const width = window.innerWidth - 20;
    // Adjust height based on viewport size 
    const height = Math.max(600, window.innerHeight - 250); // Reduced from 650
    const margin = {
      top: 30,
      right: 350, // Increased right margin to make room for the info panel
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

