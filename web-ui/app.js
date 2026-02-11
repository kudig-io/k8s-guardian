const API_BASE = '/api';
let currentNamespace = 'all';
let currentSection = 'dashboard';
let socket = null;
let charts = {};
let resourceHistory = {
    cpu: [],
    memory: []
};

const MAX_HISTORY_POINTS = 60;

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    connectWebSocket();
    loadNamespaces();
    loadDashboard();
});

function initializeApp() {
    setupNavigation();
    setupCharts();
}

function setupEventListeners() {
    document.getElementById('refresh-btn').addEventListener('click', refreshCurrentSection);
    document.getElementById('namespace-select').addEventListener('change', (e) => {
        currentNamespace = e.target.value;
        refreshCurrentSection();
    });

    document.getElementById('monitoring-time-range').addEventListener('change', refreshCurrentSection);
    document.getElementById('monitoring-refresh-btn').addEventListener('click', refreshCurrentSection);

    document.getElementById('create-alert-rule-btn').addEventListener('click', showCreateAlertRuleModal);
    document.getElementById('export-alerts-btn').addEventListener('click', exportAlertRules);
    document.getElementById('import-alerts-btn').addEventListener('click', importAlertRules);

    document.getElementById('create-script-btn').addEventListener('click', showCreateScriptModal);
    document.getElementById('refresh-scripts-btn').addEventListener('click', loadAutomation);

    document.getElementById('create-tenant-btn').addEventListener('click', showCreateTenantModal);
    document.getElementById('refresh-tenants-btn').addEventListener('click', loadTenants);

    document.getElementById('pod-search').addEventListener('input', debounce(filterPods, 300));
    document.getElementById('pod-status-filter').addEventListener('change', filterPods);
    document.getElementById('deployment-search').addEventListener('input', debounce(filterDeployments, 300));
    document.getElementById('service-search').addEventListener('input', debounce(filterServices, 300));
    document.getElementById('event-type-filter').addEventListener('change', filterEvents);

    document.getElementById('log-pod-select').addEventListener('change', (e) => {
        loadContainersForPod(e.target.value);
    });

    document.getElementById('log-tail-lines').addEventListener('change', loadLogs);
    document.getElementById('log-analyze-btn').addEventListener('click', analyzeLogs);

    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });

    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') {
            closeModal();
        }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(e.target.closest('.resource-tabs, .network-tabs, .storage-tabs, .rbac-tabs'), tab);
        });
    });
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = e.target.dataset.section;
            navigateToSection(section);
        });
    });
}

function navigateToSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelectorAll('.section').forEach(s => {
        s.classList.remove('active');
    });

    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    document.getElementById(section).classList.add('active');
    currentSection = section;

    loadSectionData(section);
}

function loadSectionData(section) {
    switch (section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'pods':
            loadPods();
            break;
        case 'deployments':
            loadDeployments();
            break;
        case 'services':
            loadServices();
            break;
        case 'nodes':
            loadNodes();
            break;
        case 'events':
            loadEvents();
            break;
        case 'logs':
            loadPodsForLogs();
            break;
        case 'monitoring':
            loadMonitoring();
            break;
        case 'alerts':
            loadAlerts();
            break;
        case 'automation':
            loadAutomation();
            break;
        case 'tenants':
            loadTenants();
            break;
        case 'resources':
            loadResourceTab('resource-quotas');
            break;
        case 'network':
            loadNetworkTab('network-policies');
            break;
        case 'storage':
            loadStorageTab('persistent-volumes');
            break;
        case 'rbac':
            loadRBACTab('roles');
            break;
    }
}

function refreshCurrentSection() {
    loadSectionData(currentSection);
}

async function loadNamespaces() {
    try {
        const response = await fetch(`${API_BASE}/namespaces`);
        const namespaces = await response.json();

        const select = document.getElementById('namespace-select');
        select.innerHTML = '<option value="all">所有命名空间</option>';
        namespaces.forEach(ns => {
            const option = document.createElement('option');
            option.value = ns.metadata.name;
            option.textContent = ns.metadata.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load namespaces:', error);
    }
}

async function loadDashboard() {
    try {
        const [health, usage, pods] = await Promise.all([
            fetch(`${API_BASE}/health`).then(r => r.json()),
            fetch(`${API_BASE}/resource-usage`).then(r => r.json()),
            fetch(`${API_BASE}/pods?namespace=${currentNamespace}`).then(r => r.json())
        ]);

        updateHealthStatus(health.overall);
        updateCPUChart(usage.cpu);
        updateMemoryChart(usage.memory);
        updatePodStatusChart(pods);
        updateResourceTrendChart(usage);

        addToResourceHistory(usage);
    } catch (error) {
        console.error('Failed to load dashboard:', error);
    }
}

function updateHealthStatus(status) {
    const healthElement = document.getElementById('cluster-health');
    const indicator = healthElement.querySelector('.status-indicator');
    const text = healthElement.querySelector('.status-text');

    indicator.className = 'status-indicator';
    text.textContent = status;

    switch (status) {
        case 'Healthy':
            indicator.classList.add('healthy');
            break;
        case 'Degraded':
            indicator.classList.add('degraded');
            break;
        case 'Unhealthy':
            indicator.classList.add('unhealthy');
            break;
    }
}

function setupCharts() {
    const cpuCtx = document.getElementById('cpu-chart').getContext('2d');
    charts.cpu = new Chart(cpuCtx, {
        type: 'doughnut',
        data: {
            labels: ['已使用', '可用'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#326ce5', '#e9ecef'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    const memoryCtx = document.getElementById('memory-chart').getContext('2d');
    charts.memory = new Chart(memoryCtx, {
        type: 'doughnut',
        data: {
            labels: ['已使用', '可用'],
            datasets: [{
                data: [0, 100],
                backgroundColor: ['#28a745', '#e9ecef'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    const podStatusCtx = document.getElementById('pod-status-chart').getContext('2d');
    charts.podStatus = new Chart(podStatusCtx, {
        type: 'bar',
        data: {
            labels: ['Running', 'Pending', 'Failed', 'Succeeded'],
            datasets: [{
                label: 'Pod 数量',
                data: [0, 0, 0, 0],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#17a2b8']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    const trendCtx = document.getElementById('resource-trend-chart').getContext('2d');
    charts.resourceTrend = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'CPU 使用率 (%)',
                    data: [],
                    borderColor: '#326ce5',
                    backgroundColor: 'rgba(50, 108, 229, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '内存使用率 (%)',
                    data: [],
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });
}

function updateCPUChart(cpuData) {
    const usedPercent = cpuData.usagePercent;
    const availablePercent = 100 - usedPercent;
    charts.cpu.data.datasets[0].data = [usedPercent, availablePercent];
    charts.cpu.update();
}

function updateMemoryChart(memoryData) {
    const usedPercent = memoryData.usagePercent;
    const availablePercent = 100 - usedPercent;
    charts.memory.data.datasets[0].data = [usedPercent, availablePercent];
    charts.memory.update();
}

function updatePodStatusChart(pods) {
    const statusCounts = {
        Running: 0,
        Pending: 0,
        Failed: 0,
        Succeeded: 0
    };

    pods.forEach(pod => {
        const status = pod.status.phase;
        if (statusCounts.hasOwnProperty(status)) {
            statusCounts[status]++;
        }
    });

    charts.podStatus.data.datasets[0].data = [
        statusCounts.Running,
        statusCounts.Pending,
        statusCounts.Failed,
        statusCounts.Succeeded
    ];
    charts.podStatus.update();
}

function updateResourceTrendChart(usage) {
    const now = new Date().toLocaleTimeString();
    charts.resourceTrend.data.labels.push(now);
    charts.resourceTrend.data.datasets[0].data.push(usage.cpu.usagePercent);
    charts.resourceTrend.data.datasets[1].data.push(usage.memory.usagePercent);

    if (charts.resourceTrend.data.labels.length > MAX_HISTORY_POINTS) {
        charts.resourceTrend.data.labels.shift();
        charts.resourceTrend.data.datasets[0].data.shift();
        charts.resourceTrend.data.datasets[1].data.shift();
    }

    charts.resourceTrend.update();
}

function addToResourceHistory(usage) {
    const timestamp = new Date().toISOString();
    resourceHistory.cpu.push({ timestamp, value: usage.cpu.usagePercent });
    resourceHistory.memory.push({ timestamp, value: usage.memory.usagePercent });

    if (resourceHistory.cpu.length > MAX_HISTORY_POINTS) {
        resourceHistory.cpu.shift();
        resourceHistory.memory.shift();
    }
}

async function loadPods() {
    try {
        const response = await fetch(`${API_BASE}/pods?namespace=${currentNamespace}`);
        const pods = await response.json();
        renderPodsTable(pods);
    } catch (error) {
        console.error('Failed to load pods:', error);
    }
}

function renderPodsTable(pods) {
    const tbody = document.getElementById('pods-table-body');
    tbody.innerHTML = '';

    if (pods.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="loading">没有找到 Pod</td></tr>';
        return;
    }

    pods.forEach(pod => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${pod.metadata.name}</td>
            <td>${pod.metadata.namespace}</td>
            <td><span class="status-badge ${pod.status.phase}">${pod.status.phase}</span></td>
            <td>${pod.spec.nodeName || '-'}</td>
            <td>${new Date(pod.metadata.creationTimestamp).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewPodDetails('${pod.metadata.name}', '${pod.metadata.namespace}')">详情</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterPods() {
    const searchTerm = document.getElementById('pod-search').value.toLowerCase();
    const statusFilter = document.getElementById('pod-status-filter').value;
    const rows = document.querySelectorAll('#pods-table-body tr');

    rows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const namespace = row.cells[1].textContent.toLowerCase();
        const status = row.cells[2].textContent.trim();

        const matchesSearch = name.includes(searchTerm) || namespace.includes(searchTerm);
        const matchesStatus = !statusFilter || status === statusFilter;

        row.style.display = matchesSearch && matchesStatus ? '' : 'none';
    });
}

async function loadDeployments() {
    try {
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;
        const response = await fetch(`${API_BASE}/deployments?namespace=${namespace}`);
        const deployments = await response.json();
        renderDeploymentsTable(deployments);
    } catch (error) {
        console.error('Failed to load deployments:', error);
    }
}

function renderDeploymentsTable(deployments) {
    const tbody = document.getElementById('deployments-table-body');
    tbody.innerHTML = '';

    if (deployments.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">没有找到 Deployment</td></tr>';
        return;
    }

    deployments.forEach(deployment => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${deployment.metadata.name}</td>
            <td>${deployment.metadata.namespace}</td>
            <td>${deployment.spec.replicas}</td>
            <td>${deployment.status.readyReplicas || 0}</td>
            <td>${deployment.spec.template.spec.containers[0].image}</td>
            <td>${new Date(deployment.metadata.creationTimestamp).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewDeploymentDetails('${deployment.metadata.name}', '${deployment.metadata.namespace}')">详情</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterDeployments() {
    const searchTerm = document.getElementById('deployment-search').value.toLowerCase();
    const rows = document.querySelectorAll('#deployments-table-body tr');

    rows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const namespace = row.cells[1].textContent.toLowerCase();
        const image = row.cells[4].textContent.toLowerCase();

        const matchesSearch = name.includes(searchTerm) || namespace.includes(searchTerm) || image.includes(searchTerm);

        row.style.display = matchesSearch ? '' : 'none';
    });
}

async function loadServices() {
    try {
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;
        const response = await fetch(`${API_BASE}/services?namespace=${namespace}`);
        const services = await response.json();
        renderServicesTable(services);
    } catch (error) {
        console.error('Failed to load services:', error);
    }
}

function renderServicesTable(services) {
    const tbody = document.getElementById('services-table-body');
    tbody.innerHTML = '';

    if (services.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="loading">没有找到 Service</td></tr>';
        return;
    }

    services.forEach(service => {
        const ports = service.spec.ports ? service.spec.ports.map(p => `${p.port}/${p.protocol}`).join(', ') : '-';
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${service.metadata.name}</td>
            <td>${service.metadata.namespace}</td>
            <td>${service.spec.type}</td>
            <td>${service.spec.clusterIP || 'None'}</td>
            <td>${ports}</td>
            <td>${new Date(service.metadata.creationTimestamp).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewServiceDetails('${service.metadata.name}', '${service.metadata.namespace}')">详情</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function filterServices() {
    const searchTerm = document.getElementById('service-search').value.toLowerCase();
    const rows = document.querySelectorAll('#services-table-body tr');

    rows.forEach(row => {
        const name = row.cells[0].textContent.toLowerCase();
        const namespace = row.cells[1].textContent.toLowerCase();
        const type = row.cells[2].textContent.toLowerCase();

        const matchesSearch = name.includes(searchTerm) || namespace.includes(searchTerm) || type.includes(searchTerm);

        row.style.display = matchesSearch ? '' : 'none';
    });
}

async function loadNodes() {
    try {
        const response = await fetch(`${API_BASE}/nodes`);
        const nodes = await response.json();
        renderNodesGrid(nodes);
    } catch (error) {
        console.error('Failed to load nodes:', error);
    }
}

function renderNodesGrid(nodes) {
    const grid = document.getElementById('nodes-grid');
    grid.innerHTML = '';

    if (nodes.length === 0) {
        grid.innerHTML = '<div class="loading">没有找到节点</div>';
        return;
    }

    nodes.forEach(node => {
        const readyCondition = node.status.conditions.find(c => c.type === 'Ready');
        const isReady = readyCondition && readyCondition.status === 'True';
        const roles = node.metadata.labels['kubernetes.io/role'] || 'none';

        const card = document.createElement('div');
        card.className = 'node-card';
        card.innerHTML = `
            <div class="node-header">
                <div class="node-name">${node.metadata.name}</div>
                <div class="node-status">
                    <span class="node-status-indicator ${isReady ? 'healthy' : 'unhealthy'}"></span>
                    <span>${isReady ? 'Ready' : 'Not Ready'}</span>
                </div>
            </div>
            <div class="node-info">
                <div class="node-info-item">
                    <span class="node-info-label">角色</span>
                    <span class="node-info-value">${roles}</span>
                </div>
                <div class="node-info-item">
                    <span class="node-info-label">版本</span>
                    <span class="node-info-value">${node.status.nodeInfo.kubeletVersion}</span>
                </div>
                <div class="node-info-item">
                    <span class="node-info-label">操作系统</span>
                    <span class="node-info-value">${node.status.nodeInfo.osImage}</span>
                </div>
                <div class="node-info-item">
                    <span class="node-info-label">容器运行时</span>
                    <span class="node-info-value">${node.status.nodeInfo.containerRuntimeVersion}</span>
                </div>
                <div class="node-info-item">
                    <span class="node-info-label">CPU</span>
                    <span class="node-info-value">${node.status.capacity.cpu}</span>
                </div>
                <div class="node-info-item">
                    <span class="node-info-label">内存</span>
                    <span class="node-info-value">${node.status.capacity.memory}</span>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

async function loadEvents() {
    try {
        const response = await fetch(`${API_BASE}/events?namespace=${currentNamespace}`);
        const events = await response.json();
        renderEvents(events);
    } catch (error) {
        console.error('Failed to load events:', error);
    }
}

function renderEvents(events) {
    const container = document.getElementById('events-container');
    container.innerHTML = '';

    if (events.length === 0) {
        container.innerHTML = '<div class="loading">没有找到事件</div>';
        return;
    }

    events.forEach(event => {
        const type = event.type || 'Normal';
        const reason = event.reason || 'Unknown';
        const message = event.message || '';
        const timestamp = event.lastTimestamp || event.firstTimestamp;
        const involvedObject = `${event.involvedObject?.kind || 'Unknown'}/${event.involvedObject?.name || 'Unknown'}`;

        const eventItem = document.createElement('div');
        eventItem.className = `event-item ${type}`;
        eventItem.innerHTML = `
            <div class="event-header">
                <span class="event-type ${type}">${type}</span>
                <span class="event-reason">${reason}</span>
            </div>
            <div class="event-message">${message}</div>
            <div class="event-meta">
                <span>对象: ${involvedObject}</span>
                <span>时间: ${timestamp}</span>
                ${event.involvedObject?.namespace && currentNamespace === 'all' ? `<span>命名空间: ${event.involvedObject.namespace}</span>` : ''}
            </div>
        `;
        container.appendChild(eventItem);
    });
}

function filterEvents() {
    const typeFilter = document.getElementById('event-type-filter').value;
    const eventItems = document.querySelectorAll('.event-item');

    eventItems.forEach(item => {
        const type = item.classList.contains('Normal') ? 'Normal' : 'Warning';
        item.style.display = !typeFilter || type === typeFilter ? '' : 'none';
    });
}

async function loadPodsForLogs() {
    try {
        const response = await fetch(`${API_BASE}/pods?namespace=${currentNamespace}`);
        const pods = await response.json();

        const select = document.getElementById('log-pod-select');
        select.innerHTML = '<option value="">选择 Pod</option>';
        pods.forEach(pod => {
            const option = document.createElement('option');
            option.value = pod.metadata.name;
            option.textContent = `${pod.metadata.name} (${pod.metadata.namespace})`;
            option.dataset.namespace = pod.metadata.namespace;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load pods for logs:', error);
    }
}

async function loadMonitoring() {
    try {
        const response = await fetch(`${API_BASE}/monitoring?timeRange=${document.getElementById('monitoring-time-range').value}`);
        const data = await response.json();

        updateClusterOverview(data.nodes, data.pods, data.cluster);
        setupMonitoringCharts();
        updateMonitoringCharts(data);
    } catch (error) {
        console.error('Failed to load monitoring:', error);
    }
}

function updateClusterOverview(nodes, pods, cluster) {
    document.getElementById('overview-nodes').textContent = nodes.length;
    document.getElementById('overview-pods').textContent = pods.length;
    
    const runningPods = pods.filter(p => p.phase === 'Running').length;
    const failedPods = pods.filter(p => p.phase === 'Failed').length;
    
    document.getElementById('overview-running-pods').textContent = runningPods;
    document.getElementById('overview-failed-pods').textContent = failedPods;
    
    document.getElementById('overview-cpu-capacity').textContent = cluster.cpu.total.toFixed(2) + ' cores';
    document.getElementById('overview-cpu-usage').textContent = cluster.cpu.usagePercent.toFixed(1) + '%';
    document.getElementById('overview-memory-capacity').textContent = (cluster.memory.total / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    document.getElementById('overview-memory-usage').textContent = cluster.memory.usagePercent.toFixed(1) + '%';
}

function setupMonitoringCharts() {
    if (charts.monitoringCpu) {
        charts.monitoringCpu.destroy();
    }
    if (charts.monitoringMemory) {
        charts.monitoringMemory.destroy();
    }
    if (charts.monitoringNodeCpu) {
        charts.monitoringNodeCpu.destroy();
    }
    if (charts.monitoringNodeMemory) {
        charts.monitoringNodeMemory.destroy();
    }
    if (charts.monitoringNetwork) {
        charts.monitoringNetwork.destroy();
    }
    if (charts.monitoringDisk) {
        charts.monitoringDisk.destroy();
    }
    if (charts.monitoringTopPods) {
        charts.monitoringTopPods.destroy();
    }
    if (charts.monitoringPodStatus) {
        charts.monitoringPodStatus.destroy();
    }
    if (charts.monitoringRestart) {
        charts.monitoringRestart.destroy();
    }

    const cpuCtx = document.getElementById('monitoring-cpu-chart').getContext('2d');
    charts.monitoringCpu = new Chart(cpuCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU 使用率 (%)',
                data: [],
                borderColor: '#326ce5',
                backgroundColor: 'rgba(50, 108, 229, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    const memoryCtx = document.getElementById('monitoring-memory-chart').getContext('2d');
    charts.monitoringMemory = new Chart(memoryCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '内存使用率 (%)',
                data: [],
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    const nodeCpuCtx = document.getElementById('monitoring-node-cpu-chart').getContext('2d');
    charts.monitoringNodeCpu = new Chart(nodeCpuCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'CPU 使用率 (%)',
                data: [],
                backgroundColor: '#326ce5'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    const nodeMemoryCtx = document.getElementById('monitoring-node-memory-chart').getContext('2d');
    charts.monitoringNodeMemory = new Chart(nodeMemoryCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '内存使用率 (%)',
                data: [],
                backgroundColor: '#28a745'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    const networkCtx = document.getElementById('monitoring-network-chart').getContext('2d');
    charts.monitoringNetwork = new Chart(networkCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '入站流量 (MB/s)',
                    data: [],
                    borderColor: '#17a2b8',
                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '出站流量 (MB/s)',
                    data: [],
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    const diskCtx = document.getElementById('monitoring-disk-chart').getContext('2d');
    charts.monitoringDisk = new Chart(diskCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '读取 (MB/s)',
                    data: [],
                    borderColor: '#6f42c1',
                    backgroundColor: 'rgba(111, 66, 193, 0.1)',
                    fill: true,
                    tension: 0.4
                },
                {
                    label: '写入 (MB/s)',
                    data: [],
                    borderColor: '#e83e8c',
                    backgroundColor: 'rgba(232, 62, 140, 0.1)',
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });

    const topPodsCtx = document.getElementById('monitoring-top-pods-chart').getContext('2d');
    charts.monitoringTopPods = new Chart(topPodsCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [
                {
                    label: 'CPU 使用率 (%)',
                    data: [],
                    backgroundColor: '#326ce5'
                },
                {
                    label: '内存使用率 (%)',
                    data: [],
                    backgroundColor: '#28a745'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100
                }
            }
        }
    });

    const podStatusCtx = document.getElementById('monitoring-pod-status-chart').getContext('2d');
    charts.monitoringPodStatus = new Chart(podStatusCtx, {
        type: 'doughnut',
        data: {
            labels: ['Running', 'Pending', 'Failed', 'Succeeded'],
            datasets: [{
                data: [0, 0, 0, 0],
                backgroundColor: ['#28a745', '#ffc107', '#dc3545', '#17a2b8']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });

    const restartCtx = document.getElementById('monitoring-restart-chart').getContext('2d');
    charts.monitoringRestart = new Chart(restartCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: '重启次数',
                data: [],
                backgroundColor: '#dc3545'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function updateMonitoringCharts(data) {
    const now = new Date().toLocaleTimeString();

    charts.monitoringCpu.data.labels.push(now);
    charts.monitoringCpu.data.datasets[0].data.push(data.cluster.cpu.usagePercent);
    if (charts.monitoringCpu.data.labels.length > 30) {
        charts.monitoringCpu.data.labels.shift();
        charts.monitoringCpu.data.datasets[0].data.shift();
    }
    charts.monitoringCpu.update();

    charts.monitoringMemory.data.labels.push(now);
    charts.monitoringMemory.data.datasets[0].data.push(data.cluster.memory.usagePercent);
    if (charts.monitoringMemory.data.labels.length > 30) {
        charts.monitoringMemory.data.labels.shift();
        charts.monitoringMemory.data.datasets[0].data.shift();
    }
    charts.monitoringMemory.update();

    const nodeNames = data.nodes.map(n => n.name);
    const nodeCpuUsage = data.nodes.map(n => n.cpu.usagePercent);

    charts.monitoringNodeCpu.data.labels = nodeNames;
    charts.monitoringNodeCpu.data.datasets[0].data = nodeCpuUsage;
    charts.monitoringNodeCpu.update();

    const nodeMemoryUsage = data.nodes.map(n => n.memory.usagePercent);

    charts.monitoringNodeMemory.data.labels = nodeNames;
    charts.monitoringNodeMemory.data.datasets[0].data = nodeMemoryUsage;
    charts.monitoringNodeMemory.update();

    charts.monitoringNetwork.data.labels.push(now);
    charts.monitoringNetwork.data.datasets[0].data.push(Math.random() * 10);
    charts.monitoringNetwork.data.datasets[1].data.push(Math.random() * 10);
    if (charts.monitoringNetwork.data.labels.length > 30) {
        charts.monitoringNetwork.data.labels.shift();
        charts.monitoringNetwork.data.datasets[0].data.shift();
        charts.monitoringNetwork.data.datasets[1].data.shift();
    }
    charts.monitoringNetwork.update();

    charts.monitoringDisk.data.labels.push(now);
    charts.monitoringDisk.data.datasets[0].data.push(Math.random() * 5);
    charts.monitoringDisk.data.datasets[1].data.push(Math.random() * 5);
    if (charts.monitoringDisk.data.labels.length > 30) {
        charts.monitoringDisk.data.labels.shift();
        charts.monitoringDisk.data.datasets[0].data.shift();
        charts.monitoringDisk.data.datasets[1].data.shift();
    }
    charts.monitoringDisk.update();

    const topPods = data.pods
        .filter(p => p.phase === 'Running')
        .sort((a, b) => b.cpu.request - a.cpu.request)
        .slice(0, 10)
        .map(p => p.name);

    charts.monitoringTopPods.data.labels = topPods;
    charts.monitoringTopPods.data.datasets[0].data = topPods.map(name => {
        const pod = data.pods.find(p => p.name === name);
        return pod ? (pod.cpu.request / data.cluster.cpu.total * 100) : 0;
    });
    charts.monitoringTopPods.data.datasets[1].data = topPods.map(name => {
        const pod = data.pods.find(p => p.name === name);
        return pod ? (pod.memory.request / data.cluster.memory.total * 100) : 0;
    });
    charts.monitoringTopPods.update();

    const podStatusCounts = {
        Running: data.pods.filter(p => p.phase === 'Running').length,
        Pending: data.pods.filter(p => p.phase === 'Pending').length,
        Failed: data.pods.filter(p => p.phase === 'Failed').length,
        Succeeded: data.pods.filter(p => p.phase === 'Succeeded').length
    };

    charts.monitoringPodStatus.data.datasets[0].data = [
        podStatusCounts.Running,
        podStatusCounts.Pending,
        podStatusCounts.Failed,
        podStatusCounts.Succeeded
    ];
    charts.monitoringPodStatus.update();

    const topRestartPods = data.pods
        .filter(p => p.restarts > 0)
        .sort((a, b) => b.restarts - a.restarts)
        .slice(0, 10);

    charts.monitoringRestart.data.labels = topRestartPods.map(p => p.name);
    charts.monitoringRestart.data.datasets[0].data = topRestartPods.map(p => p.restarts);
    charts.monitoringRestart.update();
}

async function loadAlerts() {
    try {
        const [stats, activeAlerts, rules, history] = await Promise.all([
            fetch(`${API_BASE}/alerts/statistics`).then(r => r.json()),
            fetch(`${API_BASE}/alerts/active`).then(r => r.json()),
            fetch(`${API_BASE}/alerts/rules`).then(r => r.json()),
            fetch(`${API_BASE}/alerts/history?limit=50`).then(r => r.json())
        ]);

        updateAlertStats(stats);
        updateActiveAlertsTable(activeAlerts);
        updateAlertRulesTable(rules);
        updateAlertHistoryTable(history);
    } catch (error) {
        console.error('Failed to load alerts:', error);
    }
}

function updateAlertStats(stats) {
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-active').textContent = stats.active;
    document.getElementById('stat-critical').textContent = stats.bySeverity.critical;
    document.getElementById('stat-error').textContent = stats.bySeverity.error;
    document.getElementById('stat-warning').textContent = stats.bySeverity.warning;
    document.getElementById('stat-recent').textContent = stats.recent24h;
}

function updateActiveAlertsTable(alerts) {
    const tbody = document.getElementById('active-alerts-table');
    
    if (!alerts || alerts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无活跃告警</td></tr>';
        return;
    }

    tbody.innerHTML = alerts.map(alert => `
        <tr>
            <td>${alert.ruleName}</td>
            <td><span class="alert-badge ${alert.severity}">${alert.severity}</span></td>
            <td>${alert.value}</td>
            <td>${alert.operator} ${alert.threshold}</td>
            <td>${new Date(alert.triggeredAt).toLocaleString()}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="acknowledgeAlert('${alert.ruleId}', '${alert.value}')">确认</button>
                <button class="btn btn-sm btn-secondary" onclick="resolveAlert('${alert.ruleId}', '${alert.value}')">解决</button>
            </td>
        </tr>
    `).join('');
}

function updateAlertRulesTable(rules) {
    const tbody = document.getElementById('alert-rules-table');
    
    if (!rules || rules.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">暂无告警规则</td></tr>';
        return;
    }

    tbody.innerHTML = rules.map(rule => `
        <tr>
            <td>${rule.name}</td>
            <td>${rule.description || '-'}</td>
            <td><span class="alert-badge ${rule.severity}">${rule.severity}</span></td>
            <td><span class="status-badge ${rule.enabled ? 'success' : 'warning'}">${rule.enabled ? '启用' : '禁用'}</span></td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editAlertRule('${rule.id}')">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteAlertRule('${rule.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

function updateAlertHistoryTable(history) {
    const tbody = document.getElementById('alert-history-table');
    
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">暂无告警历史</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(alert => {
        let status = 'pending';
        if (alert.acknowledged) status = 'acknowledged';
        if (alert.resolved) status = 'resolved';

        return `
            <tr>
                <td>${alert.ruleName}</td>
                <td><span class="alert-badge ${alert.severity}">${alert.severity}</span></td>
                <td>${new Date(alert.createdAt).toLocaleString()}</td>
                <td><span class="status-badge ${status}">${status}</span></td>
                <td>
                    ${!alert.acknowledged ? `<button class="btn btn-sm btn-primary" onclick="acknowledgeAlertById('${alert.id}')">确认</button>` : ''}
                    ${!alert.resolved ? `<button class="btn btn-sm btn-secondary" onclick="resolveAlertById('${alert.id}')">解决</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function showCreateAlertRuleModal() {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <div class="modal-header">
            <h3>创建告警规则</h3>
            <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <form id="alert-rule-form">
                <div class="form-group">
                    <label>规则名称</label>
                    <input type="text" name="name" required>
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>严重程度</label>
                    <select name="severity">
                        <option value="info">信息</option>
                        <option value="warning">警告</option>
                        <option value="error">错误</option>
                        <option value="critical">严重</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>资源类型</label>
                    <select name="resourceType">
                        <option value="pod">Pod</option>
                        <option value="node">Node</option>
                        <option value="event">Event</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>字段</label>
                    <select name="field">
                        <option value="restartCount">重启次数</option>
                        <option value="cpuUsage">CPU 使用率</option>
                        <option value="memoryUsage">内存使用率</option>
                        <option value="ready">就绪状态</option>
                        <option value="diskPressure">磁盘压力</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>操作符</label>
                    <select name="operator">
                        <option value=">">大于</option>
                        <option value="<">小于</option>
                        <option value=">=">大于等于</option>
                        <option value="<=">小于等于</option>
                        <option value="==">等于</option>
                        <option value="!=">不等于</option>
                        <option value="contains">包含</option>
                        <option value="not-contains">不包含</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>阈值</label>
                    <input type="text" name="threshold" required>
                </div>
                <div class="form-group">
                    <label>时间窗口</label>
                    <select name="timeWindow">
                        <option value="1m">1 分钟</option>
                        <option value="5m">5 分钟</option>
                        <option value="10m">10 分钟</option>
                        <option value="30m">30 分钟</option>
                        <option value="1h">1 小时</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>操作</label>
                    <div class="checkbox-group">
                        <label><input type="checkbox" name="actions" value="log" checked> 记录日志</label>
                        <label><input type="checkbox" name="actions" value="notify" checked> 发送通知</label>
                        <label><input type="checkbox" name="actions" value="webhook"> Webhook</label>
                        <label><input type="checkbox" name="actions" value="email"> 邮件</label>
                    </div>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" name="enabled" checked> 启用规则</label>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary modal-close">取消</button>
            <button class="btn btn-primary" onclick="createAlertRule()">创建</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

async function createAlertRule() {
    const form = document.getElementById('alert-rule-form');
    const formData = new FormData(form);
    
    const actions = [];
    document.querySelectorAll('input[name="actions"]:checked').forEach(cb => {
        actions.push(cb.value);
    });
    
    const rule = {
        name: formData.get('name'),
        description: formData.get('description'),
        severity: formData.get('severity'),
        enabled: formData.get('enabled') === 'on',
        condition: {
            type: formData.get('resourceType'),
            field: formData.get('field'),
            operator: formData.get('operator'),
            threshold: formData.get('threshold'),
            timeWindow: formData.get('timeWindow')
        },
        actions
    };
    
    try {
        const response = await fetch(`${API_BASE}/alerts/rules`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule)
        });
        
        if (response.ok) {
            closeModal();
            loadAlerts();
        } else {
            alert('创建告警规则失败');
        }
    } catch (error) {
        console.error('Failed to create alert rule:', error);
        alert('创建告警规则失败');
    }
}

async function editAlertRule(ruleId) {
    try {
        const response = await fetch(`${API_BASE}/alerts/rules`);
        const rules = await response.json();
        const rule = rules.find(r => r.id === ruleId);
        
        if (!rule) {
            alert('告警规则不存在');
            return;
        }
        
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>编辑告警规则</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="alert-rule-form">
                    <div class="form-group">
                        <label>规则名称</label>
                        <input type="text" name="name" value="${rule.name}" required>
                    </div>
                    <div class="form-group">
                        <label>描述</label>
                        <textarea name="description" rows="3">${rule.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>严重程度</label>
                        <select name="severity">
                            <option value="info" ${rule.severity === 'info' ? 'selected' : ''}>信息</option>
                            <option value="warning" ${rule.severity === 'warning' ? 'selected' : ''}>警告</option>
                            <option value="error" ${rule.severity === 'error' ? 'selected' : ''}>错误</option>
                            <option value="critical" ${rule.severity === 'critical' ? 'selected' : ''}>严重</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>资源类型</label>
                        <select name="resourceType">
                            <option value="pod" ${rule.condition.type === 'pod' ? 'selected' : ''}>Pod</option>
                            <option value="node" ${rule.condition.type === 'node' ? 'selected' : ''}>Node</option>
                            <option value="event" ${rule.condition.type === 'event' ? 'selected' : ''}>Event</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>字段</label>
                        <select name="field">
                            <option value="restartCount" ${rule.condition.field === 'restartCount' ? 'selected' : ''}>重启次数</option>
                            <option value="cpuUsage" ${rule.condition.field === 'cpuUsage' ? 'selected' : ''}>CPU 使用率</option>
                            <option value="memoryUsage" ${rule.condition.field === 'memoryUsage' ? 'selected' : ''}>内存使用率</option>
                            <option value="ready" ${rule.condition.field === 'ready' ? 'selected' : ''}>就绪状态</option>
                            <option value="diskPressure" ${rule.condition.field === 'diskPressure' ? 'selected' : ''}>磁盘压力</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>操作符</label>
                        <select name="operator">
                            <option value=">" ${rule.condition.operator === '>' ? 'selected' : ''}>大于</option>
                            <option value="<" ${rule.condition.operator === '<' ? 'selected' : ''}>小于</option>
                            <option value=">=" ${rule.condition.operator === '>=' ? 'selected' : ''}>大于等于</option>
                            <option value="<=" ${rule.condition.operator === '<=' ? 'selected' : ''}>小于等于</option>
                            <option value="==" ${rule.condition.operator === '==' ? 'selected' : ''}>等于</option>
                            <option value="!=" ${rule.condition.operator === '!=' ? 'selected' : ''}>不等于</option>
                            <option value="contains" ${rule.condition.operator === 'contains' ? 'selected' : ''}>包含</option>
                            <option value="not-contains" ${rule.condition.operator === 'not-contains' ? 'selected' : ''}>不包含</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>阈值</label>
                        <input type="text" name="threshold" value="${rule.condition.threshold}" required>
                    </div>
                    <div class="form-group">
                        <label>时间窗口</label>
                        <select name="timeWindow">
                            <option value="1m" ${rule.condition.timeWindow === '1m' ? 'selected' : ''}>1 分钟</option>
                            <option value="5m" ${rule.condition.timeWindow === '5m' ? 'selected' : ''}>5 分钟</option>
                            <option value="10m" ${rule.condition.timeWindow === '10m' ? 'selected' : ''}>10 分钟</option>
                            <option value="30m" ${rule.condition.timeWindow === '30m' ? 'selected' : ''}>30 分钟</option>
                            <option value="1h" ${rule.condition.timeWindow === '1h' ? 'selected' : ''}>1 小时</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>操作</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" name="actions" value="log" ${rule.actions.includes('log') ? 'checked' : ''}> 记录日志</label>
                            <label><input type="checkbox" name="actions" value="notify" ${rule.actions.includes('notify') ? 'checked' : ''}> 发送通知</label>
                            <label><input type="checkbox" name="actions" value="webhook" ${rule.actions.includes('webhook') ? 'checked' : ''}> Webhook</label>
                            <label><input type="checkbox" name="actions" value="email" ${rule.actions.includes('email') ? 'checked' : ''}> 邮件</label>
                        </div>
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="enabled" ${rule.enabled ? 'checked' : ''}> 启用规则</label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-close">取消</button>
                <button class="btn btn-primary" onclick="updateAlertRule('${ruleId}')">更新</button>
            </div>
        `;
        
        modal.style.display = 'block';
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error('Failed to edit alert rule:', error);
    }
}

async function updateAlertRule(ruleId) {
    const form = document.getElementById('alert-rule-form');
    const formData = new FormData(form);
    
    const actions = [];
    document.querySelectorAll('input[name="actions"]:checked').forEach(cb => {
        actions.push(cb.value);
    });
    
    const rule = {
        name: formData.get('name'),
        description: formData.get('description'),
        severity: formData.get('severity'),
        enabled: formData.get('enabled') === 'on',
        condition: {
            type: formData.get('resourceType'),
            field: formData.get('field'),
            operator: formData.get('operator'),
            threshold: formData.get('threshold'),
            timeWindow: formData.get('timeWindow')
        },
        actions
    };
    
    try {
        const response = await fetch(`${API_BASE}/alerts/rules/${ruleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rule)
        });
        
        if (response.ok) {
            closeModal();
            loadAlerts();
        } else {
            alert('更新告警规则失败');
        }
    } catch (error) {
        console.error('Failed to update alert rule:', error);
        alert('更新告警规则失败');
    }
}

async function deleteAlertRule(ruleId) {
    if (!confirm('确定要删除这个告警规则吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/alerts/rules/${ruleId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadAlerts();
        } else {
            alert('删除告警规则失败');
        }
    } catch (error) {
        console.error('Failed to delete alert rule:', error);
        alert('删除告警规则失败');
    }
}

async function acknowledgeAlert(ruleId, value) {
    try {
        const response = await fetch(`${API_BASE}/alerts/active`, {
            method: 'GET'
        });
        const alerts = await response.json();
        const alert = alerts.find(a => a.ruleId === ruleId && a.value == value);
        
        if (alert) {
            await acknowledgeAlertById(alert.id);
        }
    } catch (error) {
        console.error('Failed to acknowledge alert:', error);
    }
}

async function acknowledgeAlertById(alertId) {
    try {
        const response = await fetch(`${API_BASE}/alerts/${alertId}/acknowledge`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadAlerts();
        } else {
            alert('确认告警失败');
        }
    } catch (error) {
        console.error('Failed to acknowledge alert:', error);
        alert('确认告警失败');
    }
}

async function resolveAlert(ruleId, value) {
    try {
        const response = await fetch(`${API_BASE}/alerts/active`, {
            method: 'GET'
        });
        const alerts = await response.json();
        const alert = alerts.find(a => a.ruleId === ruleId && a.value == value);
        
        if (alert) {
            await resolveAlertById(alert.id);
        }
    } catch (error) {
        console.error('Failed to resolve alert:', error);
    }
}

async function resolveAlertById(alertId) {
    try {
        const response = await fetch(`${API_BASE}/alerts/${alertId}/resolve`, {
            method: 'POST'
        });
        
        if (response.ok) {
            loadAlerts();
        } else {
            alert('解决告警失败');
        }
    } catch (error) {
        console.error('Failed to resolve alert:', error);
        alert('解决告警失败');
    }
}

async function exportAlertRules() {
    try {
        const response = await fetch(`${API_BASE}/alerts/export`);
        const data = await response.text();
        
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'alert-rules.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Failed to export alert rules:', error);
        alert('导出告警规则失败');
    }
}

async function importAlertRules() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const data = event.target.result;
                const response = await fetch(`${API_BASE}/alerts/import`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: data
                });
                
                if (response.ok) {
                    const result = await response.json();
                    alert(`成功导入 ${result.imported} 条告警规则`);
                    loadAlerts();
                } else {
                    alert('导入告警规则失败');
                }
            } catch (error) {
                console.error('Failed to import alert rules:', error);
                alert('导入告警规则失败');
            }
        };
        reader.readAsText(file);
    };
    
    input.click();
}

async function loadAutomation() {
    try {
        const [stats, scripts, history] = await Promise.all([
            fetch(`${API_BASE}/automation/statistics`).then(r => r.json()),
            fetch(`${API_BASE}/automation/scripts`).then(r => r.json()),
            fetch(`${API_BASE}/automation/history?limit=50`).then(r => r.json())
        ]);

        updateScriptStats(stats);
        updateAutomationScriptsTable(scripts);
        updateScriptHistoryTable(history);
    } catch (error) {
        console.error('Failed to load automation:', error);
    }
}

function updateScriptStats(stats) {
    document.getElementById('script-total').textContent = stats.totalScripts;
    document.getElementById('script-enabled').textContent = stats.enabledScripts;
    document.getElementById('script-scheduled').textContent = stats.scheduledTasks;
    document.getElementById('script-executions').textContent = stats.totalExecutions;
    document.getElementById('script-success').textContent = stats.successfulExecutions;
    document.getElementById('script-failed').textContent = stats.failedExecutions;
}

function updateAutomationScriptsTable(scripts) {
    const tbody = document.getElementById('automation-scripts-table');
    
    if (!scripts || scripts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无自动化脚本</td></tr>';
        return;
    }

    tbody.innerHTML = scripts.map(script => `
        <tr>
            <td>${script.name}</td>
            <td>${script.description || '-'}</td>
            <td><span class="status-badge ${script.type === 'builtin' ? 'info' : 'success'}">${script.type === 'builtin' ? '内置' : '自定义'}</span></td>
            <td>${script.schedule || '-'}</td>
            <td><span class="status-badge ${script.enabled ? 'success' : 'warning'}">${script.enabled ? '启用' : '禁用'}</span></td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="executeScript('${script.id}')">执行</button>
                <button class="btn btn-sm btn-secondary" onclick="editScript('${script.id}')">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteScript('${script.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

function updateScriptHistoryTable(history) {
    const tbody = document.getElementById('script-history-table');
    
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无执行历史</td></tr>';
        return;
    }

    tbody.innerHTML = history.map(exec => `
        <tr>
            <td>${exec.scriptName}</td>
            <td><span class="status-badge ${exec.trigger === 'manual' ? 'info' : 'warning'}">${exec.trigger === 'manual' ? '手动' : '定时'}</span></td>
            <td><span class="status-badge ${exec.status}">${exec.status}</span></td>
            <td>${new Date(exec.startTime).toLocaleString()}</td>
            <td>${exec.duration ? exec.duration + 's' : '-'}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="viewExecutionDetails('${exec.id}')">详情</button>
            </td>
        </tr>
    `).join('');
}

async function showCreateScriptModal() {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <div class="modal-header">
            <h3>创建自动化脚本</h3>
            <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <form id="script-form">
                <div class="form-group">
                    <label>脚本名称</label>
                    <input type="text" name="name" required>
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>脚本类型</label>
                    <select name="type" onchange="toggleScriptType(this.value)">
                        <option value="builtin">内置脚本</option>
                        <option value="custom">自定义脚本</option>
                    </select>
                </div>
                <div class="form-group" id="builtin-script-group">
                    <label>内置脚本</label>
                    <select name="builtinScript">
                        <option value="cleanup-evicted-pods">清理已驱逐的 Pod</option>
                        <option value="restart-crashing-pods">重启崩溃的 Pod</option>
                        <option value="scale-deployment">扩展 Deployment</option>
                        <option value="cleanup-old-images">清理旧镜像</option>
                        <option value="backup-configmaps">备份 ConfigMaps</option>
                        <option value="check-node-health">检查节点健康</option>
                        <option value="rotate-logs">日志轮转</option>
                        <option value="update-image-tags">更新镜像标签</option>
                    </select>
                </div>
                <div class="form-group" id="custom-script-group" style="display: none;">
                    <label>脚本内容</label>
                    <textarea name="customScript" rows="10" placeholder="#!/bin/bash"></textarea>
                </div>
                <div class="form-group">
                    <label>定时任务 (Cron 表达式)</label>
                    <input type="text" name="schedule" placeholder="例如: 0 */6 * * * (每6小时)">
                </div>
                <div class="form-group">
                    <label>超时时间 (秒)</label>
                    <input type="number" name="timeout" value="300" min="60">
                </div>
                <div class="form-group">
                    <label><input type="checkbox" name="enabled" checked> 启用脚本</label>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary modal-close">取消</button>
            <button class="btn btn-primary" onclick="createScript()">创建</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

function toggleScriptType(type) {
    const builtinGroup = document.getElementById('builtin-script-group');
    const customGroup = document.getElementById('custom-script-group');
    
    if (type === 'builtin') {
        builtinGroup.style.display = 'block';
        customGroup.style.display = 'none';
    } else {
        builtinGroup.style.display = 'none';
        customGroup.style.display = 'block';
    }
}

async function createScript() {
    const form = document.getElementById('script-form');
    const formData = new FormData(form);
    
    const type = formData.get('type');
    let script;
    
    if (type === 'builtin') {
        script = formData.get('builtinScript');
    } else {
        script = formData.get('customScript');
    }
    
    const newScript = {
        name: formData.get('name'),
        description: formData.get('description'),
        type,
        script,
        schedule: formData.get('schedule'),
        timeout: parseInt(formData.get('timeout')),
        enabled: formData.get('enabled') === 'on',
        parameters: {}
    };
    
    try {
        const response = await fetch(`${API_BASE}/automation/scripts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newScript)
        });
        
        if (response.ok) {
            closeModal();
            loadAutomation();
        } else {
            alert('创建脚本失败');
        }
    } catch (error) {
        console.error('Failed to create script:', error);
        alert('创建脚本失败');
    }
}

async function editScript(scriptId) {
    try {
        const response = await fetch(`${API_BASE}/automation/scripts`);
        const scripts = await response.json();
        const script = scripts.find(s => s.id === scriptId);
        
        if (!script) {
            alert('脚本不存在');
            return;
        }
        
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>编辑自动化脚本</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <form id="script-form">
                    <div class="form-group">
                        <label>脚本名称</label>
                        <input type="text" name="name" value="${script.name}" required>
                    </div>
                    <div class="form-group">
                        <label>描述</label>
                        <textarea name="description" rows="3">${script.description || ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>脚本类型</label>
                        <select name="type" onchange="toggleScriptType(this.value)">
                            <option value="builtin" ${script.type === 'builtin' ? 'selected' : ''}>内置脚本</option>
                            <option value="custom" ${script.type === 'custom' ? 'selected' : ''}>自定义脚本</option>
                        </select>
                    </div>
                    <div class="form-group" id="builtin-script-group" style="display: ${script.type === 'builtin' ? 'block' : 'none'};">
                        <label>内置脚本</label>
                        <select name="builtinScript">
                            <option value="cleanup-evicted-pods" ${script.script === 'cleanup-evicted-pods' ? 'selected' : ''}>清理已驱逐的 Pod</option>
                            <option value="restart-crashing-pods" ${script.script === 'restart-crashing-pods' ? 'selected' : ''}>重启崩溃的 Pod</option>
                            <option value="scale-deployment" ${script.script === 'scale-deployment' ? 'selected' : ''}>扩展 Deployment</option>
                            <option value="cleanup-old-images" ${script.script === 'cleanup-old-images' ? 'selected' : ''}>清理旧镜像</option>
                            <option value="backup-configmaps" ${script.script === 'backup-configmaps' ? 'selected' : ''}>备份 ConfigMaps</option>
                            <option value="check-node-health" ${script.script === 'check-node-health' ? 'selected' : ''}>检查节点健康</option>
                            <option value="rotate-logs" ${script.script === 'rotate-logs' ? 'selected' : ''}>日志轮转</option>
                            <option value="update-image-tags" ${script.script === 'update-image-tags' ? 'selected' : ''}>更新镜像标签</option>
                        </select>
                    </div>
                    <div class="form-group" id="custom-script-group" style="display: ${script.type === 'custom' ? 'block' : 'none'};">
                        <label>脚本内容</label>
                        <textarea name="customScript" rows="10">${script.type === 'custom' ? script.script : ''}</textarea>
                    </div>
                    <div class="form-group">
                        <label>定时任务 (Cron 表达式)</label>
                        <input type="text" name="schedule" value="${script.schedule || ''}" placeholder="例如: 0 */6 * * * (每6小时)">
                    </div>
                    <div class="form-group">
                        <label>超时时间 (秒)</label>
                        <input type="number" name="timeout" value="${script.timeout}" min="60">
                    </div>
                    <div class="form-group">
                        <label><input type="checkbox" name="enabled" ${script.enabled ? 'checked' : ''}> 启用脚本</label>
                    </div>
                </form>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-close">取消</button>
                <button class="btn btn-primary" onclick="updateScript('${scriptId}')">更新</button>
            </div>
        `;
        
        modal.style.display = 'block';
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error('Failed to edit script:', error);
    }
}

async function updateScript(scriptId) {
    const form = document.getElementById('script-form');
    const formData = new FormData(form);
    
    const type = formData.get('type');
    let script;
    
    if (type === 'builtin') {
        script = formData.get('builtinScript');
    } else {
        script = formData.get('customScript');
    }
    
    const updatedScript = {
        name: formData.get('name'),
        description: formData.get('description'),
        type,
        script,
        schedule: formData.get('schedule'),
        timeout: parseInt(formData.get('timeout')),
        enabled: formData.get('enabled') === 'on',
        parameters: {}
    };
    
    try {
        const response = await fetch(`${API_BASE}/automation/scripts/${scriptId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedScript)
        });
        
        if (response.ok) {
            closeModal();
            loadAutomation();
        } else {
            alert('更新脚本失败');
        }
    } catch (error) {
        console.error('Failed to update script:', error);
        alert('更新脚本失败');
    }
}

async function deleteScript(scriptId) {
    if (!confirm('确定要删除这个脚本吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/automation/scripts/${scriptId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadAutomation();
        } else {
            alert('删除脚本失败');
        }
    } catch (error) {
        console.error('Failed to delete script:', error);
        alert('删除脚本失败');
    }
}

async function executeScript(scriptId) {
    if (!confirm('确定要执行这个脚本吗？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/automation/scripts/${scriptId}/execute`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const execution = await response.json();
            alert(`脚本已开始执行，执行 ID: ${execution.id}`);
            loadAutomation();
        } else {
            alert('执行脚本失败');
        }
    } catch (error) {
        console.error('Failed to execute script:', error);
        alert('执行脚本失败');
    }
}

async function viewExecutionDetails(executionId) {
    try {
        const response = await fetch(`${API_BASE}/automation/history/${executionId}`);
        const execution = await response.json();
        
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>执行详情</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="execution-details">
                    <div class="detail-item">
                        <span class="detail-label">脚本名称</span>
                        <span class="detail-value">${execution.scriptName}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">触发方式</span>
                        <span class="detail-value">${execution.trigger === 'manual' ? '手动' : '定时'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">状态</span>
                        <span class="detail-value"><span class="status-badge ${execution.status}">${execution.status}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">开始时间</span>
                        <span class="detail-value">${new Date(execution.startTime).toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">结束时间</span>
                        <span class="detail-value">${execution.endTime ? new Date(execution.endTime).toLocaleString() : '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">持续时间</span>
                        <span class="detail-value">${execution.duration ? execution.duration + 's' : '-'}</span>
                    </div>
                    ${execution.error ? `
                    <div class="detail-item full-width">
                        <span class="detail-label">错误信息</span>
                        <pre class="error-message">${execution.error}</pre>
                    </div>
                    ` : ''}
                    ${execution.output ? `
                    <div class="detail-item full-width">
                        <span class="detail-label">输出</span>
                        <pre class="output-message">${execution.output}</pre>
                    </div>
                    ` : ''}
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-close">关闭</button>
            </div>
        `;
        
        modal.style.display = 'block';
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error('Failed to view execution details:', error);
    }
}

function loadContainersForPod(podName) {
    const select = document.getElementById('log-pod-select');
    const selectedOption = select.options[select.selectedIndex];
    const namespace = selectedOption.dataset.namespace || 'default';

    if (!podName) {
        document.getElementById('log-container-select').innerHTML = '<option value="">选择容器</option>';
        return;
    }

    fetch(`${API_BASE}/pods?namespace=${namespace}`)
        .then(r => r.json())
        .then(pods => {
            const pod = pods.find(p => p.metadata.name === podName);
            if (pod && pod.spec.containers) {
                const containerSelect = document.getElementById('log-container-select');
                containerSelect.innerHTML = '<option value="">选择容器</option>';
                pod.spec.containers.forEach(container => {
                    const option = document.createElement('option');
                    option.value = container.name;
                    option.textContent = container.name;
                    containerSelect.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Failed to load containers:', error));
}

async function loadLogs() {
    const podSelect = document.getElementById('log-pod-select');
    const podName = podSelect.value;
    const selectedOption = podSelect.options[podSelect.selectedIndex];
    const namespace = selectedOption.dataset.namespace || 'default';
    const container = document.getElementById('log-container-select').value;
    const tailLines = document.getElementById('log-tail-lines').value || 100;

    if (!podName) {
        document.getElementById('logs-content').innerHTML = '<pre class="logs-text">选择一个 Pod 查看日志</pre>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/logs/${podName}?namespace=${namespace}&container=${container}&tailLines=${tailLines}`);
        const data = await response.json();
        document.getElementById('logs-content').innerHTML = `<pre class="logs-text">${escapeHtml(data.logs)}</pre>`;
    } catch (error) {
        console.error('Failed to load logs:', error);
        document.getElementById('logs-content').innerHTML = '<pre class="logs-text">加载日志失败</pre>';
    }
}

async function analyzeLogs() {
    const podSelect = document.getElementById('log-pod-select');
    const podName = podSelect.value;
    const selectedOption = podSelect.options[podSelect.selectedIndex];
    const namespace = selectedOption.dataset.namespace || 'default';
    const container = document.getElementById('log-container-select').value;

    if (!podName) {
        alert('请先选择一个 Pod');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/logs/${podName}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ namespace, container })
        });
        const analysis = await response.json();
        renderLogsAnalysis(analysis);
    } catch (error) {
        console.error('Failed to analyze logs:', error);
        alert('分析日志失败');
    }
}

function renderLogsAnalysis(analysis) {
    const container = document.getElementById('logs-analysis');
    const content = document.getElementById('logs-analysis-content');

    let html = `
        <div class="analysis-stat">
            <span>总行数</span>
            <span>${analysis.totalLines}</span>
        </div>
        <div class="analysis-stat">
            <span>错误数</span>
            <span style="color: #dc3545;">${analysis.errorCount}</span>
        </div>
        <div class="analysis-stat">
            <span>警告数</span>
            <span style="color: #ffc107;">${analysis.warningCount}</span>
        </div>
        <div class="analysis-stat">
            <span>信息数</span>
            <span style="color: #17a2b8;">${analysis.infoCount}</span>
        </div>
        <div class="analysis-stat">
            <span>调试数</span>
            <span style="color: #6c757d;">${analysis.debugCount || 0}</span>
        </div>
    `;

    if (analysis.logLevels) {
        html += `<h4>日志级别统计:</h4>`;
        html += `<div class="log-levels-grid">`;
        Object.entries(analysis.logLevels).forEach(([level, count]) => {
            if (count > 0) {
                const color = level === 'error' || level === 'fatal' ? '#dc3545' : 
                             level === 'warning' ? '#ffc107' : 
                             level === 'info' ? '#17a2b8' : '#6c757d';
                html += `<div class="log-level-item" style="border-left: 3px solid ${color}; padding: 0.5rem; margin: 0.25rem 0;">
                    <span style="font-weight: 600;">${level.toUpperCase()}</span>
                    <span>${count}</span>
                </div>`;
            }
        });
        html += `</div>`;
    }

    if (analysis.errors.length > 0) {
        html += `<h4>错误示例（前5个）:</h4>`;
        analysis.errors.slice(0, 5).forEach(error => {
            html += `<div class="error">行 ${error.line}: ${escapeHtml(error.content)}</div>`;
        });
    }

    if (analysis.warnings.length > 0) {
        html += `<h4>警告示例（前5个）:</h4>`;
        analysis.warnings.slice(0, 5).forEach(warning => {
            html += `<div style="background: #fff3cd; color: #856404; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px;">行 ${warning.line}: ${escapeHtml(warning.content)}</div>`;
        });
    }

    if (analysis.stackTraces && analysis.stackTraces.length > 0) {
        html += `<h4>堆栈跟踪（${analysis.stackTraces.length}个）:</h4>`;
        analysis.stackTraces.slice(0, 3).forEach(trace => {
            html += `<div style="background: #f8d7da; color: #721c24; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; font-family: monospace; font-size: 0.875rem;">行 ${trace.line}: ${escapeHtml(trace.content.substring(0, 200))}${trace.content.length > 200 ? '...' : ''}</div>`;
        });
    }

    if (analysis.performanceMetrics && analysis.performanceMetrics.slowRequests.length > 0) {
        html += `<h4>慢请求（>1秒）:</h4>`;
        html += `<div class="analysis-stat"><span>慢请求数量</span><span>${analysis.performanceMetrics.slowRequests.length}</span></div>`;
        if (analysis.performanceMetrics.responseTimeStats) {
            const stats = analysis.performanceMetrics.responseTimeStats;
            html += `<div class="analysis-stat"><span>平均响应时间</span><span>${stats.avg.toFixed(2)}ms</span></div>`;
            html += `<div class="analysis-stat"><span>最小响应时间</span><span>${stats.min.toFixed(2)}ms</span></div>`;
            html += `<div class="analysis-stat"><span>最大响应时间</span><span>${stats.max.toFixed(2)}ms</span></div>`;
        }
    }

    if (analysis.databaseQueries && analysis.databaseQueries.length > 0) {
        html += `<h4>数据库查询（${analysis.databaseQueries.length}个）:</h4>`;
        const queryTypes = {};
        analysis.databaseQueries.forEach(q => {
            queryTypes[q.type] = (queryTypes[q.type] || 0) + 1;
        });
        Object.entries(queryTypes).forEach(([type, count]) => {
            html += `<div class="analysis-stat"><span>${type}</span><span>${count}</span></div>`;
        });
    }

    if (analysis.apiCalls && analysis.apiCalls.length > 0) {
        html += `<h4>API 调用（${analysis.apiCalls.length}个）:</h4>`;
        const methods = {};
        const statusCodes = {};
        analysis.apiCalls.forEach(call => {
            methods[call.method] = (methods[call.method] || 0) + 1;
            if (call.status) {
                statusCodes[call.status] = (statusCodes[call.status] || 0) + 1;
            }
        });
        html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem;">`;
        Object.entries(methods).forEach(([method, count]) => {
            html += `<div class="analysis-stat"><span>${method}</span><span>${count}</span></div>`;
        });
        html += `</div>`;
        if (Object.keys(statusCodes).length > 0) {
            html += `<h5>HTTP 状态码:</h5>`;
            Object.entries(statusCodes).forEach(([code, count]) => {
                const color = code.startsWith('2') ? '#28a745' : code.startsWith('3') ? '#17a2b8' : code.startsWith('4') ? '#ffc107' : '#dc3545';
                html += `<div class="analysis-stat"><span style="color: ${color};">${code}</span><span>${count}</span></div>`;
            });
        }
    }

    if (analysis.securityEvents && analysis.securityEvents.length > 0) {
        html += `<h4 style="color: #dc3545;">安全事件（${analysis.securityEvents.length}个）:</h4>`;
        analysis.securityEvents.slice(0, 5).forEach(event => {
            html += `<div style="background: #f8d7da; color: #721c24; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid #dc3545;">
                <strong>${event.type}</strong><br>
                行 ${event.line}: ${escapeHtml(event.content.substring(0, 150))}${event.content.length > 150 ? '...' : ''}
            </div>`;
        });
    }

    if (analysis.keywordStats && Object.keys(analysis.keywordStats).length > 0) {
        html += `<h4>关键词统计:</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">`;
        Object.entries(analysis.keywordStats).forEach(([keyword, count]) => {
            html += `<div class="analysis-stat"><span>${keyword}</span><span>${count}</span></div>`;
        });
        html += `</div>`;
    }

    if (analysis.timeDistribution && Object.keys(analysis.timeDistribution).length > 0) {
        html += `<h4>时间分布:</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">`;
        Object.entries(analysis.timeDistribution).forEach(([timeSlot, count]) => {
            html += `<div class="analysis-stat"><span>${timeSlot}</span><span>${count}</span></div>`;
        });
        html += `</div>`;
    }

    if (Object.keys(analysis.patternAnalysis).length > 0) {
        html += `<h4>模式分析:</h4>`;
        Object.entries(analysis.patternAnalysis).forEach(([pattern, count]) => {
            html += `<div class="analysis-stat"><span>${pattern}</span><span>${count}</span></div>`;
        });
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += `<h4>优化建议:</h4>`;
        analysis.recommendations.forEach(rec => {
            const bgColor = rec.severity === 'high' ? '#f8d7da' : rec.severity === 'medium' ? '#fff3cd' : '#d4edda';
            const textColor = rec.severity === 'high' ? '#721c24' : rec.severity === 'medium' ? '#856404' : '#155724';
            html += `<div style="background: ${bgColor}; color: ${textColor}; padding: 0.75rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid ${textColor};">
                <strong>[${rec.severity.toUpperCase()}]</strong> ${rec.message}
            </div>`;
        });
    }

    content.innerHTML = html;
    container.style.display = 'block';
}

function switchTab(container, tab) {
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    container.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (container.classList.contains('resource-tabs')) {
        loadResourceTab(tab);
    } else if (container.classList.contains('network-tabs')) {
        loadNetworkTab(tab);
    } else if (container.classList.contains('storage-tabs')) {
        loadStorageTab(tab);
    } else if (container.classList.contains('rbac-tabs')) {
        loadRBACTab(tab);
    }
}

async function loadResourceTab(tab) {
    const content = document.getElementById('resource-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'resource-quotas':
                data = await fetch(`${API_BASE}/resource-quotas?namespace=${namespace}`).then(r => r.json());
                renderResourceQuotas(data);
                break;
            case 'limit-ranges':
                data = await fetch(`${API_BASE}/limit-ranges?namespace=${namespace}`).then(r => r.json());
                renderLimitRanges(data);
                break;
            case 'daemonsets':
                data = await fetch(`${API_BASE}/daemonsets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'DaemonSet');
                break;
            case 'statefulsets':
                data = await fetch(`${API_BASE}/statefulsets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'StatefulSet');
                break;
            case 'jobs':
                data = await fetch(`${API_BASE}/jobs?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Job');
                break;
            case 'cronjobs':
                data = await fetch(`${API_BASE}/cronjobs?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'CronJob');
                break;
            case 'configmaps':
                data = await fetch(`${API_BASE}/configmaps?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'ConfigMap');
                break;
            case 'secrets':
                data = await fetch(`${API_BASE}/secrets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Secret');
                break;
            case 'serviceaccounts':
                data = await fetch(`${API_BASE}/service-accounts?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'ServiceAccount');
                break;
            case 'ingresses':
                data = await fetch(`${API_BASE}/ingresses?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Ingress');
                break;
            case 'replicasets':
                data = await fetch(`${API_BASE}/replicasets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'ReplicaSet');
                break;
            case 'endpoints':
                data = await fetch(`${API_BASE}/endpoints?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Endpoint');
                break;
            case 'hpas':
                data = await fetch(`${API_BASE}/horizontal-pod-autoscalers?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'HorizontalPodAutoscaler');
                break;
            case 'pdbs':
                data = await fetch(`${API_BASE}/pod-disruption-budgets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'PodDisruptionBudget');
                break;
            case 'priority-classes':
                data = await fetch(`${API_BASE}/priority-classes`).then(r => r.json());
                renderGenericResourceTable(data, 'PriorityClass');
                break;
            case 'leases':
                data = await fetch(`${API_BASE}/leases?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Lease');
                break;
            case 'runtime-classes':
                data = await fetch(`${API_BASE}/runtime-classes`).then(r => r.json());
                renderGenericResourceTable(data, 'RuntimeClass');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function renderResourceQuotas(quotas) {
    const content = document.getElementById('resource-content');
    if (quotas.length === 0) {
        content.innerHTML = '<div class="loading">没有找到资源配额</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>资源类型</th><th>硬限制</th><th>已使用</th></tr></thead><tbody>';
    quotas.forEach(quota => {
        Object.entries(quota.spec.hard || {}).forEach(([resource, limit]) => {
            const used = quota.status?.used?.[resource] || '-';
            html += `<tr><td>${quota.metadata.name}</td><td>${resource}</td><td>${limit}</td><td>${used}</td></tr>`;
        });
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

function renderLimitRanges(limits) {
    const content = document.getElementById('resource-content');
    if (limits.length === 0) {
        content.innerHTML = '<div class="loading">没有找到限制范围</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>类型</th><th>最小值</th><th>最大值</th><th>默认值</th></tr></thead><tbody>';
    limits.forEach(limitRange => {
        limitRange.spec.limits.forEach(limit => {
            const min = limit.min ? JSON.stringify(limit.min) : '-';
            const max = limit.max ? JSON.stringify(limit.max) : '-';
            const def = limit.default ? JSON.stringify(limit.default) : '-';
            html += `<tr><td>${limitRange.metadata.name}</td><td>${limit.type}</td><td>${min}</td><td>${max}</td><td>${def}</td></tr>`;
        });
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

function renderGenericResourceTable(resources, resourceType) {
    const content = document.getElementById('resource-content');
    if (resources.length === 0) {
        content.innerHTML = `<div class="loading">没有找到 ${resourceType}</div>`;
        return;
    }

    let html = `<table class="data-table"><thead><tr><th>名称</th><th>命名空间</th><th>创建时间</th></tr></thead><tbody>`;
    resources.forEach(resource => {
        const namespace = resource.metadata.namespace || '-';
        const creationTime = new Date(resource.metadata.creationTimestamp).toLocaleString();
        html += `<tr><td>${resource.metadata.name}</td><td>${namespace}</td><td>${creationTime}</td></tr>`;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

async function loadNetworkTab(tab) {
    const content = document.getElementById('network-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'network-policies':
                data = await fetch(`${API_BASE}/network-policies?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'NetworkPolicy');
                break;
            case 'ingress-classes':
                data = await fetch(`${API_BASE}/ingress-classes`).then(r => r.json());
                renderGenericResourceTable(data, 'IngressClass');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

async function loadStorageTab(tab) {
    const content = document.getElementById('storage-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'persistent-volumes':
                data = await fetch(`${API_BASE}/persistent-volumes`).then(r => r.json());
                renderPersistentVolumes(data);
                break;
            case 'persistent-volume-claims':
                data = await fetch(`${API_BASE}/persistent-volume-claims?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'PersistentVolumeClaim');
                break;
            case 'storage-classes':
                data = await fetch(`${API_BASE}/storage-classes`).then(r => r.json());
                renderStorageClasses(data);
                break;
            case 'volume-attachments':
                data = await fetch(`${API_BASE}/volume-attachments`).then(r => r.json());
                renderGenericResourceTable(data, 'VolumeAttachment');
                break;
            case 'csi-drivers':
                data = await fetch(`${API_BASE}/csi-drivers`).then(r => r.json());
                renderGenericResourceTable(data, 'CSIDriver');
                break;
            case 'csi-nodes':
                data = await fetch(`${API_BASE}/csi-nodes`).then(r => r.json());
                renderGenericResourceTable(data, 'CSINode');
                break;
            case 'csi-capacities':
                data = await fetch(`${API_BASE}/csi-storage-capacities?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'CSIStorageCapacity');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function renderPersistentVolumes(pvs) {
    const content = document.getElementById('storage-content');
    if (pvs.length === 0) {
        content.innerHTML = '<div class="loading">没有找到持久卷</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>容量</th><th>访问模式</th><th>回收策略</th><th>状态</th><th>存储类</th></tr></thead><tbody>';
    pvs.forEach(pv => {
        const capacity = pv.spec.capacity?.storage || '-';
        const accessModes = pv.spec.accessModes?.join(', ') || '-';
        const reclaimPolicy = pv.spec.persistentVolumeReclaimPolicy || '-';
        const phase = pv.status?.phase || '-';
        const storageClass = pv.spec.storageClassName || '-';
        html += `<tr><td>${pv.metadata.name}</td><td>${capacity}</td><td>${accessModes}</td><td>${reclaimPolicy}</td><td><span class="status-badge ${phase}">${phase}</span></td><td>${storageClass}</td></tr>`;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

function renderStorageClasses(storageClasses) {
    const content = document.getElementById('storage-content');
    if (storageClasses.length === 0) {
        content.innerHTML = '<div class="loading">没有找到存储类</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>提供者</th><th>回收策略</th><th>绑定模式</th><th>允许卷扩展</th></tr></thead><tbody>';
    storageClasses.forEach(sc => {
        const provisioner = sc.provisioner || '-';
        const reclaimPolicy = sc.reclaimPolicy || '-';
        const bindingMode = sc.volumeBindingMode || '-';
        const allowExpansion = sc.allowVolumeExpansion ? '是' : '否';
        html += `<tr><td>${sc.metadata.name}</td><td>${provisioner}</td><td>${reclaimPolicy}</td><td>${bindingMode}</td><td>${allowExpansion}</td></tr>`;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

async function loadRBACTab(tab) {
    const content = document.getElementById('rbac-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'roles':
                data = await fetch(`${API_BASE}/roles?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Role');
                break;
            case 'cluster-roles':
                data = await fetch(`${API_BASE}/cluster-roles`).then(r => r.json());
                renderGenericResourceTable(data, 'ClusterRole');
                break;
            case 'role-bindings':
                data = await fetch(`${API_BASE}/role-bindings?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'RoleBinding');
                break;
            case 'cluster-role-bindings':
                data = await fetch(`${API_BASE}/cluster-role-bindings`).then(r => r.json());
                renderGenericResourceTable(data, 'ClusterRoleBinding');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to WebSocket');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket');
    });

    socket.on('update', (data) => {
        handleRealtimeUpdate(data);
    });
}

async function loadTenants() {
    try {
        const [stats, tenants] = await Promise.all([
            fetch(`${API_BASE}/tenants/statistics`).then(r => r.json()),
            fetch(`${API_BASE}/tenants`).then(r => r.json())
        ]);

        updateTenantStats(stats);
        updateTenantsTable(tenants);
    } catch (error) {
        console.error('Failed to load tenants:', error);
    }
}

function updateTenantStats(stats) {
    document.getElementById('tenant-total').textContent = stats.totalTenants;
    document.getElementById('tenant-users').textContent = stats.totalUsers;
    document.getElementById('tenant-namespaces').textContent = stats.totalNamespaces;
}

function updateTenantsTable(tenants) {
    const tbody = document.getElementById('tenants-table');
    
    if (!tenants || tenants.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无租户</td></tr>';
        return;
    }

    tbody.innerHTML = tenants.map(tenant => `
        <tr>
            <td>${tenant.name}</td>
            <td>${tenant.description || '-'}</td>
            <td>${tenant.namespaces.join(', ')}</td>
            <td>
                <div>CPU: ${tenant.resourceQuotas.cpu}</div>
                <div>内存: ${tenant.resourceQuotas.memory}</div>
                <div>Pods: ${tenant.resourceQuotas.pods}</div>
            </td>
            <td>-</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="viewTenantDetails('${tenant.id}')">详情</button>
                <button class="btn btn-sm btn-danger" onclick="deleteTenant('${tenant.id}')">删除</button>
            </td>
        </tr>
    `).join('');
}

async function showCreateTenantModal() {
    const modal = document.getElementById('modal');
    const content = document.getElementById('modal-content');
    
    content.innerHTML = `
        <div class="modal-header">
            <h3>创建租户</h3>
            <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
            <form id="tenant-form">
                <div class="form-group">
                    <label>租户名称</label>
                    <input type="text" name="name" required>
                </div>
                <div class="form-group">
                    <label>描述</label>
                    <textarea name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>命名空间 (逗号分隔)</label>
                    <input type="text" name="namespaces" placeholder="例如: tenant1,tenant1-staging">
                </div>
                <div class="form-group">
                    <label>资源配额</label>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem;">
                        <div>
                            <label>CPU</label>
                            <input type="text" name="cpuQuota" value="4">
                        </div>
                        <div>
                            <label>内存</label>
                            <input type="text" name="memoryQuota" value="8Gi">
                        </div>
                        <div>
                            <label>Pods</label>
                            <input type="number" name="podsQuota" value="50">
                        </div>
                        <div>
                            <label>Services</label>
                            <input type="number" name="servicesQuota" value="20">
                        </div>
                    </div>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary modal-close">取消</button>
            <button class="btn btn-primary" onclick="createTenant()">创建</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

async function createTenant() {
    const form = document.getElementById('tenant-form');
    const formData = new FormData(form);
    
    const namespaces = formData.get('namespaces').split(',').map(ns => ns.trim()).filter(ns => ns);
    
    const newTenant = {
        name: formData.get('name'),
        description: formData.get('description'),
        namespaces: namespaces.length > 0 ? namespaces : ['tenant-' + Math.random().toString(36).substr(2, 9)],
        resourceQuotas: {
            cpu: formData.get('cpuQuota'),
            memory: formData.get('memoryQuota'),
            pods: formData.get('podsQuota'),
            services: formData.get('servicesQuota'),
            persistentVolumeClaims: '10'
        },
        networkPolicies: {
            enabled: true,
            defaultDeny: true
        },
        rbac: {
            enabled: true,
            defaultRole: 'edit'
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}/tenants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTenant)
        });
        
        if (response.ok) {
            closeModal();
            loadTenants();
        } else {
            alert('创建租户失败');
        }
    } catch (error) {
        console.error('Failed to create tenant:', error);
        alert('创建租户失败');
    }
}

async function viewTenantDetails(tenantId) {
    try {
        const response = await fetch(`${API_BASE}/tenants/${tenantId}`);
        const tenant = await response.json();
        
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>租户详情</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="tenant-details">
                    <div class="detail-item">
                        <span class="detail-label">名称</span>
                        <span class="detail-value">${tenant.name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">描述</span>
                        <span class="detail-value">${tenant.description || '-'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">命名空间</span>
                        <span class="detail-value">${tenant.namespaces.join(', ')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">资源配额</span>
                        <span class="detail-value">
                            <div>CPU: ${tenant.resourceQuotas.cpu}</div>
                            <div>内存: ${tenant.resourceQuotas.memory}</div>
                            <div>Pods: ${tenant.resourceQuotas.pods}</div>
                            <div>Services: ${tenant.resourceQuotas.services}</div>
                            <div>PVCs: ${tenant.resourceQuotas.persistentVolumeClaims}</div>
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">网络策略</span>
                        <span class="detail-value">
                            <div>启用: ${tenant.networkPolicies.enabled ? '是' : '否'}</div>
                            <div>默认拒绝: ${tenant.networkPolicies.defaultDeny ? '是' : '否'}</div>
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">RBAC</span>
                        <span class="detail-value">
                            <div>启用: ${tenant.rbac.enabled ? '是' : '否'}</div>
                            <div>默认角色: ${tenant.rbac.defaultRole}</div>
                        </span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">创建时间</span>
                        <span class="detail-value">${new Date(tenant.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">更新时间</span>
                        <span class="detail-value">${new Date(tenant.updatedAt).toLocaleString()}</span>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-close">关闭</button>
            </div>
        `;
        
        modal.style.display = 'block';
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error('Failed to view tenant details:', error);
    }
}

async function deleteTenant(tenantId) {
    if (!confirm('确定要删除这个租户吗？这将删除所有相关的命名空间和资源。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/tenants/${tenantId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTenants();
        } else {
            alert('删除租户失败');
        }
    } catch (error) {
        console.error('Failed to delete tenant:', error);
        alert('删除租户失败');
    }
}

async function loadSecurity() {
    try {
        const [auditStats, securityStats, auditLogs, securityEvents, complianceReports] = await Promise.all([
            fetch(`${API_BASE}/audit/statistics`).then(r => r.json()),
            fetch(`${API_BASE}/security/statistics`).then(r => r.json()),
            fetch(`${API_BASE}/audit/logs?limit=50`).then(r => r.json()),
            fetch(`${API_BASE}/security/events?limit=50`).then(r => r.json()),
            fetch(`${API_BASE}/compliance/reports?limit=10`).then(r => r.json())
        ]);

        updateAuditStats(auditStats);
        updateSecurityEventStats(securityStats);
        updateAuditLogsTable(auditLogs);
        updateSecurityEventsTable(securityEvents);
        updateComplianceReportsTable(complianceReports);
    } catch (error) {
        console.error('Failed to load security data:', error);
    }
}

function updateAuditStats(stats) {
    document.getElementById('audit-total').textContent = stats.totalAuditLogs || 0;
    document.getElementById('audit-24h').textContent = stats.last24hAuditLogs || 0;
    document.getElementById('audit-7d').textContent = stats.last7dAuditLogs || 0;
}

function updateSecurityEventStats(stats) {
    document.getElementById('security-total').textContent = stats.totalSecurityEvents || 0;
    document.getElementById('security-open').textContent = stats.openSecurityEvents || 0;
    document.getElementById('security-resolved').textContent = stats.resolvedSecurityEvents || 0;
}

function updateAuditLogsTable(logs) {
    const tbody = document.getElementById('audit-logs-table');
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center">暂无审计日志</td></tr>';
        return;
    }

    tbody.innerHTML = logs.map(log => `
        <tr>
            <td>${new Date(log.timestamp).toLocaleString()}</td>
            <td>${log.eventType}</td>
            <td>${log.category}</td>
            <td><span class="status-badge ${log.severity === 'high' ? 'danger' : log.severity === 'medium' ? 'warning' : 'info'}">${log.severity}</span></td>
            <td>${log.user || '-'}</td>
            <td>${log.action}</td>
            <td><span class="status-badge ${log.result === 'success' ? 'success' : 'danger'}">${log.result}</span></td>
        </tr>
    `).join('');
}

function updateSecurityEventsTable(events) {
    const tbody = document.getElementById('security-events-table');
    
    if (!events || events.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无安全事件</td></tr>';
        return;
    }

    tbody.innerHTML = events.map(event => `
        <tr>
            <td>${new Date(event.detectedAt).toLocaleString()}</td>
            <td>${event.type}</td>
            <td><span class="status-badge ${event.severity === 'critical' ? 'danger' : event.severity === 'high' ? 'warning' : 'info'}">${event.severity}</span></td>
            <td>${event.title}</td>
            <td><span class="status-badge ${event.status === 'open' ? 'warning' : event.status === 'acknowledged' ? 'info' : 'success'}">${event.status}</span></td>
            <td>
                ${event.status === 'open' ? `<button class="btn btn-sm btn-secondary" onclick="acknowledgeSecurityEvent('${event.id}')">确认</button>` : ''}
                ${(event.status === 'open' || event.status === 'acknowledged') ? `<button class="btn btn-sm btn-primary" onclick="resolveSecurityEvent('${event.id}')">解决</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function updateComplianceReportsTable(reports) {
    const tbody = document.getElementById('compliance-reports-table');
    
    if (!reports || reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">暂无合规报告</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(report => `
        <tr>
            <td>${new Date(report.generatedAt).toLocaleString()}</td>
            <td>${report.reportType}</td>
            <td><span class="status-badge ${report.status === 'compliant' ? 'success' : report.status === 'partial' ? 'warning' : 'danger'}">${report.status}</span></td>
            <td>${report.complianceScore}%</td>
            <td>${report.issuesFound || 0}</td>
            <td><button class="btn btn-sm btn-secondary" onclick="viewComplianceReport('${report.id}')">查看</button></td>
        </tr>
    `).join('');
}

async function acknowledgeSecurityEvent(eventId) {
    try {
        const response = await fetch(`${API_BASE}/security/events/${eventId}/acknowledge`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acknowledgedBy: 'user' })
        });
        
        if (response.ok) {
            loadSecurity();
        } else {
            alert('确认事件失败');
        }
    } catch (error) {
        console.error('Failed to acknowledge security event:', error);
        alert('确认事件失败');
    }
}

async function resolveSecurityEvent(eventId) {
    try {
        const response = await fetch(`${API_BASE}/security/events/${eventId}/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resolvedBy: 'user' })
        });
        
        if (response.ok) {
            loadSecurity();
        } else {
            alert('解决事件失败');
        }
    } catch (error) {
        console.error('Failed to resolve security event:', error);
        alert('解决事件失败');
    }
}

async function generateComplianceReport() {
    try {
        const response = await fetch(`${API_BASE}/compliance/reports/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportType: 'comprehensive' })
        });
        
        if (response.ok) {
            const report = await response.json();
            alert(`合规报告已生成，ID: ${report.id}`);
            loadSecurity();
        } else {
            alert('生成报告失败');
        }
    } catch (error) {
        console.error('Failed to generate compliance report:', error);
        alert('生成报告失败');
    }
}

async function viewComplianceReport(reportId) {
    try {
        const response = await fetch(`${API_BASE}/compliance/reports/${reportId}`);
        const report = await response.json();
        
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        
        let html = `
            <div class="modal-header">
                <h3>合规报告详情</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="report-details">
                    <div class="detail-item">
                        <span class="detail-label">报告类型</span>
                        <span class="detail-value">${report.reportType}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">生成时间</span>
                        <span class="detail-value">${new Date(report.generatedAt).toLocaleString()}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">状态</span>
                        <span class="detail-value"><span class="status-badge ${report.status === 'compliant' ? 'success' : report.status === 'partial' ? 'warning' : 'danger'}">${report.status}</span></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">合规分数</span>
                        <span class="detail-value">${report.complianceScore}%</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">总检查项</span>
                        <span class="detail-value">${report.totalChecks}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">通过项</span>
                        <span class="detail-value">${report.passedChecks}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">失败项</span>
                        <span class="detail-value">${report.failedChecks}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">警告项</span>
                        <span class="detail-value">${report.warningChecks || 0}</span>
                    </div>
                </div>
                
                ${report.issuesFound > 0 ? `
                <h4>发现的问题:</h4>
                <div class="issues-list">
                    ${report.issues.slice(0, 10).map(issue => `
                        <div style="background: #f8d7da; color: #721c24; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid #dc3545;">
                            <strong>[${issue.severity.toUpperCase()}]</strong> ${issue.title}<br>
                            <small>${issue.description}</small>
                        </div>
                    `).join('')}
                </div>
                ` : ''}
                
                ${report.recommendations && report.recommendations.length > 0 ? `
                <h4>建议:</h4>
                <div class="recommendations-list">
                    ${report.recommendations.slice(0, 10).map(rec => `
                        <div style="background: #d4edda; color: #155724; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid #28a745;">
                            ${rec}
                        </div>
                    `).join('')}
                </div>
                ` : ''}
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-close">关闭</button>
            </div>
        `;
        
        content.innerHTML = html;
        modal.style.display = 'block';
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error('Failed to view compliance report:', error);
    }
}

function switchTab(container, tab) {
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    container.querySelector(`[data-tab="${tab}"]`).classList.add('active');

    if (container.classList.contains('resource-tabs')) {
        loadResourceTab(tab);
    } else if (container.classList.contains('network-tabs')) {
        loadNetworkTab(tab);
    } else if (container.classList.contains('storage-tabs')) {
        loadStorageTab(tab);
    } else if (container.classList.contains('rbac-tabs')) {
        loadRBACTab(tab);
    } else if (container.classList.contains('security-tabs')) {
        container.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(tab).classList.add('active');
    }
}

// 初始化安全审计相关事件监听器
if (document.getElementById('generate-report-btn')) {
    document.getElementById('generate-report-btn').addEventListener('click', generateComplianceReport);
}

if (document.getElementById('refresh-security-btn')) {
    document.getElementById('refresh-security-btn').addEventListener('click', loadSecurity);
}

// 为安全审计标签页添加点击事件监听器
document.querySelectorAll('.security-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tab = this.dataset.tab;
        switchTab(this.closest('.security-tabs'), tab);
    });
});

// 为安全审计导航项添加点击事件监听器
document.querySelector('[data-section="security"]').addEventListener('click', function(e) {
    e.preventDefault();
    switchSection('security');
    loadSecurity();
});

function loadContainersForPod(podName) {
    const select = document.getElementById('log-pod-select');
    const selectedOption = select.options[select.selectedIndex];
    const namespace = selectedOption.dataset.namespace || 'default';

    if (!podName) {
        document.getElementById('log-container-select').innerHTML = '<option value="">选择容器</option>';
        return;
    }

    fetch(`${API_BASE}/pods?namespace=${namespace}`)
        .then(r => r.json())
        .then(pods => {
            const pod = pods.find(p => p.metadata.name === podName);
            if (pod && pod.spec.containers) {
                const containerSelect = document.getElementById('log-container-select');
                containerSelect.innerHTML = '<option value="">选择容器</option>';
                pod.spec.containers.forEach(container => {
                    const option = document.createElement('option');
                    option.value = container.name;
                    option.textContent = container.name;
                    containerSelect.appendChild(option);
                });
            }
        })
        .catch(error => console.error('Failed to load containers:', error));
}

async function loadLogs() {
    const podSelect = document.getElementById('log-pod-select');
    const podName = podSelect.value;
    const selectedOption = podSelect.options[podSelect.selectedIndex];
    const namespace = selectedOption.dataset.namespace || 'default';
    const container = document.getElementById('log-container-select').value;
    const tailLines = document.getElementById('log-tail-lines').value || 100;

    if (!podName) {
        document.getElementById('logs-content').innerHTML = '<pre class="logs-text">选择一个 Pod 查看日志</pre>';
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/logs/${podName}?namespace=${namespace}&container=${container}&tailLines=${tailLines}`);
        const data = await response.json();
        document.getElementById('logs-content').innerHTML = `<pre class="logs-text">${escapeHtml(data.logs)}</pre>`;
    } catch (error) {
        console.error('Failed to load logs:', error);
        document.getElementById('logs-content').innerHTML = '<pre class="logs-text">加载日志失败</pre>';
    }
}

async function analyzeLogs() {
    const podSelect = document.getElementById('log-pod-select');
    const podName = podSelect.value;
    const selectedOption = podSelect.options[podSelect.selectedIndex];
    const namespace = selectedOption.dataset.namespace || 'default';
    const container = document.getElementById('log-container-select').value;

    if (!podName) {
        alert('请先选择一个 Pod');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/logs/${podName}/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ namespace, container })
        });
        const analysis = await response.json();
        renderLogsAnalysis(analysis);
    } catch (error) {
        console.error('Failed to analyze logs:', error);
        alert('分析日志失败');
    }
}

function renderLogsAnalysis(analysis) {
    const container = document.getElementById('logs-analysis');
    const content = document.getElementById('logs-analysis-content');

    let html = `
        <div class="analysis-stat">
            <span>总行数</span>
            <span>${analysis.totalLines}</span>
        </div>
        <div class="analysis-stat">
            <span>错误数</span>
            <span style="color: #dc3545;">${analysis.errorCount}</span>
        </div>
        <div class="analysis-stat">
            <span>警告数</span>
            <span style="color: #ffc107;">${analysis.warningCount}</span>
        </div>
        <div class="analysis-stat">
            <span>信息数</span>
            <span style="color: #17a2b8;">${analysis.infoCount}</span>
        </div>
        <div class="analysis-stat">
            <span>调试数</span>
            <span style="color: #6c757d;">${analysis.debugCount || 0}</span>
        </div>
    `;

    if (analysis.logLevels) {
        html += `<h4>日志级别统计:</h4>`;
        html += `<div class="log-levels-grid">`;
        Object.entries(analysis.logLevels).forEach(([level, count]) => {
            if (count > 0) {
                const color = level === 'error' || level === 'fatal' ? '#dc3545' : 
                             level === 'warning' ? '#ffc107' : 
                             level === 'info' ? '#17a2b8' : '#6c757d';
                html += `<div class="log-level-item" style="border-left: 3px solid ${color}; padding: 0.5rem; margin: 0.25rem 0;">
                    <span style="font-weight: 600;">${level.toUpperCase()}</span>
                    <span>${count}</span>
                </div>`;
            }
        });
        html += `</div>`;
    }

    if (analysis.errors.length > 0) {
        html += `<h4>错误示例（前5个）:</h4>`;
        analysis.errors.slice(0, 5).forEach(error => {
            html += `<div class="error">行 ${error.line}: ${escapeHtml(error.content)}</div>`;
        });
    }

    if (analysis.warnings.length > 0) {
        html += `<h4>警告示例（前5个）:</h4>`;
        analysis.warnings.slice(0, 5).forEach(warning => {
            html += `<div style="background: #fff3cd; color: #856404; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px;">行 ${warning.line}: ${escapeHtml(warning.content)}</div>`;
        });
    }

    if (analysis.stackTraces && analysis.stackTraces.length > 0) {
        html += `<h4>堆栈跟踪（${analysis.stackTraces.length}个）:</h4>`;
        analysis.stackTraces.slice(0, 3).forEach(trace => {
            html += `<div style="background: #f8d7da; color: #721c24; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; font-family: monospace; font-size: 0.875rem;">行 ${trace.line}: ${escapeHtml(trace.content.substring(0, 200))}${trace.content.length > 200 ? '...' : ''}</div>`;
        });
    }

    if (analysis.performanceMetrics && analysis.performanceMetrics.slowRequests.length > 0) {
        html += `<h4>慢请求（>1秒）:</h4>`;
        html += `<div class="analysis-stat"><span>慢请求数量</span><span>${analysis.performanceMetrics.slowRequests.length}</span></div>`;
        if (analysis.performanceMetrics.responseTimeStats) {
            const stats = analysis.performanceMetrics.responseTimeStats;
            html += `<div class="analysis-stat"><span>平均响应时间</span><span>${stats.avg.toFixed(2)}ms</span></div>`;
            html += `<div class="analysis-stat"><span>最小响应时间</span><span>${stats.min.toFixed(2)}ms</span></div>`;
            html += `<div class="analysis-stat"><span>最大响应时间</span><span>${stats.max.toFixed(2)}ms</span></div>`;
        }
    }

    if (analysis.databaseQueries && analysis.databaseQueries.length > 0) {
        html += `<h4>数据库查询（${analysis.databaseQueries.length}个）:</h4>`;
        const queryTypes = {};
        analysis.databaseQueries.forEach(q => {
            queryTypes[q.type] = (queryTypes[q.type] || 0) + 1;
        });
        Object.entries(queryTypes).forEach(([type, count]) => {
            html += `<div class="analysis-stat"><span>${type}</span><span>${count}</span></div>`;
        });
    }

    if (analysis.apiCalls && analysis.apiCalls.length > 0) {
        html += `<h4>API 调用（${analysis.apiCalls.length}个）:</h4>`;
        const methods = {};
        const statusCodes = {};
        analysis.apiCalls.forEach(call => {
            methods[call.method] = (methods[call.method] || 0) + 1;
            if (call.status) {
                statusCodes[call.status] = (statusCodes[call.status] || 0) + 1;
            }
        });
        html += `<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; margin-bottom: 1rem;">`;
        Object.entries(methods).forEach(([method, count]) => {
            html += `<div class="analysis-stat"><span>${method}</span><span>${count}</span></div>`;
        });
        html += `</div>`;
        if (Object.keys(statusCodes).length > 0) {
            html += `<h5>HTTP 状态码:</h5>`;
            Object.entries(statusCodes).forEach(([code, count]) => {
                const color = code.startsWith('2') ? '#28a745' : code.startsWith('3') ? '#17a2b8' : code.startsWith('4') ? '#ffc107' : '#dc3545';
                html += `<div class="analysis-stat"><span style="color: ${color};">${code}</span><span>${count}</span></div>`;
            });
        }
    }

    if (analysis.securityEvents && analysis.securityEvents.length > 0) {
        html += `<h4 style="color: #dc3545;">安全事件（${analysis.securityEvents.length}个）:</h4>`;
        analysis.securityEvents.slice(0, 5).forEach(event => {
            html += `<div style="background: #f8d7da; color: #721c24; padding: 0.5rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid #dc3545;">
                <strong>${event.type}</strong><br>
                行 ${event.line}: ${escapeHtml(event.content.substring(0, 150))}${event.content.length > 150 ? '...' : ''}
            </div>`;
        });
    }

    if (analysis.keywordStats && Object.keys(analysis.keywordStats).length > 0) {
        html += `<h4>关键词统计:</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem;">`;
        Object.entries(analysis.keywordStats).forEach(([keyword, count]) => {
            html += `<div class="analysis-stat"><span>${keyword}</span><span>${count}</span></div>`;
        });
        html += `</div>`;
    }

    if (analysis.timeDistribution && Object.keys(analysis.timeDistribution).length > 0) {
        html += `<h4>时间分布:</h4>`;
        html += `<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem;">`;
        Object.entries(analysis.timeDistribution).forEach(([timeSlot, count]) => {
            html += `<div class="analysis-stat"><span>${timeSlot}</span><span>${count}</span></div>`;
        });
        html += `</div>`;
    }

    if (Object.keys(analysis.patternAnalysis).length > 0) {
        html += `<h4>模式分析:</h4>`;
        Object.entries(analysis.patternAnalysis).forEach(([pattern, count]) => {
            html += `<div class="analysis-stat"><span>${pattern}</span><span>${count}</span></div>`;
        });
    }

    if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += `<h4>优化建议:</h4>`;
        analysis.recommendations.forEach(rec => {
            const bgColor = rec.severity === 'high' ? '#f8d7da' : rec.severity === 'medium' ? '#fff3cd' : '#d4edda';
            const textColor = rec.severity === 'high' ? '#721c24' : rec.severity === 'medium' ? '#856404' : '#155724';
            html += `<div style="background: ${bgColor}; color: ${textColor}; padding: 0.75rem; margin: 0.5rem 0; border-radius: 4px; border-left: 4px solid ${textColor};">
                <strong>[${rec.severity.toUpperCase()}]</strong> ${rec.message}
            </div>`;
        });
    }

    content.innerHTML = html;
    container.style.display = 'block';
}

async function loadResourceTab(tab) {
    const content = document.getElementById('resource-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'resource-quotas':
                data = await fetch(`${API_BASE}/resource-quotas?namespace=${namespace}`).then(r => r.json());
                renderResourceQuotas(data);
                break;
            case 'limit-ranges':
                data = await fetch(`${API_BASE}/limit-ranges?namespace=${namespace}`).then(r => r.json());
                renderLimitRanges(data);
                break;
            case 'daemonsets':
                data = await fetch(`${API_BASE}/daemonsets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'DaemonSet');
                break;
            case 'statefulsets':
                data = await fetch(`${API_BASE}/statefulsets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'StatefulSet');
                break;
            case 'jobs':
                data = await fetch(`${API_BASE}/jobs?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Job');
                break;
            case 'cronjobs':
                data = await fetch(`${API_BASE}/cronjobs?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'CronJob');
                break;
            case 'configmaps':
                data = await fetch(`${API_BASE}/configmaps?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'ConfigMap');
                break;
            case 'secrets':
                data = await fetch(`${API_BASE}/secrets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Secret');
                break;
            case 'serviceaccounts':
                data = await fetch(`${API_BASE}/service-accounts?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'ServiceAccount');
                break;
            case 'ingresses':
                data = await fetch(`${API_BASE}/ingresses?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Ingress');
                break;
            case 'replicasets':
                data = await fetch(`${API_BASE}/replicasets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'ReplicaSet');
                break;
            case 'endpoints':
                data = await fetch(`${API_BASE}/endpoints?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Endpoint');
                break;
            case 'hpas':
                data = await fetch(`${API_BASE}/horizontal-pod-autoscalers?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'HorizontalPodAutoscaler');
                break;
            case 'pdbs':
                data = await fetch(`${API_BASE}/pod-disruption-budgets?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'PodDisruptionBudget');
                break;
            case 'priority-classes':
                data = await fetch(`${API_BASE}/priority-classes`).then(r => r.json());
                renderGenericResourceTable(data, 'PriorityClass');
                break;
            case 'leases':
                data = await fetch(`${API_BASE}/leases?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Lease');
                break;
            case 'runtime-classes':
                data = await fetch(`${API_BASE}/runtime-classes`).then(r => r.json());
                renderGenericResourceTable(data, 'RuntimeClass');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function renderResourceQuotas(quotas) {
    const content = document.getElementById('resource-content');
    if (quotas.length === 0) {
        content.innerHTML = '<div class="loading">没有找到资源配额</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>资源类型</th><th>硬限制</th><th>已使用</th></tr></thead><tbody>';
    quotas.forEach(quota => {
        Object.entries(quota.spec.hard || {}).forEach(([resource, limit]) => {
            const used = quota.status?.used?.[resource] || '-';
            html += `<tr><td>${quota.metadata.name}</td><td>${resource}</td><td>${limit}</td><td>${used}</td></tr>`;
        });
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

function renderLimitRanges(limits) {
    const content = document.getElementById('resource-content');
    if (limits.length === 0) {
        content.innerHTML = '<div class="loading">没有找到限制范围</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>类型</th><th>最小值</th><th>最大值</th><th>默认值</th></tr></thead><tbody>';
    limits.forEach(limitRange => {
        limitRange.spec.limits.forEach(limit => {
            const min = limit.min ? JSON.stringify(limit.min) : '-';
            const max = limit.max ? JSON.stringify(limit.max) : '-';
            const def = limit.default ? JSON.stringify(limit.default) : '-';
            html += `<tr><td>${limitRange.metadata.name}</td><td>${limit.type}</td><td>${min}</td><td>${max}</td><td>${def}</td></tr>`;
        });
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

function renderGenericResourceTable(resources, resourceType) {
    const content = document.getElementById('resource-content');
    if (resources.length === 0) {
        content.innerHTML = `<div class="loading">没有找到 ${resourceType}</div>`;
        return;
    }

    let html = `<table class="data-table"><thead><tr><th>名称</th><th>命名空间</th><th>创建时间</th></tr></thead><tbody>`;
    resources.forEach(resource => {
        const namespace = resource.metadata.namespace || '-';
        const creationTime = new Date(resource.metadata.creationTimestamp).toLocaleString();
        html += `<tr><td>${resource.metadata.name}</td><td>${namespace}</td><td>${creationTime}</td></tr>`;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

async function loadNetworkTab(tab) {
    const content = document.getElementById('network-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'network-policies':
                data = await fetch(`${API_BASE}/network-policies?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'NetworkPolicy');
                break;
            case 'ingress-classes':
                data = await fetch(`${API_BASE}/ingress-classes`).then(r => r.json());
                renderGenericResourceTable(data, 'IngressClass');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

async function loadStorageTab(tab) {
    const content = document.getElementById('storage-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'persistent-volumes':
                data = await fetch(`${API_BASE}/persistent-volumes`).then(r => r.json());
                renderPersistentVolumes(data);
                break;
            case 'persistent-volume-claims':
                data = await fetch(`${API_BASE}/persistent-volume-claims?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'PersistentVolumeClaim');
                break;
            case 'storage-classes':
                data = await fetch(`${API_BASE}/storage-classes`).then(r => r.json());
                renderStorageClasses(data);
                break;
            case 'volume-attachments':
                data = await fetch(`${API_BASE}/volume-attachments`).then(r => r.json());
                renderGenericResourceTable(data, 'VolumeAttachment');
                break;
            case 'csi-drivers':
                data = await fetch(`${API_BASE}/csi-drivers`).then(r => r.json());
                renderGenericResourceTable(data, 'CSIDriver');
                break;
            case 'csi-nodes':
                data = await fetch(`${API_BASE}/csi-nodes`).then(r => r.json());
                renderGenericResourceTable(data, 'CSINode');
                break;
            case 'csi-capacities':
                data = await fetch(`${API_BASE}/csi-storage-capacities?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'CSIStorageCapacity');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function renderPersistentVolumes(pvs) {
    const content = document.getElementById('storage-content');
    if (pvs.length === 0) {
        content.innerHTML = '<div class="loading">没有找到持久卷</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>容量</th><th>访问模式</th><th>回收策略</th><th>状态</th><th>存储类</th></tr></thead><tbody>';
    pvs.forEach(pv => {
        const capacity = pv.spec.capacity?.storage || '-';
        const accessModes = pv.spec.accessModes?.join(', ') || '-';
        const reclaimPolicy = pv.spec.persistentVolumeReclaimPolicy || '-';
        const phase = pv.status?.phase || '-';
        const storageClass = pv.spec.storageClassName || '-';
        html += `<tr><td>${pv.metadata.name}</td><td>${capacity}</td><td>${accessModes}</td><td>${reclaimPolicy}</td><td><span class="status-badge ${phase}">${phase}</span></td><td>${storageClass}</td></tr>`;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

function renderStorageClasses(storageClasses) {
    const content = document.getElementById('storage-content');
    if (storageClasses.length === 0) {
        content.innerHTML = '<div class="loading">没有找到存储类</div>';
        return;
    }

    let html = '<table class="data-table"><thead><tr><th>名称</th><th>提供者</th><th>回收策略</th><th>绑定模式</th><th>允许卷扩展</th></tr></thead><tbody>';
    storageClasses.forEach(sc => {
        const provisioner = sc.provisioner || '-';
        const reclaimPolicy = sc.reclaimPolicy || '-';
        const bindingMode = sc.volumeBindingMode || '-';
        const allowExpansion = sc.allowVolumeExpansion ? '是' : '否';
        html += `<tr><td>${sc.metadata.name}</td><td>${provisioner}</td><td>${reclaimPolicy}</td><td>${bindingMode}</td><td>${allowExpansion}</td></tr>`;
    });
    html += '</tbody></table>';
    content.innerHTML = html;
}

async function loadRBACTab(tab) {
    const content = document.getElementById('rbac-content');
    content.innerHTML = '<div class="loading">加载中...</div>';

    try {
        let data;
        const namespace = currentNamespace === 'all' ? 'default' : currentNamespace;

        switch (tab) {
            case 'roles':
                data = await fetch(`${API_BASE}/roles?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'Role');
                break;
            case 'cluster-roles':
                data = await fetch(`${API_BASE}/cluster-roles`).then(r => r.json());
                renderGenericResourceTable(data, 'ClusterRole');
                break;
            case 'role-bindings':
                data = await fetch(`${API_BASE}/role-bindings?namespace=${namespace}`).then(r => r.json());
                renderGenericResourceTable(data, 'RoleBinding');
                break;
            case 'cluster-role-bindings':
                data = await fetch(`${API_BASE}/cluster-role-bindings`).then(r => r.json());
                renderGenericResourceTable(data, 'ClusterRoleBinding');
                break;
        }
    } catch (error) {
        console.error(`Failed to load ${tab}:`, error);
        content.innerHTML = `<div class="error">加载失败: ${error.message}</div>`;
    }
}

function connectWebSocket() {
    socket = io();

    socket.on('connect', () => {
        console.log('Connected to WebSocket');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket');
    });

    socket.on('update', (data) => {
        handleRealtimeUpdate(data);
    });
}

// 初始化应用
connectWebSocket();
loadDashboard();

// 定期刷新数据
setInterval(loadDashboard, 30000);

// 为导航项添加点击事件监听器
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const section = this.dataset.section;
        switchSection(section);
        
        switch (section) {
            case 'dashboard':
                loadDashboard();
                break;
            case 'pods':
                loadPods();
                break;
            case 'deployments':
                loadDeployments();
                break;
            case 'services':
                loadServices();
                break;
            case 'nodes':
                loadNodes();
                break;
            case 'events':
                loadEvents();
                break;
            case 'logs':
                loadPodsForLogs();
                break;
            case 'monitoring':
                loadMonitoring();
                break;
            case 'alerts':
                loadAlerts();
                break;
            case 'automation':
                loadAutomation();
                break;
            case 'tenants':
                loadTenants();
                break;
            case 'security':
                loadSecurity();
                break;
            case 'resources':
                loadResourceTab('resource-quotas');
                break;
            case 'network':
                loadNetworkTab('network-policies');
                break;
            case 'storage':
                loadStorageTab('persistent-volumes');
                break;
            case 'rbac':
                loadRBACTab('roles');
                break;
        }
    });
});

// 为命名空间选择器添加变化事件监听器
document.getElementById('namespace-select').addEventListener('change', function() {
    currentNamespace = this.value;
    const currentSection = document.querySelector('.nav-item.active').dataset.section;
    switch (currentSection) {
        case 'pods':
            loadPods();
            break;
        case 'deployments':
            loadDeployments();
            break;
        case 'services':
            loadServices();
            break;
        case 'events':
            loadEvents();
            break;
        case 'logs':
            loadPodsForLogs();
            break;
        case 'resources':
            const activeTab = document.querySelector('.resource-tabs .tab-btn.active').dataset.tab;
            loadResourceTab(activeTab);
            break;
        case 'network':
            const activeNetworkTab = document.querySelector('.network-tabs .tab-btn.active').dataset.tab;
            loadNetworkTab(activeNetworkTab);
            break;
        case 'storage':
            const activeStorageTab = document.querySelector('.storage-tabs .tab-btn.active').dataset.tab;
            loadStorageTab(activeStorageTab);
            break;
        case 'rbac':
            const activeRBACTab = document.querySelector('.rbac-tabs .tab-btn.active').dataset.tab;
            loadRBACTab(activeRBACTab);
            break;
    }
});

function switchSection(section) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    document.querySelectorAll('.section').forEach(sectionEl => {
        sectionEl.style.display = 'none';
    });
    document.getElementById(section).style.display = 'block';
}

function handleRealtimeUpdate(data) {
    if (data.type === 'pod') {
        loadDashboard();
        if (document.querySelector('[data-section="pods"].active')) {
            loadPods();
        }
    } else if (data.type === 'deployment') {
        loadDashboard();
        if (document.querySelector('[data-section="deployments"].active')) {
            loadDeployments();
        }
    } else if (data.type === 'service') {
        loadDashboard();
        if (document.querySelector('[data-section="services"].active')) {
            loadServices();
        }
    } else if (data.type === 'alert') {
        if (document.querySelector('[data-section="alerts"].active')) {
            loadAlerts();
        }
    } else if (data.type === 'automation') {
        if (document.querySelector('[data-section="automation"].active')) {
            loadAutomation();
        }
    } else if (data.type === 'security') {
        if (document.querySelector('[data-section="security"].active')) {
            loadSecurity();
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
                    <textarea name="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label>命名空间 (逗号分隔)</label>
                    <input type="text" name="namespaces" placeholder="例如: tenant1-ns1, tenant1-ns2" required>
                </div>
                <div class="form-group">
                    <label>CPU 配额</label>
                    <input type="text" name="cpu" value="4" required>
                </div>
                <div class="form-group">
                    <label>内存配额</label>
                    <input type="text" name="memory" value="8Gi" required>
                </div>
                <div class="form-group">
                    <label>Pod 配额</label>
                    <input type="number" name="pods" value="50" required>
                </div>
                <div class="form-group">
                    <label>Service 配额</label>
                    <input type="number" name="services" value="20" required>
                </div>
                <div class="form-group">
                    <label>PVC 配额</label>
                    <input type="number" name="persistentVolumeClaims" value="10" required>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" name="networkPolicies" checked> 启用网络策略</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" name="defaultDeny" checked> 默认拒绝所有流量</label>
                </div>
                <div class="form-group">
                    <label><input type="checkbox" name="rbac" checked> 启用 RBAC</label>
                </div>
                <div class="form-group">
                    <label>默认角色</label>
                    <select name="defaultRole">
                        <option value="view">只读</option>
                        <option value="edit">编辑</option>
                        <option value="admin">管理员</option>
                    </select>
                </div>
            </form>
        </div>
        <div class="modal-footer">
            <button class="btn btn-secondary modal-close">取消</button>
            <button class="btn btn-primary" onclick="createTenant()">创建</button>
        </div>
    `;
    
    modal.style.display = 'block';
    
    document.querySelectorAll('.modal-close').forEach(btn => {
        btn.addEventListener('click', closeModal);
    });
}

async function createTenant() {
    const form = document.getElementById('tenant-form');
    const formData = new FormData(form);
    
    const namespaces = formData.get('namespaces').split(',').map(ns => ns.trim()).filter(ns => ns);
    
    const tenant = {
        name: formData.get('name'),
        description: formData.get('description'),
        namespaces,
        resourceQuotas: {
            cpu: formData.get('cpu'),
            memory: formData.get('memory'),
            pods: parseInt(formData.get('pods')),
            services: parseInt(formData.get('services')),
            persistentVolumeClaims: parseInt(formData.get('persistentVolumeClaims'))
        },
        networkPolicies: {
            enabled: formData.get('networkPolicies') === 'on',
            defaultDeny: formData.get('defaultDeny') === 'on'
        },
        rbac: {
            enabled: formData.get('rbac') === 'on',
            defaultRole: formData.get('defaultRole')
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}/tenants`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tenant)
        });
        
        if (response.ok) {
            closeModal();
            loadTenants();
        } else {
            alert('创建租户失败');
        }
    } catch (error) {
        console.error('Failed to create tenant:', error);
        alert('创建租户失败');
    }
}

async function deleteTenant(tenantId) {
    if (!confirm('确定要删除这个租户吗？这将删除所有相关资源。')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/tenants/${tenantId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            loadTenants();
        } else {
            alert('删除租户失败');
        }
    } catch (error) {
        console.error('Failed to delete tenant:', error);
        alert('删除租户失败');
    }
}

async function viewTenantDetails(tenantId) {
    try {
        const [tenant, usage, users] = await Promise.all([
            fetch(`${API_BASE}/tenants`).then(r => r.json()).then(tenants => tenants.find(t => t.id === tenantId)),
            fetch(`${API_BASE}/tenants/${tenantId}/usage`).then(r => r.json()),
            fetch(`${API_BASE}/tenants/${tenantId}/users`).then(r => r.json())
        ]);
        
        const modal = document.getElementById('modal');
        const content = document.getElementById('modal-content');
        
        content.innerHTML = `
            <div class="modal-header">
                <h3>租户详情</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="execution-details">
                    <div class="detail-item">
                        <span class="detail-label">租户名称</span>
                        <span class="detail-value">${tenant.name}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">描述</span>
                        <span class="detail-value">${tenant.description || '-'}</span>
                    </div>
                    <div class="detail-item full-width">
                        <span class="detail-label">命名空间</span>
                        <span class="detail-value">${tenant.namespaces.join(', ')}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">CPU 使用</span>
                        <span class="detail-value">${usage.totals.cpuRequests.toFixed(2)} / ${usage.quotas.cpu}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">内存使用</span>
                        <span class="detail-value">${(usage.totals.memoryRequests / (1024 * 1024 * 1024)).toFixed(2)}Gi / ${usage.quotas.memory}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Pod 使用</span>
                        <span class="detail-value">${usage.totals.pods} / ${usage.quotas.pods}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Service 使用</span>
                        <span class="detail-value">${usage.totals.services} / ${usage.quotas.services}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">PVC 使用</span>
                        <span class="detail-value">${usage.totals.persistentVolumeClaims} / ${usage.quotas.persistentVolumeClaims}</span>
                    </div>
                </div>
                <h4>用户列表</h4>
                <div class="table-container">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>用户名</th>
                                <th>邮箱</th>
                                <th>角色</th>
                                <th>创建时间</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${users.length === 0 ? '<tr><td colspan="4" class="text-center">暂无用户</td></tr>' : users.map(user => `
                                <tr>
                                    <td>${user.username}</td>
                                    <td>${user.email || '-'}</td>
                                    <td>${user.role}</td>
                                    <td>${new Date(user.createdAt).toLocaleString()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary modal-close">关闭</button>
            </div>
        `;
        
        modal.style.display = 'block';
        
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });
    } catch (error) {
        console.error('Failed to view tenant details:', error);
    }
}

function handleRealtimeUpdate(data) {
    if (currentSection === 'dashboard' && data.type === 'resource-usage') {
        updateResourceTrendChart(data.data);
    }
}

function showModal(title, content) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = content;
    document.getElementById('modal').classList.add('show');
}

function closeModal() {
    document.getElementById('modal').classList.remove('show');
}

function viewPodDetails(name, namespace) {
    fetch(`${API_BASE}/pods?namespace=${namespace}`)
        .then(r => r.json())
        .then(pods => {
            const pod = pods.find(p => p.metadata.name === name);
            if (pod) {
                const content = `
                    <div class="modal-detail">
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">名称</span>
                            <span class="modal-detail-value">${pod.metadata.name}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">命名空间</span>
                            <span class="modal-detail-value">${pod.metadata.namespace}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">状态</span>
                            <span class="modal-detail-value"><span class="status-badge ${pod.status.phase}">${pod.status.phase}</span></span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">节点</span>
                            <span class="modal-detail-value">${pod.spec.nodeName || '-'}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">创建时间</span>
                            <span class="modal-detail-value">${new Date(pod.metadata.creationTimestamp).toLocaleString()}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">Pod IP</span>
                            <span class="modal-detail-value">${pod.status.podIP || '-'}</span>
                        </div>
                        <div class="modal-detail-item full-width">
                            <span class="modal-detail-label">标签</span>
                            <span class="modal-detail-value">${JSON.stringify(pod.metadata.labels, null, 2)}</span>
                        </div>
                        <div class="modal-detail-item full-width">
                            <span class="modal-detail-label">注解</span>
                            <span class="modal-detail-value">${JSON.stringify(pod.metadata.annotations, null, 2)}</span>
                        </div>
                    </div>
                `;
                showModal('Pod 详情', content);
            }
        })
        .catch(error => console.error('Failed to load pod details:', error));
}

function viewDeploymentDetails(name, namespace) {
    fetch(`${API_BASE}/deployments?namespace=${namespace}`)
        .then(r => r.json())
        .then(deployments => {
            const deployment = deployments.find(d => d.metadata.name === name);
            if (deployment) {
                const content = `
                    <div class="modal-detail">
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">名称</span>
                            <span class="modal-detail-value">${deployment.metadata.name}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">命名空间</span>
                            <span class="modal-detail-value">${deployment.metadata.namespace}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">副本数</span>
                            <span class="modal-detail-value">${deployment.spec.replicas}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">就绪副本</span>
                            <span class="modal-detail-value">${deployment.status.readyReplicas || 0}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">镜像</span>
                            <span class="modal-detail-value">${deployment.spec.template.spec.containers[0].image}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">创建时间</span>
                            <span class="modal-detail-value">${new Date(deployment.metadata.creationTimestamp).toLocaleString()}</span>
                        </div>
                        <div class="modal-detail-item full-width">
                            <span class="modal-detail-label">标签</span>
                            <span class="modal-detail-value">${JSON.stringify(deployment.metadata.labels, null, 2)}</span>
                        </div>
                    </div>
                `;
                showModal('Deployment 详情', content);
            }
        })
        .catch(error => console.error('Failed to load deployment details:', error));
}

function viewServiceDetails(name, namespace) {
    fetch(`${API_BASE}/services?namespace=${namespace}`)
        .then(r => r.json())
        .then(services => {
            const service = services.find(s => s.metadata.name === name);
            if (service) {
                const ports = service.spec.ports ? service.spec.ports.map(p => `${p.port}/${p.protocol}`).join(', ') : '-';
                const content = `
                    <div class="modal-detail">
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">名称</span>
                            <span class="modal-detail-value">${service.metadata.name}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">命名空间</span>
                            <span class="modal-detail-value">${service.metadata.namespace}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">类型</span>
                            <span class="modal-detail-value">${service.spec.type}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">ClusterIP</span>
                            <span class="modal-detail-value">${service.spec.clusterIP || 'None'}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">端口</span>
                            <span class="modal-detail-value">${ports}</span>
                        </div>
                        <div class="modal-detail-item">
                            <span class="modal-detail-label">创建时间</span>
                            <span class="modal-detail-value">${new Date(service.metadata.creationTimestamp).toLocaleString()}</span>
                        </div>
                        <div class="modal-detail-item full-width">
                            <span class="modal-detail-label">选择器</span>
                            <span class="modal-detail-value">${JSON.stringify(service.spec.selector, null, 2)}</span>
                        </div>
                    </div>
                `;
                showModal('Service 详情', content);
            }
        })
        .catch(error => console.error('Failed to load service details:', error));
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
