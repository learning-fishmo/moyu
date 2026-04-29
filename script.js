let chart;
let rawData = [];
let filteredData = [];
let dataIndex = 0;
let simulationInterval;
let kalmanFilter;

const filterTypeSelect = document.getElementById('filterType');
const windowSizeSlider = document.getElementById('windowSize');
const windowValue = document.getElementById('windowValue');
const noiseLevelSlider = document.getElementById('noiseLevel');
const noiseValue = document.getElementById('noiseValue');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const resetBtn = document.getElementById('resetBtn');
const autoTipsBtn = document.getElementById('autoTipsBtn');
const tipsModal = document.getElementById('tipsModal');
const tipsText = document.getElementById('tipsText');
const closeModal = document.querySelector('.close');

// 自动化知识库 + 彩蛋
const autoTips = [
    "📌 滤波是自动化传感器信号处理的核心，目的是去除噪声，保留真实信号。",
    "📌 均值滤波适合随机噪声，中值滤波适合脉冲干扰与尖峰突变噪声。",
    "📌 卡尔曼滤波广泛用于自动驾驶、无人机、机器人姿态与位置估算。",
    "📌 工业自动化中，信号滤波直接影响闭环控制精度与系统稳定性。",
    "📌 滑动平均滤波算法结构简单、运算量小，是工控现场最常用算法。",
    "📌 传感器噪声主要分为机械振动噪声、电路温漂噪声、环境电磁干扰噪声。",
    "📌 滤波窗口越大曲线越平滑，但系统滞后越大、响应速度变慢。",
    "📌 闭环PID控制系统必须先做信号滤波，否则高频噪声会导致执行器频繁抖动。",
    "📌 工程上常采用多级复合滤波，结合均值、中值、加权滤波提升效果。",
    "📌 自动化控制三大核心环节：传感器检测、传输、控制器运算、执行机构输出。",
    "📌 数字滤波比模拟滤波更灵活、稳定、易调试。",
    "📌 PLC、单片机、嵌入式系统都必须实现滤波算法。",
    "📌 PID控制是工业自动化最经典、应用最广的闭环调节算法。",
    "📌 变送器负责把物理量转换成标准4-20mA工业电流信号，抗干扰能力极强。",
    "📌 工控常用通信协议：Modbus、Profinet、CANopen、以太网IP。",
    "📌 工业现场强电和弱电必须分开布线，避免电磁耦合干扰传感器信号。",
    "📌 我爱玩《猎杀对决》"
];

autoTipsBtn.addEventListener('click', () => {
    const t = autoTips[Math.floor(Math.random() * autoTips.length)];
    tipsText.innerText = t;
    tipsModal.style.display = 'block';
});
closeModal.addEventListener('click', () => tipsModal.style.display = 'none');
window.addEventListener('click', e => e.target === tipsModal && (tipsModal.style.display = 'none'));

// 图表初始化
function initChart() {
    const ctx = document.getElementById('filterChart').getContext('2d');
    chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label: '原始信号',
                    data: [],
                    borderColor: '#ff4d94',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.2
                },
                {
                    label: '滤波后',
                    data: [],
                    borderColor: '#00e0ff',
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.2
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#cdd9ed' } }
            },
            scales: {
                x: { grid: { color: '#253350' }, ticks: { color: '#8899b3' } },
                y: { grid: { color: '#253350' }, ticks: { color: '#8899b3' } }
            },
            animation: { duration: 0 }
        }
    });
}

// 信号生成
function generateNoisySignal(index, noiseLevel) {
    const base = 50 + 30 * Math.sin(index * 0.1);
    const noise = (Math.random() - 0.5) * 2 * noiseLevel;
    return base + noise;
}

// 滤波算法
function meanFilter(data, size) {
    if (data.length < size) return data.at(-1);
    const w = data.slice(-size);
    return w.reduce((a,b)=>a+b,0)/w.length;
}
function medianFilter(data, size) {
    if (data.length < size) return data.at(-1);
    const w = [...data.slice(-size)].sort((a,b)=>a-b);
    return w[w.length>>1];
}
function movingAverageFilter(data, size) {
    return meanFilter(data, size);
}
class KalmanFilter {
    constructor(Q=0.1, R=10, x=50) {
        this.Q=Q;this.R=R;this.P=1;this.x=x;
    }
    update(z) {
        this.P += this.Q;
        const K = this.P/(this.P+this.R);
        this.x += K*(z-this.x);
        this.P *= 1-K;
        return this.x;
    }
}

function applyFilter(raw, type, size) {
    switch(type){
        case 'mean': return meanFilter(rawData, size);
        case 'median': return medianFilter(rawData, size);
        case 'movingAverage': return movingAverageFilter(rawData, size);
        case 'kalman': return kalmanFilter.update(raw);
        default: return raw;
    }
}

function updateChart(raw, filtered) {
    chart.data.labels.push(dataIndex++);
    chart.data.datasets[0].data.push(raw);
    chart.data.datasets[1].data.push(filtered);
    if (chart.data.labels.length > 200) {
        chart.data.labels.shift();
        chart.data.datasets[0].data.shift();
        chart.data.datasets[1].data.shift();
    }
    chart.update();
}

// 控制
function startSimulation() {
    if (simulationInterval) return;
    const size = +windowSizeSlider.value;
    const noise = +noiseLevelSlider.value;
    const type = filterTypeSelect.value;
    if (type === 'kalman') kalmanFilter = new KalmanFilter(0.1, noise, 50);
    simulationInterval = setInterval(() => {
        const raw = generateNoisySignal(dataIndex, noise);
        rawData.push(raw);
        const f = applyFilter(raw, type, size);
        filteredData.push(f);
        updateChart(raw, f);
    }, 100);
}
function stopSimulation() {
    clearInterval(simulationInterval);
    simulationInterval = null;
}
function resetData() {
    stopSimulation();
    rawData = []; filteredData = []; dataIndex = 0;
    chart.data.labels = [];
    chart.data.datasets[0].data = [];
    chart.data.datasets[1].data = [];
    chart.update();
}

// 事件
windowSizeSlider.addEventListener('input', () => windowValue.textContent = windowSizeSlider.value);
noiseLevelSlider.addEventListener('input', () => noiseValue.textContent = noiseLevelSlider.value);
startBtn.addEventListener('click', startSimulation);
stopBtn.addEventListener('click', stopSimulation);
resetBtn.addEventListener('click', resetData);

initChart();
