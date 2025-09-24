// admin_users.js - 관리자 관리 기능 (개선된 버전)

let currentUser = null;
let adminList = [];
let currentPage = 0;
let pageSize = 20;  // 기본값
let totalCount = 0;
let managementGroups = [];
let editingUsername = null;
let isLoading = false;
let lastLoadTime = 0;

// 필터 상태 저장
let currentFilters = {
    searchFilter: '',
    roleFilter: '',
    statusFilter: ''
};

// 페이지 로드 시 초기화
$(document).ready(function() {
    initializePage();

    // 이벤트 바인딩
    $('#searchInput').on('keypress', function(e) {
        if (e.which === 13) searchAdmins();
    });

    // 페이지 크기 변경
    $('#pageSizeSelect').on('change', function() {
        pageSize = parseInt($(this).val());
        currentPage = 0;
        loadAdminsWithCount();
    });

    // 비밀번호 확인 검증
    $('#passwordConfirm').on('input', function() {
        validatePasswordMatch();
    });

    // Enter 키로 검색
    $('.filter-row input').on('keypress', function(e) {
        if (e.which === 13) searchAdmins();
    });

    // 모바일 터치 스와이프로 페이지 전환
    setupMobileSwipe();
});

// 페이지 초기화
function initializePage() {
    // 현재 사용자 정보 확인
    loadCurrentUser();

    // 관리 그룹 목록 로드
    loadManagementGroups();

    // 관리자 수 먼저 조회 후 목록 로드
    loadAdminsWithCount();
}

// 현재 사용자 정보 로드
function loadCurrentUser() {
    const userInfo = localStorage.getItem('currentUser');
    if (userInfo) {
        currentUser = JSON.parse(userInfo);

        // Super Admin이 아니면 접근 불가
        if (currentUser.role !== 'super_admin') {
            alert('접근 권한이 없습니다.');
            window.location.href = 'nfc_admin_dashboard.html';
        }
        $('#login_userName').text( currentUser.username);

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

// 관리자 목록 로드 - Count 먼저 조회하는 개선된 버전
function loadAdminsWithCount(page = 0) {
    if (isLoading) {
        console.log('Already loading admins, skipping...');
        return;
    }

    currentPage = page;
    isLoading = true;
    lastLoadTime = Date.now();

    showLoading(true);

    // 필터 값 가져오기
    currentFilters = {
        searchFilter: $('#searchInput').val().trim() || '',
        roleFilter: $('#roleFilter').val() || '',
        statusFilter: $('#statusFilter').val() || ''
    };

    // Step 1: Count 조회
    if (window.AdminManagement && window.AdminManagement.getAdminsCount) {
        const countCallbackId = 'admins-count-' + Date.now();

        // Count 조회 - 필터 적용
        window.AdminManagement.getAdminsCount(
            countCallbackId,
            currentFilters.searchFilter,
            currentFilters.roleFilter
        );
    } else {
        console.error('AdminManagement.getAdminsCount not available');
        showToast('앱에서만 사용 가능합니다.', 'error');
        isLoading = false;
        showLoading(false);
    }
}

// Count 조회 성공 콜백
window.onAdminsCountLoaded = function(callbackId, response) {
    try {
        const result = JSON.parse(response);

        if (result.success) {
            totalCount = result.count;
            console.log(`Total admins count: ${totalCount} (filtered)`);

            // Count 정보 표시
            updateCountDisplay();

            // Step 2: 실제 데이터 로드 (필요한 페이지만)
            if (totalCount > 0) {
                loadAdminsData();
            } else {
                // 데이터가 없는 경우
                adminList = [];
                renderAdminTable();
                isLoading = false;
                showLoading(false);
            }
        }
    } catch (e) {
        console.error('Failed to parse count response:', e);
        showToast('관리자 수 조회 실패', 'error');
        isLoading = false;
        showLoading(false);
    }
};

// Count 조회 실패 콜백
window.onAdminsCountError = function(callbackId, error) {
    console.error('Admins count error:', error);
    showToast('관리자 수 조회 실패: ' + error, 'error');
    isLoading = false;
    showLoading(false);
};

// 실제 관리자 데이터 로드
function loadAdminsData() {
    if (window.AdminManagement && window.AdminManagement.getAdminUsers) {
        const callbackId = 'admins-data-' + Date.now();

        // 현재 페이지의 데이터만 로드
        window.AdminManagement.getAdminUsers(
            callbackId,
            currentPage,
            pageSize,
            currentFilters.searchFilter,
            currentFilters.roleFilter
        );
    }
}

// 관리자 로드 성공 콜백
window.onAdminUsersLoaded = function(callbackId, response) {
    try {
        const admins = JSON.parse(response);
        const loadTime = Date.now() - lastLoadTime;

        console.log(`Admins loaded in ${loadTime}ms`);

        adminList = admins;
        renderAdminTable();

        // 성능 경고
        if (loadTime > 2000) {
            console.warn('Admin loading took too long:', loadTime + 'ms');
        }
    } catch (e) {
        console.error('Failed to parse admins:', e);
        showToast('관리자 데이터 파싱 오류', 'error');
    } finally {
        isLoading = false;
        showLoading(false);
    }
};

// 관리자 로드 실패 콜백
window.onAdminUsersError = function(callbackId, error) {
    console.error('Admin loading error:', error);
    showToast('관리자 로드 실패: ' + error, 'error');
    isLoading = false;
    showLoading(false);
};

// Count 정보 표시 업데이트
function updateCountDisplay() {
    const startIdx = currentPage * pageSize + 1;
    const endIdx = Math.min((currentPage + 1) * pageSize, totalCount);

    $('#totalCountDisplay').text(`전체 ${totalCount}명`);
    $('#currentRangeDisplay').text(`${startIdx}-${endIdx}`);

    // 필터 적용 상태 표시
    if (currentFilters.searchFilter || currentFilters.roleFilter || currentFilters.statusFilter) {
        $('#filterStatus').show().text('(필터 적용됨)');
    } else {
        $('#filterStatus').hide();
    }

    // 역할별 통계 표시 (옵션)
    updateRoleStatistics();
}

// 역할별 통계 업데이트
function updateRoleStatistics() {
    // AdminManagementInterface에 getRoleStatistics가 없으므로
    // getAdminsCount를 여러 번 호출하여 통계 생성

    const roles = ['super_admin', 'admin', 'viewer'];
    const stats = {};
    let completed = 0;

    roles.forEach(role => {
        if (window.AdminManagement && window.AdminManagement.getAdminsCount) {
            const callbackId = `role-stats-${role}-${Date.now()}`;

            // 역할별로 count 조회
            window.AdminManagement.getAdminsCount(callbackId, '', role);

            // 임시 콜백 저장
            window[`onAdminsCountLoaded_${callbackId}`] = window.onAdminsCountLoaded;

            // 역할별 통계 수집을 위한 커스텀 콜백
            window.onAdminsCountLoaded = function(id, response) {
                if (id === callbackId) {
                    try {
                        const result = JSON.parse(response);
                        if (result.success) {
                            stats[role] = result.count;
                            completed++;

                            // 모든 역할 조회 완료
                            if (completed === roles.length) {
                                $('#superAdminCount').text(stats.super_admin || 0);
                                $('#adminCount').text(stats.admin || 0);
                                $('#viewerCount').text(stats.viewer || 0);

                                // 원래 콜백 복원
                                window.onAdminsCountLoaded = window[`onAdminsCountLoaded_${callbackId}`];
                            }
                        }
                    } catch (e) {
                        console.error('Failed to parse role statistics:', e);
                    }
                } else {
                    // 다른 count 조회는 원래 콜백으로 처리
                    window[`onAdminsCountLoaded_${callbackId}`](id, response);
                }
            };
        }
    });
}

// 관리자 테이블 렌더링
function renderAdminTable() {
    const tbody = $('#adminTableBody');
    tbody.empty();

    if (adminList.length === 0) {
        $('#emptyState').show();
        $('.admin-table table').hide();
        updatePagination();
        return;
    }

    $('#emptyState').hide();
    $('.admin-table table').show();

    adminList.forEach(admin => {
        const row = createAdminRow(admin);
        tbody.append(row);
    });

    updatePagination();
}

// 관리자 행 생성
function createAdminRow(admin) {
    const row = $('<tr>');

    // 사용자명
    row.append(`<td><strong>${admin.username}</strong></td>`);

    // 역할
    const roleBadge = getRoleBadge(admin.role);
    row.append(`<td>${roleBadge}</td>`);

    // 상태
    const statusText = admin.isActive ?
        '<span class="status-active">활성</span>' :
        '<span class="status-inactive">비활성</span>';
    row.append(`<td>${statusText}</td>`);

    // 마지막 로그인
    const lastLogin = admin.lastLoginAt ?
        formatDateTime(new Date(admin.lastLoginAt)) :
        '<span class="text-muted">-</span>';
    row.append(`<td>${lastLogin}</td>`);

    // 관리 그룹
    const groups = admin.managementGroups && admin.managementGroups.length > 0 ?
        admin.managementGroups.map(g => `<span class="group-badge">${g}</span>`).join(' ') :
        '<span class="text-muted">-</span>';
    row.append(`<td>${groups}</td>`);

    // 작업 버튼
    const actions = createActionButtons(admin);
    row.append(`<td>${actions}</td>`);

    return row;
}

// 작업 버튼 생성
function createActionButtons(admin) {
    let buttons = `
        <button class="btn btn-sm btn-outline-primary" onclick="viewAdminDetail('${admin.username}')">
            상세
        </button>
        <button class="btn btn-sm btn-outline-warning" onclick="editAdmin('${admin.username}')">
            수정
        </button>
    `;

    // 자기 자신은 삭제 불가
    if (admin.username !== currentUser.username) {
        buttons += `
            <button class="btn btn-sm btn-outline-danger" onclick="deleteAdmin('${admin.username}')">
                삭제
            </button>
        `;
    }

    return `<div class="action-buttons">${buttons}</div>`;
}

// 역할 배지
function getRoleBadge(role) {
    const badges = {
        'super_admin': '<span class="badge badge-danger">Super Admin</span>',
        'admin': '<span class="badge badge-primary">Admin</span>',
        'viewer': '<span class="badge badge-secondary">Viewer</span>'
    };
    return badges[role] || `<span class="badge badge-secondary">${role}</span>`;
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

    // 페이지 번호 - 모바일에서는 현재 페이지 주변만 표시
    const isMobile = window.innerWidth < 768;
    const pageRange = isMobile ? 1 : 2;
    const startPage = Math.max(0, currentPage - pageRange);
    const endPage = Math.min(totalPages - 1, currentPage + pageRange);

    if (startPage > 0) {
        pagination.append(`
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(0)">1</a>
            </li>
        `);
        if (startPage > 1) {
            pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        const active = i === currentPage ? 'active' : '';
        pagination.append(`
            <li class="page-item ${active}">
                <a class="page-link" href="#" onclick="changePage(${i})">${i + 1}</a>
            </li>
        `);
    }

    if (endPage < totalPages - 1) {
        if (endPage < totalPages - 2) {
            pagination.append('<li class="page-item disabled"><span class="page-link">...</span></li>');
        }
        pagination.append(`
            <li class="page-item">
                <a class="page-link" href="#" onclick="changePage(${totalPages - 1})">${totalPages}</a>
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
        loadAdminsWithCount(page);
    }
}

// 관리자 검색
function searchAdmins() {
    currentPage = 0;
    loadAdminsWithCount();
}

// 필터 초기화
function resetFilters() {
    $('#searchInput').val('');
    $('#roleFilter').val('');
    $('#statusFilter').val('');
    searchAdmins();
}

// 관리자 상세 보기
function viewAdminDetail(username) {
    const admin = adminList.find(a => a.username === username);
    if (admin) {
        // 상세 정보 모달 표시
        $('#detailUsername').text(admin.username);
        $('#detailRole').html(getRoleBadge(admin.role));
        $('#detailStatus').html(admin.isActive ?
            '<span class="status-active">활성</span>' :
            '<span class="status-inactive">비활성</span>');
        $('#detailCreatedAt').text(admin.createdAt ?
            formatDateTime(new Date(admin.createdAt)) : '-');
        $('#detailLastLogin').text(admin.lastLoginAt ?
            formatDateTime(new Date(admin.lastLoginAt)) : '-');
        $('#detailGroups').html(admin.managementGroups && admin.managementGroups.length > 0 ?
            admin.managementGroups.map(g => `<span class="group-badge">${g}</span>`).join(' ') :
            '<span class="text-muted">없음</span>');

        // 권한 정보
        if (admin.permissions) {
            $('#detailPermissions').html(formatPermissions(admin.permissions));
        }

        $('#viewAdminModal').modal('show');
    }
}

// 권한 포맷
function formatPermissions(permissions) {
    const permissionList = [];

    if (permissions.canCreateTags) permissionList.push('태그 생성');
    if (permissions.canModifyTags) permissionList.push('태그 수정');
    if (permissions.canDeleteTags) permissionList.push('태그 삭제');
    if (permissions.canViewReports) permissionList.push('리포트 조회');
    if (permissions.canManageAdmins) permissionList.push('관리자 관리');

    return permissionList.length > 0 ?
        permissionList.map(p => `<span class="badge badge-info">${p}</span>`).join(' ') :
        '<span class="text-muted">권한 없음</span>';
}

// 관리자 추가
function showAddAdminModal() {
    $('#addUsername').val('');
    $('#addPassword').val('');
    $('#passwordConfirm').val('');
    $('#addRole').val('viewer');
    $('#addGroups').val([]);
    $('#addAdminModal').modal('show');
}

// 관리자 추가 처리
window.addNewAdmin = function() {
    const username = $('#addUsername').val().trim();
    const password = $('#addPassword').val();
    const passwordConfirm = $('#passwordConfirm').val();
    const role = $('#addRole').val();
    const groups = $('#addGroups').val() || [];

    // 유효성 검사
    if (!username || username.length < 3) {
        showToast('사용자명은 3자 이상이어야 합니다.', 'error');
        return;
    }

    if (!password || password.length < 6) {
        showToast('비밀번호는 6자 이상이어야 합니다.', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showToast('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    const adminData = {
        username: username,
        password: password,
        role: role,
        managementGroups: groups,
        isActive: true
    };

    if (window.AdminManagement && window.AdminManagement.createAdmin) {
        const callbackId = 'create-admin-' + Date.now();
        window.AdminManagement.createAdmin(callbackId, JSON.stringify(adminData));
    }
};

// 관리자 생성 성공 콜백
window.onAdminCreated = function(callbackId) {
    showToast('관리자가 추가되었습니다.', 'success');
    $('#addAdminModal').modal('hide');
    loadAdminsWithCount();
};

// 관리자 생성 오류 콜백
window.onAdminCreateError = function(callbackId, error) {
    console.error('Admin create error:', error);
    showToast('관리자 추가 실패: ' + error, 'error');
};

// 관리자 수정
function editAdmin(username) {
    editingUsername = username;
    const admin = adminList.find(a => a.username === username);

    if (admin) {
        $('#editUsername').val(admin.username);
        $('#editRole').val(admin.role);
        $('#editGroups').val(admin.managementGroups || []);
        $('#editActive').prop('checked', admin.isActive);

        // 권한 설정
        if (admin.permissions) {
            $('#canCreateTags').prop('checked', admin.permissions.canCreateTags);
            $('#canModifyTags').prop('checked', admin.permissions.canModifyTags);
            $('#canDeleteTags').prop('checked', admin.permissions.canDeleteTags);
            $('#canViewReports').prop('checked', admin.permissions.canViewReports);
            $('#canManageAdmins').prop('checked', admin.permissions.canManageAdmins);
        }

        $('#editAdminModal').modal('show');
    }
}

// 관리자 수정 저장
window.saveAdminEdit = function() {
    const updateData = {
        role: $('#editRole').val(),
        managementGroups: $('#editGroups').val() || [],
        isActive: $('#editActive').is(':checked'),
        permissions: {
            canCreateTags: $('#canCreateTags').is(':checked'),
            canModifyTags: $('#canModifyTags').is(':checked'),
            canDeleteTags: $('#canDeleteTags').is(':checked'),
            canViewReports: $('#canViewReports').is(':checked'),
            canManageAdmins: $('#canManageAdmins').is(':checked')
        }
    };

    if (window.AdminManagement && window.AdminManagement.updateAdmin) {
        const callbackId = 'update-admin-' + Date.now();
        window.AdminManagement.updateAdmin(callbackId, editingUsername, JSON.stringify(updateData));
    }
};

// 관리자 업데이트 성공 콜백
window.onAdminUpdated = function(callbackId) {
    showToast('관리자 정보가 수정되었습니다.', 'success');
    $('#editAdminModal').modal('hide');
    loadAdminsWithCount(currentPage);
};

// 관리자 업데이트 오류 콜백
window.onAdminUpdateError = function(callbackId, error) {
    console.error('Admin update error:', error);
    showToast('관리자 수정 실패: ' + error, 'error');
};

// 관리자 삭제
function deleteAdmin(username) {
    $('#deleteUsername').text(username);
    $('#deleteConfirmModal').modal('show');
}

// 관리자 삭제 확인
window.confirmDeleteAdmin = function() {
    const username = $('#deleteUsername').text();

    if (window.AdminManagement && window.AdminManagement.deleteAdmin) {
        const callbackId = 'delete-admin-' + Date.now();
        window.AdminManagement.deleteAdmin(callbackId, username);
    }
};

// 관리자 삭제 성공 콜백
window.onAdminDeleted = function(callbackId) {
    showToast('관리자가 삭제되었습니다.', 'success');
    $('#deleteConfirmModal').modal('hide');
    loadAdminsWithCount();
};

// 관리자 삭제 오류 콜백
window.onAdminDeleteError = function(callbackId, error) {
    console.error('Admin delete error:', error);
    showToast('관리자 삭제 실패: ' + error, 'error');
    $('#deleteConfirmModal').modal('hide');
};

// 비밀번호 일치 검증
function validatePasswordMatch() {
    const password = $('#addPassword').val();
    const confirm = $('#passwordConfirm').val();

    if (confirm && password !== confirm) {
        $('#passwordConfirm').addClass('is-invalid');
        $('#passwordError').show();
    } else {
        $('#passwordConfirm').removeClass('is-invalid');
        $('#passwordError').hide();
    }
}

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

// 날짜/시간 포맷
function formatDateTime(date) {
    const options = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('ko-KR', options);
}

// 로딩 표시
function showLoading(show) {
    if (show) {
        $('#loadingOverlay').show();
        $('#adminTableBody').css('opacity', '0.5');
    } else {
        $('#loadingOverlay').hide();
        $('#adminTableBody').css('opacity', '1');
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

    setTimeout(() => {
        window.location.href = 'nfc_admin_dashboard.html';
    }, 2000);
};

// 관리 그룹 로드 성공 콜백
window.onManagementGroupsLoaded = function(callbackId, response) {
    try {
        managementGroups = JSON.parse(response);

        // 그룹 선택 옵션 업데이트
        const groupSelects = $('#addGroups, #editGroups');
        groupSelects.empty();

        managementGroups.forEach(group => {
            groupSelects.append(`<option value="${group}">${group}</option>`);
        });

        // Select2 또는 다중 선택 플러그인 초기화 (있는 경우)
        if ($.fn.select2) {
            groupSelects.select2({
                placeholder: '그룹 선택',
                allowClear: true
            });
        }
    } catch (e) {
        console.error('Failed to parse management groups:', e);
    }
};

// 오류 콜백들
window.onAdminError = function(callbackId, error) {
    console.error('Admin operation error:', error);
    showToast('작업 실패: ' + error, 'error');
    showLoading(false);
};
// 뒤로 가기
function goBack() {

     let move_url     =   "nfc_admin_main.html?ts=" + new Date().getTime() ;
     gwzCommon.fn_move_url( move_url );

}
window.onBackPressed = function () {
    setTimeout(function(){
        goBack();
        }, 100);
    return false;
};
