// admin_tags.js - 태그 관리 기능 (개선된 버전)

let currentUser = null;
let tagList = [];
let currentPage = 0;
let pageSize = 50;  // 기본값
let totalCount = 0;
let managementGroups = [];
let editingUid = null;
let selectedTags = new Set();
let bulkMode = false;
let isLoading = false;
let lastLoadTime = 0;

// 페이지네이션 상태 관리
let paginationState = {
    currentPage: 0,
    pageSize: 20,
    totalCount: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false,
    pageCache: new Map(), // 페이지별 데이터 캐시
    lastFilters: null
};


// 필터 상태 저장
let currentFilters = {
    groupFilter: '',
    statusFilter: '',
    searchFilter: ''
};
// 필터가 변경되었는지 확인
function filtersChanged(newFilters) {
    return JSON.stringify(newFilters) !== JSON.stringify(paginationState.lastFilters);
}

// 태그 로드 - 개선된 버전
function loadTagsOptimized(page = 0) {
    if (isLoading) {
        console.log('Already loading tags, skipping...');
        return;
    }

    // 필터 값 가져오기
    const newFilters = {
        groupFilter: $('#groupFilter').val() || '',
        statusFilter: $('#statusFilter').val() || '',
        searchFilter: $('#searchUid').val().trim() || '',
        updateFilter: $('#updateDate').val() || '',
    };

    if ( !newFilters.updateFilter  || newFilters.updateFilter == '' ){
        showToast('등록일을 입력바랍니다.', 'error');
        return false;
    }

    // 필터가 변경되면 캐시 초기화
    if (filtersChanged(newFilters)) {
        paginationState.pageCache.clear();
        paginationState.lastFilters = newFilters;
        page = 0; // 필터 변경시 첫 페이지로
    }


    // 캐시된 데이터가 있으면 사용
    const cacheKey = `page-${page}`;
    if (paginationState.pageCache.has(cacheKey)) {
        console.log(`Using cached data for page ${page}`);
        const cachedData = paginationState.pageCache.get(cacheKey);
        displayTags(cachedData);
        updatePaginationControls();
        return;
    }

    paginationState.currentPage = page;
    isLoading = true;
    showLoading(true);

    // Step 1: Count 조회 (첫 페이지나 필터 변경시만)
    if (page === 0 || paginationState.totalCount === 0) {
        getTagsCountOptimized(newFilters, () => {
            // Count 조회 완료 후 데이터 로드
            loadTagsData(page, newFilters);
        });
    } else {
        // Count가 이미 있으면 바로 데이터 로드
        loadTagsData(page, newFilters);
    }
}

// 태그 목록 표시
function displayTags(tags) {
    tagList = tags;
    renderTagTable();
}

// 페이지네이션 컨트롤 업데이트
function updatePaginationControls() {
    const { currentPage, totalPages } = paginationState;

    paginationState.hasPrev = currentPage > 0;
    paginationState.hasNext = currentPage < totalPages - 1;

    // 페이지 정보 표시
    $('#pageInfo').text(`${currentPage + 1} / ${totalPages}`);

    // 버튼 상태 업데이트
    $('#prevPageBtn').prop('disabled', !paginationState.hasPrev);
    $('#nextPageBtn').prop('disabled', !paginationState.hasNext);

    // 페이지 점프 옵션
    updatePageJumpOptions();
}

// 페이지 점프 옵션 업데이트
function updatePageJumpOptions() {
    const $pageJump = $('#pageJump');
    $pageJump.empty();

    for (let i = 0; i < paginationState.totalPages; i++) {
        $pageJump.append(`<option value="${i}">${i + 1} 페이지</option>`);
    }

    $pageJump.val(paginationState.currentPage);
}

// Count 표시 업데이트
function updateCountDisplay() {
    const { totalCount, groupFilter, statusFilter, searchFilter, updateFilter } = paginationState;

    let countText = `전체: ${totalCount}개`;

    // 필터 정보 추가
    const filters = [];
    if (groupFilter && groupFilter !== 'all') filters.push(`그룹: ${groupFilter}`);
    if (statusFilter && statusFilter !== 'all') filters.push(`상태: ${statusFilter === 'active' ? '활성' : '비활성'}`);
    if (searchFilter) filters.push(`검색: ${searchFilter}`);
    if (updateFilter) filters.push(`날짜: ${updateFilter} 이후`);

    if (filters.length > 0) {
        countText += ` (${filters.join(', ')})`;
    }

    $('#totalCount').text(countText);
}

// 이전 페이지
function prevPage() {
    if (paginationState.hasPrev) {
        loadTagsOptimized(paginationState.currentPage - 1);
    }
}

// 다음 페이지
function nextPage() {
    if (paginationState.hasNext) {
        loadTagsOptimized(paginationState.currentPage + 1);
    }
}

// 특정 페이지로 이동
function goToPage(page) {
    if (page >= 0 && page < paginationState.totalPages) {
        loadTagsOptimized(page);
    }
}

// 페이지 크기 변경
function changePageSize(newSize) {
    paginationState.pageSize = newSize;
    paginationState.pageCache.clear(); // 캐시 초기화
    loadTagsOptimized(0); // 첫 페이지부터 다시 로드
}


// 개선된 Count 조회
function getTagsCountOptimized(filters, callback) {
    if (window.TagManagement && window.TagManagement.getTagsCount) {
        const callbackId = 'tags-count-' + Date.now();

        // 콜백 등록
        window[`onTagsCountLoaded_${callbackId}`] = function(response) {
            try {
                const result =  response ;
                if (result.success) {
                    paginationState.totalCount = result.count;
                    paginationState.totalPages = Math.ceil(result.count / paginationState.pageSize);
                    updateCountDisplay();

                    if (callback) callback();
                }
            } catch (e) {
                console.error('Failed to parse count response:', e);
                showToast('태그 수 조회 실패', 'error');
                isLoading = false;
                showLoading(false);
            }

            // 콜백 정리
            delete window[`onTagsCountLoaded_${callbackId}`];
        };

        // V2 API 호출
        window.TagManagement.getTagsCount(
            callbackId,
            filters.groupFilter,
            filters.statusFilter,
            filters.searchFilter,
            filters.updateFilter
        );
    }
}

// 페이지 로드 시 초기화
$(document).ready(function() {
    initializePage();

    // 이벤트 바인딩
    $('#searchUid').on('keypress', function(e) {
        if (e.which === 13) searchTags();
    });


    // 파일 선택 시 미리보기
    $('#bulkFile').on('change', function() {
        const fileName = $(this).val().split('\\').pop();
        if (fileName) {
            $(this).next('.custom-file-label').text(fileName);

            // 파일 크기 체크
            const file = this.files[0];
            if (file.size > 5 * 1024 * 1024) {
                showToast('파일 크기는 5MB를 초과할 수 없습니다.', 'error');
                $(this).val('');
                $(this).next('.custom-file-label').text('파일 선택...');
            }
        }
    });

    // 전체 선택 체크박스
    $('#selectAllTags').on('change', function() {
        const isChecked = $(this).is(':checked');
        $('.tag-checkbox').prop('checked', isChecked);
        if (isChecked) {
            tagList.forEach(tag => selectedTags.add(tag.uid));
        } else {
            selectedTags.clear();
        }
        updateBulkActionButtons();
    });

    // Enter 키로 검색
    $('.filter-row input').on('keypress', function(e) {
        if (e.which === 13) searchTags();
    });


    // 페이지네이션 이벤트
    $('#prevPageBtn').on('click', prevPage);
    $('#nextPageBtn').on('click', nextPage);
    $('#pageJump').on('change', function() {
        goToPage(parseInt($(this).val()));
    });
    $('#pageSizeSelect').on('change', function() {
        changePageSize(parseInt($(this).val()));
    });

    // 필터 변경 이벤트 - 디바운스 적용
    let filterTimeout;
    $('.filter-control').on('change input', function() {
        clearTimeout(filterTimeout);
        filterTimeout = setTimeout(() => {
            loadTagsOptimized(0);
        }, 300);
    });

    // 초기 로드
    loadTagsOptimized(0);

});

// 페이지 초기화
function initializePage() {
    // 현재 사용자 정보 확인
    loadCurrentUser();

    // 관리 그룹 목록 로드
    loadManagementGroups();

    // 등록일 설정
    setUpateDate();

    // 태그 수 먼저 조회 후 목록 로드
    loadTagsWithCount();
}

// 현재 사용자 정보 로드
function loadCurrentUser() {
    const userInfo = localStorage.getItem('currentUser');
    if (userInfo) {
        currentUser = JSON.parse(userInfo) ;

        // 권한 확인
        if ( currentUser.role != "super_admin"  ) {
            alert('태그 조회 권한이 없습니다.');
            window.location.href = 'nfc_admin_main.html';
            return;
        }

    } else {
        window.location.href = 'nfc_admin_login.html';
    }
}

// 관리 그룹 목록 로드
function loadManagementGroups() {
    if (window.AdminManagement && window.AdminManagement.getManagementGroups) {
        const callbackId = 'mgmt-groups-' + Date.now();
        window.AdminManagement.getManagementGroups(callbackId);
    }
}
function setUpateDate() {
    let default_date = new Date();

    // 하루 전날로 설정 (24시간 = 86400000ms)
    default_date.setDate(default_date.getDate() - 1);

    let formatted = default_date.toISOString().split("T")[0];

    $("#updateDate").val(formatted);
}

// 태그 목록 로드 - Count 먼저 조회하는 개선된 버전
function loadTagsWithCount(page = 0) {
    if (isLoading) {
        console.log('Already loading tags, skipping...');
        return;
    }

    currentPage = page;
    isLoading = true;
    lastLoadTime = Date.now();

    showLoading(true);

    // 필터 값 가져오기
    currentFilters = {
        groupFilter: $('#groupFilter').val() || '',
        statusFilter: $('#statusFilter').val() || '',
        searchFilter: $('#searchUid').val().trim() || ''
    };

    // Step 1: Count 조회
    if (window.TagManagement && window.TagManagement.getTagsCount) {
        const countCallbackId = 'tags-count-' + Date.now();

        // Count 조회 - 필터 적용
        window.TagManagement.getTagsCount(
            countCallbackId,
            currentFilters.groupFilter,
            currentFilters.statusFilter,
            currentFilters.searchFilter,
            currentFilters.updateFilter
        );
    } else {
        console.error('TagManagement.getTagsCount not available');
        showToast('앱에서만 사용 가능합니다.', 'error');
        isLoading = false;
        showLoading(false);
    }
}

// Count 조회 성공 콜백
window.onTagsCountLoaded = function(callbackId, response) {
    isLoading = false;
    showLoading(false);

    const dynamicCallback = window[`onTagsCountLoaded_${callbackId}`];
    if (dynamicCallback) {
        dynamicCallback(response);
    }
};
// Count 조회 실패 콜백
window.onTagsCountError = function(callbackId, error) {
    console.error('Tags count error:', error);
    showToast('태그 수 조회 실패: ' + error, 'error');
    isLoading = false;
    showLoading(false);
};

// 태그 데이터 로드
function loadTagsData(page, filters) {
    isLoading = false;
    showLoading(false);
    if (window.TagManagement && window.TagManagement.getTags) {
        const callbackId = 'tags-data-' + Date.now();

        // 콜백 등록
        window[`onTagsLoaded_${callbackId}`] = function(response) {
            try {
                const result =  response ;
                if (result.success) {
                    // 캐시에 저장
                    const cacheKey = `page-${page}`;
                    paginationState.pageCache.set(cacheKey, result.tags);

                    // 데이터 표시
                    displayTags(result.tags);
                    updatePaginationControls();
                }
            } catch (e) {
                console.error('Failed to parse tags response:', e);
                showToast('태그 조회 실패', 'error');
            }

            isLoading = false;
            showLoading(false);

            // 콜백 정리
            delete window[`onTagsLoaded_${callbackId}`];
        };

        // V2 API 호출
        window.TagManagement.getTags(
            callbackId,
            page,
            paginationState.pageSize,
            JSON.stringify(filters)
        );
    }
}

// 태그 로드 성공 콜백
window.onTagsLoaded = function(callbackId, response) {
    isLoading = false;
    showLoading(false);
    const dynamicCallback = window[`onTagsLoaded_${callbackId}`];
    if (dynamicCallback) {
        dynamicCallback(response);
    }
};

// 태그 로드 실패 콜백
window.onTagsError = function(callbackId, error) {
    console.error('Tags loading error:', error);
    showToast('태그 로드 실패: ' + error, 'error');
    isLoading = false;
    showLoading(false);
};

// Count 정보 표시 업데이트
function updateCountDisplay() {
    const startIdx = currentPage * pageSize + 1;
    const endIdx = Math.min((currentPage + 1) * pageSize, totalCount);

    $('#totalCountDisplay').text(`전체 ${totalCount}개`);
    $('#currentRangeDisplay').text(`${startIdx}-${endIdx}`);

    // 필터 적용 상태 표시
    if (currentFilters.groupFilter || currentFilters.statusFilter || currentFilters.searchFilter) {
        $('#filterStatus').show().text('(필터 적용됨)');
    } else {
        $('#filterStatus').hide();
    }
}

// 태그 테이블 렌더링
function renderTagTable() {
    const tbody = $('#tagTableBody');
    tbody.empty();

    if (tagList.length === 0) {
        $('#emptyState').show();
        $('.tag-table').hide();
        updatePagination();
        return;
    }

    $('#emptyState').hide();
    $('.tag-table').show();

    tagList.forEach(tag => {
        const row = createTagRow(tag);
        tbody.append(row);
    });

    updatePagination();
    updateBulkActionButtons();
}

// 태그 행 생성
function createTagRow(tag) {
    const row = $('<tr>');

    // 체크박스 (삭제 권한이 있는 경우만)
    if (currentUser.permissions && currentUser.permissions.canDeleteTags) {
        row.append(`
            <td>
                <input type="checkbox" class="tag-checkbox" value="${tag.uid}"
                    ${selectedTags.has(tag.uid) ? 'checked' : ''}>
            </td>
        `);
    }

    // UID
    row.append(`<td class="text-monospace">${tag.uid}</td>`);

    // 그룹
    const groupBadge = tag.managementGroupName ?
        `<span class="badge badge-info">${tag.managementGroupName}</span>` :
        '<span class="text-muted">-</span>';
    row.append(`<td>${groupBadge}</td>`);

    // 상태
    const statusBadge = tag.isActive ?
        '<span class="badge badge-success">활성</span>' :
        '<span class="badge badge-secondary">비활성</span>';
    row.append(`<td>${statusBadge}</td>`);

    // 측정 상태
    const measuringBadge = tag.isMeasuring ?
        '<span class="badge badge-primary">측정중</span>' :
        '<span class="text-muted">-</span>';
    row.append(`<td>${measuringBadge}</td>`);

    // 생성일
    const createdDate = tag.createdAt ?
        formatDate(new Date(tag.createdAt)) : '-';
    row.append(`<td>${createdDate}</td>`);

    // 작업 버튼
    const actions = createActionButtons(tag);
    row.append(`<td>${actions}</td>`);

    // 체크박스 이벤트
    row.find('.tag-checkbox').on('change', function() {
        if ($(this).is(':checked')) {
            selectedTags.add(tag.uid);
        } else {
            selectedTags.delete(tag.uid);
        }
        updateBulkActionButtons();
    });

    return row;
}

// 작업 버튼 생성
function createActionButtons(tag) {
    let buttons = '';

    // 상세 보기는 모든 사용자 가능
    buttons += `
        <button class="btn btn-sm btn-outline-primary" onclick="viewTagDetail('${tag.uid}')">
            상세
        </button>
    `;

    // 수정 권한 확인
    if (currentUser.permissions && currentUser.permissions.canModifyTags) {
        buttons += `
            <button class="btn btn-sm btn-outline-warning" onclick="editTag('${tag.uid}')">
                수정
            </button>
        `;
    }

    // 삭제 권한 확인
    if (currentUser.permissions && currentUser.permissions.canDeleteTags) {
        buttons += `
            <button class="btn btn-sm btn-outline-danger" onclick="deleteTag('${tag.uid}')">
                삭제
            </button>
        `;
    }

    return `<div class="btn-group">${buttons}</div>`;
}

// 페이지네이션 업데이트
function updatePagination() {
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination = $('.pagination');
    pagination.empty();

    // 이전 페이지
    const prevDisabled = currentPage === 0 ? 'disabled' : '';
    pagination.append(`
        <li class="page-item ${prevDisabled}">
            <a class="page-link" href="#" onclick="changePage(${currentPage - 1})">이전</a>
        </li>
    `);

    // 페이지 번호
    const startPage = Math.max(0, currentPage - 2);
    const endPage = Math.min(totalPages - 1, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        pagination.append(`
            <li class="page-item ${active}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i + 1}</a>
            </li>
        `);
    }

    // 다음 페이지
    const nextDisabled = currentPage === totalPages - 1 ? 'disabled' : '';
    pagination.append(`
        <li class="page-item ${nextDisabled}">
            <a class="page-link" href="#" onclick="changePage(${currentPage + 1})">다음</a>
        </li>
    `);

    // 페이지 정보
    $('#pageInfo').text(`${currentPage + 1} / ${totalPages} 페이지`);
}

// 페이지 변경
function changePage(page) {
    if (page >= 0 && page <= Math.ceil(totalCount / pageSize) - 1) {
        loadTagsWithCount(page);
    }
}

// 태그 검색
function searchTags() {
    currentPage = 0;
    loadTagsWithCount();
}

// 필터 초기화
function resetFilters() {
    $('#searchUid').val('');
    $('#groupFilter').val('');
    $('#statusFilter').val('');
    searchTags();
}

// 태그 상세 보기
function viewTagDetail(uid) {
    // 상세 페이지로 이동하거나 모달로 표시
    window.location.href = `nfc_admin_tag_detail.html?uid=${encodeURIComponent(uid)}`;
}

// 태그 수정
function editTag(uid) {
    editingUid = uid;
    const tag = tagList.find(t => t.uid === uid);

    if (tag) {
        $('#editUid').val(tag.uid);
        $('#editGroup').val(tag.managementGroupName || '');
        $('#editActive').prop('checked', tag.isActive);
        $('#editTagModal').modal('show');
    }
}

// 태그 수정 저장
window.saveTagEdit = function() {
    const updateData = {
        managementGroupName: $('#editGroup').val(),
        isActive: $('#editActive').is(':checked')
    };

    if (window.TagManagement && window.TagManagement.updateTag) {
        const callbackId = 'update-tag-' + Date.now();
        window.TagManagement.updateTag(callbackId, editingUid, JSON.stringify(updateData));
    }
};

// 태그 업데이트 성공 콜백
window.onTagUpdated = function(callbackId) {
    showToast('태그가 수정되었습니다.', 'success');
    $('#editTagModal').modal('hide');
    loadTagsWithCount(currentPage);
};

// 태그 업데이트 오류 콜백
window.onTagUpdateError = function(callbackId, error) {
    console.error('Tag update error:', error);
    showToast('태그 수정 실패: ' + error, 'error');
};

// 태그 삭제
function deleteTag(uid) {
    if (confirm(`태그 ${uid}를 삭제하시겠습니까?`)) {
        if (window.TagManagement && window.TagManagement.deleteTag) {
            const callbackId = 'delete-tag-' + Date.now();
            window.TagManagement.deleteTag(callbackId, uid);
        }
    }
}

// 태그 삭제 성공 콜백
window.onTagDeleted = function(callbackId) {
    showToast('태그가 삭제되었습니다.', 'success');
    loadTagsWithCount(currentPage);
};

// 태그 삭제 오류 콜백
window.onTagDeleteError = function(callbackId, error) {
    console.error('Tag delete error:', error);
    showToast('태그 삭제 실패: ' + error, 'error');
};

// 일괄 작업 버튼 업데이트
function updateBulkActionButtons() {
    const selectedCount = selectedTags.size;

    if (selectedCount > 0) {
        $('#selectedCount').text(`${selectedCount}개 선택됨`);
        $('#bulkActions').show();
    } else {
        $('#bulkActions').hide();
    }
}

// 일괄 활성화/비활성화
function bulkUpdateStatus(isActive) {
    if (selectedTags.size === 0) {
        showToast('선택된 태그가 없습니다.', 'error');
        return;
    }

    const message = isActive ? '활성화' : '비활성화';
    if (confirm(`선택된 ${selectedTags.size}개 태그를 ${message}하시겠습니까?`)) {
        if (window.TagManagement && window.TagManagement.bulkUpdateTags) {
            const callbackId = 'bulk-update-' + Date.now();
            const updateData = {
                uids: Array.from(selectedTags),
                updates: { isActive: isActive }
            };
            window.TagManagement.bulkUpdateTags(
                JSON.stringify(Array.from(selectedTags)),
                JSON.stringify({ isActive: isActive }),
                callbackId
            );
        }
    }
}

// 일괄 업데이트 완료 콜백
window.onBulkUpdateCompleted = function(callbackId, response) {
    try {
        const result =  response ;

        if (result.success) {
            showToast(result.message || '태그가 업데이트되었습니다.', 'success');
            selectedTags.clear();
            $('#selectAllTags').prop('checked', false);
            loadTagsWithCount(currentPage);
        } else {
            showToast('일괄 업데이트 실패: ' + (result.error || '알 수 없는 오류'), 'error');
        }
    } catch (e) {
        console.error('Failed to parse bulk update response:', e);
        showToast('응답 처리 오류', 'error');
    }
};

// 일괄 업데이트 오류 콜백
window.onBulkUpdateError = function(callbackId, error) {
    console.error('Bulk update error:', error);
    showToast('일괄 업데이트 오류: ' + error, 'error');
};

// 일괄 삭제
function bulkDelete() {
    if (selectedTags.size === 0) {
        showToast('선택된 태그가 없습니다.', 'error');
        return;
    }

    if (confirm(`선택된 ${selectedTags.size}개 태그를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        if (window.TagManagement && window.TagManagement.bulkDeleteTags) {
            const callbackId = 'bulk-delete-' + Date.now();
            window.TagManagement.bulkDeleteTags(
                JSON.stringify(Array.from(selectedTags)),
                callbackId
            );
        }
    }
}

// 일괄 삭제 완료 콜백
window.onBulkDeleteCompleted = function(callbackId, response) {
    try {
        const result = response;

        if (result.success) {
            showToast(result.message || '태그가 삭제되었습니다.', 'success');
            selectedTags.clear();
            $('#selectAllTags').prop('checked', false);
            loadTagsWithCount(currentPage);
        } else {
            showToast('일괄 삭제 실패: ' + (result.error || '알 수 없는 오류'), 'error');
        }
    } catch (e) {
        console.error('Failed to parse bulk delete response:', e);
        showToast('응답 처리 오류', 'error');
    }
};

// 일괄 삭제 오류 콜백
window.onBulkDeleteError = function(callbackId, error) {
    console.error('Bulk delete error:', error);
    showToast('일괄 삭제 오류: ' + error, 'error');
};

// 모바일 스와이프 설정
function setupMobileSwipe() {
    if ('ontouchstart' in window) {
        let touchStartX = 0;
        let touchEndX = 0;

        document.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        });

        document.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        });

        function handleSwipe() {
            if (touchEndX < touchStartX - 50) {
                // 왼쪽 스와이프 - 다음 페이지
                changePage(currentPage + 1);
            }
            if (touchEndX > touchStartX + 50) {
                // 오른쪽 스와이프 - 이전 페이지
                changePage(currentPage - 1);
            }
        }
    }
}

// 날짜 포맷
function formatDate(date) {
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    };
    return date.toLocaleDateString('ko-KR', options);
}

// 로딩 표시
function showLoading(show) {
    return false ;
    if (show) {
        $('#loadingOverlay').show();
        $('#tagTableBody').css('opacity', '0.5');
    } else {
        $('#loadingOverlay').hide();
        $('#tagTableBody').css('opacity', '1');
    }
}

// 토스트 메시지
function showToast(message, type = 'info') {
    const toast = $('#toast');
    toast.removeClass('show error success');

    if (type === 'error') {
        toast.addClass('error');
    } else if (type === 'success') {
        toast.addClass('success');
    }

    toast.text(message);
    toast.addClass('show');

    setTimeout(() => {
        toast.removeClass('show');
    }, 3000);
}

// 권한 거부 콜백
window.onPermissionDenied = function(callbackId, message) {
    console.error('Permission denied:', message);
    showToast(message, 'error');


};

// 관리 그룹 로드 성공 콜백
window.onManagementGroupsLoaded = function(callbackId, response) {
    try {
        managementGroups =  response ;

        // 그룹 필터 옵션 업데이트
        const groupFilter = $('#groupFilter');
        groupFilter.empty();
        groupFilter.append('<option value="">전체 그룹</option>');

        managementGroups.forEach(group => {
            groupFilter.append(`<option value="${group}">${group}</option>`);
        });
    } catch (e) {
        console.error('Failed to parse management groups:', e);
    }
};