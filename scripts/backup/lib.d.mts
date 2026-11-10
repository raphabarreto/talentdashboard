// Tipos para os testes (o código roda em Node puro, sem build).
export const TABLES: string[]
export const PRIMARY_KEY: Record<string, string>
export const ESSENTIAL_NON_EMPTY: string[]
export const REQUIRED_COLUMNS: Record<string, string[]>
export const FORMAT: number
export function pkOf(t: string): string
export function buildBackupQuery(): string
export function extractBackup(response: unknown): any
export function extractBackupText(response: unknown): string
export const BACKUP_WORKFLOW_PATH: string
export function validateBackup(doc: unknown): { ok: boolean; errors: string[]; warnings: string[]; counts: Record<string, number> }
export const TIMESTAMPTZ_COLUMNS: Record<string, string[]>
export function normalizeDecimal(src: string | number): string | null
export function parseLossless(text: string): any
export function normalizeTimestamp(v: unknown): string | null
export function canonicalValue(v: unknown): unknown
export function canonicalRow(table: string, row: Record<string, unknown>): unknown
export function diffTables(original: any, restored: any): Record<string, { original: number; restored: number; different: number }>
export function diffOk(d: Record<string, { original: number; restored: number; different: number }>): boolean
export function brasiliaDate(d?: Date): string
export function artifactNameFor(date: string): string
export function sha256(buf: Uint8Array | string): string
export function parsePacketKeyIds(text: string): string[]
export function parseEncryptionKeyIds(text: string): string[]
export function buildManifest(a: { date: string; generatedAt: string; fileName: string; fileBytes: Uint8Array; recipients: string[]; counts: Record<string, number> }): any
export const RELEASE_BODY: string
export function isOurDraft(release: any, name: string): boolean
export function evaluateCandidate(a: { name: string; release: any; manifest: any; fileSha256: string; fileSize: number; expectedKeyIds: string[] }): string | null
