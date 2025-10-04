import fs from "node:fs"
import path from "node:path"
import { translate } from "@vitalets/google-translate-api"
import Logger from "logger"

export class Ln {
  logger
  locales
  default
  directory
  online

  constructor(options) {
    this.logger = options.logger || new Logger({
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
      this.logger.info("Modo online activado, no se carga directorio local")
      return
    }
    try {
      const directory = await fs.promises.stat(this.directory)
      if (!directory.isDirectory()) {
        this.logger.fatal("The \"directory\" parameter must be a path to a valid directory.")
        return
      }
      const files = await fs.promises.readdir(this.directory)
      if (!files.some((file) => path.extname(file) === ".lang")) {
        this.logger.warn("There is no file with the \"lang\" extension in the specified directory.")
        return
      }
      for (const file of files) {
        this.logger.info(`Reading the contents of the file "${file}".`)
        const content = await fs.promises.readFile(path.resolve(this.directory, file), "utf8")
        this.logger.trace({
          file,
          content
        })
        if (!content.length) {
          this.logger.info(`File "${file}" has no content, skipping file.`)
          continue
        }
        const lines = content.split("\n").map((line) => line.trim()).filter((line) => line !== "" && !/^\#/.test(line))
        this.logger.trace({
          file,
          lines
        })
        if (!lines.length) {
          this.logger.info(`File "${file}" has no lines, skipping file.`)
          continue
        }
        if (!this.locales.has(path.basename(file, ".lang"))) {
          this.locales.set(path.basename(file, ".lang"), new Map())
        }
        const locale = this.locales.get(path.basename(file, ".lang"))
        for (let i = 0; i < lines.length; i++) {
          this.logger.info(`Processing line number "${i}" of file "${file}".`)
          const line = lines[i]
          this.logger.trace({
            file,
            line: i,
            content: line
          })
          const match = line?.match(/^([^=]+)=(.*)$/)
          if (!match || !match[1] || !match[2]) {
            this.logger.info(`Line number "${i}" of file "${file}" has no valid key=value.`)
            continue
          }
          const [, key, value] = match
          this.logger.trace({
            file,
            line: i,
            key: key.trim(),
            value: value.trim()
          })
          locale.set(key.trim(), value.trim())
        }
        this.logger.info(`The file "${file}" has finished processing.`)
        this.logger.trace({
          file,
          keys: locale.size
        })
      }
      this.logger.info("All files have been processed.")
      this.logger.trace({
        locales: Array.from(this.locales.keys())
      })
    } catch (e) {
      this.logger.error(e)
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
      if (!textToTranslate || !key) {
        this.logger.error("In online mode, textToTranslate and key are required")
        return textToTranslate || key
      }
      if (vars) {
        Object.keys(vars).forEach((k, index) => {
          const placeholder = `%${k}%`
          const tempPlaceholder = `__PH_${index}__`
          placeholders[tempPlaceholder] = placeholder
          textToTranslate = textToTranslate.replace(placeholder, tempPlaceholder)
        })
      }
    } else {
      key = args[0]
      language = args[1] || this.default
      vars = args[2]
    }

    this.logger.info(`GET "${key}" for language "${language}"`)
    this.logger.trace({
      key,
      language,
      vars: vars || {},
      mode: this.online ? "online" : "local"
    })

    if (!this.locales.has(language)) {
      this.locales.set(language, new Map())
    }
    const locale = this.locales.get(language)

    let text = locale.get(key)

    if (!text && this.online && textToTranslate) {
      try {
        this.logger.info(`Translating online "${textToTranslate}" to "${language}"`)
        const res = await translate(textToTranslate, { to: language })
        text = res.text
        Object.entries(placeholders).forEach(([temp, original]) => {
          text = text.replace(temp, original)
        })
        locale.set(key, text)
        this.logger.trace({
          key,
          language,
          translated: text
        })
      } catch (e) {
        this.logger.error(`Error in online translation: ${e}`)
        text = textToTranslate
        Object.entries(placeholders).forEach(([temp, original]) => {
          text = text.replace(temp, original)
        })
      }
    } else if (!text) {
      text = textToTranslate || key
      this.logger.info(`Key "${key}" not found for language "${language}"`)
    }

    let finalText = text
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        finalText = finalText.replace(`%${k}%`, v)
      })
    }

    this.logger.trace({
      key,
      language,
      value: finalText
    })
    return finalText
  }

  reset() {
    this.locales.clear()
    this.logger.info("Translation cache reset")
  }
}
export default Ln
