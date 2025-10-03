import type Logger from "@imjxsx/logger"

export type Nullable<T> = T | undefined | null

export interface LnOptions {
  default: string
  directory?: string
  online?: boolean
  logger?: Nullable<Logger>
}

export interface Ln {
  t(textToTranslate: string, key: string, language?: string, vars?: Record<string, string>): Promise<string>
  t(key: string, language?: string, vars?: Record<string, string>): Promise<string>
  load(): Promise<void>
  reset(): void
}

export class Ln {
  constructor(options: LnOptions)
  load(): Promise<void>
  t(...args: any[]): Promise<string>
  reset(): void
}
export default Ln
