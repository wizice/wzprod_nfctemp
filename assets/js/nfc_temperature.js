// nfc_temperature.js - temperature 페이지용 JavaScript

// 전역 변수
let currentChart = null;
let currentData = null;
// 전역 변수 추가
let currentChartMode = 'range'; // 'auto' 또는 'range'
let currentTablePage = 1;
let rowsPerPage = 20;
let totalRows = 0;

// PDF 생성 관련 전역 변수
let pdfInstance = null;

let gReadData = {
    'data':{}
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    console.log('Temperature page loaded');

    // 전역 함수들은 파일 하단에서 정의됨

    // 기본 모드를 설정범위로 설정
    changeChartMode('range');

    // localStorage에서 데이터 확인
    const savedData = localStorage.getItem('temperatureData');
    if (savedData) {
        try {
            const data = JSON.parse(savedData);
            gReadData.data   = JSON.parse(savedData);
            displayTemperatureData(data);
            // 사용 후 삭제 - 관리자 로그인에서 저장해준 데이터를 표시하고 나서 삭제 (전달용이므로 )
            localStorage.removeItem('temperatureData');
        } catch (e) {
            console.error('Failed to parse saved data:', e);
        }
    } else {
        // URL 파라미터에서 NFC에서 온 것인지 확인
        const urlParams = new URLSearchParams(window.location.search);
        const fromNFC = urlParams.get('fromNFC');
        const uid = urlParams.get('uid');
        
        if (fromNFC === 'true' && uid) {
            // NFC에서 온 경우 스마트 진행바 시작 (측정값 미확인 시 기본값)
            initializeSmartProgressBar(null);
            showLoadingState();
            
            // Native 코드에 온도 데이터 요청
            if (window.Android && window.Android.readTemperatureData) {
                console.log('Requesting temperature data for UID:', uid);
                window.Android.readTemperatureData(uid);
            }
        } else if (fromNFC === 'true') {
            // UID 없이 fromNFC만 있는 경우 (이전 버전 호환)
            const storedUid = localStorage.getItem('currentTagUid');
            if (storedUid) {
                initializeSmartProgressBar(null);
                showLoadingState();
                if (window.Android && window.Android.readTemperatureData) {
                    console.log('Requesting temperature data for stored UID:', storedUid);
                    window.Android.readTemperatureData(storedUid);
                }
            } else {
                showEmptyState();
            }
        } else {
            // 그 외의 경우 빈 상태 메시지
            showEmptyState();
        }
    }
});

// 스마트 진행바 관련 함수들 (nfc_main.js에서 복사)
let progressTimer = null;

// 측정 건수 기반 예상 시간 계산 (4864 measurements = ~12초 기준으로 더 길게)
function calculateEstimatedTime(measurementCount) {
    if (!measurementCount || measurementCount <= 0) {
        return 5000; // 기본 5초로 증가
    }
    
    // 4864 measurements = 12000ms 기준으로 비례 계산 (2배 증가)
    const baseTime = (measurementCount / 4864) * 12000;
    
    // 최소 5초, 최대 20초로 제한하고 넉넉하게
    const estimatedTime = Math.max(5000, Math.min(20000, baseTime * 1.5));
    return Math.round(estimatedTime);
}

// 스마트 프로그레스 바 초기화
function initializeSmartProgressBar(measurementCount) {
    // NFC 진행바 카드 표시
    $('#nfcProgressCard').show();
    
    // 프로그레스 바를 0%로 초기화하고 표시
    $('#progress-container').removeClass("hide");
    $('#progress-bar').css('width', '0%').text('0%');
    
    // 기존 타이머가 있다면 정리
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    
    const estimatedTime = calculateEstimatedTime(measurementCount);
    console.log(`Temperature page smart progress bar initialized: ${measurementCount} measurements, estimated ${estimatedTime}ms`);
    
    // setTimeout으로 부드러운 진행바 표시
    let progress = 0;
    const updateInterval = Math.max(50, estimatedTime / 100); // 100단계로 나누되 최소 50ms 간격
    
    progressTimer = setInterval(() => {
        progress += 50;
        if (progress <= 95) { // 95%까지만 자동 진행
            $('#progress-bar').css('width', progress + '%').text(progress + '%');
        }
    }, updateInterval);
}

// 측정 갯수 기반 스마트 프로그레스 바 초기화 (5%씩 천천히 진행)
function initializeDataProgressBar(measurementCount) {
    // NFC 진행바 카드 표시
    $('#nfcProgressCard').show();
    
    // 프로그레스 바를 0%로 초기화하고 표시
    $('#progress-container').removeClass("hide");
    $('#progress-bar').css('width', '0%').text('0%');
    
    // 기존 타이머가 있다면 정리
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    
    const estimatedTime = calculateEstimatedTime(measurementCount);
    console.log(`Data progress bar initialized: ${measurementCount} measurements, estimated ${estimatedTime}ms`);
    
    // 측정 갯수가 있을 때는 5%씩 천천히 진행
    let progress = 0;
    const updateInterval = Math.max(100, estimatedTime / 100); // 더 천천히 진행
    
    progressTimer = setInterval(() => {
        progress += 2; // 2%씩 증가
        if (progress <= 95) { // 95%까지만 자동 진행
            $('#progress-bar').css('width', progress + '%').text(progress + '%');
        }
    }, updateInterval);
}

// 온도 데이터 읽기 완료 콜백 (간단한 완료 알림)
function onTemperatureDataComplete() {
    console.log('Temperature data reading completed on temperature page');
    
    // 기존 타이머 정리
    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }
    
    // 프로그레스 바를 100%로 설정
    $('#progress-bar').css('width', '100%').text('100%');
    
    // 잠시 후 진행바와 NFC 카드 숨기기
    setTimeout(() => {
        $('#progress-container').addClass("hide");
        $('#nfcProgressCard').hide();
    }, 1000);
}

// 온도 데이터 표시
/**
 * Android에서 전달되는 데이터 구조:
 * {
 *   status: 'success',
 *   data: [
 *     { temperature: 16.5, timestamp: 1693123200000, index: 0 },
 *     { temperature: 16.3, timestamp: 1693123800000, index: 1 },
 *     ...
 *   ],
 *   settings: {
 *     measurementStatus: "3",        // 측정 상태 (0:대기, 1:진행중, 2:비정상종료, 3:정상완료)
 *     maxTemp: 16.8,                 // 최고 온도
 *     minTemp: 11.4,                 // 최저 온도  
 *     temperatureRange: "[-20.0°C,50.0°C]",  // 설정 온도 범위
 *     intervalTime: 600,             // 측정 간격 (초)
 *     measurementStartTime: "2025-08-07 17:29:22"  // 측정 시작 시간
 *   }
 * }
 */
window.displayTemperatureData = function(data) {
    console.log('Displaying temperature data:', data);
    console.log('Data.data:', data.data);
    console.log('Data.data type:', typeof data.data);
    console.log('Data.data length:', data.data ? data.data.length : 0);
    console.log('Data.settings:', data.settings); // 메타데이터 구조 확인

    if (!data || data.status !== 'success') {
        showError('유효하지 않은 데이터입니다');
        return;
    }

    currentData = data;

    //정품 인증마크
    const certificationMarkElement = document.getElementById('certificationMark');
    if (certificationMarkElement) {
        certificationMarkElement.classList.add('show');
    }

    // 차트 그리기 - data.data가 문자열인 경우 파싱
    let chartData = data.data || data.temperatureData;
    if (typeof chartData === 'string') {
        try {
            chartData = JSON.parse(chartData);
        } catch(e) {
            console.error('Failed to parse chart data:', e);
        }
    }
    drawChart(chartData);

    // 요약 정보 업데이트 (최고/최저 온도 등)
    updateSummary(data);

    // 측정 정보 표시 (설정 정보)
    updateMeasurementInfo(data.settings);

    // 데이터 테이블 업데이트 - 파싱된 데이터 사용
    updateDataTable(chartData);

    // 빈 상태 숨기기 (기존)
    hideEmptyState();
    
    // 차트 컨테이너와 측정 정보 표시
    showMainContent();
};

// 전역 함수로 등록
window.changeChartMode = changeChartMode;
window.changePage = changePage;
window.exportToExcel = exportToExcel;

// 저장 진행률 업데이트 함수
window.onSaveProgress = function(progress, savedCount, totalCount) {
    const progressInfo = document.getElementById('saveProgress');
    const progressText = document.querySelector('.progress-text');
    const progressFill = document.querySelector('.progress-fill');
    
    if (progressInfo && progressText && progressFill) {
        progressInfo.style.display = 'block';
        progressText.textContent = `${Math.round(progress)}% (${savedCount}/${totalCount})`;
        progressFill.style.width = `${progress}%`;
    }
};

// 설정 정보 읽기 완료 콜백
window.onSettingsRead = function(settings) {
    console.log('Settings read completed on temperature page:', settings);
    
    // 진행바 메시지 업데이트
    const progressText = document.querySelector('.smart-progress-text');
    if (progressText) {
        progressText.textContent = '온도 데이터를 읽는 중...';
    }
};

// 저장 완료 시 데이터 받기
window.onTemperatureDataReceived = function(data) {
    console.log('Temperature data received from DB save:', data);
    hideLoading();
    
    // 스마트 진행바 완료 처리
    onTemperatureDataComplete();
    
    // 로딩 상태 요소 제거
    const loadingState = document.querySelector('.loading-state');
    if (loadingState) {
        loadingState.remove();
    }
    
    // 빈 상태 요소 제거
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
    
    // main-content가 없는 경우 복구
    if (!document.querySelector('.chart-container')) {
        showMainContent();
    }
    
    // 데이터 표시
    displayTemperatureData(data);
};

// 저장 완료 콜백
window.onSaveComplete = function(success, saved, total) {
    console.log('Save completed:', success, saved, total);
    if (!success) {
        showError(`데이터 저장 실패 (${saved}/${total})`);
    }
};

// 에러 처리 콜백
window.onError = function(message) {
    console.error('Error from native:', message);
    hideLoading();
    
    // 증분 읽기 시간초과는 console에만 표시
    if (message && message.includes('시간 초과')) {
        console.error('증분 읽기 시간초과:', message);
        return;
    }
    
    // NFC 통신 오류 처리
    if (message && message.includes('NFC communication error')) {
        showNfcCommunicationError(message);
    } else if (message && message.includes('Tag was lost')) {
        showTagLostError();
    } else {
        showError(message || '데이터를 읽을 수 없습니다');
    }
};

// 태그 정보 업데이트
function updateTagInfo(uid) {
    const certificationMarkElement = document.getElementById('certificationMark');
    if (certificationMarkElement) {
        certificationMarkElement.classList.add('show');
    }

    const tagIdElement = document.getElementById('tagId');
    if (tagIdElement) {
        tagIdElement.textContent = uid ? uid.toUpperCase() : '-';
    }

    const tagStatusElement = document.getElementById('tagStatus');
    if (tagStatusElement) {
        tagStatusElement.textContent = '정품 인증됨';
        tagStatusElement.className = 'status-active';
    }


}

// 요약 정보 업데이트
function updateSummary(data) {
    // data.data에서 min, max, avg, measurementCount 값 계산 (없는 경우)
    if (data.data && data.data.length > 0) {
        if (!data.minTemp || !data.maxTemp || !data.avgTemp || !data.measurementCount) {
            const temperatures = data.data.map(item => item.temperature).filter(temp => temp != null);
            
            if (temperatures.length > 0) {
                if (!data.minTemp) {
                    data.minTemp = Math.min(...temperatures);
                }
                if (!data.maxTemp) {
                    data.maxTemp = Math.max(...temperatures);
                }
                if (!data.avgTemp) {
                    data.avgTemp = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
                }
            }
            
            if (!data.measurementCount) {
                data.measurementCount = data.data.length;
            }
        }
    }
    
    // 최저 온도
    const minTempElement = document.getElementById('minTempValue');
    if (minTempElement) {
        minTempElement.textContent = data.minTemp ? `${data.minTemp.toFixed(1)}°C` : '-';
    }

    // 최고 온도
    const maxTempElement = document.getElementById('maxTempValue');
    if (maxTempElement) {
        maxTempElement.textContent = data.maxTemp ? `${data.maxTemp.toFixed(1)}°C` : '-';
    }

    // 평균 온도
    const avgTempElement = document.getElementById('avgTemp');
    if (avgTempElement && data.avgTemp) {
        avgTempElement.textContent = `${data.avgTemp.toFixed(1)}°C`;
    } else if (avgTempElement && data.data) {
        // 평균 계산
        const avg = calculateAverage(data.data);
        avgTempElement.textContent = `${avg.toFixed(1)}°C`;
    }

    // 측정 횟수
    const countElement = document.getElementById('measureCount');
    if (countElement) {
        const count = data.measurementCount || data.measureCount ||
                     (data.data ? data.data.length : 0);
        countElement.textContent = count;
    }
}


// 1. 차트 모드 변경 함수
function changeChartMode(mode) {
    const prevMode = currentChartMode;
    currentChartMode = mode;

   // 애니메이션 효과 적용
    if (prevMode !== mode) {
        animateTabSwitch(prevMode, mode);
    }

    // 탭 컨테이너에 클래스 추가/제거로 인디케이터 위치 조절
    const tabContainer = document.querySelector('.chart-mode-tabs');
    if (mode === 'auto') {
        tabContainer.classList.add('auto-mode');
    } else {
        tabContainer.classList.remove('auto-mode');
    }

    // 버튼 활성화 상태 변경
    document.getElementById('autoModeBtn').classList.toggle('active', mode === 'auto');
    document.getElementById('rangeModeBtn').classList.toggle('active', mode === 'range');

    // 차트 다시 그리기
    if (currentData) {
        drawChart(currentData.data || currentData.temperatureData);
    }

    // 데이터 테이블도 다시 업데이트 (온도 색상 변경을 위해)
    if (currentData) {
        updateDataTable(currentData.data || currentData.temperatureData);
    }
}

// 2. 수정된 drawChart 함수 (모드별 처리)
function drawChart(temperatureData) {
    if (!temperatureData || temperatureData.length === 0) {
        console.warn('No temperature data to display');
        return;
    }

    const ctx = document.getElementById('temperatureChart');
    if (!ctx) {
        console.error('Chart canvas not found');
        return;
    }

    // 기존 차트 제거
    if (currentChart) {
        currentChart.destroy();
    }

    // 데이터 준비
    const labels = temperatureData.map(item => {
        const time = item.time;
        if (time && time.includes(' ')) {
            return time.split(' ')[1];
        }
        return time || '-';
    });

    const temperatures = temperatureData.map(item => item.temperature);

    // 차트 설정 준비
    const datasets = [{
        label: '온도 (°C)',
        data: temperatures,
        borderColor: '#667eea',
        backgroundColor: 'rgba(102, 126, 234, 0.1)',
        tension: 0,

        pointHoverRadius: 5,
        pointBackgroundColor: '#667eea',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,

        borderWidth: 2,         // 선 두께
        fill: false,            // 배경 채우지 않기
        pointRadius: 0,         // 점 없애기
    }];

    // Y축 설정
    let yAxisConfig = {
        display: true,
        title: {
            display: true,
            text: '온도 (°C)',
            color: '#666',
            font: {
                size: 12,
                weight: '500'
            }
        },
        grid: {
            color: 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
            color: '#666',
            font: {
                size: 11
            }
        }
    };

    // 범위 모드인 경우 기준선과 Y축 범위 설정
    if (currentChartMode === 'range' && currentData && currentData.settings) {
        const minTemp   = currentData.settings.settingMinTemp ;
        const maxTemp   = currentData.settings.settingMaxTemp ;

        if (minTemp !== null && maxTemp !== null) {
            // Y축 범위 설정 (최저 -5 ~ 최고 +5)
            yAxisConfig.min = minTemp - 5;
            yAxisConfig.max = maxTemp + 5;

            // 기준선 추가
            datasets.push(
                // 최저 기준선 (파란색 점선)
                {
                    label: '최저 기준',
                    data: Array(labels.length).fill(minTemp),
                    borderColor: '#3182ce',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0
                },
                // 최고 기준선 (빨간색 점선)
                {
                    label: '최고 기준',
                    data: Array(labels.length).fill(maxTemp),
                    borderColor: '#e53e3e',
                    backgroundColor: 'transparent',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 0,
                    tension: 0
                }
            );
        }
    }

    // 차트 생성
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: currentChartMode === 'range', // 범위 모드에서만 범례 표시
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 15,
                        filter: function(legendItem, data) {
                            // 온도 데이터만 표시하고 기준선은 숨김
                            return legendItem.datasetIndex === 0;
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(102, 126, 234, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    borderColor: '#667eea',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 0) {
                                return `온도: ${context.parsed.y.toFixed(1)}°C`;
                            } else if (context.datasetIndex === 1) {
                                return `최저 기준: ${context.parsed.y.toFixed(1)}°C`;
                            } else if (context.datasetIndex === 2) {
                                return `최고 기준: ${context.parsed.y.toFixed(1)}°C`;
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '시간',
                        color: '#666',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    ticks: {
                        color: '#666',
                        font: {
                            size: 11
                        }
                    }
                },
                y: yAxisConfig
            }
        }
    });
}
// 3. 온도 범위 파싱 함수
function parseTemperatureRange(temperatureRange) {
    try {
        // 예: "-20°C ~ 50°C" 또는 "-20 ~ 50" 형태
        const range = temperatureRange.replace(/[°C\s]/g, '');
        const parts = range.split('~').map(part => parseFloat(part.trim()));

        if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
            return {
                minTemp: Math.min(parts[0], parts[1]),
                maxTemp: Math.max(parts[0], parts[1])
            };
        }
    } catch (e) {
        console.error('Failed to parse temperature range:', e);
    }

    return { minTemp: null, maxTemp: null };
}



function updateMeasurementInfo(data) {
    // 측정 상태
    const measurementStatusElement = document.getElementById('measurementStatus');
    if (measurementStatusElement) {
        const statusText = getMeasurementStatusText(data.measurementStatus || "0");
        measurementStatusElement.textContent = statusText;

        // 상태에 따른 색상 적용
        measurementStatusElement.className = 'info-value';
        if (data.measurementStatus === "1") {
            measurementStatusElement.style.color = '#2196F3'; // 측정 중 - 파랑
        } else if (data.measurementStatus === "2") {
            measurementStatusElement.style.color = '#FF5722'; // 비정상 종료 - 빨강
        } else if (data.measurementStatus === "3") {
            measurementStatusElement.style.color = '#4CAF50'; // 정상 완료 - 초록
        } else {
            measurementStatusElement.style.color = '#999'; // 대기 - 회색
        }
    }

    // 최고 측정값
    const maxTempValueElement = document.getElementById('maxTempValue');
    if (maxTempValueElement) {
        maxTempValueElement.textContent = data.maxTemp ? `${data.maxTemp.toFixed(1)}°C` : '-';
    }

    // 최저 측정값
    const minTempValueElement = document.getElementById('minTempValue');
    if (minTempValueElement) {
        minTempValueElement.textContent = data.minTemp ? `${data.minTemp.toFixed(1)}°C` : '-';
    }

    // 측정 범위
    const temperatureRangeElement = document.getElementById('temperatureRange');
    if (temperatureRangeElement) {
        temperatureRangeElement.textContent = data.temperatureRange || '-';
    }

    // 측정 간격
    const intervalTimeElement = document.getElementById('intervalTime');
    if (intervalTimeElement) {
        const interval = data.intervalTime || data.interval;
        intervalTimeElement.textContent = interval ? `${parseInt(interval/60)}분` : '-';
    }

    // 측정 시작일시
    const measurementStartTimeElement = document.getElementById('measurementStartTime');
    if (measurementStartTimeElement) {
        measurementStartTimeElement.textContent = data.measurementStartTime || '-';
    }
}

// 4. 새로운 함수 추가: getMeasurementStatusText
function getMeasurementStatusText(status) {
    switch (String(status)) {
        case "0": return "대기 (측정 시작 전)";
        case "1": return "측정 중 (현재 온도 로깅 진행 중)";
        case "2": return "태그가 측정중인 상태가 아닙니다.";
        case "3": return "정상 완료 (모든 측정이 완료됨)";
        default: return "알 수 없음";
    }
}

// 상세 정보 표시
function updateDetails(data) {
    const detailsContainer = document.querySelector('.details-content');
    if (!detailsContainer) return;

    const details = [];

    // 측정 간격
    if (data.intervalTime || data.interval) {
        const interval = data.intervalTime || data.interval;
        details.push(`측정 간격: ${ parseInt(interval/60)}분`);
    }

    // 온도 범위
    if (data.temperatureRange || data.range) {
        details.push(`설정 범위: ${data.temperatureRange || data.range}`);
    }

    // 측정 상태
    if (data.measurementStatus) {
        const statusText = getMeasurementStatusText(data.measurementStatus);
        details.push(`측정 상태: ${statusText}`);
    }

    // 시작 시간
    if (data.startTime) {
        const startDate = new Date(parseInt(data.startTime) * 1000);
        details.push(`시작 시간: ${startDate.toLocaleString()}`);
    }

    detailsContainer.innerHTML = details.map(d => `<p>${d}</p>`).join('');
}

// 로딩 상태 표시
function showLoadingState() {
    // container 요소 찾기
    const container = document.querySelector('.container');
    if (!container) return;
    
    // 기존 차트, 테이블 등을 임시로 숨기기
    const chartContainer = document.querySelector('.chart-container');
    const measurementInfo = document.querySelector('.measurement-info');
    const exportSection = document.querySelector('.data-export-section');
    
    if (chartContainer) chartContainer.style.display = 'none';
    if (measurementInfo) measurementInfo.style.display = 'none';
    if (exportSection) exportSection.style.display = 'none';

    return false;

    // 로딩 상태 표시
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-state';
    loadingDiv.innerHTML = `
        <div class="loading-spinner"></div>
        <h3>데이터 확인중...</h3>
        <p>온도 데이터를 읽고 있습니다</p>
        <div class="progress-info" id="saveProgress" style="display:none;">
            <span class="progress-text">0%</span>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;

    // 중복이어서 표시안함.
    // header 다음에 로딩 상태 추가
    // const header = document.querySelector('.header');
    // if (header && header.nextSibling) {
    //     container.insertBefore(loadingDiv, header.nextSibling);
   //  } else {
    //     container.appendChild(loadingDiv);
    // }
}

// 메인 콘텐츠 복구 함수 (showMainContent로 통일됨)

// 빈 상태 표시
function showEmptyState() {
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📊</div>
                <h3>온도 데이터가 없습니다</h3>
                <p>NFC 태그를 스캔하여 온도 데이터를 읽어주세요</p>
                <button class="btn btn-primary" onclick="goBack()">돌아가기</button>
            </div>
        `;
    }
}

// 빈 상태 숨기기
function hideEmptyState() {
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) {
        emptyState.remove();
    }
}

// 메인 콘텐츠 표시 (차트 컨테이너, 측정 정보 등)
function showMainContent() {
    console.log('Showing main content elements');
    
    const chartContainer = document.querySelector('.chart-container');
    const measurementInfo = document.querySelector('.measurement-info');
    const exportSection = document.querySelector('.data-export-section');
    
    if (chartContainer) {
        chartContainer.style.display = '';
        console.log('Chart container displayed');
    } else {
        console.warn('Chart container not found');
    }
    
    if (measurementInfo) {
        measurementInfo.style.display = '';
        console.log('Measurement info displayed');
    } else {
        console.warn('Measurement info not found');
    }
    
    if (exportSection) {
        exportSection.style.display = '';
        console.log('Export section displayed');
    }
}


// 4. 데이터 테이블 업데이트 함수
function updateDataTable(temperatureData) {
    if (!temperatureData || temperatureData.length === 0) {
        document.getElementById('temperatureDataTableBody').innerHTML =
            '<tr><td colspan="4" style="text-align: center; color: #999;">데이터가 없습니다</td></tr>';
        return;
    }

    totalRows = temperatureData.length;
    const startIndex = (currentTablePage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, totalRows);
    const pageData = temperatureData.slice(startIndex, endIndex);

    const tbody = document.getElementById('temperatureDataTableBody');
    tbody.innerHTML = '';

    pageData.forEach((item, index) => {
        const actualIndex = startIndex + index + 1;
        const row = document.createElement('tr');

        // 온도에 따른 색상 클래스 결정
        let tempClass = 'temp-normal';
        if (currentChartMode === 'range' && currentData.temperatureRange) {
            const { minTemp, maxTemp } = parseTemperatureRange(currentData.temperatureRange);
            if (minTemp !== null && maxTemp !== null) {
                if (item.temperature < minTemp) tempClass = 'temp-low';
                else if (item.temperature > maxTemp) tempClass = 'temp-high';
            }
        }

        row.innerHTML = `
            <td>${actualIndex}</td>
            <td>${item.time || '-'}</td>
            <td class="temp-cell ${tempClass}">${item.temperature ? item.temperature.toFixed(1) : '-'}°C</td>
            <td>정상</td>
        `;

        tbody.appendChild(row);
    });

    updatePagination();
}

// 5. 페이지네이션 업데이트
function updatePagination() {
    const totalPages = Math.ceil(totalRows / rowsPerPage);

    if (totalPages <= 1) {
        document.getElementById('tablePagination').style.display = 'none';
        return;
    }

    document.getElementById('tablePagination').style.display = 'flex';
    document.getElementById('pageInfo').textContent = `${currentTablePage} / ${totalPages}`;
    document.getElementById('prevPageBtn').disabled = currentTablePage === 1;
    document.getElementById('nextPageBtn').disabled = currentTablePage === totalPages;
}

// 6. 페이지 변경 함수
function changePage(direction) {
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const newPage = currentTablePage + direction;

    if (newPage >= 1 && newPage <= totalPages) {
        currentTablePage = newPage;
        if (currentData) {
            updateDataTable(currentData.data || currentData.temperatureData);
        }
    }
}


// 8. Excel 내보내기 함수
function exportToExcel() {
    if (!currentData || !currentData.data) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    try {
        const temperatureData = currentData.data || currentData.temperatureData;
        const csvContent = generateCSVContent(temperatureData);

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `temperature_data_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('CSV 파일로 다운로드되었습니다.');
    } catch (e) {
        console.error('Excel export failed:', e);
        alert('Excel 내보내기 중 오류가 발생했습니다.');
    }
}



// 10. CSV 내용 생성
function generateCSVContent(temperatureData) {
    let csvContent = '\uFEFF'; // BOM for UTF-8
    csvContent += '번호,시간,온도(°C),상태\n';

    temperatureData.forEach((item, index) => {
        csvContent += `${index + 1},${item.time || '-'},${item.temperature ? item.temperature.toFixed(1) : '-'},정상\n`;
    });

    return csvContent;
}




function animateTabSwitch(fromMode, toMode) {
    const tabContainer = document.querySelector('.chart-mode-tabs');
    const indicator = document.querySelector('.tab-indicator');

    // 부드러운 전환 효과
    indicator.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    // 탭 전환 시 약간의 바운스 효과
    setTimeout(() => {
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
            activeTab.style.transform = 'scale(0.95)';
            setTimeout(() => {
                activeTab.style.transform = 'scale(1)';
            }, 100);
        }
    }, 150);
}



// 새 태그 감지 (temperature 페이지에서)
window.onNewTagDetected = function(uid) {
    console.log('New tag detected on temperature page:', uid);

    // 태그 정보 업데이트
    updateTagInfo(uid);

    // 로딩 표시
    showLoading('새로운 온도 데이터를 읽고 있습니다...');

    // MainActivity에서 자동으로 데이터를 읽고 displayTemperatureData를 호출함
};

// 로딩 표시
window.showLoading = function(message) {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingOverlay';
    loadingDiv.className = 'loading-overlay';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p>${message || '처리 중...'}</p>
        </div>
    `;
    document.body.appendChild(loadingDiv);
};

// 로딩 숨기기
window.hideLoading = function() {
    const loadingDiv = document.getElementById('loadingOverlay');
    if (loadingDiv) {
        loadingDiv.remove();
    }
    
    // 추가적으로 모든 로딩 관련 요소 정리
    const allLoadingOverlays = document.querySelectorAll('.loading-overlay, #loadingOverlay');
    allLoadingOverlays.forEach(overlay => {
        if (overlay && overlay.parentNode) {
            overlay.remove();
        }
    });
    
    // 메인 콘텐츠가 숨겨져 있다면 표시
    const mainContent = document.querySelector('.main-content, .content-wrapper, #mainContent');
    if (mainContent) {
        mainContent.style.display = 'block';
        mainContent.style.visibility = 'visible';
    }
};

// 에러 표시
window.showError = function(message) {
    hideLoading();
    
    // 토스트 메시지 표시
    showToast(message, 'error');
    
    // 메인 콘텐츠 영역에 에러 상태 표시
    const mainContent = document.querySelector('.main-content, .content-wrapper, #mainContent, body');
    if (mainContent) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-state-overlay';
        errorDiv.innerHTML = `
            <div class="error-content">
                <div class="error-icon">⚠️</div>
                <h3>데이터 읽기 실패</h3>
                <p>${message}</p>
                <div class="error-actions">
                    <button onclick="location.reload();" class="retry-button">다시 시도</button>
                    <button onclick="history.back();" class="back-button">돌아가기</button>
                </div>
            </div>
        `;
        
        // 기존 에러 상태 제거 후 새 에러 표시
        const existingError = document.querySelector('.error-state-overlay');
        if (existingError) {
            existingError.remove();
        }
        
        mainContent.appendChild(errorDiv);
    }
};

// NFC 통신 오류 처리
function showNfcCommunicationError(message) {
    const errorHtml = `
        <div class="error-state">
            <div class="error-icon">📱</div>
            <h3>NFC 통신 오류</h3>
            <p>데이터를 읽는 중에 NFC 연결이 끊어졌습니다.</p>
            <div class="error-details">
                <p><strong>해결 방법:</strong></p>
                <ul>
                    <li>🔄 NFC 태그를 다시 가까이 대어주세요</li>
                    <li>📱 태그를 안정적으로 유지해주세요 (3~5초)</li>
                    <li>🔍 태그와 휴대폰 사이에 장애물이 없는지 확인하세요</li>
                </ul>
            </div>
            <div class="error-actions">
                <button class="btn btn-primary" onclick="retryDataReading()">다시 시도</button>
                <button class="btn btn-secondary" onclick="goBack()">돌아가기</button>
            </div>
        </div>
    `;
    
    showErrorState(errorHtml);
}

// 태그 분실 오류 처리
function showTagLostError() {
    const errorHtml = `
        <div class="error-state">
            <div class="error-icon">📍</div>
            <h3>NFC 태그 연결 끊어짐</h3>
            <p>데이터를 읽는 중에 태그 연결이 끊어졌습니다.</p>
            <div class="error-details">
                <p><strong>다시 시도해주세요:</strong></p>
                <ul>
                    <li>🎯 태그를 휴대폰 뒷면 중앙에 대어주세요</li>
                    <li>⏰ 읽기가 완료될 때까지 움직이지 마세요</li>
                    <li>🔋 NFC가 활성화되어 있는지 확인하세요</li>
                </ul>
            </div>
            <div class="error-actions">
                <button class="btn btn-primary" onclick="retryDataReading()">다시 시도</button>
                <button class="btn btn-secondary" onclick="goBack()">돌아가기</button>
            </div>
        </div>
    `;
    
    showErrorState(errorHtml);
}

// 에러 상태 표시
function showErrorState(htmlContent) {
    const container = document.querySelector('.container');
    if (!container) return;
    
    // 기존 콘텐츠 숨기기
    const chartContainer = document.querySelector('.chart-container');
    const measurementInfo = document.querySelector('.measurement-info');
    const exportSection = document.querySelector('.data-export-section');
    
    if (chartContainer) chartContainer.style.display = 'none';
    if (measurementInfo) measurementInfo.style.display = 'none';
    if (exportSection) exportSection.style.display = 'none';
    
    // 기존 에러 상태 제거
    const existingError = document.querySelector('.error-state');
    if (existingError) {
        existingError.remove();
    }
    
    // 새 에러 상태 추가
    container.insertAdjacentHTML('beforeend', htmlContent);
}

// 데이터 읽기 재시도
function retryDataReading() {
    const errorState = document.querySelector('.error-state');
    if (errorState) {
        errorState.remove();
    }
    
    // 현재 UID 가져오기
    const urlParams = new URLSearchParams(window.location.search);
    const uid = urlParams.get('uid');
    
    if (uid) {
        showLoading('온도 데이터를 다시 읽고 있습니다...');
        // NFC 매니저에 데이터 읽기 재시도 요청
        if (window.Android && window.Android.readTemperatureData) {
            window.Android.readTemperatureData(uid);
        } else {
            // 브라우저에서 테스트용
            setTimeout(() => {
                hideLoading();
                showError('Android 환경에서만 사용 가능합니다');
            }, 1000);
        }
    } else {
        showError('태그 정보를 찾을 수 없습니다. 다시 스캔해주세요.');
    }
}

// 토스트 메시지
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast') || createToast();
    toast.textContent = message;
    toast.className = `toast show ${type}`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 토스트 생성
function createToast() {
    const toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
    return toast;
}

// 유틸리티 함수들
function calculateAverage(data) {
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + item.temperature, 0);
    return sum / data.length;
}

function getMeasurementStatusText(status) {
    switch (status) {
        case "0": return "대기";
        case "1": return "측정 중";
        case "2": return "비정상 종료";
        case "3": return "정상 완료";
        default: return "알 수 없음";
    }
}

// 뒤로 가기
function goBack() {
    let back_url     = gwzCommon.clear_back_url()
    if ( back_url == "") {
        back_url     = "nfc_main.html";
    }

    let move_url     =   back_url + "?ts=" +   new Date().getTime() ;
     gwzCommon.fn_move_url( move_url );
}
window.onBackPressed = function () {
    setTimeout(function(){
        goBack();
        }, 100);
    return false;
};

document.addEventListener('keydown', function(e) {
    // Tab 키로 모드 전환 (Ctrl + Tab)
    if (e.ctrlKey && e.key === 'Tab') {
        e.preventDefault();
        const newMode = currentChartMode === 'auto' ? 'range' : 'auto';
        changeChartMode(newMode);
    }
});



// 로딩 관련 함수들 정의 (기존 nfc_temperature.js에 추가하거나 수정)

// 1. 로딩 표시 함수들
function showLoading(message = '데이터를 처리하는 중...') {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        // 로딩 텍스트 업데이트
        const loadingText = loading.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        loading.classList.add('show');
        loading.style.display = 'flex';
    } else {
        // 로딩 오버레이가 없으면 생성
        createLoadingOverlay(message);
    }
}

function hideLoading() {
    const loading = document.getElementById('loadingOverlay');
    if (loading) {
        loading.classList.remove('show');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 300);
    }
    
    // 로딩이 끝나면 메인 콘텐츠 표시 (데이터가 있는 경우)
    if (window.currentData) {
        showMainContent();
    }
}

// 2. 로딩 오버레이 생성 함수 (HTML에 없을 경우)
function createLoadingOverlay(message = '데이터를 처리하는 중...') {
    // 기존 로딩 오버레이 제거
    const existingLoading = document.getElementById('loadingOverlay');
    if (existingLoading) {
        existingLoading.remove();
    }

    // 새 로딩 오버레이 생성
    const loadingHTML = `
        <div class="loading-overlay show" id="loadingOverlay">
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <div class="loading-text">${message}</div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

// 3. PDF 생성 전용 로딩 함수들
function showPdfLoading(step = 'PDF 생성 중...') {
    showLoading(step);

    // PDF 전용 진행 상태 표시
    const progressHtml = `
        <div class="pdf-progress show" id="pdfProgress">
            <div class="progress-text">${step}</div>
            <div class="progress-bar">
                <div class="progress-fill" id="progressFill" style="width: 0%"></div>
            </div>
        </div>
    `;

    // 기존 진행 상태 제거 후 새로 생성
    const existingProgress = document.getElementById('pdfProgress');
    if (existingProgress) {
        existingProgress.remove();
    }

    document.body.insertAdjacentHTML('beforeend', progressHtml);
}

function updatePdfProgress(step, percentage) {
    const progressText = document.querySelector('#pdfProgress .progress-text');
    const progressFill = document.getElementById('progressFill');

    if (progressText) {
        progressText.textContent = step;
    }

    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }

    // 메인 로딩 텍스트도 업데이트
    const loadingText = document.querySelector('#loadingOverlay .loading-text');
    if (loadingText) {
        loadingText.textContent = step;
    }
}

function hidePdfLoading() {
    hideLoading();

    const pdfProgress = document.getElementById('pdfProgress');
    if (pdfProgress) {
        pdfProgress.classList.remove('show');
        setTimeout(() => {
            pdfProgress.remove();
        }, 300);
    }
}

// 4. 수정된 PDF 생성 함수 (오류 처리 개선)
async function exportToPDFWithChart() {
    if (!currentData || !currentData.data) {
        alert('내보낼 데이터가 없습니다.');
        return;
    }

    try {
        // jsPDF 라이브러리 확인
        if (typeof window.jspdf === 'undefined') {
            alert('PDF 라이브러리가 로드되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
            return;
        }

        // html2canvas 라이브러리 확인
        if (typeof html2canvas === 'undefined') {
            alert('이미지 변환 라이브러리가 로드되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.');
            return;
        }

        // 진행 상태와 함께 로딩 시작
        showPdfLoading('PDF 생성을 시작합니다...');
        updatePdfProgress('PDF 문서를 초기화하는 중...', 10);

        // jsPDF 인스턴스 생성
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // PDF 메타데이터 설정
        doc.setProperties({
            title: 'NFC 온도 센서 데이터 리포트',
            subject: '온도 측정 데이터',
            author: 'wizice.com',
            keywords: 'NFC, 온도, 센서, 데이터',
            creator: 'wizice.com'
        });

        updatePdfProgress('헤더 정보를 추가하는 중...', 20);
        // 1. 헤더 추가
        await addPdfHeader(doc);

        updatePdfProgress('차트 이미지를 생성하는 중...', 40);
        // 2. 차트 이미지 추가
        await addChartToPdf(doc);

        updatePdfProgress('측정 정보를 추가하는 중...', 60);
        // 3. 측정 정보 추가
        await addMeasurementInfoToPdf(doc);

        updatePdfProgress('데이터 테이블을 생성하는 중...', 80);
        // 4. 데이터 테이블 추가
        //addDataTableToPdf(doc);

        updatePdfProgress('푸터를 추가하는 중...', 90);
        // 5. 푸터 추가
        addPdfFooter(doc);

        updatePdfProgress('PDF 파일을 저장하는 중...', 100);
        // PDF 저장
        const fileName = `temperature_data_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);

        // 성공 메시지와 함께 로딩 종료
        setTimeout(() => {
            hidePdfLoading();
            alert('PDF 저장이 완료되었습니다.');
        }, 500);

    } catch (error) {
        console.error('PDF 생성 중 오류:', error);
        hidePdfLoading();

        // 구체적인 오류 메시지 제공
        let errorMessage = 'PDF 생성 중 오류가 발생했습니다.';

        if (error.name === 'ReferenceError') {
            errorMessage = '필요한 라이브러리가 로드되지 않았습니다. 페이지를 새로고침 후 다시 시도해주세요.';
        } else if (error.message.includes('html2canvas')) {
            errorMessage = '차트 이미지 생성 중 오류가 발생했습니다. 차트가 완전히 로드된 후 다시 시도해주세요.';
        } else if (error.message.includes('jsPDF')) {
            errorMessage = 'PDF 생성 라이브러리 오류입니다. 페이지를 새로고침 후 다시 시도해주세요.';
        }

        alert(errorMessage + '\n\n기술적 세부사항: ' + error.message);
    }
}

// 5. 안전한 차트 캡처 함수
async function addChartToPdf(doc) {
    try {
        const chartElement = document.querySelector('.chart-container');

        if (!chartElement) {
            console.warn('차트 요소를 찾을 수 없습니다.');
            // 차트가 없어도 계속 진행
            return 55;
        }

        // 차트가 완전히 렌더링될 때까지 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000));

        // html2canvas로 차트 영역을 이미지로 변환
        const canvas = await html2canvas(chartElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true,
            width: chartElement.offsetWidth,
            height: chartElement.offsetHeight,
            timeout: 30000 // 30초 타임아웃
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.9);

        // PDF에 차트 이미지 추가
        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        // 차트 제목
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('온도 변화 차트', 20, 65);

        // 차트 이미지
        doc.addImage(imgData, 'JPEG', 20, 75, imgWidth, imgHeight);

        return 75 + imgHeight + 10;

    } catch (error) {
        console.error('차트 이미지 생성 실패:', error);

        // 차트 캡처 실패 시 텍스트로 대체
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('온도 변화 차트', 20, 65);

        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text('차트 이미지를 생성할 수 없습니다.', 20, 80);
        doc.text('데이터는 아래 테이블에서 확인하실 수 있습니다.', 20, 90);

        return 100;
    }
}

// 6. 안전한 측정 정보 캡처 함수
async function addMeasurementInfoToPdf(doc) {
    try {
        const measurementElement = document.querySelector('.measurement-info');

        if (!measurementElement) {
            console.warn('측정 정보 요소를 찾을 수 없습니다.');
            return addMeasurementInfoAsText(doc);
        }

        // 잠시 대기 후 캡처
        await new Promise(resolve => setTimeout(resolve, 500));

        const canvas = await html2canvas(measurementElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true,
            timeout: 15000 // 15초 타임아웃
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.9);

        let currentY = 200;
        const imgWidth = 170;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        if (currentY + imgHeight > 280) {
            doc.addPage();
            currentY = 20;
        }

        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('측정 정보', 20, currentY);
        currentY += 10;

        doc.addImage(imgData, 'JPEG', 20, currentY, imgWidth, imgHeight);

        return currentY + imgHeight + 10;

    } catch (error) {
        console.error('측정 정보 이미지 생성 실패:', error);
        return addMeasurementInfoAsText(doc);
    }
}

// 전역 함수로 등록
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.showPdfLoading = showPdfLoading;
window.updatePdfProgress = updatePdfProgress;
window.hidePdfLoading = hidePdfLoading;
window.exportToPDFWithChart = exportToPDFWithChart;


// addPdfHeader 함수 구현

async function addPdfHeader(doc) {
    try {
        let currentY = 15; // 시작 Y 위치

        // 1. 회사 로고 추가 (선택적)
        try {
            const logoImg = await loadImageAsBase64('img/company_logo.jpg');
            if (logoImg) {
                // 로고 크기 조정 (가로 30mm, 세로는 비율에 맞게)
                doc.addImage(logoImg, 'PNG', 20, currentY - 5, 30, 15);
            }
        } catch (logoError) {
            console.log('로고 이미지 로드 실패:', logoError);
            // 로고 로드 실패해도 계속 진행
        }

        // 2. 제목과 부제목 (로고 오른쪽에 배치)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(40, 40, 40); // 진한 회색
        doc.text('NFC 온도 센서 데이터 리포트', 60, currentY + 3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(100, 100, 100); // 중간 회색
        doc.text('TempReco - NFC 온도기록라벨', 60, currentY + 11);

        currentY += 25;

        // 3. 기본 정보 섹션
        doc.setFontSize(10);
        doc.setTextColor(60, 60, 60);

        // 생성 정보
        const now = new Date();
        const generateTime = now.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        doc.text('리포트 생성일시: ' + generateTime, 20, currentY);
        currentY += 6;

        // 태그 기본 정보
        const tagId = currentData?.uid || '-';
        doc.text('태그 ID: ' + tagId.toUpperCase(), 20, currentY);
        currentY += 6;

        // 측정 상태
        const measurementStatus = getMeasurementStatusText(currentData?.measurementStatus || '0');
        doc.text('측정 상태: ' + measurementStatus, 20, currentY);
        currentY += 8;

        // 4. 요약 정보 박스
        const boxY = currentY;
        const boxHeight = 35;

        // 박스 배경
        doc.setFillColor(248, 249, 250); // 연한 회색 배경
        doc.setDrawColor(220, 220, 220); // 테두리 색상
        doc.setLineWidth(0.5);
        doc.roundedRect(20, boxY, 170, boxHeight, 2, 2, 'FD'); // 둥근 모서리 박스

        // 박스 내용
        currentY = boxY + 8;

        // 첫 번째 행: 측정 범위, 측정 간격
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);

        doc.text('측정 범위:', 25, currentY);
        doc.setFont('helvetica', 'normal');
        doc.text(currentData?.temperatureRange || '-', 50, currentY);

        doc.setFont('helvetica', 'bold');
        doc.text('측정 간격:', 110, currentY);
        doc.setFont('helvetica', 'normal');
        const interval = currentData?.intervalTime || currentData?.interval;
        doc.text(interval ? `${parseInt(interval/60)}분` : '-', 135, currentY);

        currentY += 8;

        // 두 번째 행: 최고 온도, 최저 온도
        doc.setFont('helvetica', 'bold');
        doc.text('최고 온도:', 25, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(220, 53, 69); // 빨간색
        const maxTemp = currentData?.maxTemp ? `${currentData.maxTemp.toFixed(1)}°C` : '-';
        doc.text(maxTemp, 50, currentY);

        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('최저 온도:', 110, currentY);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(13, 110, 253); // 파란색
        const minTemp = currentData?.minTemp ? `${currentData.minTemp.toFixed(1)}°C` : '-';
        doc.text(minTemp, 135, currentY);

        currentY += 8;

        // 세 번째 행: 측정 시작일시, 측정 횟수
        doc.setTextColor(80, 80, 80);
        doc.setFont('helvetica', 'bold');
        doc.text('시작일시:', 25, currentY);
        doc.setFont('helvetica', 'normal');
        const startTime = currentData?.measurementStartTime || '-';
        // 긴 날짜 텍스트 줄임
        const shortStartTime = startTime.length > 16 ? startTime.substring(0, 16) + '...' : startTime;
        doc.text(shortStartTime, 50, currentY);

        doc.setFont('helvetica', 'bold');
        doc.text('측정 횟수:', 110, currentY);
        doc.setFont('helvetica', 'normal');
        const dataCount = currentData?.data?.length || currentData?.temperatureData?.length || 0;
        doc.text(`${dataCount}개`, 135, currentY);

        currentY = boxY + boxHeight + 10;

        // 5. 구분선
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.5);
        doc.line(20, currentY, 190, currentY);

        currentY += 8;

        // 6. 차트 모드 정보 (현재 선택된 모드)
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        const chartMode = currentChartMode === 'auto' ? '자동 범위' : '설정 범위';
        doc.text(`차트 모드: ${chartMode}`, 20, currentY);

        return currentY + 5; // 다음 컨텐츠 시작 Y 위치 반환

    } catch (error) {
        console.error('PDF 헤더 생성 중 오류:', error);
        // 오류 발생 시 기본 헤더만 추가
        return addBasicPdfHeader(doc);
    }
}

// 기본 헤더 함수 (오류 시 대체용)
function addBasicPdfHeader(doc) {
    let currentY = 20;

    // 기본 제목
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('NFC 온도 센서 데이터 리포트', 20, currentY);

    currentY += 10;

    // 생성일시
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('생성일시: ' + new Date().toLocaleString('ko-KR'), 20, currentY);

    currentY += 8;

    // 태그 ID
    const tagId = currentData?.uid || '-';
    doc.text('태그 ID: ' + tagId, 20, currentY);

    currentY += 15;

    // 구분선
    doc.setDrawColor(200, 200, 200);
    doc.line(20, currentY, 190, currentY);

    return currentY + 8;
}

// 이미지를 Base64로 로드하는 함수 (개선된 버전)
async function loadImageAsBase64(imagePath) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = function() {
            try {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                // 이미지 크기 설정
                canvas.width = img.width;
                canvas.height = img.height;

                // 흰색 배경 추가 (투명 배경 처리)
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // 이미지 그리기
                ctx.drawImage(img, 0, 0);

                // Base64 변환
                const base64 = canvas.toDataURL('image/png');
                resolve(base64);
            } catch (canvasError) {
                console.error('Canvas 처리 오류:', canvasError);
                reject(canvasError);
            }
        };

        img.onerror = function(error) {
            console.error('이미지 로드 오류:', error);
            reject(error);
        };

        // 타임아웃 설정 (5초)
        setTimeout(() => {
            reject(new Error('이미지 로드 타임아웃'));
        }, 5000);

        img.src = imagePath;
    });
}

// 둥근 사각형 그리기 함수 (jsPDF에 없는 경우 대체)
if (!window.jspdf.jsPDF.prototype.roundedRect) {
    window.jspdf.jsPDF.prototype.roundedRect = function(x, y, width, height, rx, ry, style) {
        // 기본 사각형으로 대체
        this.rect(x, y, width, height, style);
    };
}

// 전역 함수로 등록
window.addPdfHeader = addPdfHeader;
window.addBasicPdfHeader = addBasicPdfHeader;
window.loadImageAsBase64 = loadImageAsBase64;

// addPdfFooter 함수 구현

function addPdfFooter(doc) {
    try {
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height; // A4: 297mm
        const pageWidth = doc.internal.pageSize.width;   // A4: 210mm

        // 각 페이지에 푸터 추가
        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            doc.setPage(pageNum);

            const footerY = pageHeight - 15; // 하단에서 15mm 위

            // 1. 푸터 구분선
            doc.setDrawColor(220, 220, 220);
            doc.setLineWidth(0.3);
            doc.line(20, footerY - 5, pageWidth - 20, footerY - 5);

            // 2. 왼쪽: 생성 정보
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(120, 120, 120);

            const generatedText = 'Generated by TempReco NFC App';
            doc.text(generatedText, 20, footerY);

            // 3. 가운데: 생성 날짜/시간
            const now = new Date();
            const dateText = now.toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            const timeText = now.toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            const dateTimeText = `${dateText} ${timeText}`;

            // 텍스트 중앙 정렬을 위한 너비 계산
            const dateTimeWidth = doc.getTextWidth(dateTimeText);
            const centerX = (pageWidth - dateTimeWidth) / 2;
            doc.text(dateTimeText, centerX, footerY);

            // 4. 오른쪽: 페이지 번호
            const pageText = `${pageNum} / ${pageCount}`;
            const pageTextWidth = doc.getTextWidth(pageText);
            doc.text(pageText, pageWidth - 20 - pageTextWidth, footerY);

            // 5. 첫 페이지에만 추가 정보
            if (pageNum === 1) {
                addFirstPageFooterInfo(doc, footerY);
            }

            // 6. 마지막 페이지에만 요약 정보
            if (pageNum === pageCount) {
                addLastPageFooterInfo(doc, footerY);
            }
        }

        // 7. 메타데이터에 페이지 수 정보 추가
        doc.setProperties({
            title: 'NFC 온도 센서 데이터 리포트',
            subject: `온도 측정 데이터 (${pageCount}페이지)`,
            author: 'wizice.com',
            keywords: 'NFC, 온도, 센서, 데이터, 리포트',
            creator: 'TempReco NFC App v1.0'
        });

    } catch (error) {
        console.error('PDF 푸터 생성 중 오류:', error);
        // 기본 푸터 추가
        addBasicFooter(doc);
    }
}

// 첫 페이지 추가 정보
function addFirstPageFooterInfo(doc, footerY) {
    try {
        // 태그 정보를 푸터 위쪽에 작게 추가
        const infoY = footerY - 12;

        doc.setFont('helvetica', 'italic');
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);

        const tagInfo = `Tag ID: ${currentData?.uid || 'Unknown'} | `;
        const statusInfo = `Status: ${getMeasurementStatusTextEng(currentData?.measurementStatus || '0')} | `;
        const dataCount = currentData?.data?.length || currentData?.temperatureData?.length || 0;
        const countInfo = `Data Points: ${dataCount}`;

        const fullInfo = tagInfo + statusInfo + countInfo;

        // 텍스트가 너무 길면 줄임
        const maxWidth = 170;
        const textWidth = doc.getTextWidth(fullInfo);

        if (textWidth > maxWidth) {
            const shortInfo = `Tag: ${currentData?.uid || 'Unknown'} | Points: ${dataCount}`;
            doc.text(shortInfo, 20, infoY);
        } else {
            doc.text(fullInfo, 20, infoY);
        }

    } catch (error) {
        console.error('첫 페이지 푸터 정보 추가 오류:', error);
    }
}

// 마지막 페이지 요약 정보
function addLastPageFooterInfo(doc, footerY) {
    try {
        const summaryY = footerY - 12;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);

        // 온도 범위 요약
        let summaryText = '';
        if (currentData?.minTemp && currentData?.maxTemp) {
            const tempRange = (currentData.maxTemp - currentData.minTemp).toFixed(1);
            summaryText = `Temperature Range: ${tempRange}°C | `;
        }

        // 측정 간격 정보
        const interval = currentData?.intervalTime || currentData?.interval;
        if (interval) {
            summaryText += `Interval: ${parseInt(interval/60)}분 | `;
        }

        // 측정 기간 계산 (추정)
        const dataCount = currentData?.data?.length || currentData?.temperatureData?.length || 0;
        if (interval && dataCount > 1) {
            const totalMinutes = Math.round((interval * (dataCount - 1)) / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;

            let durationText = '';
            if (hours > 0) {
                durationText = `${hours}h ${minutes}m`;
            } else {
                durationText = `${minutes}m`;
            }
            summaryText += `Duration: ~${durationText}`;
        }

        if (summaryText) {
            // 텍스트 길이 확인 후 조정
            const maxWidth = 170;
            const textWidth = doc.getTextWidth(summaryText);

            if (textWidth <= maxWidth) {
                doc.text(summaryText, 20, summaryY);
            } else {
                // 간단한 버전으로 축약
                const shortSummary = `${dataCount} data points collected`;
                doc.text(shortSummary, 20, summaryY);
            }
        }

    } catch (error) {
        console.error('마지막 페이지 푸터 정보 추가 오류:', error);
    }
}

// 기본 푸터 (오류 시 대체용)
function addBasicFooter(doc) {
    try {
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            doc.setPage(pageNum);

            const footerY = pageHeight - 10;

            // 기본 페이지 번호만 추가
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);

            const pageText = `Page ${pageNum} of ${pageCount}`;
            const pageTextWidth = doc.getTextWidth(pageText);
            doc.text(pageText, pageWidth - 20 - pageTextWidth, footerY);

            // 생성 정보
            doc.text('TempReco', 20, footerY);
        }
    } catch (error) {
        console.error('기본 푸터 생성 실패:', error);
    }
}

// 고급 푸터 (추가 기능들)
function addAdvancedFooter(doc) {
    try {
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            doc.setPage(pageNum);

            const footerY = pageHeight - 15;

            // 1. 장식적 구분선 (그라데이션 효과)
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.5);
            doc.line(20, footerY - 8, pageWidth - 20, footerY - 8);

            // 작은 점들로 장식
            doc.setFillColor(220, 220, 220);
            for (let i = 25; i < pageWidth - 25; i += 10) {
                doc.circle(i, footerY - 8, 0.3, 'F');
            }

            // 2. 푸터 배경 (매우 연한 색상)
            doc.setFillColor(252, 252, 252);
            doc.rect(20, footerY - 5, pageWidth - 40, 8, 'F');

            // 3. 푸터 텍스트들
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7);
            doc.setTextColor(130, 130, 130);

            // 왼쪽: 앱 정보
            doc.text('TempReco NFC Temperature Monitor', 22, footerY);

            // 가운데: 현재 시간
            const now = new Date();
            const timeStamp = now.toLocaleString('ko-KR', {
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });

            const centerText = `Generated on ${timeStamp}`;
            const centerWidth = doc.getTextWidth(centerText);
            const centerX = (pageWidth - centerWidth) / 2;
            doc.text(centerText, centerX, footerY);

            // 오른쪽: 페이지 정보
            const pageInfo = `${pageNum}/${pageCount}`;
            const pageInfoWidth = doc.getTextWidth(pageInfo);
            doc.text(pageInfo, pageWidth - 22 - pageInfoWidth, footerY);

            // 4. 각 페이지별 특별 정보
            if (pageNum === 1) {
                // 첫 페이지: 차트 모드 정보
                doc.setFontSize(6);
                doc.setTextColor(160, 160, 160);
                const modeText = `Chart Mode: ${currentChartMode === 'auto' ? 'Auto Range' : 'Set Range'}`;
                doc.text(modeText, 22, footerY + 4);
            }

            if (pageNum === pageCount && pageCount > 1) {
                // 마지막 페이지: 완료 정보
                doc.setFontSize(6);
                doc.setTextColor(100, 150, 100);
                doc.text('Report Complete', pageWidth - 42, footerY + 4);
            }
        }

    } catch (error) {
        console.error('고급 푸터 생성 오류:', error);
        addBasicFooter(doc);
    }
}

// 워터마크 추가 (선택적)
function addWatermark(doc) {
    try {
        const pageCount = doc.internal.getNumberOfPages();
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;

        for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
            doc.setPage(pageNum);

            // 워터마크 텍스트
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(50);
            doc.setTextColor(245, 245, 245); // 매우 연한 회색

            // 페이지 중앙에 회전된 워터마크
            const centerX = pageWidth / 2;
            const centerY = pageHeight / 2;

            doc.text('TempReco', centerX, centerY, {
                angle: 45,
                align: 'center'
            });
        }

    } catch (error) {
        console.error('워터마크 추가 오류:', error);
    }
}

// 전역 함수로 등록
window.addPdfFooter = addPdfFooter;
window.addBasicFooter = addBasicFooter;
window.addAdvancedFooter = addAdvancedFooter;
window.addWatermark = addWatermark;


// addDataTableToPdf 함수 구현

function addDataTableToPdf(doc) {
    try {
        const temperatureData = currentData?.data || currentData?.temperatureData;

        if (!temperatureData || temperatureData.length === 0) {
            addEmptyDataMessage(doc);
            return;
        }

        // 새 페이지 추가
        doc.addPage();

        let currentY = 20;

        // 1. 데이터 테이블 제목 및 정보
        currentY = addTableHeader(doc, currentY, temperatureData.length);

        // 2. 데이터를 페이지별로 분할하여 표시
        const rowsPerPage = 35; // 페이지당 표시할 행 수
        const totalPages = Math.ceil(temperatureData.length / rowsPerPage);
        let currentPage = 1;

        for (let startIndex = 0; startIndex < temperatureData.length; startIndex += rowsPerPage) {
            const endIndex = Math.min(startIndex + rowsPerPage, temperatureData.length);
            const pageData = temperatureData.slice(startIndex, endIndex);

            // 첫 페이지가 아니면 새 페이지 추가
            if (startIndex > 0) {
                doc.addPage();
                currentY = 20;

                // 페이지 제목
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(60, 60, 60);
                doc.text(`측정 데이터 (계속) - ${currentPage}/${totalPages}`, 20, currentY);
                currentY += 15;
            }

            // 테이블 헤더
            currentY = addTableHeaders(doc, currentY);

            // 데이터 행들
            currentY = addTableRows(doc, currentY, pageData, startIndex);

            // 페이지 요약 (각 페이지 하단)
            addPageSummary(doc, startIndex + 1, endIndex, temperatureData.length);

            currentPage++;
        }

        // 전체 요약 통계 (마지막에 추가)
        addDataSummarySection(doc, temperatureData);

    } catch (error) {
        console.error('데이터 테이블 생성 중 오류:', error);
        addErrorMessage(doc, error.message);
    }
}

// 테이블 헤더 섹션
function addTableHeader(doc, startY, totalCount) {
    let currentY = startY;

    // 메인 제목
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('측정 데이터', 20, currentY);

    currentY += 10;

    // 데이터 정보
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);

    const infoText = `총 ${totalCount}개의 측정 데이터`;
    doc.text(infoText, 20, currentY);

    // 측정 간격 정보
    const interval = currentData?.intervalTime || currentData?.interval;
    if (interval) {
        doc.text(`측정 간격: ${parseInt(interval/60)}분`, 100, currentY);
    }

    currentY += 15;

    return currentY;
}

// 테이블 헤더 행
function addTableHeaders(doc, startY) {
    const headerY = startY;

    // 헤더 배경
    doc.setFillColor(240, 240, 240);
    doc.rect(20, headerY - 3, 170, 8, 'F');

    // 헤더 테두리
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.rect(20, headerY - 3, 170, 8);

    // 헤더 텍스트
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);

    const headers = ['번호', '측정시간', '온도(°C)', '상태', '범위체크'];
    const columnPositions = [25, 45, 100, 130, 155];
    const columnWidths = [15, 50, 25, 20, 30];

    headers.forEach((header, index) => {
        doc.text(header, columnPositions[index], headerY + 2);

        // 열 구분선
        if (index < headers.length - 1) {
            const lineX = columnPositions[index] + columnWidths[index] - 2;
            doc.line(lineX, headerY - 3, lineX, headerY + 5);
        }
    });

    return headerY + 10;
}

// 테이블 데이터 행들
function addTableRows(doc, startY, dataArray, startIndex) {
    let currentY = startY;

    dataArray.forEach((item, index) => {
        const actualIndex = startIndex + index + 1;
        const rowY = currentY;

        // 페이지 넘김 확인
        if (rowY > 270) {
            return currentY; // 페이지 끝에 도달
        }

        // 줄무늬 배경 (짝수 행)
        if (index % 2 === 0) {
            doc.setFillColor(248, 249, 250);
            doc.rect(20, rowY - 2, 170, 6, 'F');
        }

        // 행 테두리
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.1);
        doc.rect(20, rowY - 2, 170, 6);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);

        // 1. 번호
        doc.setTextColor(100, 100, 100);
        doc.text(actualIndex.toString(), 25, rowY + 1);

        // 2. 측정시간
        doc.setTextColor(60, 60, 60);
        const timeText = formatTimeForPdf(item.time);
        doc.text(timeText, 45, rowY + 1);

        // 3. 온도 (색상 구분)
        const tempValue = item.temperature;
        const tempText = tempValue ? `${tempValue.toFixed(1)}` : '-';

        // 온도 범위에 따른 색상 설정
        const tempColor = getTemperatureColor(tempValue);
        doc.setTextColor(tempColor.r, tempColor.g, tempColor.b);
        doc.text(tempText, 100, rowY + 1);

        // 4. 상태
        doc.setTextColor(76, 175, 80); // 초록색
        doc.text('정상', 130, rowY + 1);

        // 5. 범위 체크
        const rangeCheck = checkTemperatureRange(tempValue);
        doc.setTextColor(rangeCheck.color.r, rangeCheck.color.g, rangeCheck.color.b);
        doc.text(rangeCheck.text, 155, rowY + 1);

        // 열 구분선
        const columnPositions = [40, 95, 125, 150];
        doc.setDrawColor(240, 240, 240);
        columnPositions.forEach(x => {
            doc.line(x, rowY - 2, x, rowY + 4);
        });

        currentY += 6;
    });

    return currentY;
}

// 시간 포맷팅
function formatTimeForPdf(timeString) {
    if (!timeString) return '-';

    try {
        // "2025-07-22 15:30:45" 형태를 "07-22 15:30" 형태로 변환
        if (timeString.includes(' ')) {
            const [date, time] = timeString.split(' ');
            const [year, month, day] = date.split('-');
            const [hour, minute] = time.split(':');
            return `${month}-${day} ${hour}:${minute}`;
        }

        // 시간만 있는 경우
        if (timeString.includes(':')) {
            const [hour, minute] = timeString.split(':');
            return `${hour}:${minute}`;
        }

        return timeString.length > 15 ? timeString.substring(0, 15) : timeString;
    } catch (error) {
        return timeString.length > 15 ? timeString.substring(0, 15) : timeString;
    }
}

// 온도에 따른 색상 결정
function getTemperatureColor(temperature) {
    if (!temperature && temperature !== 0) {
        return { r: 150, g: 150, b: 150 }; // 회색 (데이터 없음)
    }

    // 설정 범위 모드인 경우
    if (currentChartMode === 'range' && currentData?.temperatureRange) {
        const { minTemp, maxTemp } = parseTemperatureRange(currentData.temperatureRange);

        if (minTemp !== null && maxTemp !== null) {
            if (temperature < minTemp) {
                return { r: 54, g: 162, b: 235 }; // 파란색 (저온)
            } else if (temperature > maxTemp) {
                return { r: 220, g: 53, b: 69 }; // 빨간색 (고온)
            }
        }
    }

    // 일반적인 온도 색상
    if (temperature < 0) {
        return { r: 54, g: 162, b: 235 }; // 파란색
    } else if (temperature > 40) {
        return { r: 220, g: 53, b: 69 }; // 빨간색
    } else {
        return { r: 76, g: 175, b: 80 }; // 초록색 (정상)
    }
}

// 온도 범위 체크
function checkTemperatureRange(temperature) {
    if (!temperature && temperature !== 0) {
        return {
            text: '-',
            color: { r: 150, g: 150, b: 150 }
        };
    }

    // 설정 범위 모드인 경우
    if (currentChartMode === 'range' && currentData?.temperatureRange) {
        const { minTemp, maxTemp } = parseTemperatureRange(currentData.temperatureRange);

        if (minTemp !== null && maxTemp !== null) {
            if (temperature < minTemp) {
                return {
                    text: '저온',
                    color: { r: 54, g: 162, b: 235 }
                };
            } else if (temperature > maxTemp) {
                return {
                    text: '고온',
                    color: { r: 220, g: 53, b: 69 }
                };
            } else {
                return {
                    text: '정상',
                    color: { r: 76, g: 175, b: 80 }
                };
            }
        }
    }

    return {
        text: '정상',
        color: { r: 76, g: 175, b: 80 }
    };
}

// 페이지 요약
function addPageSummary(doc, startNum, endNum, totalCount) {
    const pageHeight = doc.internal.pageSize.height;
    const summaryY = pageHeight - 25;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);

    const summaryText = `${startNum}-${endNum}번 (총 ${totalCount}개 중)`;
    doc.text(summaryText, 20, summaryY);
}

// 데이터 요약 통계 섹션
function addDataSummarySection(doc, temperatureData) {
    doc.addPage();

    let currentY = 20;

    // 제목
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(40, 40, 40);
    doc.text('데이터 요약 통계', 20, currentY);
    currentY += 20;

    // 통계 계산
    const stats = calculateTemperatureStats(temperatureData);

    // 통계 박스
    doc.setFillColor(248, 249, 250);
    doc.setDrawColor(220, 220, 220);
    doc.roundedRect(20, currentY - 5, 170, 60, 3, 3, 'FD');

    currentY += 5;

    // 통계 정보 표시
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);

    const statItems = [
        `총 측정 횟수: ${stats.count}개`,
        `평균 온도: ${stats.average.toFixed(2)}°C`,
        `최고 온도: ${stats.max.toFixed(1)}°C`,
        `최저 온도: ${stats.min.toFixed(1)}°C`,
        `온도 범위: ${stats.range.toFixed(1)}°C`,
        `표준편차: ${stats.stdDev.toFixed(2)}°C`
    ];

    statItems.forEach((item, index) => {
        const x = 25 + (index % 2) * 85;
        const y = currentY + Math.floor(index / 2) * 8;
        doc.text(item, x, y);
    });
}

// 온도 통계 계산
function calculateTemperatureStats(data) {
    const validTemps = data.filter(item => item.temperature !== null && item.temperature !== undefined)
                          .map(item => item.temperature);

    if (validTemps.length === 0) {
        return {
            count: 0,
            average: 0,
            max: 0,
            min: 0,
            range: 0,
            stdDev: 0
        };
    }

    const count = validTemps.length;
    const sum = validTemps.reduce((a, b) => a + b, 0);
    const average = sum / count;
    const max = Math.max(...validTemps);
    const min = Math.min(...validTemps);
    const range = max - min;

    // 표준편차 계산
    const variance = validTemps.reduce((acc, temp) => acc + Math.pow(temp - average, 2), 0) / count;
    const stdDev = Math.sqrt(variance);

    return {
        count,
        average,
        max,
        min,
        range,
        stdDev
    };
}

// 빈 데이터 메시지
function addEmptyDataMessage(doc) {
    doc.addPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(150, 150, 150);
    doc.text('측정 데이터가 없습니다', 20, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('표시할 온도 측정 데이터가 없습니다.', 20, 65);
}

// 오류 메시지
function addErrorMessage(doc, errorMsg) {
    doc.addPage();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(220, 53, 69);
    doc.text('데이터 테이블 생성 오류', 20, 40);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('오류: ' + errorMsg, 20, 55);
}

// 전역 함수로 등록
window.addDataTableToPdf = addDataTableToPdf;


// Excel/CSV 내보내기 함수 수정
async function exportToExcelViaAndroid(autoShare = false) {
    try {
        if (!currentData || !currentData.data) {
            showToast('내보낼 데이터가 없습니다.');
            return;
        }

        showLoading('CSV 파일 생성 중...');

        // CSV 헤더
        let csvContent = 'Time,Temperature(°C),Status\n';

        // 데이터 행 추가
        currentData.data.forEach((item, index) => {
            const time = formatTimeForPdf(item.time || `${index * (currentData.intervalTime || 600)}초`);
            const temp = item.temperature.toFixed(1);
            const status = item.status || 'Normal';

            csvContent += `"${time}","${temp}","${status}"\n`;
        });

        // 메타데이터
        const metadata = {
            fileName: `Temperature_Data_${currentData.uid}_${new Date().toISOString().split('T')[0]}.csv`,
            tagId: currentData.uid || 'unknown',
            measurementCount: currentData.data.length,
            createdAt: new Date().toISOString(),
            autoShare: autoShare
        };

        hideLoading();

        // Android로 전송
        if (window.Android && window.Android.saveToExcel) {
            window.Android.saveToExcel(csvContent, JSON.stringify(metadata));
        } else {
            // 웹 브라우저에서 직접 다운로드
            downloadCSV(csvContent, metadata.fileName);
        }

    } catch (error) {
        console.error('CSV 생성 오류:', error);
        hideLoading();
        showToast('CSV 파일 생성에 실패했습니다.');
    }
}

// 3. 이미지(차트)를 Base64로 안드로이드에 전송
async function exportChartImageViaAndroid() {
    try {
        if (typeof Android === 'undefined' || !Android.saveFileFromBase64) {
            alert('안드로이드 앱에서만 사용 가능한 기능입니다.');
            return;
        }

        const chartElement = document.querySelector('.chart-container');
        if (!chartElement) {
            alert('차트를 찾을 수 없습니다.');
            return;
        }

        showLoading('차트 이미지를 생성하는 중...');

        // html2canvas로 차트를 이미지로 변환
        const canvas = await html2canvas(chartElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true
        });

        // Canvas를 Base64로 변환
        const imageBase64 = canvas.toDataURL('image/png');
        const base64Data = imageBase64.split(',')[1];

        const fileName = `temperature_chart_${new Date().toISOString().split('T')[0]}.png`;

        const metadata = {
            fileName: fileName,
            fileSize: base64Data.length,
            mimeType: 'image/png',
            width: canvas.width,
            height: canvas.height,
            chartMode: currentChartMode,
            createdAt: new Date().toISOString()
        };

        // 안드로이드로 전송
        Android.saveFileFromBase64(base64Data, JSON.stringify(metadata), 'image');

        hideLoading();
        showToast('차트 이미지 생성을 안드로이드에 요청했습니다.');

    } catch (error) {
        console.error('차트 이미지 생성/전송 오류:', error);
        hideLoading();
        alert('차트 이미지 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

// 4. 통합 내보내기 함수 (사용자 선택)
function exportDataViaAndroid(format) {
    switch (format) {
        case 'pdf':
            exportToPDFViaAndroid();
            break;
        case 'csv':
            exportToExcelViaAndroid();
            break;
        case 'image':
            exportChartImageViaAndroid();
            break;
        case 'all':
            exportAllFormatsViaAndroid();
            break;
        default:
            alert('지원하지 않는 형식입니다.');
    }
}

// 5. 모든 형식으로 내보내기
async function exportAllFormatsViaAndroid() {
    try {


        // PDF 생성
        updatePdfProgress('PDF 생성 중...', 25);
        await exportToPDFViaAndroid();

        // 잠시 대기
        await new Promise(resolve => setTimeout(resolve, 1000));
//
//        // CSV 생성
//        updatePdfProgress('CSV 생성 중...', 50);
//        exportToExcelViaAndroid();
//
//        // 잠시 대기
//        await new Promise(resolve => setTimeout(resolve, 1000));
//
//        // 차트 이미지 생성
//        updatePdfProgress('차트 이미지 생성 중...', 75);
//        await exportChartImageViaAndroid();
//
//        updatePdfProgress('완료!', 100);
//
//        setTimeout(() => {
//            hidePdfLoading();
//            showToast('모든 파일 생성이 완료되었습니다.');
//        }, 1000);

    } catch (error) {
        console.error('전체 내보내기 오류:', error);
        hidePdfLoading();
        alert('파일 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

window.onFileSaveFailed = function(fileName, error, fileType) {
    console.error('파일 저장 실패:', fileName, error);

    const message = `❌ ${fileType.toUpperCase()} 파일 저장에 실패했습니다: ${error}`;
    showErrorNotification(message);
};

// 7. 성공/오류 알림 함수들
function showSuccessNotification(message) {
    const notification = createNotification(message, 'success');
    document.body.appendChild(notification);

    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 4000);
}

function showErrorNotification(message) {
    const notification = createNotification(message, 'error');
    document.body.appendChild(notification);

    setTimeout(() => {
        if (document.body.contains(notification)) {
            document.body.removeChild(notification);
        }
    }, 5000);
}

function createNotification(message, type) {
    const notification = document.createElement('div');
    const bgColor = type === 'success' ? '#4CAF50' : '#F44336';
    const icon = type === 'success' ? '✅' : '❌';

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${bgColor};
        color: white;
        padding: 15px 25px;
        border-radius: 8px;
        z-index: 10002;
        box-shadow: 0 4px 15px rgba(0,0,0,0.3);
        max-width: 400px;
        text-align: center;
        animation: slideInDown 0.3s ease;
    `;

    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; justify-content: center;">
            <span style="font-size: 18px;">${icon}</span>
            <span>${message}</span>
        </div>
    `;

    return notification;
}

// 8. 내보내기 버튼 이벤트 업데이트
function updateExportButtons() {
    // PDF 버튼
    const pdfBtn = document.querySelector('.pdf-btn');
    if (pdfBtn) {
        pdfBtn.onclick = () => exportDataViaAndroid('pdf');
    }

    // Excel 버튼
    const excelBtn = document.querySelector('.excel-btn');
    if (excelBtn) {
        excelBtn.onclick = () => exportDataViaAndroid('csv');
    }


}

// 9. 페이지 로드 시 버튼 업데이트
document.addEventListener('DOMContentLoaded', function() {


    // 안드로이드 환경에서만 버튼 업데이트
    if (typeof Android !== 'undefined') {
        updateExportButtons();
    }
});

// 전역 함수로 등록

window.exportToExcelViaAndroid = exportToExcelViaAndroid;
window.exportChartImageViaAndroid = exportChartImageViaAndroid;
window.exportDataViaAndroid = exportDataViaAndroid;
window.exportAllFormatsViaAndroid = exportAllFormatsViaAndroid;

// nfc_temperature.js - PDF 생성 관련 기능 정리

// Android 버전 확인 함수
function getAndroidVersion() {
    if (window.Android && window.Android.getAndroidVersion) {
        return window.Android.getAndroidVersion();
    }
    return 'unknown';
}

// ===== PDF 생성 메인 함수 =====
async function generatePDFReport(autoShare = true ) {
     try {
        // Android 버전 체크
        const androidVersion = getAndroidVersion();
        console.log('Android Version:', androidVersion);

        showPdfLoading('PDF 생성 준비 중...', 10);

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        // PDF 메타데이터 설정
        doc.setProperties({
            title: 'NFC Temperature Recording Data Report',
            subject: 'Temperature Measurement Data',
            author: 'TempReco',
            keywords: 'NFC, Temperature, Recording, Data, wizice',
            creator: 'wizice.com'
        });



         let yPos = 20;

         // 1. 헤더 추가
         doc.setFontSize(20);
         doc.setTextColor(102, 126, 234);
         doc.text('TempReco', 105, yPos, { align: 'center' });

         yPos += 10;
         doc.setFontSize(14);
         doc.setTextColor(100, 100, 100);
         doc.text('NFC Temperature Recording Label', 105, yPos, { align: 'center' });

         yPos += 15;

         // 2. 기본 정보
         doc.setFontSize(14);
         doc.setTextColor(102, 126, 234);
         doc.text('Measurement Results', 20, yPos);

         yPos += 7;
         doc.setFontSize(10);
         doc.setTextColor(0, 0, 0);

         // 정보 테이블
         const results = [
             ['Tag ID', currentData?.uid || 'N/A'],
             ['Measurement Status', getMeasurementStatusTextEng(currentData?.measurementStatus || '0')],
             ['Start Time', currentData?.measurementStartTime || '-'],
             ['Interval', currentData?.intervalTime ? `${parseInt(currentData.intervalTime/60)} Min` : '-'],

             ['Max Temperature', currentData?.maxTemp ? `${currentData.maxTemp.toFixed(1)}°C` : '-'],
             ['Min Temperature', currentData?.minTemp ? `${currentData.minTemp.toFixed(1)}°C` : '-'],
             ['Temperature Range', currentData?.temperatureRange || '-'],
             ['Total Measurements', `${currentData?.data?.length || 0}`]
         ];

         results.forEach(([label, value]) => {
             doc.setFont(undefined, 'bold');
             doc.text(label + ':', 25, yPos);
             doc.setFont(undefined, 'normal');

             // 온도 값에 색상 적용
             if (label.includes('Max')) {
                 doc.setTextColor(229, 62, 62); // 빨간색
             } else if (label.includes('Min')) {
                 doc.setTextColor(49, 130, 206); // 파란색
             }

             doc.text(value, 70, yPos);
             doc.setTextColor(0, 0, 0); // 색상 리셋
             yPos += 4;
         });

         yPos += 7;

         // 4. 차트 이미지 추가 (canvas에서 직접)
         showPdfLoading('차트 이미지 생성 중...', 50);

         const chartCanvas = document.getElementById('temperatureChart');
         if (chartCanvas) {
             const chartImage = chartCanvas.toDataURL('image/png');

             // 차트 제목
             doc.setFontSize(14);
             doc.setTextColor(102, 126, 234);
             doc.text('Temperature Chart', 20, yPos);
             yPos += 0;

             // 차트 이미지 삽입
             const imgWidth = 170;
             const imgHeight = 180;
             doc.addImage(chartImage, 'PNG', 20, yPos, imgWidth, imgHeight);
             yPos += imgHeight + 10;
         }

         // 5. 데이터 테이블 (모든 데이터)
         console.log('=== PDF 데이터 디버깅 ===');
         console.log('currentData:', currentData);
         console.log('currentData.data length:', currentData?.data?.length);
         if (currentData?.data && currentData.data.length > 0) {
             // 새 페이지 추가
             doc.addPage();
             yPos = 20;

             doc.setFontSize(14);
             doc.setTextColor(102, 126, 234);
             doc.text('Measurement Data', 20, yPos);
             yPos += 10;

             // 테이블 헤더
             doc.setFontSize(10);
             doc.setFont(undefined, 'bold');
             doc.text('No.', 25, yPos);
             doc.text('Time', 45, yPos);
             doc.text('Temperature', 120, yPos);
             doc.text('Status', 160, yPos);

             yPos += 5;
             doc.setDrawColor(200, 200, 200);
             doc.line(20, yPos, 190, yPos);
             yPos += 5;

             // 데이터 행 (페이지별로 나누어 처리)
             doc.setFont(undefined, 'normal');
             const dataToShow = currentData.data; // 모든 데이터 표시
             const rowsPerPage = 35; // 페이지당 최대 행 수
             const totalPages = Math.ceil(dataToShow.length / rowsPerPage);
             
             console.log('PDF에 표시할 데이터 개수:', dataToShow.length);
             console.log('페이지당 행 수:', rowsPerPage);
             console.log('총 페이지 수:', totalPages);
             console.log('첫 번째 데이터:', dataToShow[0]);
             console.log('마지막 데이터:', dataToShow[dataToShow.length - 1]);

             for (let page = 0; page < totalPages; page++) {
                 if (page > 0) {
                     doc.addPage();
                     yPos = 20;
                     
                     // 새 페이지에 헤더 추가
                     doc.setFontSize(10);
                     doc.setFont(undefined, 'bold');
                     doc.text('No.', 25, yPos);
                     doc.text('Time', 45, yPos);
                     doc.text('Temperature', 120, yPos);
                     doc.text('Status', 160, yPos);
                     yPos += 5;
                     doc.setDrawColor(200, 200, 200);
                     doc.line(20, yPos, 190, yPos);
                     yPos += 5;
                     doc.setFont(undefined, 'normal');
                 }
                 
                 const startIdx = page * rowsPerPage;
                 const endIdx = Math.min(startIdx + rowsPerPage, dataToShow.length);
                 
                 console.log(`페이지 ${page + 1}: 데이터 ${startIdx}-${endIdx - 1} 처리 중`);
                 
                 for (let i = startIdx; i < endIdx; i++) {
                     const item = dataToShow[i];
                     
                     // 첫 5개와 마지막 5개 데이터 로깅
                     if (i < 5 || i >= dataToShow.length - 5) {
                         console.log(`데이터[${i}]:`, item);
                     }
                     
                     doc.text(`${i + 1}`, 25, yPos);
                     doc.text(item.time || '-', 45, yPos);
                     doc.text(`${item.temperature ? item.temperature.toFixed(1) : '-'}°C`, 120, yPos);
                     doc.text('Normal', 160, yPos);
                     yPos += 7;
                 }
             }
             
             console.log(`PDF에 총 ${dataToShow.length}개 데이터가 추가되었습니다.`);
         }

         // 6. 푸터
         const pageCount = doc.internal.getNumberOfPages();
         for (let i = 1; i <= pageCount; i++) {
             doc.setPage(i);
             doc.setFontSize(8);
             doc.setTextColor(150, 150, 150);
             doc.text(`Page ${i} of ${pageCount}`, 105, 285, { align: 'center' });
             doc.text('© TempReco - NFC Temperature Label', 105, 290, { align: 'center' });
         }

        showPdfLoading('PDF 변환 중...', 80);

        const pdfBase64 = doc.output('datauristring');
        const base64Data = pdfBase64.split(',')[1];

        // 메타데이터 생성
        const metadata = {
            fileName: `Report_${currentData?.uid || 'unknown'}_${new Date().toISOString().split('T')[0]}.pdf`,
            fileSize: base64Data.length,
            mimeType: 'application/pdf',
            tagId: currentData?.uid || 'unknown',
            measurementCount: currentData?.data?.length || 0,
            measurementStatus: currentData?.measurementStatus || '0',
            createdAt: new Date().toISOString(),
            autoShare: autoShare  // 자동 공유 옵션
        };

        showPdfLoading('안드로이드로 전송 중...', 100);

        // Android 인터페이스 호출
        if (window.Android && window.Android.savePdfFromBase64) {
            window.Android.savePdfFromBase64(base64Data, JSON.stringify(metadata));
        } else {
            // 웹 브라우저에서 실행 중
            downloadPDFDirectly();
        }

        hidePdfLoading();

    } catch (error) {
        console.error('PDF 생성 실패:', error);
        hidePdfLoading();
        showToast('PDF 생성에 실패했습니다: ' + error.message);
    }
 }

// ===== PDF 내용 생성 =====
function createPDFContent() {
    const data = currentData || {};

    // 측정 정보 가져오기
    const measurementStatus = getMeasurementStatusText(data.measurementStatus || "0");
    const maxTemp = data.maxTemp ? `${data.maxTemp.toFixed(1)}°C` : '-';
    const minTemp = data.minTemp ? `${data.minTemp.toFixed(1)}°C` : '-';
    const temperatureRange = data.temperatureRange || '-';
    const intervalTime = data.intervalTime || data.interval;
    const measurementStartTime = data.measurementStartTime || '-';

    // 상태별 색상
    let statusColor = '#999';
    if (data.measurementStatus === "1") statusColor = '#2196F3';
    else if (data.measurementStatus === "2") statusColor = '#FF5722';
    else if (data.measurementStatus === "3") statusColor = '#4CAF50';

    return `
        <!-- 헤더 -->
        <div style="text-align: center; margin-bottom: 30px; border-bottom: 2px solid #667eea; padding-bottom: 20px;">
            <h1 style="font-size: 28px; margin: 0; color: #667eea;">TempReco</h1>
            <p style="font-size: 16px; margin: 5px 0; color: #666;">NFC 온도기록라벨</p>
            <h2 style="font-size: 22px; margin: 15px 0; color: #333;">온도 측정 데이터 리포트</h2>
        </div>

        <!-- 기본 정보 -->
        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; color: #667eea; margin-bottom: 15px;">기본 정보</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; width: 30%; font-weight: bold;">태그 ID</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0;">${data.uid || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; font-weight: bold;">측정 상태</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; color: ${statusColor}; font-weight: bold;">${measurementStatus}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; font-weight: bold;">측정 시작 시간</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0;">${measurementStartTime}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; font-weight: bold;">측정 간격</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0;">${intervalTime ? parseInt(intervalTime/60) + '분' : '-'}</td>
                </tr>
            </table>
        </div>

        <!-- 측정 결과 -->
        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; color: #667eea; margin-bottom: 15px;">측정 결과</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; width: 30%; font-weight: bold;">최고 온도</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; color: #e53e3e; font-weight: bold;">${maxTemp}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; font-weight: bold;">최저 온도</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; color: #3182ce; font-weight: bold;">${minTemp}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; font-weight: bold;">측정 범위</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0;">${temperatureRange}</td>
                </tr>
                <tr>
                    <td style="padding: 10px; border: 1px solid #e0e0e0; background: #f8f9fa; font-weight: bold;">총 측정 횟수</td>
                    <td style="padding: 10px; border: 1px solid #e0e0e0;">${data.data?.length || 0}회</td>
                </tr>
            </table>
        </div>

        <!-- 차트 영역 -->
        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; color: #667eea; margin-bottom: 15px;">온도 변화 그래프</h3>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; min-height: 300px;">
                <canvas id="pdf-temperature-chart" width="600" height="300"></canvas>
            </div>
        </div>

        ${generateAnalysisSectionHTML()}

        <!-- 생성 정보 -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center; color: #666; font-size: 12px;">
            <p>생성일시: ${new Date().toLocaleString('ko-KR')}</p>
            <p>© TempReco - NFC Temperature Label</p>
        </div>
    `;
}

// ===== 분석 섹션 HTML 생성 =====
function generateAnalysisSectionHTML() {
    // 분석 데이터가 있는지 확인
    const analysisData = window.tempAnalysisData || window.currentAnalysis;
    if (!analysisData) {
        return ''; // 분석 데이터가 없으면 빈 문자열 반환
    }

    const settings = currentData?.settings || {};
    const highThreshold = settings.maxTemp || 25;
    const lowThreshold = settings.minTemp || 5;

    return `
        <!-- 데이터 분석 결과 -->
        <div style="margin-bottom: 30px;">
            <h3 style="font-size: 18px; color: #667eea; margin-bottom: 15px;">📊 데이터 분석 결과</h3>
            
            <!-- 분석 요약 -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
                <div style="background: #fff5f5; border-left: 4px solid #e53e3e; padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 8px 0; color: #e53e3e; font-size: 14px;">⚠️ 고온 경고</h4>
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #e53e3e;">${analysisData.highTemp?.length || 0}건</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${highThreshold}°C 초과</p>
                </div>
                
                <div style="background: #f0f9ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 8px 0; color: #3182ce; font-size: 14px;">❄️ 저온 경고</h4>
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #3182ce;">${analysisData.lowTemp?.length || 0}건</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">${lowThreshold}°C 미만</p>
                </div>
                
                <div style="background: #fffbeb; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 8px 0; color: #f59e0b; font-size: 14px;">📈 급격한 변화</h4>
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #f59e0b;">${analysisData.rapidChange?.length || 0}건</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">5°C 이상 급변</p>
                </div>
                
                <div style="background: #f0fdf4; border-left: 4px solid #10b981; padding: 15px; border-radius: 8px;">
                    <h4 style="margin: 0 0 8px 0; color: #10b981; font-size: 14px;">✅ 정상 데이터</h4>
                    <p style="margin: 0; font-size: 20px; font-weight: bold; color: #10b981;">${analysisData.normalData?.length || 0}건</p>
                    <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">정상 범위 내</p>
                </div>
            </div>
            
            <!-- 장시간 이상 상태 -->
            ${analysisData.longPeriod?.length > 0 ? `
            <div style="background: #faf5ff; border: 1px solid #d8b4fe; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h4 style="margin: 0 0 10px 0; color: #7c3aed; font-size: 14px;">⏰ 장시간 이상 상태: ${analysisData.longPeriod.length}건</h4>
                ${analysisData.longPeriod.slice(0, 3).map(item => `
                    <p style="margin: 5px 0; font-size: 12px; color: #666;">
                        • ${item.startTime} ~ ${item.endTime} (${item.duration}회 연속)
                    </p>
                `).join('')}
                ${analysisData.longPeriod.length > 3 ? `
                    <p style="margin: 5px 0; font-size: 12px; color: #999; font-style: italic;">
                        외 ${analysisData.longPeriod.length - 3}건 더...
                    </p>
                ` : ''}
            </div>
            ` : ''}
            
            <!-- 분석 기준 -->
            <div style="background: #f8f9fa; padding: 12px; border-radius: 8px; border: 1px solid #e9ecef;">
                <h4 style="margin: 0 0 8px 0; color: #495057; font-size: 13px;">분석 기준</h4>
                <p style="margin: 0; font-size: 11px; color: #6c757d;">
                    • 고온 경고: ${highThreshold}°C 초과 | 저온 경고: ${lowThreshold}°C 미만<br>
                    • 급격한 변화: 연속 측정값 간 5°C 이상 차이 | 장시간 이상: 30회 이상 연속 임계값 초과
                </p>
            </div>
        </div>
    `;
}

// ===== PDF용 차트 생성 =====
async function createPDFChart(container) {
    return new Promise((resolve) => {
        const canvas = container.querySelector('#pdf-temperature-chart');
        if (!canvas || !currentData?.data) {
            resolve();
            return;
        }

        const ctx = canvas.getContext('2d');
        const temperatureData = currentData.data;

        // 데이터 준비
        const labels = temperatureData.map(item => {
            const time = item.time;
            if (time && time.includes(' ')) {
                return time.split(' ')[1];
            }
            return time || '-';
        });

        const temperatures = temperatureData.map(item => item.temperature);

        // 차트 데이터셋 준비
        const datasets = [{
            label: '온도 (°C)',
            data: temperatures,
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            tension: 0,
            borderWidth: 2,
            fill: false,
            pointRadius: 0
        }];

        // 범위 모드인 경우 기준선 추가
        if (currentChartMode === 'range' && currentData.settings.settingMinTemp !== undefined) {
            const minTemp = currentData.settings.settingMinTemp;
            const maxTemp = currentData.settings.settingMaxTemp;

            datasets.push(
                {
                    label: '최저 기준',
                    data: Array(labels.length).fill(minTemp),
                    borderColor: '#3182ce',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    borderWidth: 1
                },
                {
                    label: '최고 기준',
                    data: Array(labels.length).fill(maxTemp),
                    borderColor: '#e53e3e',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    borderWidth: 1
                }
            );
        }

        // PDF용 차트 생성
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                animation: {
                    duration: 0 // PDF용이므로 애니메이션 비활성화
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: '시간'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: '온도 (°C)'
                        }
                    }
                }
            }
        });

        // 차트 렌더링 대기
        setTimeout(resolve, 500);
    });
}

// ===== 로딩 표시 함수들 =====
function showPdfLoading(message = 'PDF 생성 중...', progress = 0) {
    showLoading(message);

    // PDF 전용 진행 상태 표시
    let progressElement = document.getElementById('pdfProgress');
    if (!progressElement) {
        const progressHtml = `
            <div class="pdf-progress show" id="pdfProgress">
                <div class="progress-text">${message}</div>
                <div class="progress-bar">
                    <div class="progress-fill" id="progressFill" style="width: ${progress}%"></div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', progressHtml);
    } else {
        updatePdfProgress(message, progress);
    }
}

function updatePdfProgress(message, percentage) {
    const progressText = document.querySelector('#pdfProgress .progress-text');
    const progressFill = document.getElementById('progressFill');

    if (progressText) {
        progressText.textContent = message;
    }

    if (progressFill) {
        progressFill.style.width = `${percentage}%`;
    }
}

function hidePdfLoading() {
    hideLoading();

    const pdfProgress = document.getElementById('pdfProgress');
    if (pdfProgress) {
        pdfProgress.classList.remove('show');
        setTimeout(() => {
            pdfProgress.remove();
        }, 300);
    }
}

// ===== 보조 함수들 =====
function getMeasurementStatusText(status) {
    switch (String(status)) {
        case "0": return "대기 (측정 시작 전)";
        case "1": return "측정 중 (현재 온도 로깅 진행 중)";
        case "2": return "태그가 측정중인 상태가 아닙니다.";
        case "3": return "정상 완료 (모든 측정이 완료됨)";
        default: return "알 수 없음";
    }
}
function getMeasurementStatusTextEng(status) {
   switch (String(status)) {
       case "0": return "Standby (Before measurement start)";
       case "1": return "Measuring (Temperature logging in progress)";
       case "2": return "The tag is not in a measuring state.";
       case "3": return "Completed (All measurements completed)";
       default: return "Unknown";
   }
}
// ===== 내보내기 버튼 이벤트 =====
function onPDFButtonClick() {
    if (!currentData || !currentData.data) {
        showToast('내보낼 데이터가 없습니다.');
        return;
    }

    if (window.Android && window.Android.savePdfFromBase64) {
        // Android 앱에서 실행 중
        generatePDFReport();
    } else {
        // 웹 브라우저에서 실행 중 - 직접 다운로드
        downloadPDFDirectly();
    }
}

// 웹 브라우저용 직접 다운로드
async function downloadPDFDirectly() {
    try {
        showPdfLoading('PDF 생성 준비 중...', 10);

        const pdfContainer = document.createElement('div');
        pdfContainer.id = 'pdf-export-container';
        pdfContainer.style.cssText = `
            position: absolute;
            left: -9999px;
            width: 210mm;
            min-height: 297mm;
            padding: 15mm;
            background: white;
            font-family: 'Malgun Gothic', 'Arial', sans-serif;
            color: #333;
        `;

        const pdfContent = createPDFContent();
        pdfContainer.innerHTML = pdfContent;
        document.body.appendChild(pdfContainer);

        showPdfLoading('차트 생성 중...', 30);
        await createPDFChart(pdfContainer);

        showPdfLoading('PDF 변환 중...', 60);

        const tagId = currentData?.uid || 'unknown';
        const date = new Date().toISOString().split('T')[0];
        const fileName = `Report_${tagId}_${date}.pdf`;

        const opt = {
            margin: [10, 10, 10, 10],
            filename: fileName,
            image: {
                type: 'jpeg',
                quality: 0.95
            },
            html2canvas: {
                scale: 2,
                useCORS: true,
                logging: false
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            }
        };

        showPdfLoading('PDF 저장 중...', 80);

        // 브라우저에서 직접 다운로드
        await html2pdf().set(opt).from(pdfContainer).save();

        document.body.removeChild(pdfContainer);
        hidePdfLoading();
        showToast('PDF가 다운로드되었습니다');

    } catch (error) {
        console.error('PDF 생성 실패:', error);
        hidePdfLoading();
        showToast('PDF 생성에 실패했습니다');
    }
}

// 파일 저장 성공 콜백 - 공유 옵션 포함
window.onFileSaveSuccess = function(fileName, filePath, fileType) {
    console.log('파일 저장 성공:', fileName, filePath, fileType);

    let message = '';
    let mimeType = '';

    switch (fileType) {
        case 'pdf':
            message = `PDF 저장 완료`;
            mimeType = 'application/pdf';
            break;
        case 'csv':
            message = `Excel 저장 완료`;
            mimeType = 'text/csv';
            break;
        case 'image':
            message = `이미지 저장 완료`;
            mimeType = 'image/png';
            break;
    }

    // 공유 버튼이 있는 알림 표시
    showSuccessNotificationWithShare(message, fileName, filePath, mimeType);

    // 최근 저장 파일 정보 저장
    window.lastSavedFile = {
        fileName: fileName,
        filePath: filePath,
        fileType: fileType,
        mimeType: mimeType,
        savedAt: new Date().toISOString()
    };
};

// 공유 버튼이 있는 성공 알림
function showSuccessNotificationWithShare(message, fileName, filePath, mimeType) {
    const notification = document.createElement('div');
    notification.className = 'file-save-notification';

    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon"></div>
            <div class="notification-text">
                <div class="notification-message">${message}</div>
                <div class="notification-filename">${fileName}</div>
            </div>
        </div>
        <div class="notification-actions">
            <button class="notification-btn share-btn" onclick="shareFile('${filePath}', '${mimeType}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                공유
            </button>
            <button class="notification-btn close-btn" onclick="closeNotification(this)">
                닫기
            </button>
        </div>
    `;

    document.body.appendChild(notification);

    // 애니메이션
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    return false;

    // 자동 제거 타이머
    const autoCloseTimer = setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.classList.remove('show');
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }
    }, 10000); // 10초 후 자동 제거

    // 타이머 정보 저장
    notification.dataset.timerId = autoCloseTimer;
}

// 파일 공유 함수
function shareFile(filePath, mimeType) {
    console.log('Sharing file:', filePath, mimeType);

    if (window.Android && window.Android.shareFile) {
        window.Android.shareFile(filePath, mimeType);
    } else {
        showToast('공유 기능을 사용할 수 없습니다.');
    }
}

// 알림 닫기
function closeNotification(button) {
    const notification = button.closest('.file-save-notification');
    if (notification) {
        // 자동 제거 타이머 취소
        const timerId = notification.dataset.timerId;
        if (timerId) {
            clearTimeout(parseInt(timerId));
        }

        notification.classList.remove('show');
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }
}

// 내보내기 버튼 이벤트 업데이트 - 터치 제스처 지원
function updateExportButtons() {
    // PDF 버튼
    const pdfBtn = document.querySelector('.pdf-btn');
    if (pdfBtn) {
        // 기본 클릭 - 저장만
        pdfBtn.onclick = (e) => {
            e.preventDefault();
            generatePDFReport(false);
        };

        // 길게 누르기 감지
        let longPressTimer;
        let isLongPress = false;

        const startLongPress = (e) => {
            isLongPress = false;
            longPressTimer = setTimeout(() => {
                isLongPress = true;
                // 진동 피드백 (지원하는 경우)
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                // 저장 후 자동 공유
                generatePDFReport(true);
            }, 800); // 0.8초
        };

        const cancelLongPress = () => {
            clearTimeout(longPressTimer);
            if (!isLongPress) {
                // 짧은 터치는 onclick에서 처리
            }
        };

        // 터치 이벤트
        pdfBtn.addEventListener('touchstart', startLongPress, { passive: true });
        pdfBtn.addEventListener('touchend', cancelLongPress);
        pdfBtn.addEventListener('touchcancel', cancelLongPress);

        // 마우스 이벤트 (데스크톱)
        pdfBtn.addEventListener('mousedown', startLongPress);
        pdfBtn.addEventListener('mouseup', cancelLongPress);
        pdfBtn.addEventListener('mouseleave', cancelLongPress);

        // 툴팁 추가
        pdfBtn.title = '클릭: PDF 저장\n길게 누르기: 저장 후 공유';
    }

    // Excel 버튼
    const excelBtn = document.querySelector('.excel-btn');
    if (excelBtn) {
        excelBtn.onclick = (e) => {
            e.preventDefault();
            exportToExcelViaAndroid(false);
        };

        // Excel 버튼도 동일한 길게 누르기 기능 추가
        let excelLongPressTimer;
        let isExcelLongPress = false;

        const startExcelLongPress = (e) => {
            isExcelLongPress = false;
            excelLongPressTimer = setTimeout(() => {
                isExcelLongPress = true;
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
                exportToExcelViaAndroid(true);
            }, 800);
        };

        const cancelExcelLongPress = () => {
            clearTimeout(excelLongPressTimer);
        };

        excelBtn.addEventListener('touchstart', startExcelLongPress, { passive: true });
        excelBtn.addEventListener('touchend', cancelExcelLongPress);
        excelBtn.addEventListener('touchcancel', cancelExcelLongPress);
        excelBtn.addEventListener('mousedown', startExcelLongPress);
        excelBtn.addEventListener('mouseup', cancelExcelLongPress);
        excelBtn.addEventListener('mouseleave', cancelExcelLongPress);

        excelBtn.title = '클릭: Excel 저장\n길게 누르기: 저장 후 공유';
    }
}

// 웹 브라우저용 직접 다운로드 함수들
function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, fileName);
    } else {
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        link.click();
        URL.revokeObjectURL(link.href);
    }
}
// 권한 체크 및 요청 예시
function checkAndRequestPermission() {
    if (window.Android && window.Android.hasStoragePermission) {
        if (!window.Android.hasStoragePermission()) {
            // 권한이 없으면 요청
            window.Android.requestStoragePermission();
        } else {
            // 권한이 있으면 파일 작업 진행
            proceedWithFileOperation();
        }
    } else {
        // 웹 환경이거나 Android 인터페이스가 없는 경우
        proceedWithFileOperation();
    }
}

// 권한 허용 콜백
window.onStoragePermissionGranted = function() {
    console.log('Storage permission granted');
    showToast('이제 파일을 저장할 수 있습니다');
    // 대기 중이던 작업 실행
    proceedWithFileOperation();
};

// 권한 거부 콜백
window.onStoragePermissionDenied = function() {
    console.log('Storage permission denied');
    showToast('파일 저장 권한이 거부되었습니다');
};

// 전역 함수 등록
window.generatePDFReport = generatePDFReport;
window.exportToExcelViaAndroid = exportToExcelViaAndroid;
window.shareFile = shareFile;
window.closeNotification = closeNotification;


window.onPDFButtonClick = onPDFButtonClick;
window.exportToPDFViaAndroid = generatePDFReport; // 별칭