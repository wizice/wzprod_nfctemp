/**
 * WASM 인증 모듈 로더
 */

let wasmModule = null;
let authenticator = null;
let isWasmInitialized = false;

// Firebase Functions 엔드포인트
// 프로덕션: 'https://us-central1-nfctemperatureapp.cloudfunctions.net/verifyTagAuthenticity'
// 로컬 테스트: 'http://10.0.2.2:5001/nfctemperatureapp/us-central1/verifyTagAuthenticity'
const FIREBASE_FUNCTIONS_URL = 'https://us-central1-nfctemperatureapp.cloudfunctions.net/verifyTagAuthenticity';

// 암호화 키 (실제 배포 시 안전하게 관리)
// Base64URL을 표준 Base64로 변환 (_ -> /, - -> +)
const ENCRYPTION_KEY = 'ATBVo4sIj/ZAZpo2aHUFJLYeoCQVUshCGVvrhVS9MQ4=';

/**
 * WASM 파일을 Base64로 로드
 */
async function loadWasmAsBase64(url) {
    return new Promise((resolve, reject) => {
        try {
            // Android WebView에서는 XMLHttpRequest 사용
            if (window.AndroidNfc || url.startsWith('file://')) {
                const xhr = new XMLHttpRequest();
                xhr.open('GET', url, true);
                xhr.responseType = 'arraybuffer';
                
                xhr.onload = function() {
                    if (xhr.status === 200 || xhr.status === 0) {
                        const bytes = new Uint8Array(xhr.response);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        resolve(btoa(binary));
                    } else {
                        reject(new Error('Failed to load WASM: ' + xhr.status));
                    }
                };
                
                xhr.onerror = function() {
                    reject(new Error('XHR failed to load WASM'));
                };
                
                xhr.send();
            } else {
                // 일반 브라우저에서는 fetch 사용
                fetch(url)
                    .then(response => response.arrayBuffer())
                    .then(buffer => {
                        const bytes = new Uint8Array(buffer);
                        let binary = '';
                        for (let i = 0; i < bytes.byteLength; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        resolve(btoa(binary));
                    })
                    .catch(reject);
            }
        } catch (error) {
            console.error('Failed to load WASM as Base64:', error);
            reject(error);
        }
    });
}

/**
 * Base64에서 WASM 모듈 초기화
 */
async function initFromBase64(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return WebAssembly.instantiate(bytes.buffer);
}

/**
 * WASM 모듈 초기화
 */
async function initializeWasmAuth() {
    try {
        // 이미 초기화된 경우 재초기화 방지
        if (isWasmInitialized) {
            console.log('WASM already initialized');
            return true;
        }
        
        console.log('Initializing WASM authentication module...');
        
        // WASM 파일이 존재하는지 먼저 체크
        try {
            // WASM 파일을 Base64로 로드
            const wasmBase64 = await loadWasmAsBase64('file:///android_asset/wasm/nfc_auth_wasm_bg.wasm');
            console.log('WASM loaded as Base64, length:', wasmBase64 ? wasmBase64.length : 0);
            
            if (!wasmBase64) {
                throw new Error('WASM file could not be loaded');
            }
        
        // WASM 모듈을 동적으로 로드
        const script = document.createElement('script');
        script.type = 'module';
        script.textContent = `
            import init, { NfcAuthenticator } from 'file:///android_asset/wasm/nfc_auth_wasm.js';
            
            window.initWasmModule = async function(wasmBase64) {
                try {
                    // Base64를 ArrayBuffer로 변환
                    const binary = atob(wasmBase64);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    
                    // WASM 초기화 - ArrayBuffer 사용
                    await init(bytes.buffer);
                    
                    // NfcAuthenticator 인스턴스 생성 (constructor 필요)
                    const encryptionKey = '${ENCRYPTION_KEY}';
                    const apiEndpoint = '${FIREBASE_FUNCTIONS_URL}';
                    return new NfcAuthenticator(encryptionKey, apiEndpoint);
                } catch (error) {
                    console.error('WASM init error:', error);
                    throw error;
                }
            };
        `;
        document.head.appendChild(script);
        
        // 스크립트 로드 대기
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (window.initWasmModule) {
            try {
                authenticator = await window.initWasmModule(wasmBase64);
                wasmModule = authenticator;
                isWasmInitialized = true;
                console.log('WASM module loaded successfully');
                
                // 전역 객체로 authenticator 노출
                window.authenticator = authenticator;
            } catch (error) {
                console.error('WASM initialization failed:', error);
                // WASM 로드 실패 시 대체 처리
                isWasmInitialized = false;
                return false;
            }
        } else {
            console.error('WASM module script not loaded');
            return false;
        }
        
        console.log('WASM authentication module initialized successfully');
        
        // Android WebView 콜백 호출
        if (typeof WasmCallback !== 'undefined' && WasmCallback.onInitialized) {
            console.log('Calling WasmCallback.onInitialized(true)');
            WasmCallback.onInitialized(true);
        } else {
            console.warn('WasmCallback not available');
        }
        
        return true;
        } catch (wasmError) {
            console.warn('WASM file not found or could not be loaded:', wasmError);
            console.log('WASM authentication will be disabled');
            isWasmInitialized = false;
            
            // Android WebView 콜백 호출 (실패)
            if (typeof WasmCallback !== 'undefined' && WasmCallback.onInitialized) {
                console.log('Calling WasmCallback.onInitialized(false)');
                WasmCallback.onInitialized(false);
            } else {
                console.warn('WasmCallback not available (failed case)');
            }
            
            return false;
        }
    } catch (error) {
        console.error('Failed to initialize WASM:', error);
        isWasmInitialized = false;
        return false;
    }
}

// wasm-bindgen이 자동으로 메모리 관리를 처리하므로 
// 수동 메모리 관리 함수들은 더 이상 필요하지 않음

/**
 * NFC 태그 인증 (WASM 사용 - 상세 응답)
 */
async function authenticateTagWithWasmDetailed(uid) {
    try {
        if (!authenticator) {
            console.log('WASM not initialized, initializing now...');
            const initialized = await initializeWasmAuth();
            if (!initialized) {
                return {
                    authenticated: false,
                    status: 'WASM_NOT_AVAILABLE',
                    message: 'WASM initialization failed'
                };
            }
        }
        
        console.log('Authenticating tag with WASM (detailed):', uid);
        
        // 앱 버전 정보
        const appVersion = '1.0.0';
        
        // WASM의 상세 인증 메서드 호출
        const result = await authenticator.verify_tag_detailed(uid, appVersion);
        
        console.log('Detailed authentication result:', result);
        
        // Android WebView 콜백 호출
        if (typeof WasmCallback !== 'undefined' && WasmCallback.onAuthResult) {
            console.log('Calling WasmCallback.onAuthResult:', result.status);
            WasmCallback.onAuthResult(result.status);
        }
        
        return result;
        
    } catch (error) {
        console.error('WASM authentication error:', error);
        
        const errorResult = {
            authenticated: false,
            status: 'WASM_ERROR',
            message: error.message || 'WASM authentication failed'
        };
        
        // Android WebView 콜백 호출
        if (typeof WasmCallback !== 'undefined' && WasmCallback.onAuthResult) {
            console.log('Calling WasmCallback.onAuthResult:', errorResult.status);
            WasmCallback.onAuthResult(errorResult.status);
        }
        
        return errorResult;
    }
}

/**
 * NFC 태그 인증 (WASM 사용 - 기존 호환성)
 */
async function authenticateTagWithWasm(uid) {
    try {
        const detailedResult = await authenticateTagWithWasmDetailed(uid);
        return detailedResult.authenticated;
    } catch (error) {
        console.error('WASM authentication error:', error);
        
        // 폴백: 기존 방식으로 인증
        console.log('Falling back to traditional authentication...');
        return await fallbackAuthentication(uid);
    }
}

/**
 * Nonce 생성
 */
function generateNonce() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode.apply(null, array))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

/**
 * 폴백 인증 (WASM 실패 시)
 */
async function fallbackAuthentication(uid) {
    try {
        // Android 네이티브 코드 호출
        if (window.AndroidNfc && window.AndroidNfc.checkTagAuthentication) {
            return await new Promise((resolve) => {
                window.AndroidNfc.checkTagAuthentication(uid, (result) => {
                    resolve(result === 'true');
                });
            });
        }
        return false;
    } catch (error) {
        console.error('Fallback authentication error:', error);
        return false;
    }
}

/**
 * 전역 함수로 노출 (Android WebView에서 호출)
 */
window.authenticateNfcTag = authenticateTagWithWasm;
window.authenticateNfcTagDetailed = authenticateTagWithWasmDetailed;
window.initializeWasmAuth = initializeWasmAuth;

// 페이지 로드 시 자동 초기화 - 지연 실행
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            console.log('Page loaded, initializing WASM after delay...');
            initializeWasmAuth();
        }, 1000); // 1초 후 초기화
    });
} else {
    // 이미 로드된 경우
    setTimeout(() => {
        console.log('Document already loaded, initializing WASM...');
        initializeWasmAuth();
    }, 1000);
}