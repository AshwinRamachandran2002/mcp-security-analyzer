// Main JavaScript for MCP Red Team Dashboard

// Toast notification function
function showToast(message, type = 'info', duration = 5000) {
    // Create toast container if it doesn't exist
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';
    
    // Toast content
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${icon}" style="color: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : '#3b82f6'}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-message">${message}</div>
        </div>
        <div class="toast-close">
            <i class="fas fa-times"></i>
        </div>
    `;
    
    // Add to container
    toastContainer.appendChild(toast);
    
    // Close button functionality
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    });
    
    // Auto remove after duration
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, duration);
    
    // Animation
    setTimeout(() => {
        toast.style.opacity = '1';
    }, 10);
}

// Format JSON with syntax highlighting
function formatJson(json) {
    if (typeof json === 'string') {
        try {
            json = JSON.parse(json);
        } catch (e) {
            return json;
        }
    }
    return JSON.stringify(json, null, 2);
}

// Setup copy buttons for code and payload examples
function setupCopyButtons() {
    // Add copy buttons to all payload examples
    document.querySelectorAll('.bg-black.rounded.p-2.font-mono').forEach(block => {
        // Create button if it doesn't already have one
        if (!block.querySelector('.copy-btn')) {
            const button = document.createElement('button');
            button.className = 'copy-btn absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-white hover:bg-gray-700 focus:outline-none';
            button.innerHTML = '<i class="fas fa-clipboard"></i>';
            button.setAttribute('aria-label', 'Copy payload');
            
            // Position the block
            if (block.style.position !== 'relative') {
                block.style.position = 'relative';
            }
            
            block.appendChild(button);
            
            // Add click handler
            button.addEventListener('click', () => {
                const text = block.textContent.trim();
                navigator.clipboard.writeText(text).then(() => {
                    // Show success state
                    button.innerHTML = '<i class="fas fa-check"></i>';
                    setTimeout(() => {
                        button.innerHTML = '<i class="fas fa-clipboard"></i>';
                    }, 2000);
                    
                    showToast('Prompt injection payload copied to clipboard!', 'warning');
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    button.innerHTML = '<i class="fas fa-times"></i>';
                    setTimeout(() => {
                        button.innerHTML = '<i class="fas fa-clipboard"></i>';
                    }, 2000);
                });
            });
        }
    });
}

// Add security notices to function test forms
function addSecurityNotices() {
    const testForms = document.querySelectorAll('#test-function-btn');
    
    testForms.forEach(btn => {
        // Check if we're on an analyzed function page
        const isAnalyzed = document.getElementById('security-classification-content');
        
        if (isAnalyzed && btn) {
            // Add click handler with warning
            btn.addEventListener('click', (e) => {
                // We'll still let the original handler run, but show a warning first
                const confirmed = confirm('WARNING: This function has been identified as a potential security risk. Are you sure you want to execute it?');
                
                if (!confirmed) {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }, true);  // Use capturing to run before the original handler
        }
    });
}

// Refresh button loading state
function setButtonLoading(button, isLoading) {
    if (isLoading) {
        button.disabled = true;
        button.setAttribute('data-original-text', button.innerHTML);
        button.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Loading...';
    } else {
        button.disabled = false;
        button.innerHTML = button.getAttribute('data-original-text');
    }
}

// Initialize the attack vector analysis UI
function initVectorAnalysis() {
    // Get server items to trigger vector analysis
    const serverItems = document.querySelectorAll('.server-item');
    
    // Skip if no server items are found (e.g., on server config page)
    if (serverItems.length === 0) {
        console.log('No server items found, skipping vector analysis initialization');
        return;
    }
    
    let currentServer = '';
    
    // Load combined vectors immediately on page load
    loadCombinedVectors();
    
    serverItems.forEach(item => {
        item.addEventListener('click', async (e) => {
            const serverName = item.dataset.server;
            
            // Check if user clicked on chevron or function count - navigate to server page
            if (e.target.classList.contains('fa-chevron-right') || 
                e.target.closest('[data-tooltip="Click to view functions"]') ||
                e.ctrlKey || e.metaKey) {
                window.location.href = `/server/${serverName}`;
                return;
            }
            
            // If there are 0 functions, navigate to server page instead of analysis
            const functionCountElement = item.querySelector('.text-sm.text-gray-600');
            if (functionCountElement && functionCountElement.textContent.includes('0 Functions')) {
                window.location.href = `/server/${serverName}`;
                return;
            }
            
            // Check if this server is already selected for analysis
            if (currentServer === serverName) {
                console.log(`Server ${serverName} is already selected for analysis, navigating to server page instead`);
                window.location.href = `/server/${serverName}`;
                return;
            }
            
            // Set as current server for analysis (for TAP generation)
            currentServer = serverName;
            
            // Update visual state - remove active class from all servers
            document.querySelectorAll('.server-item').forEach(serverItem => {
                serverItem.classList.remove('ring-2', 'ring-red-500', 'bg-red-50');
            });
            
            // Add active class to selected server
            item.classList.add('ring-2', 'ring-red-500', 'bg-red-50');
        });
    });
    
    // Function to load combined vectors from all servers
    async function loadCombinedVectors() {
        // Show loading state
        document.getElementById('vector-analysis-empty').classList.add('hidden');
        document.getElementById('vector-analysis-content').classList.add('hidden');
        document.getElementById('vector-analysis-error').classList.add('hidden');
        document.getElementById('vector-analysis-loading').classList.remove('hidden');
        
        // Update server name display
        const serverNameDisplay = document.querySelector('.server-name-display span');
        if (serverNameDisplay) {
            serverNameDisplay.textContent = 'All Servers Combined';
        }
        
        try {
            // Call API to get combined functions from all servers
            const response = await fetch('/api/classify-functions-all');
            const data = await response.json();
            
            if (data.success) {
                // Hide loading and show content
                document.getElementById('vector-analysis-loading').classList.add('hidden');
                document.getElementById('vector-analysis-content').classList.remove('hidden');
                
                // Populate inward vectors with selectable items
                const inwardVectorsList = document.getElementById('inward-vectors-list');
                inwardVectorsList.innerHTML = '';
                
                if (data.classification.inward_vectors.length > 0) {
                    data.classification.inward_vectors.forEach(vector => {
                        const vectorItem = document.createElement('div');
                        vectorItem.className = 'p-3 bg-white border border-blue-200 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors vector-item';
                        vectorItem.dataset.vectorName = vector.name;
                        vectorItem.dataset.vectorServer = vector.server;
                        vectorItem.dataset.vectorType = 'inward';
                        vectorItem.innerHTML = `
                            <div class="font-medium text-blue-800 flex items-center justify-between">
                                ${vector.name}
                                <i class="fas fa-circle-check text-blue-600 opacity-0 selected-icon"></i>
                            </div>
                            <div class="text-xs text-blue-600 mt-1">
                                <i class="fas fa-server mr-1"></i>${vector.server}
                            </div>
                        `;
                        
                        // Add click handler for immediate selection
                        vectorItem.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Remove selection from other inward vectors immediately
                            document.querySelectorAll('[data-vector-type="inward"]').forEach(item => {
                                item.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-100');
                                const icon = item.querySelector('.selected-icon');
                                if (icon) icon.classList.add('opacity-0');
                            });
                            
                            // Select this vector immediately
                            vectorItem.classList.add('ring-2', 'ring-blue-500', 'bg-blue-100');
                            const selectedIcon = vectorItem.querySelector('.selected-icon');
                            if (selectedIcon) selectedIcon.classList.remove('opacity-0');
                            
                            // Update generate button state immediately
                            updateGenerateButtonState();
                        });
                        
                        inwardVectorsList.appendChild(vectorItem);
                    });
                } else {
                    inwardVectorsList.innerHTML = '<div class="text-center text-sm text-gray-500 py-2">No inward vectors found</div>';
                }
                
                // Populate private data vectors with selectable items
                const privateVectorsList = document.getElementById('private-vectors-list');
                privateVectorsList.innerHTML = '';
                
                if (data.classification.private_vectors.length > 0) {
                    data.classification.private_vectors.forEach(vector => {
                        const vectorItem = document.createElement('div');
                        vectorItem.className = 'p-3 bg-white border border-orange-200 rounded-lg cursor-pointer hover:bg-orange-50 transition-colors vector-item';
                        vectorItem.dataset.vectorName = vector.name;
                        vectorItem.dataset.vectorServer = vector.server;
                        vectorItem.dataset.vectorType = 'private';
                        vectorItem.innerHTML = `
                            <div class="font-medium text-orange-800 flex items-center justify-between">
                                ${vector.name}
                                <i class="fas fa-circle-check text-orange-600 opacity-0 selected-icon"></i>
                            </div>
                            <div class="text-xs text-orange-600 mt-1">
                                <i class="fas fa-server mr-1"></i>${vector.server}
                            </div>
                        `;
                        
                        // Add click handler for immediate selection
                        vectorItem.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Remove selection from other private vectors immediately
                            document.querySelectorAll('[data-vector-type="private"]').forEach(item => {
                                item.classList.remove('ring-2', 'ring-orange-500', 'bg-orange-100');
                                const icon = item.querySelector('.selected-icon');
                                if (icon) icon.classList.add('opacity-0');
                            });
                            
                            // Select this vector immediately
                            vectorItem.classList.add('ring-2', 'ring-orange-500', 'bg-orange-100');
                            const selectedIcon = vectorItem.querySelector('.selected-icon');
                            if (selectedIcon) selectedIcon.classList.remove('opacity-0');
                            
                            // Update generate button state immediately
                            updateGenerateButtonState();
                        });
                        
                        privateVectorsList.appendChild(vectorItem);
                    });
                } else {
                    privateVectorsList.innerHTML = '<div class="text-center text-sm text-gray-500 py-2">No private data vectors found</div>';
                }
                
                // Populate outward vectors with selectable items
                const outwardVectorsList = document.getElementById('outward-vectors-list');
                outwardVectorsList.innerHTML = '';
                
                if (data.classification.outward_vectors.length > 0) {
                    data.classification.outward_vectors.forEach(vector => {
                        const vectorItem = document.createElement('div');
                        vectorItem.className = 'p-3 bg-white border border-green-200 rounded-lg cursor-pointer hover:bg-green-50 transition-colors vector-item';
                        vectorItem.dataset.vectorName = vector.name;
                        vectorItem.dataset.vectorServer = vector.server;
                        vectorItem.dataset.vectorType = 'outward';
                        vectorItem.innerHTML = `
                            <div class="font-medium text-green-800 flex items-center justify-between">
                                ${vector.name}
                                <i class="fas fa-circle-check text-green-600 opacity-0 selected-icon"></i>
                            </div>
                            <div class="text-xs text-green-600 mt-1">
                                <i class="fas fa-server mr-1"></i>${vector.server}
                            </div>
                        `;
                        
                        // Add click handler for immediate selection
                        vectorItem.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Remove selection from other outward vectors immediately
                            document.querySelectorAll('[data-vector-type="outward"]').forEach(item => {
                                item.classList.remove('ring-2', 'ring-green-500', 'bg-green-100');
                                const icon = item.querySelector('.selected-icon');
                                if (icon) icon.classList.add('opacity-0');
                            });
                            
                            // Select this vector immediately
                            vectorItem.classList.add('ring-2', 'ring-green-500', 'bg-green-100');
                            const selectedIcon = vectorItem.querySelector('.selected-icon');
                            if (selectedIcon) selectedIcon.classList.remove('opacity-0');
                            
                            // Update generate button state immediately
                            updateGenerateButtonState();
                        });
                        
                        outwardVectorsList.appendChild(vectorItem);
                    });
                } else {
                    outwardVectorsList.innerHTML = '<div class="text-center text-sm text-gray-500 py-2">No outward vectors found</div>';
                }
                
                // Toggle generate button state
                updateGenerateButtonState();
            } else {
                throw new Error(data.error || 'Unknown error classifying functions');
            }
        } catch (error) {
            // Show error state
            document.getElementById('vector-analysis-loading').classList.add('hidden');
            document.getElementById('vector-analysis-error').classList.remove('hidden');
            document.getElementById('vector-analysis-error-message').textContent = error.message;
            console.error('Error:', error);
        }
    }
    
    // Handle vector selection and generate button state
    const generateBtn = document.getElementById('generate-injection-btn');
    
    function updateGenerateButtonState() {
        const selectedInward = document.querySelector('[data-vector-type="inward"].ring-2');
        const selectedPrivate = document.querySelector('[data-vector-type="private"].ring-2');
        const selectedOutward = document.querySelector('[data-vector-type="outward"].ring-2');
        
        // TAP generation requires an inward vector and either private or outward vector
        if (selectedInward && (selectedPrivate || selectedOutward)) {
            generateBtn.disabled = false;
        } else {
            generateBtn.disabled = true;
        }
    }
    
    // Handle generate button click
    generateBtn.addEventListener('click', async () => {
        const selectedInward = document.querySelector('[data-vector-type="inward"].ring-2');
        const selectedPrivate = document.querySelector('[data-vector-type="private"].ring-2');
        const selectedOutward = document.querySelector('[data-vector-type="outward"].ring-2');
        
        const inwardVector = selectedInward ? selectedInward.dataset.vectorName : null;
        const privateVector = selectedPrivate ? selectedPrivate.dataset.vectorName : null;
        const outwardVector = selectedOutward ? selectedOutward.dataset.vectorName : null;
        
        let serverForInward = selectedInward ? selectedInward.dataset.vectorServer : null;
        let serverForPrivate = selectedPrivate ? selectedPrivate.dataset.vectorServer : null;
        let serverForOutward = selectedOutward ? selectedOutward.dataset.vectorServer : null;
        
        // Get TAP parameters
        const branchingFactor = parseInt(document.getElementById('branching-factor').value) || 2;
        const depth = parseInt(document.getElementById('depth').value) || 4;
        const width = parseInt(document.getElementById('width').value) || 4;
        
        if (!inwardVector || !outwardVector || !serverForInward || !serverForOutward || !privateVector || !serverForPrivate) {
            showToast('Please select an inward vector and either a private or outward vector.', 'warning');
            return;
        }
        
        // Show prompt injection section and loading state
        document.getElementById('prompt-injection-container').classList.remove('hidden');
        document.getElementById('prompt-injection-loading').classList.remove('hidden');
        document.getElementById('prompt-injection-content').classList.add('hidden');
        document.getElementById('prompt-injection-error').classList.add('hidden');
        
        // Disable generate button during request
        setButtonLoading(generateBtn, true);
        
        try {
            // Call API to run main_TAP.py in background
            const response = await fetch('/api/generate-prompt-injection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inward_server: serverForInward,
                    outward_server: serverForOutward,
                    private_server: serverForPrivate,
                    inward_vector: inwardVector,
                    outward_vector: outwardVector,
                    private_vector: privateVector,
                    branching_factor: branchingFactor,
                    depth: depth,
                    width: width
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Re-enable generate button
                setButtonLoading(generateBtn, false);
                
                // Hide loading and show attack graph immediately
                document.getElementById('prompt-injection-loading').classList.add('hidden');
                initializeAttackGraph();
                
                showToast('TAP analysis started! Use refresh button to update the graph.', 'success');
            } else {
                throw new Error(data.message || 'Failed to start TAP analysis');
            }
        } catch (error) {
            // Re-enable generate button
            setButtonLoading(generateBtn, false);
            
            // Show error state
            document.getElementById('prompt-injection-loading').classList.add('hidden');
            document.getElementById('prompt-injection-error').classList.remove('hidden');
            document.getElementById('prompt-injection-error-message').textContent = error.message;
            console.error('Error:', error);
        }
    });
}

// Initialize once DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Handle form submissions to prevent page reload
    document.querySelectorAll('form').forEach(form => {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
        });
    });
    
    // Initialize any tooltips
    const tooltips = document.querySelectorAll('[data-tooltip]');
    tooltips.forEach(tooltip => {
        tooltip.addEventListener('mouseenter', (e) => {
            const tooltipText = e.target.getAttribute('data-tooltip');
            
            // Create tooltip element
            const tooltipEl = document.createElement('div');
            tooltipEl.className = 'absolute z-50 bg-gray-900 text-white text-xs rounded py-1 px-2 max-w-xs';
            tooltipEl.style.bottom = 'calc(100% + 5px)';
            tooltipEl.style.left = '50%';
            tooltipEl.style.transform = 'translateX(-50%)';
            tooltipEl.textContent = tooltipText;
            
            // Add arrow
            const arrow = document.createElement('div');
            arrow.className = 'absolute w-2 h-2 bg-gray-900 transform rotate-45';
            arrow.style.bottom = '-4px';
            arrow.style.left = 'calc(50% - 4px)';
            
            tooltipEl.appendChild(arrow);
            e.target.appendChild(tooltipEl);
        });
        
        tooltip.addEventListener('mouseleave', (e) => {
            const tooltipEl = e.target.querySelector('div.absolute');
            if (tooltipEl) {
                tooltipEl.remove();
            }
        });
    });
    
    // Setup copy buttons for attack vector payloads
    setupCopyButtons();
    
    // Add security notice for function testing
    addSecurityNotices();
    
    // Initialize vector analysis functionality
    initVectorAnalysis();
});

// Attack Graph Visualization
function initializeAttackGraph() {
    const promptContent = document.getElementById('prompt-injection-content');
    promptContent.innerHTML = `
        <div class="bg-white rounded-lg shadow-md overflow-hidden border border-red-200">
            <div class="bg-red-50 p-3 border-b border-red-200 flex items-center justify-between">
                <h5 class="font-bold text-red-800">TAP Attack Tree Visualization</h5>
                <div class="flex items-center space-x-2">
                    <button id="refresh-graph-btn" class="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700">
                        <i class="fas fa-sync-alt mr-1"></i> Refresh
                    </button>
                    <div id="graph-stats" class="text-sm text-red-600"></div>
                </div>
            </div>
            <div class="p-4">
                <p class="text-gray-600 text-sm mb-4">Real-time visualization of TAP attack progression. Click on nodes to see prompts and responses.</p>
                
                <!-- Graph Controls -->
                <div class="mb-4 flex items-center space-x-4">
                    <div class="flex items-center space-x-2">
                        <span class="text-sm font-medium">Legend:</span>
                        <div class="flex items-center space-x-1">
                            <div class="w-3 h-3 rounded-full bg-green-500"></div>
                            <span class="text-xs">Score 1</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <div class="w-3 h-3 rounded-full bg-yellow-500"></div>
                            <span class="text-xs">Score 2</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <div class="w-3 h-3 rounded-full bg-orange-500"></div>
                            <span class="text-xs">Score 3</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <div class="w-3 h-3 rounded-full bg-red-500"></div>
                            <span class="text-xs">Score 4</span>
                        </div>
                        <div class="flex items-center space-x-1">
                            <div class="w-3 h-3 rounded-full bg-red-700"></div>
                            <span class="text-xs">Score 5</span>
                        </div>
                    </div>
                </div>
                
                <!-- Graph Container -->
                <div id="attack-graph-container" class="w-full" style="height: 500px; border: 1px solid #e5e7eb; border-radius: 0.5rem;">
                    <svg id="attack-graph-svg" width="100%" height="100%"></svg>
                </div>
                
                <!-- Node Details Panel -->
                <div id="node-details-panel" class="mt-4 p-4 bg-gray-50 rounded border hidden">
                    <div class="flex items-center justify-between mb-2">
                        <h6 class="font-bold text-gray-800">Node Details</h6>
                        <button onclick="clearSelection()" class="text-gray-500 hover:text-gray-700 text-sm">
                            <i class="fas fa-times"></i> Clear Selection
                        </button>
                    </div>
                    <div id="node-details-content"></div>
                </div>
                
            </div>
        </div>
    `;
    promptContent.classList.remove('hidden');
    
    // Re-enable generate button if it exists
    const generateBtn = document.getElementById('generate-injection-btn');
    if (generateBtn) {
        setButtonLoading(generateBtn, false);
    }
    
    // Initialize graph
    loadAndRenderGraph();
    
    // Add refresh functionality
    document.getElementById('refresh-graph-btn').addEventListener('click', loadAndRenderGraph);
    
    showToast('TAP attack graph visualization ready!', 'success');
}

async function loadAndRenderGraph() {
    try {
        const response = await fetch('/api/attack-data');
        const data = await response.json();
        
        if (data.success) {
            renderAttackGraph(data.data);
            document.getElementById('graph-stats').textContent = `${data.count} nodes`;
        } else {
            console.error('Failed to load attack data:', data.error);
            showToast('Failed to load attack data', 'error');
        }
    } catch (error) {
        console.error('Error loading attack data:', error);
        showToast('Error loading attack data', 'error');
    }
}

function renderAttackGraph(attackData) {
    const container = document.getElementById('attack-graph-container');
    const rect = container.getBoundingClientRect();
    
    // Clear existing content and selection
    d3.select('#attack-graph-svg').selectAll('*').remove();
    clearSelection();
    
    if (!attackData || attackData.length === 0) {
        // Show empty state
        d3.select('#attack-graph-svg')
            .append('text')
            .attr('x', '50%')
            .attr('y', '50%')
            .attr('text-anchor', 'middle')
            .attr('fill', '#6b7280')
            .style('font-size', '14px')
            .text('No attack data available yet. Run TAP analysis to see the attack tree.');
        return;
    }
    
    // Set up compact dimensions for better tree visualization
    const margin = { top: 60, right: 100, bottom: 60, left: 100 };
    const nodeCount = attackData.length;
    // More compact sizing - calculate based on actual content
    const width = Math.max(800, Math.min(1200, nodeCount * 80)); // Compact width
    const height = Math.max(400, Math.min(600, nodeCount * 60)); // Compact height
    
    // Create SVG with D3 - ensure it's large enough for scrolling
    const svg = d3.select('#attack-graph-svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);
    
    const g = svg.append('g')
        .attr('transform', `translate(${margin.left},${margin.top})`);
    
    // Process attack data into hierarchical structure
    const nodesMap = new Map();
    const rootNodes = [];
    
    // Validate attack data first
    if (!Array.isArray(attackData)) {
        console.error('Attack data is not an array:', attackData);
        return;
    }
    
    // First pass: create all nodes
    attackData.forEach((attack, index) => {
        if (!attack || !attack.self_id) {
            console.warn(`Skipping invalid attack at index ${index}:`, attack);
            return;
        }
        
        const node = {
            id: attack.self_id,
            parentId: attack.parent_id,
            score: attack.score || 0,
            adv_prompt: attack.adv_prompt || '',
            target_response: attack.target_response || '',
            improvement: attack.improvement || '',
            children: []
        };
        nodesMap.set(attack.self_id, node);
        
        if (!attack.parent_id || attack.parent_id === "NA") {
            rootNodes.push(node);
        }
    });
    
    // Second pass: build parent-child relationships
    attackData.forEach(attack => {
        if (attack && attack.parent_id && attack.parent_id !== "NA" && attack.self_id) {
            const parent = nodesMap.get(attack.parent_id);
            const child = nodesMap.get(attack.self_id);
            if (parent && child) {
                parent.children.push(child);
            } else {
                console.warn(`Could not find parent ${attack.parent_id} or child ${attack.self_id}`);
            }
        }
    });
    
    console.log('Processed nodes map:', nodesMap);
    console.log('Root nodes:', rootNodes);
    
    if (rootNodes.length === 0) {
        console.error('No root nodes found');
        d3.select('#attack-graph-svg')
            .append('text')
            .attr('x', '50%')
            .attr('y', '50%')
            .attr('text-anchor', 'middle')
            .attr('fill', '#ef4444')
            .style('font-size', '14px')
            .text('Error: No valid root nodes found in attack data');
        return;
    }
    
    // Create a virtual root if there are multiple root nodes
    let hierarchyRoot;
    if (rootNodes.length === 1) {
        hierarchyRoot = d3.hierarchy(rootNodes[0]);
    } else {
        const virtualRoot = {
            id: 'virtual-root',
            children: rootNodes,
            virtual: true
        };
        hierarchyRoot = d3.hierarchy(virtualRoot);
    }
    
    // Create compact tree layout with closer nodes
    const treeLayout = d3.tree()
        .size([width, height])
        .nodeSize([60, 80]) // [width, height] for each node - much more compact
        .separation((a, b) => {
            // Tighter separation for compact view
            const aSiblings = a.parent ? a.parent.children.length : 1;
            const bSiblings = b.parent ? b.parent.children.length : 1;
            const baseSeparation = a.parent === b.parent ? 0.8 : 1.2;
            return baseSeparation + Math.max(aSiblings, bSiblings) * 0.1;
        });
    
    // Apply the layout
    const treeData = treeLayout(hierarchyRoot);
    const nodes = treeData.descendants();
    const links = treeData.links();
    
    // Filter out virtual root if it exists
    const visibleNodes = nodes.filter(d => d.data && !d.data.virtual);
    const visibleLinks = links.filter(d => 
        d.source && d.target && 
        d.source.data && d.target.data && 
        !d.source.data.virtual && !d.target.data.virtual
    );
    
    // Adjust positions to center the tree
    if (visibleNodes.length > 0) {
        const xExtent = d3.extent(visibleNodes, d => d.x);
        const xOffset = (width - (xExtent[1] - xExtent[0])) / 2 - xExtent[0];
        
        visibleNodes.forEach(d => {
            d.x += xOffset;
        });
    }
    
    // Add level demarkation lines
    const levels = d3.group(visibleNodes, d => d.depth);
    levels.forEach((levelNodes, depth) => {
        const y = levelNodes[0].y;
        
        // Add horizontal dashed line - more compact
        g.append('line')
            .attr('x1', -margin.left + 10)
            .attr('y1', y - 25)
            .attr('x2', width + margin.right - 10)
            .attr('y2', y - 25)
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3');
        
        // Add level label - smaller and more compact
        g.append('text')
            .attr('x', -margin.left + 5)
            .attr('y', y - 30)
            .attr('fill', '#6b7280')
            .attr('font-size', '10px')
            .attr('font-weight', '500')
            .text(`Level ${depth}`);
    });
    
    // Draw links with curved paths
    if (visibleLinks.length > 0) {
        g.selectAll('.link')
            .data(visibleLinks)
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d => {
                try {
                    // Ensure we have valid coordinates
                    if (d.source && d.target && 
                        typeof d.source.x === 'number' && typeof d.source.y === 'number' &&
                        typeof d.target.x === 'number' && typeof d.target.y === 'number') {
                        return d3.linkVertical()({
                            source: [d.source.x, d.source.y],
                            target: [d.target.x, d.target.y]
                        });
                    } else {
                        console.error('Invalid link data:', d);
                        return '';
                    }
                } catch (error) {
                    console.error('Error generating link path:', error, d);
                    return '';
                }
            })
            .attr('fill', 'none')
            .attr('stroke', '#6b7280')
            .attr('stroke-width', 2);
    }
    
    // Draw nodes
    const nodeGroups = g.selectAll('.node')
        .data(visibleNodes)
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x},${d.y})`)
        .style('cursor', 'pointer');
    
    // Add circles for nodes - smaller for compact view
    nodeGroups.append('circle')
        .attr('r', 18)
        .attr('fill', d => {
            const score = d.data.score;
            if (score === 1) return '#10b981'; // green
            if (score === 2) return '#eab308'; // yellow
            if (score === 3) return '#f97316'; // orange
            if (score === 4) return '#ef4444'; // red
            if (score === 5) return '#dc2626'; // bright red
            return '#6b7280'; // default gray
        })
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 1);
    
    // Add score text
    nodeGroups.append('text')
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('fill', 'white')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .text(d => d.data.score);
    
    // Add click and hover interactions
    nodeGroups
        .on('click', function(event, d) {
            selectNode(d.data, this);
        })
        .on('mouseenter', function(event, d) {
            if (this !== selectedNodeGroup) {
                d3.select(this).select('circle')
                    .attr('stroke', '#9ca3af')
                    .attr('stroke-width', 1.5);
            }
        })
        .on('mouseleave', function(event, d) {
            if (this !== selectedNodeGroup) {
                d3.select(this).select('circle')
                    .attr('stroke', '#ffffff')
                    .attr('stroke-width', 1);
            }
        });
    
    // Auto-select the first node immediately
    if (visibleNodes.length > 0) {
        const firstNodeGroup = nodeGroups.nodes()[0];
        if (firstNodeGroup) {
            selectNode(visibleNodes[0].data, firstNodeGroup);
        }
    }
}

// Track selected node and group for border management
let selectedNodeGroup = null;

function selectNode(node, group) {
    // Remove border from previously selected node (restore default)
    if (selectedNodeGroup) {
        d3.select(selectedNodeGroup).select('circle')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .style('filter', null);
    }
    
    // Add thinner white border to current selected node
    d3.select(group).select('circle')
        .attr('stroke', '#ffffff')
        .attr('stroke-width', 3)
        .style('filter', 'drop-shadow(0 0 4px #ffffff)');
    
    // Update selected node reference
    selectedNodeGroup = group;
    
    // Show node details
    showNodeDetails(node);
}

function showNodeDetails(node) {
    const panel = document.getElementById('node-details-panel');
    const content = document.getElementById('node-details-content');
    
    // Process adversarial prompt to make it readable and preserve line breaks
    let advPrompt = node.adv_prompt || 'No adversarial prompt available';
    if (advPrompt.length > 5000) {
        advPrompt = advPrompt.substring(0, 5000) + '...';
    }
    
    // Process target response - show the full response if available and preserve line breaks
    let targetResponse = node.target_response || 'No target response available';
    
    // Try to extract meaningful content from target response
    if (targetResponse.includes('draco976')) {
        const idx = targetResponse.indexOf('draco976');
        const afterDraco = targetResponse.substring(idx + 'draco976'.length).trim();
        if (afterDraco) {
            targetResponse = afterDraco;
        }
    }
    
    // Limit response length for display
    if (targetResponse.length > 5000) {
        targetResponse = targetResponse.substring(0, 5000) + '...';
    }
    
    // Process improvement text with line breaks
    let improvement = node.improvement || 'No improvement information available';
    if (improvement.length > 3000) {
        improvement = improvement.substring(0, 3000) + '...';
    }
    
    // Helper function to convert \\n to actual line breaks and escape HTML
    function formatTextWithLineBreaks(text) {
        return text
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\\n/g, '\n')
            .replace(/\n/g, '<br>');
    }
    
    content.innerHTML = `
        <div class="space-y-4">
            <div class="flex items-center gap-4">
                <div>
                    <span class="font-medium" style="color: var(--text-primary);">Score:</span>
                    <span class="ml-2 px-3 py-1 rounded-full text-sm font-bold" style="background: ${getScoreBackgroundColor(node.score)}; color: ${getScoreTextColor(node.score)};">${node.score}</span>
                </div>
                <div class="text-sm" style="color: var(--text-muted);">
                    <span class="font-medium">Node ID:</span>
                    <span class="ml-1 font-mono">${node.id.substring(0, 8)}...</span>
                </div>
            </div>
            
            ${node.parentId && node.parentId !== "NA" ? `
            <div class="text-sm" style="color: var(--text-muted);">
                <span class="font-medium">Parent ID:</span>
                <span class="ml-1 font-mono">${node.parentId.substring(0, 8)}...</span>
            </div>
            ` : ''}
            
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="font-medium" style="color: var(--text-primary);">Adversarial Prompt:</span>
                    <button onclick="copyToClipboard('${btoa(advPrompt).replace(/'/g, "\\'")}', 'Adversarial prompt')" 
                            class="copy-btn px-2 py-1 text-xs">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="code-editor-text rounded-lg p-3 max-h-48 overflow-y-auto text-sm leading-relaxed" style="background: var(--bg-surface); color: var(--text-primary); border: var(--glass-border); font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; white-space: pre-wrap;">
                    ${formatTextWithLineBreaks(advPrompt)}
                </div>
            </div>
            
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="font-medium" style="color: var(--text-primary);">Target Response:</span>
                    <button onclick="copyToClipboard('${btoa(targetResponse).replace(/'/g, "\\'")}', 'Target response')" 
                            class="copy-btn px-2 py-1 text-xs">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="code-editor-text rounded-lg p-3 max-h-48 overflow-y-auto text-sm leading-relaxed" style="background: var(--bg-surface); color: var(--text-primary); border: var(--glass-border); font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; white-space: pre-wrap;">
                    ${formatTextWithLineBreaks(targetResponse)}
                </div>
            </div>
            
            <div class="space-y-2">
                <div class="flex items-center justify-between">
                    <span class="font-medium" style="color: var(--text-primary);">Improvement:</span>
                    <button onclick="copyToClipboard('${btoa(improvement).replace(/'/g, "\\'")}', 'Improvement')" 
                            class="copy-btn px-2 py-1 text-xs">
                        <i class="fas fa-copy"></i>
                    </button>
                </div>
                <div class="code-editor-text rounded-lg p-3 max-h-48 overflow-y-auto text-sm leading-relaxed" style="background: var(--bg-surface); color: var(--text-primary); border: var(--glass-border); font-family: 'JetBrains Mono', 'Monaco', 'Menlo', 'Ubuntu Mono', monospace; white-space: pre-wrap;">
                    ${formatTextWithLineBreaks(improvement)}
                </div>
            </div>
        </div>
    `;
    
    panel.classList.remove('hidden');
}

// Helper function to copy content to clipboard
function copyToClipboard(base64Content, contentType) {
    try {
        const content = atob(base64Content);
        navigator.clipboard.writeText(content).then(() => {
            showToast(`${contentType} copied to clipboard!`, 'success');
        }).catch(err => {
            console.error('Failed to copy: ', err);
            showToast('Failed to copy to clipboard', 'error');
        });
    } catch (err) {
        console.error('Failed to decode content: ', err);
        showToast('Failed to copy to clipboard', 'error');
    }
}

function clearSelection() {
    // Remove border from selected node
    if (selectedNodeGroup) {
        d3.select(selectedNodeGroup).select('circle')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .style('filter', null);
        selectedNodeGroup = null;
    }
    
    // Hide node details panel
    const panel = document.getElementById('node-details-panel');
    if (panel) {
        panel.classList.add('hidden');
    }
}

function getScoreColor(score) {
    if (score === 1) return 'bg-green-100 text-green-800';
    if (score === 2) return 'bg-yellow-100 text-yellow-800';
    if (score === 3) return 'bg-orange-100 text-orange-800';
    if (score === 4) return 'bg-red-100 text-red-800';
    if (score === 5) return 'bg-red-200 text-red-900';
    return 'bg-gray-100 text-gray-800';
}

function getScoreBackgroundColor(score) {
    if (score === 1) return '#dcfce7'; // green-100
    if (score === 2) return '#fef3c7'; // yellow-100
    if (score === 3) return '#fed7aa'; // orange-100
    if (score === 4) return '#fee2e2'; // red-100
    if (score === 5) return '#fecaca'; // red-200
    return '#f3f4f6'; // gray-100
}

function getScoreTextColor(score) {
    if (score === 1) return '#166534'; // green-800
    if (score === 2) return '#92400e'; // yellow-800
    if (score === 3) return '#c2410c'; // orange-800
    if (score === 4) return '#991b1b'; // red-800
    if (score === 5) return '#7f1d1d'; // red-900
    return '#374151'; // gray-800
}
