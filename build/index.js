import fs from "node:fs"
import path from "node:path"
import { translate } from "@vitalets/google-translate-api"
import Logger from "logger"

export class Ln {
  locales
  default
  directory
  online
  logger

  constructor(options) {
    this.logger = new Logger({
      name: "Ln",
      colorize: true,
      level: "INFO"
    })
    this.locales = new Map()
    this.default = options.default
    this.directory = options.directory
    this.online = options.online || false
  }

  async load() {
    if (this.online) {
      this.logger.info("[Ln:Load] Modo online activado, no se carga directorio local")
      return
    }
    try {
      const directory = await fs.promises.stat(this.directory)
      if (!directory.isDirectory()) {
        this.logger.fatal("[Ln:Load] El parámetro 'directory' debe ser una ruta a un directorio válido")
        return
      }
      const files = await fs.promises.readdir(this.directory)
      if (!files.some((file) => path.extname(file) === ".lang")) {
        this.logger.warn("[Ln:Load] No hay archivos con extensión '.lang' en el directorio especificado")
        return
      }
      for (const file of files) {
        this.logger.info(`[Ln:Load] Leyendo contenido del archivo "${file}"`)
        const content = await fs.promises.readFile(path.resolve(this.directory, file), "utf8")
        if (!content.length) {
          this.logger.info(`[Ln:Load] El archivo "${file}" no tiene contenido, se omite`)
          continue
        }
        const lines = content.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !/^\#/.test(line))
        if (!lines.length) {
          this.logger.info(`[Ln:Load] El archivo "${file}" no tiene líneas válidas, se omite`)
          continue
        }
        if (!this.locales.has(path.basename(file, ".lang"))) {
          this.locales.set(path.basename(file, ".lang"), new Map())
        }
        const locale = this.locales.get(path.basename(file, ".lang"))
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]
          const match = line?.match(/^([^=]+)=(.*)$/)
          if (!match || !match[1] || !match[2]) {
            this.logger.info(`[Ln:Load] La línea ${i} del archivo "${file}" no tiene formato clave=valor válido`)
            continue
          }
          const [, key, value] = match
          locale.set(key.trim(), value.trim())
        }
        this.logger.info(`[Ln:Load] El archivo "${file}" ha sido procesado`)
      }
      this.logger.info("[Ln:Load] Todos los archivos han sido procesados")
    } catch (e) {
      this.logger.error(`[Ln:Load] Error al cargar directorio: ${e}`)
    }
  }

  async t(...args) {
    let textToTranslate
    let key
    let language
    let vars
    const placeholders = {}

    if (this.online) {
      textToTranslate = args[0]
      key = args[1]
      language = args[2] || this.default
      vars = args[3]
      if (typeof textToTranslate !== "string" || typeof key !== "string") {
        this.logger.error(`[Ln:Translate] En modo online, textToTranslate y key deben ser cadenas. Recibido: textToTranslate=${textToTranslate}, key=${key}`)
        return ""
      }
      if (!this.locales.has(language)) {
        this.locales.set(language, new Map())
      }
    } else {
      key = args[0]
      language = args[1] || this.default
      vars = args[2]
      if (typeof key !== "string") {
        this.logger.error(`[Ln:Translate] En modo local, key debe ser una cadena. Recibido: key=${key}`)
        return ""
      }
    }

    this.logger.info(`[Ln:Translate] Solicitando traducción para clave "${key}" en idioma "${language}"`)

    if (!this.locales.has(language)) {
      this.locales.set(language, new Map())
    }
    const locale = this.locales.get(language)
    let text = locale.get(key)

    if (text === undefined && this.online && textToTranslate) {
      try {
        let toTranslate = textToTranslate
        if (vars) {
          Object.keys(vars).forEach((k, index) => {
            const placeholder = `%${k}%`
            const tempPlaceholder = `{{PH_${index}}}`
            placeholders[tempPlaceholder] = placeholder
            toTranslate = toTranslate.replace(new RegExp(`%${k}%`, 'g'), tempPlaceholder)
          })
        }
        this.logger.info(`[Ln:Translate] Traduciendo "${toTranslate}" a "${language}"`)
        const res = await translate(toTranslate, { to: language })
        text = res.text
        if (typeof text !== "string") {
          this.logger.error(`[Ln:Translate] La API devolvió un texto no válido: ${text}`)
          text = textToTranslate
        }
        Object.keys(placeholders).forEach((temp) => {
          const regex = new RegExp(`\\s*${temp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\s*`, 'g')
          text = text.replace(regex, temp)
        })
        Object.entries(placeholders).forEach(([temp, original]) => {
          const regex = new RegExp(temp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')
          text = text.replace(regex, original)
        })
        if (textToTranslate) {
          text = this.restoreSpaces(textToTranslate, text, placeholders)
        }
        locale.set(key, text)
      } catch (e) {
        this.logger.error(`[Ln:Translate] Error en traducción online: ${e}`)
        text = textToTranslate
        Object.entries(placeholders).forEach(([temp, original]) => {
          const regex = new RegExp(temp.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'g')
          text = text.replace(regex, original)
        })
        locale.set(key, text)
      }
    } else if (text === undefined) {
      text = textToTranslate || key
      this.logger.info(`[Ln:Translate] Clave "${key}" no encontrada para idioma "${language}"`)
    }

    let finalText = text || ""
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        if (typeof v === "string") {
          const regex = new RegExp(`%${k}%`, 'g')
          finalText = finalText.replace(regex, v)
        } else {
          this.logger.warn(`[Ln:Translate] Variable "${k}" no es una cadena, se omite: ${v}`)
        }
      })
    }

    if (typeof finalText !== "string") {
      this.logger.error(`[Ln:Translate] El texto final no es una cadena: ${finalText}`)
      finalText = ""
    }
    return finalText
  }

  restoreSpaces(original, translated, placeholders) {
    let result = translated
    Object.entries(placeholders).forEach(([temp, placeholder]) => {
      const regex = new RegExp(`([^\\s]*${placeholder}[^\\s]*)`, 'g')
      const originalMatches = original.match(regex) || []
      const translatedMatches = result.match(regex) || []
      originalMatches.forEach((originalContext, index) => {
        if (translatedMatches[index]) {
          const translatedContext = translatedMatches[index]
          const escapedTranslatedContext = translatedContext.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
          result = result.replace(new RegExp(escapedTranslatedContext, 'g'), originalContext)
        }
      })
    })
    return result
  }

  reset() {
    this.locales.clear()
    this.logger.info("[Ln:Reset] Caché de traducciones limpiado")
  }
}

export default Ln
