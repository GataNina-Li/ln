# 🌎 @GataNina-Li/ln (v1.1.1)

## A Simple and Lightweight Multilingual (i18n) System Built with TypeScript

This package provides a flexible internationalization (i18n) solution for JavaScript/TypeScript applications. It supports two modes: **local mode** for loading translations from static `.lang` files, and **online mode** for dynamic translations using the Google Translate API via [`@vitalets/google-translate-api`](https://github.com/vitalets/google-translate-api). Translations in online mode are cached in memory for O(1) access on subsequent requests, improving performance.

<details>
<summary><b>Configuration Options</b></summary>

The `Ln` class is initialized with an options object (`LnOptions`) that configures its behavior. Below is a detailed explanation of each parameter:

```javascript
const ln = new Ln({
  default: "es",
  directory: path.join(dirname, "locales"),
  online: false,
  //logger: new Logger({ level: "OFF" })
})
```

- **`default: string`** (required)
  - **Purpose**: Specifies the fallback language code (e.g., `"es"` for Spanish) used when no language is provided in `t()` or if the requested language is unavailable.
  - **Example**: `default: "en"` sets English as the fallback.
  - **Notes**: Must be a valid language code (e.g., `"es"`, `"en"`, `"fr"`). Affects both local and online modes.

- **`directory?: string`** (optional, required for local mode)
  - **Purpose**: Path to the directory containing `.lang` files with translations (e.g., `es.lang`). Ignored in online mode.
  - **Example**: `directory: path.join(dirname, "locales")` points to a `locales` folder.
  - **Notes**: Must be a valid directory path. If invalid or missing in local mode, initialization fails with a fatal log. Use absolute paths for reliability.

- **`online?: boolean`** (optional, default: `false`)
  - **Purpose**: Enables online mode for dynamic translations via Google Translate. When `true`, `directory` is ignored, and `load()` is not needed.
  - **Example**: `online: true` activates online mode.
  - **Notes**: Requires internet access. Cached translations ensure fast subsequent lookups.

- **`logger?: Nullable<Logger>`** (optional)
  - **Purpose**: Custom logger instance from `@imjxsx/logger` for debugging and tracing. If not provided, a default logger is created with level `"INFO"` and colorized output.
  - **Example**: `logger: new Logger({ level: "OFF" })` silences all logs. Use `level: "ERROR"` to show only errors, or `level: "INFO"` for detailed logs.
  - **Notes**: Logger levels (e.g., `"OFF"`, `"ERROR"`, `"INFO"`) control verbosity. A custom logger must implement `info`, `trace`, `warn`, `error`, and `fatal`. Example for errors only:
    ```javascript
    logger: new Logger({ level: "ERROR" })
    ```

</details>

<details>
<summary><b>Local Mode</b></summary>

### Explanation
Use local mode to load translations from `.lang` files in a directory. It's fast and doesn't require internet.

**Setup and Usage:**
```javascript
import Ln from "@GataNina-Li/ln"
import Logger from "@imjxsx/logger"
import path from "node:path"
import { fileURLToPath } from "node:url"

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const ln = new Ln({
  default: "es",
  directory: path.join(dirname, "locales"),
  //logger: new Logger({ level: "OFF" })
})
await ln.load()
console.log(ln.t("hello.world", "es")) // "Hola Mundo!"
console.log(ln.t("welcome.user", "es", { user: "GataNina-Li", place: "GitHub" })) // "Hola GataNina-Li, bienvenido a GitHub."
```

Create `.lang` files like `es.lang` with `key=value` pairs, e.g.:
```
# locales/es.lang
hello.world=Hola Mundo!
welcome.user=Hola %user%, bienvenido a %place%.
```

### Advanced Explanation
For experienced developers: Local mode preloads all translations into a `Map<string, Map<string, string>>` structure for O(1) lookups.

- **Configuration**: `directory` must point to a valid folder with `.lang` files (e.g., `es.lang`). If missing, logger warns and skips loading.
- **load() Method**: Asynchronously reads files, parses lines (skipping comments `#` and empty lines), matches `key=value` with regex, trims values, and stores in maps. Handles errors with `try-catch`.
- **t() Method**: Signature `t(key: string, language?: string, vars?: Record<string, string>)`. Falls back to default language or key if not found. Interpolates vars using regex replace after lookup.
- **Logging**: Default level `"INFO"`. Customize with `logger`, e.g., `new Logger({ level: "ERROR" })` for errors only, or `new Logger({ level: "OFF" })` to mute.
- **Edge Cases**: Invalid directory fatal-logs and returns early. Empty files skipped. Missing keys return the key. Supports TypeScript types in `index.d.ts`.
- **Performance**: Preloads everything; ideal for static apps but memory-intensive for large files.

</details>

<details>
<summary><b>Online Mode</b></summary>

### Explanation
Use online mode for dynamic translations via Google Translate. No files needed; translations are fetched and cached.

**Setup and Usage:**
```javascript
import Ln from "@GataNina-Li/ln"
import Logger from "@imjxsx/logger"

const ln = new Ln({
  default: "es",
  online: true,
  //logger: new Logger({ level: "OFF" })
})
console.log(ln.t("Hello World!", "hello.world", "es")) // "¡Hola Mundo!"
console.log(ln.t("Hello %user%, welcome to %place%.", "welcome.user", "es", { user: "GataNina-Li", place: "GitHub" })) // "Hola GataNina-Li, bienvenido a GitHub."
// ln.reset() // (Optional) Clear cache if necessary
```

First call translates and saves; later calls use cache. Check supported languages [here](https://cloud.google.com/translate/docs/languages?hl=es-419).

### Advanced Explanation
For experienced developers: Online mode uses on-demand API calls with in-memory caching in `Map<string, Map<string, string>>`.

- **Configuration**: Set `online: true`; ignores `directory`. Requires internet for initial translations.
- **t() Method**: Signature `t(textToTranslate: string, key: string, language?: string, vars?: Record<string, string>)`. Checks cache first; if missing, calls `translate(textToTranslate, { to: language })`, stores result. Falls back to `textToTranslate` on API error. Interpolates vars post-translation.
- **reset() Method**: Clears `locales` Map to force re-translations, useful for text updates.
- **Logging**: Traces requests and errors. Customize logger, e.g., `new Logger({ level: "OFF" })` to mute or `new Logger({ level: "ERROR" })` for errors only.
- **Edge Cases**: Missing `textToTranslate` or `key` logs error and returns fallback. API failures (rate limits, network) log and fallback to original. Placeholders `%var%` preserved during translation. Cache grows; reset to manage memory.
- **Performance**: API calls slow initially (~seconds), but cache enables O(1) repeats. No `load()` needed.

Google Translate has request limits. If too many requests are made from the same IP address, you will get a TooManyRequestsError (code 429). [`You can use proxy to bypass it.`](https://www.npmjs.com/package/@vitalets/google-translate-api#limits)

</details>

### Key Features
- Dual Mode Support: Local or online.
- Variable Interpolation: `%user%` style.
- Built-in Logging: Customizable with `logger`.
- Fallbacks: Default language or original text.
- Cache Management: `reset()` for online.
- TypeScript Support: Full typings.

### 📥 Installation

#### In `package.json`
```bash
{
  "type": "module",
  "dependencies": {
    "ln": "github:GataNina-Li/ln"
  }
}

```

#### With NPM
```bash
npm install @gatanina-li-dev/ln
```

#### With PNPM
```bash
pnpm add @gatanina-li-dev/ln
```

#### With YARN
```bash
yarn add @gatanina-li-dev/ln
```

### ⚠️ Important Notes and Warnings
- Validate paths and params to avoid errors.
- Online mode needs internet; handles failures with fallbacks.
- Logger verbose by default; use `logger: new Logger({ level: "OFF" })` to mute or `"ERROR"` for errors only.

### 🛠️ Common Issues and Solutions
- **Directory issues**: Use absolute paths.
- **API errors**: Check connection; fallback used.
- **Missing keys**: Returns key or original text.
- **Memory**: Use `reset()` for large caches.

### 🙏 Gratitude

Developed with ❤️ by **[imjxsx](https://github.com/imjxsx)**  
![imjxsx](https://github.com/imjxsx.png?size=100)  

Remastered by **[GataNina-Li](https://github.com/GataNina-Li)**  
![GataNina-Li](https://github.com/GataNina-Li.png?size=100)
