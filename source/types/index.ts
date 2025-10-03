import type Logger from "logger"

export type Nullable<T> = T | undefined | null
export interface LnOptions {
  default: string
  directory?: string
  online?: boolean
  logger?: Nullable<Logger>
}
