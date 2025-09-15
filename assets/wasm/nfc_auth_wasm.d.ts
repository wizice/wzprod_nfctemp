/* tslint:disable */
/* eslint-disable */
export function init_panic_hook(): void;
export class NfcAuthenticator {
  free(): void;
  constructor(key_base64: string, api_endpoint: string);
  /**
   * UID를 암호화된 UUID로 변환
   */
  encrypt_uid(uid: string): string;
  /**
   * Firebase Functions 호출하여 인증 확인
   */
  verify_tag(uid: string, app_version: string): Promise<boolean>;
  /**
   * 로컬 UID 해시 생성 (빠른 비교용)
   */
  hash_uid(uid: string): string;
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly __wbg_nfcauthenticator_free: (a: number, b: number) => void;
  readonly nfcauthenticator_new: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly nfcauthenticator_encrypt_uid: (a: number, b: number, c: number) => [number, number, number, number];
  readonly nfcauthenticator_verify_tag: (a: number, b: number, c: number, d: number, e: number) => any;
  readonly nfcauthenticator_hash_uid: (a: number, b: number, c: number) => [number, number];
  readonly init_panic_hook: () => void;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_export_4: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_export_6: WebAssembly.Table;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly closure60_externref_shim: (a: number, b: number, c: any) => void;
  readonly closure71_externref_shim: (a: number, b: number, c: any, d: any) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
