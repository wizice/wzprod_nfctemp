// ===== 온도 데이터 분석 및 페이지네이션 확장 기능 =====

// 온도 데이터 파싱 헬퍼 함수
function getTemperatureData() {
    if (!currentData) return null;
    
    let chartData = currentData.data || currentData.temperatureData;
    if (typeof chartData === 'string') {
        try {
            chartData = JSON.parse(chartData);
        } catch(e) {
            console.error('Failed to parse chart data:', e);
            return null;
        }
    }
    
    return chartData && chartData.length > 0 ? chartData : null;
}

// 데이터 탭 전환
function switchDataTab(tabType) {
    // 탭 버튼 상태 변경
    document.querySelectorAll('.data-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    if (tabType === 'all') {
        document.getElementById('allDataTab').classList.add('active');
        document.getElementById('allDataContent').classList.add('active');
        document.querySelector('.data-tabs').classList.remove('analysis-mode');
    } else if (tabType === 'analysis') {
        document.getElementById('analysisTab').classList.add('active');
        document.getElementById('analysisContent').classList.add('active');
        document.querySelector('.data-tabs').classList.add('analysis-mode');
        
        // 분석 데이터 업데이트
        updateAnalysisData();
    }
}

// 페이지네이션 확장 함수들
function goToFirstPage() {
    if (currentTablePage > 1) {
        currentTablePage = 1;
        // 기존 updateDataTable 함수 활용
        if (typeof updateDataTable === 'function') {
            const chartData = getTemperatureData();
            if (chartData) {
                updateDataTable(chartData);
            }
        }
    }
}

function goToLastPage() {
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    if (currentTablePage < totalPages) {
        currentTablePage = totalPages;
        // 기존 updateDataTable 함수 활용
        if (typeof updateDataTable === 'function') {
            const chartData = getTemperatureData();
            if (chartData) {
                updateDataTable(chartData);
            }
        }
    }
}

// 분석 데이터 업데이트
function updateAnalysisData() {
    const chartData = getTemperatureData();
    if (!chartData) {
        return;
    }
    
    const settings = currentData.settings || {};
    
    // 임계값 설정 (기본값 사용)
    const highThreshold = settings.maxTemp || 25; // 기본 25°C
    const lowThreshold = settings.minTemp || 5;   // 기본 5°C
    const rapidChangeThreshold = 5; // 5°C 이상 급변
    const longPeriodThreshold = 30; // 30분 이상 연속
    
    // 분석 수행
    const analysis = performTemperatureAnalysis(chartData, {
        highThreshold,
        lowThreshold,
        rapidChangeThreshold,
        longPeriodThreshold
    });
    
    // UI 업데이트
    document.getElementById('highTempCount').textContent = `${analysis.highTemp.length}건`;
    document.getElementById('lowTempCount').textContent = `${analysis.lowTemp.length}건`;
    document.getElementById('rapidChangeCount').textContent = `${analysis.rapidChange.length}건`;
    document.getElementById('longPeriodCount').textContent = `${analysis.longPeriod.length}건`;
    document.getElementById('normalDataCount').textContent = `${analysis.normalData.length}건`;
    
    // 분석 결과 저장 (전역 변수)
    window.currentAnalysis = analysis;
}

// 온도 데이터 분석 수행
function performTemperatureAnalysis(data, thresholds) {
    const analysis = {
        highTemp: [],
        lowTemp: [],
        rapidChange: [],
        longPeriod: [],
        normalData: []
    };
    
    // 고온/저온 경고 검사 및 정상 데이터 검사
    data.forEach((point, index) => {
        if (point.temperature > thresholds.highThreshold) {
            analysis.highTemp.push({
                index: index + 1,
                time: point.time,
                temperature: point.temperature,
                type: '고온 경고',
                description: `${thresholds.highThreshold}°C 초과`
            });
        } else if (point.temperature < thresholds.lowThreshold) {
            analysis.lowTemp.push({
                index: index + 1,
                time: point.time,
                temperature: point.temperature,
                type: '저온 경고',
                description: `${thresholds.lowThreshold}°C 미만`
            });
        } else {
            // 정상 범위 데이터
            analysis.normalData.push({
                index: index + 1,
                time: point.time,
                temperature: point.temperature,
                type: '정상',
                description: `정상범위 (${thresholds.lowThreshold}~${thresholds.highThreshold}°C)`
            });
        }
    });
    
    // 급격한 온도 변화 검사
    for (let i = 1; i < data.length; i++) {
        const tempDiff = Math.abs(data[i].temperature - data[i-1].temperature);
        if (tempDiff >= thresholds.rapidChangeThreshold) {
            analysis.rapidChange.push({
                index: i + 1,
                time: data[i].time,
                temperature: data[i].temperature,
                previousTemp: data[i-1].temperature,
                difference: tempDiff.toFixed(1),
                type: '급격한 변화',
                description: `${tempDiff.toFixed(1)}°C 급변`
            });
        }
    }
    
    // 장시간 임계값 유지 검사 (연속된 이상값)
    let consecutiveCount = 0;
    let consecutiveStart = null;
    
    for (let i = 0; i < data.length; i++) {
        const temp = data[i].temperature;
        const isAbnormal = temp > thresholds.highThreshold || temp < thresholds.lowThreshold;
        
        if (isAbnormal) {
            if (consecutiveCount === 0) {
                consecutiveStart = i;
            }
            consecutiveCount++;
        } else {
            if (consecutiveCount >= thresholds.longPeriodThreshold) {
                analysis.longPeriod.push({
                    startIndex: consecutiveStart + 1,
                    endIndex: consecutiveStart + consecutiveCount,
                    startTime: data[consecutiveStart].time,
                    endTime: data[consecutiveStart + consecutiveCount - 1].time,
                    duration: consecutiveCount,
                    type: '장시간 이상',
                    description: `${consecutiveCount}회 연속 임계값 이상`
                });
            }
            consecutiveCount = 0;
        }
    }
    
    // 마지막까지 연속된 경우 처리
    if (consecutiveCount >= thresholds.longPeriodThreshold) {
        analysis.longPeriod.push({
            startIndex: consecutiveStart + 1,
            endIndex: consecutiveStart + consecutiveCount,
            startTime: data[consecutiveStart].time,
            endTime: data[consecutiveStart + consecutiveCount - 1].time,
            duration: consecutiveCount,
            type: '장시간 이상',
            description: `${consecutiveCount}회 연속 임계값 이상`
        });
    }
    
    return analysis;
}

// 분석 세부 내용 표시
function showAnalysisDetail(analysisType) {
    if (!window.currentAnalysis) return;
    
    const analysisData = window.currentAnalysis[analysisType];
    if (!analysisData || analysisData.length === 0) {
        alert('해당 분석 항목에 대한 데이터가 없습니다.');
        return;
    }
    
    // 카드에 로딩 상태 표시
    const card = document.getElementById(analysisType + 'Card') || document.getElementById(analysisType.replace('Data', '') + 'Card');
    if (card) {
        showCardLoading(card);
    }
    
    // 데이터가 많은 경우 비동기 처리
    if (analysisData.length > 1000) {
        setTimeout(() => {
            renderAnalysisDetail(analysisType, analysisData);
            if (card) hideCardLoading(card);
        }, 10);
    } else {
        renderAnalysisDetail(analysisType, analysisData);
        if (card) hideCardLoading(card);
    }
}

// 분석 세부 내용 렌더링
function renderAnalysisDetail(analysisType, analysisData) {
    
    const titles = {
        highTemp: '고온 경고 상세 내역',
        lowTemp: '저온 경고 상세 내역',
        rapidChange: '급격한 온도 변화 상세 내역',
        longPeriod: '장시간 이상 상태 상세 내역',
        normalData: '정상 데이터 상세 내역'
    };
    
    // 테이블 헤더 설정
    const headers = {
        highTemp: ['측정 정보', '상태'],
        lowTemp: ['측정 정보', '상태'],
        rapidChange: ['측정 정보', '이전 온도', '변화량', '상태'],
        longPeriod: ['시작 정보', '종료 정보', '지속 횟수', '상태'],
        normalData: ['측정 정보', '상태']
    };
    
    // 테이블 생성
    createAnalysisDetailTable(analysisData, headers[analysisType]);
    
    // 제목 설정 및 표시
    document.getElementById('detailTitle').textContent = titles[analysisType];
    document.getElementById('analysisDetail').style.display = 'block';
    
    // Floating 닫기 버튼 표시
    showFloatingCloseButton();
    
    // 스크롤 이동
    document.getElementById('analysisDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 카드 로딩 표시
function showCardLoading(card) {
    const loadingElement = document.createElement('div');
    loadingElement.className = 'card-loading';
    loadingElement.innerHTML = '<div class="loading-spinner"></div>';
    card.appendChild(loadingElement);
    card.style.pointerEvents = 'none';
}

// 카드 로딩 숨기기
function hideCardLoading(card) {
    const loadingElement = card.querySelector('.card-loading');
    if (loadingElement) {
        loadingElement.remove();
    }
    card.style.pointerEvents = 'auto';
}

// Floating 닫기 버튼 표시
function showFloatingCloseButton() {
    let floatingBtn = document.getElementById('floatingCloseBtn');
    if (!floatingBtn) {
        floatingBtn = document.createElement('button');
        floatingBtn.id = 'floatingCloseBtn';
        floatingBtn.className = 'floating-close-btn';
        floatingBtn.innerHTML = '×';
        floatingBtn.onclick = hideAnalysisDetail;
        floatingBtn.setAttribute('aria-label', '상세 내용 닫기');
        document.body.appendChild(floatingBtn);
    }
    floatingBtn.style.display = 'block';
}

// Floating 닫기 버튼 숨기기
function hideFloatingCloseButton() {
    const floatingBtn = document.getElementById('floatingCloseBtn');
    if (floatingBtn) {
        floatingBtn.style.display = 'none';
    }
}

// 분석 세부 테이블 생성
function createAnalysisDetailTable(data, headers) {
    const headerElement = document.getElementById('analysisDetailHeader');
    const bodyElement = document.getElementById('analysisDetailBody');
    
    // 헤더 생성
    headerElement.innerHTML = '';
    const headerRow = document.createElement('tr');
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    headerElement.appendChild(headerRow);
    
    // 바디 생성
    bodyElement.innerHTML = '';
    data.forEach(item => {
        const row = document.createElement('tr');
        
        if (item.startIndex !== undefined) {
            // 장시간 이상 상태
            row.innerHTML = `
                <td class="measurement-info-cell">
                    <div class="measurement-number">#${item.startIndex}</div>
                    <div class="measurement-time">${item.startTime}</div>
                </td>
                <td class="measurement-info-cell">
                    <div class="measurement-number">#${item.endIndex}</div>
                    <div class="measurement-time">${item.endTime}</div>
                </td>
                <td class="duration-cell">${item.duration}회</td>
                <td><span class="status-warning">${item.description}</span></td>
            `;
        } else if (item.previousTemp !== undefined) {
            // 급격한 변화
            row.innerHTML = `
                <td class="measurement-info-cell">
                    <div class="measurement-header">
                        <span class="measurement-number">#${item.index}</span>
                        <span class="measurement-temp">${item.temperature}°C</span>
                    </div>
                    <div class="measurement-time">${item.time}</div>
                </td>
                <td class="prev-temp-cell">${item.previousTemp}°C</td>
                <td class="change-cell">${item.difference}°C</td>
                <td><span class="status-warning">${item.description}</span></td>
            `;
        } else {
            // 고온/저온 경고 및 정상 데이터
            let statusClass;
            if (item.type === '고온 경고') {
                statusClass = 'status-critical';
            } else if (item.type === '저온 경고') {
                statusClass = 'status-normal';
            } else if (item.type === '정상') {
                statusClass = 'status-success';
            } else {
                statusClass = 'status-normal';
            }
            
            row.innerHTML = `
                <td class="measurement-info-cell">
                    <div class="measurement-header">
                        <span class="measurement-number">#${item.index}</span>
                        <span class="measurement-temp">${item.temperature}°C</span>
                    </div>
                    <div class="measurement-time">${item.time}</div>
                </td>
                <td><span class="${statusClass}">${item.description}</span></td>
            `;
        }
        
        bodyElement.appendChild(row);
    });
}

// 분석 세부 내용 숨기기
function hideAnalysisDetail() {
    document.getElementById('analysisDetail').style.display = 'none';
    hideFloatingCloseButton();
}

// 분석 리포트 내보내기 (전용 PDF 생성)
async function exportAnalysisReport() {
    if (!window.currentAnalysis) {
        alert('분석할 데이터가 없습니다.');
        return;
    }
    
    try {
        // 로딩 표시
        if (typeof showPdfLoading === 'function') {
            showPdfLoading('분석 리포트 생성 중...', 10);
        }
        
        // 분석 전용 PDF 생성
        await generateAnalysisOnlyPDF();
        
    } catch (error) {
        console.error('분석 리포트 생성 오류:', error);
        alert('분석 리포트 생성 중 오류가 발생했습니다.');
        
        if (typeof hidePdfLoading === 'function') {
            hidePdfLoading();
        }
    }
}

// 분석 데이터 전용 PDF 생성
async function generateAnalysisOnlyPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // 진행률 업데이트
    if (typeof updatePdfProgress === 'function') {
        updatePdfProgress('분석 리포트 생성 중...', 25);
    }
    
    // PDF 내용 생성
    const analysisHTML = generateAnalysisReportHTML();
    
    // HTML을 임시 컨테이너에 추가
    const tempContainer = document.createElement('div');
    tempContainer.innerHTML = analysisHTML;
    tempContainer.style.cssText = `
        position: absolute;
        left: -9999px;
        top: -9999px;
        width: 800px;
        background: white;
        padding: 20px;
        font-family: 'Noto Sans KR', sans-serif;
    `;
    document.body.appendChild(tempContainer);
    
    try {
        // 진행률 업데이트
        if (typeof updatePdfProgress === 'function') {
            updatePdfProgress('PDF 변환 중...', 50);
        }
        
        // html2pdf를 사용하여 PDF 생성
        if (window.html2pdf) {
            const element = tempContainer;
            const opt = {
                margin: [15, 15, 15, 15],
                filename: `AnalysisReport_${currentData?.uid || 'unknown'}_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };
            
            // PDF 생성 및 저장
            const pdfBlob = await html2pdf().set(opt).from(element).outputPdf('blob');
            
            // 진행률 업데이트
            if (typeof updatePdfProgress === 'function') {
                updatePdfProgress('파일 저장 중...', 75);
            }
            
            // Android에서 공유
            if (window.Android && window.Android.savePdfFromBase64) {
                const reader = new FileReader();
                reader.onload = function() {
                    const base64Data = reader.result.split(',')[1];
                    const fileName = `AnalysisReport_${currentData?.uid || 'unknown'}_${new Date().toISOString().split('T')[0]}.pdf`;
                    
                    // 기존과 동일한 메타데이터 구조 사용
                    const metadata = {
                        fileName: fileName,
                        fileSize: base64Data.length,
                        mimeType: 'application/pdf',
                        tagId: currentData?.uid || 'unknown',
                        measurementCount: currentData?.data?.length || 0,
                        measurementStatus: currentData?.measurementStatus || '0',
                        createdAt: new Date().toISOString(),
                        autoShare: true,  // 자동 공유 활성화
                        reportType: 'analysis'  // 분석 리포트 구분
                    };
                    
                    window.Android.savePdfFromBase64(base64Data, JSON.stringify(metadata));
                };
                reader.readAsDataURL(pdfBlob);
            } else {
                // 웹에서 직접 다운로드
                const url = URL.createObjectURL(pdfBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = opt.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            // 진행률 완료
            if (typeof updatePdfProgress === 'function') {
                updatePdfProgress('완료!', 100);
            }
            
            setTimeout(() => {
                if (typeof hidePdfLoading === 'function') {
                    hidePdfLoading();
                }
            }, 1000);
            
        } else {
            throw new Error('PDF 생성 라이브러리를 찾을 수 없습니다.');
        }
        
    } finally {
        // 임시 컨테이너 제거
        document.body.removeChild(tempContainer);
    }
}

// 분석 리포트 전용 HTML 생성
function generateAnalysisReportHTML() {
    const analysisData = window.currentAnalysis;
    const data = currentData || {};
    const settings = data.settings || {};
    const highThreshold = settings.maxTemp || 25;
    const lowThreshold = settings.minTemp || 5;
    
    // 기본 정보
    const measurementStatus = getMeasurementStatusText ? getMeasurementStatusText(data.measurementStatus || "0") : "측정 완료";
    const measurementStartTime = data.measurementStartTime || '-';
    const intervalTime = data.intervalTime || data.interval;
    const totalMeasurements = data.data?.length || 0;
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body { 
                    font-family: 'Noto Sans KR', Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #333;
                    margin: 0;
                    padding: 20px;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px; 
                    border-bottom: 3px solid #667eea; 
                    padding-bottom: 20px; 
                }
                .header h1 { 
                    font-size: 32px; 
                    margin: 0; 
                    color: #667eea; 
                    font-weight: bold;
                }
                .header p { 
                    font-size: 16px; 
                    margin: 5px 0; 
                    color: #666; 
                }
                .header h2 { 
                    font-size: 24px; 
                    margin: 20px 0 5px 0; 
                    color: #333; 
                }
                .section { 
                    margin-bottom: 30px; 
                }
                .section h3 { 
                    font-size: 20px; 
                    color: #667eea; 
                    margin-bottom: 15px; 
                    border-left: 4px solid #667eea;
                    padding-left: 12px;
                }
                .basic-info { 
                    background: #f8f9fa; 
                    padding: 20px; 
                    border-radius: 8px; 
                    margin-bottom: 20px;
                }
                .analysis-grid { 
                    display: grid; 
                    grid-template-columns: 1fr 1fr; 
                    gap: 20px; 
                    margin-bottom: 25px; 
                }
                .analysis-card { 
                    padding: 20px; 
                    border-radius: 12px; 
                    text-align: center;
                }
                .analysis-card h4 { 
                    margin: 0 0 10px 0; 
                    font-size: 16px; 
                    font-weight: bold;
                }
                .analysis-card .count { 
                    font-size: 36px; 
                    font-weight: bold; 
                    margin: 10px 0; 
                }
                .analysis-card .desc { 
                    font-size: 14px; 
                    opacity: 0.8; 
                    margin: 5px 0 0 0;
                }
                .high-temp { 
                    background: #fff5f5; 
                    border: 2px solid #e53e3e; 
                    color: #e53e3e; 
                }
                .low-temp { 
                    background: #f0f9ff; 
                    border: 2px solid #3182ce; 
                    color: #3182ce; 
                }
                .rapid-change { 
                    background: #fffbeb; 
                    border: 2px solid #f59e0b; 
                    color: #f59e0b; 
                }
                .normal-data { 
                    background: #f0fdf4; 
                    border: 2px solid #10b981; 
                    color: #10b981; 
                }
                .long-period { 
                    background: #faf5ff; 
                    border: 2px solid #7c3aed; 
                    color: #7c3aed; 
                    grid-column: 1 / -1;
                    text-align: left;
                }
                .detail-table { 
                    width: 100%; 
                    border-collapse: collapse; 
                    margin-top: 15px;
                }
                .detail-table th, .detail-table td { 
                    padding: 12px; 
                    text-align: left; 
                    border: 1px solid #e0e0e0; 
                }
                .detail-table th { 
                    background: #f8f9fa; 
                    font-weight: bold; 
                }
                .criteria { 
                    background: #f8f9fa; 
                    padding: 15px; 
                    border-radius: 8px; 
                    border: 1px solid #e9ecef;
                    font-size: 14px;
                    color: #6c757d;
                }
                .footer { 
                    margin-top: 40px; 
                    padding-top: 20px; 
                    border-top: 1px solid #e0e0e0; 
                    text-align: center; 
                    color: #666; 
                    font-size: 12px; 
                }
            </style>
        </head>
        <body>
            <!-- 헤더 -->
            <div class="header">
                <h1>🌡️ TempReco</h1>
                <p>NFC 온도기록라벨</p>
                <h2>📊 온도 데이터 분석 리포트</h2>
            </div>

            <!-- 기본 정보 -->
            <div class="section">
                <h3>📋 기본 정보</h3>
                <div class="basic-info">
                    <table class="detail-table">
                        <tr>
                            <td style="font-weight: bold; width: 25%;">태그 ID</td>
                            <td>${data.uid || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">측정 상태</td>
                            <td>${measurementStatus}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">측정 시작</td>
                            <td>${measurementStartTime}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">측정 간격</td>
                            <td>${intervalTime ? Math.floor(intervalTime/60) + '분' : '-'}</td>
                        </tr>
                        <tr>
                            <td style="font-weight: bold;">총 측정 횟수</td>
                            <td>${totalMeasurements}회</td>
                        </tr>
                    </table>
                </div>
            </div>

            <!-- 분석 결과 -->
            <div class="section">
                <h3>🔍 분석 결과</h3>
                <div class="analysis-grid">
                    <div class="analysis-card high-temp">
                        <h4>⚠️ 고온 경고</h4>
                        <div class="count">${analysisData.highTemp?.length || 0}</div>
                        <div class="desc">${highThreshold}°C 초과</div>
                    </div>
                    
                    <div class="analysis-card low-temp">
                        <h4>❄️ 저온 경고</h4>
                        <div class="count">${analysisData.lowTemp?.length || 0}</div>
                        <div class="desc">${lowThreshold}°C 미만</div>
                    </div>
                    
                    <div class="analysis-card rapid-change">
                        <h4>📈 급격한 변화</h4>
                        <div class="count">${analysisData.rapidChange?.length || 0}</div>
                        <div class="desc">5°C 이상 급변</div>
                    </div>
                    
                    <div class="analysis-card normal-data">
                        <h4>✅ 정상 데이터</h4>
                        <div class="count">${analysisData.normalData?.length || 0}</div>
                        <div class="desc">정상 범위 내</div>
                    </div>
                    
                    ${analysisData.longPeriod?.length > 0 ? `
                    <div class="analysis-card long-period">
                        <h4>⏰ 장시간 이상 상태: ${analysisData.longPeriod.length}건</h4>
                        <table class="detail-table" style="margin-top: 15px;">
                            <thead>
                                <tr>
                                    <th>시작 시간</th>
                                    <th>종료 시간</th>
                                    <th>지속 시간</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${analysisData.longPeriod.slice(0, 5).map(item => `
                                    <tr>
                                        <td>${item.startTime}</td>
                                        <td>${item.endTime}</td>
                                        <td>${item.duration}회 연속</td>
                                    </tr>
                                `).join('')}
                                ${analysisData.longPeriod.length > 5 ? `
                                    <tr>
                                        <td colspan="3" style="text-align: center; font-style: italic; color: #999;">
                                            외 ${analysisData.longPeriod.length - 5}건 더...
                                        </td>
                                    </tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                    ` : ''}
                </div>
            </div>

            <!-- 분석 기준 -->
            <div class="section">
                <h3>📏 분석 기준</h3>
                <div class="criteria">
                    <strong>온도 임계값:</strong><br>
                    • 고온 경고: ${highThreshold}°C 초과<br>
                    • 저온 경고: ${lowThreshold}°C 미만<br>
                    • 정상 범위: ${lowThreshold}°C ~ ${highThreshold}°C<br><br>
                    
                    <strong>이상 패턴 감지:</strong><br>
                    • 급격한 변화: 연속 측정값 간 5°C 이상 차이<br>
                    • 장시간 이상: 30회 이상 연속으로 임계값을 벗어난 경우
                </div>
            </div>

            <!-- 푸터 -->
            <div class="footer">
                <p><strong>생성일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
                <p>© TempReco - NFC Temperature Analysis Report</p>
            </div>
        </body>
        </html>
    `;
}

// 전역 함수로 등록 (기존 함수들과 충돌 방지)
window.switchDataTab = switchDataTab;
window.showAnalysisDetail = showAnalysisDetail;
window.hideAnalysisDetail = hideAnalysisDetail;
window.goToFirstPage = goToFirstPage;
window.goToLastPage = goToLastPage;
window.exportAnalysisReport = exportAnalysisReport;