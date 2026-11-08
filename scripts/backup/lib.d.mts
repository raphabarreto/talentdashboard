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
export function canonical(v: unknown): unknown
export function diffTables(original: any, restored: any): Record<string, { original: number; restored: number; different: number }>
export function diffOk(d: Record<string, { original: number; restored: number; different: number }>): boolean
export function brasiliaDate(d?: Date): string
export function artifactNameFor(date: string): string
export function sha256(buf: Uint8Array | string): string
export function parsePacketKeyIds(text: string): string[]
export function parseEncryptionKeyIds(text: string): string[]
export function buildManifest(a: { date: string; generatedAt: string; fileName: string; fileBytes: Uint8Array; recipients: string[]; counts: Record<string, number> }): any
export function evaluateCandidate(a: { name: string; artifact: any; run: any; manifest: any; fileSha256: string; fileSize: number; expectedKeyIds: string[]; acceptRunId?: string; repo?: string }): string | null
