import {cac} from 'cac'
import fg from 'fast-glob'
import fs from 'fs-extra'
import {resolve} from 'path'
import c from 'picocolors'
import {fileURLToPath} from 'url'

const cli = cac('impseek')

export const CURRENT_PATH = process.cwd()
export const IGNORE = ['**/^[.].*/**', '**/target/**', '**/dist/**', '**/node_modules/**']
export const reg = /(?<=import\s{?)(.*)(?=}?\sfrom)/g
export const IMPORT = 'import'
export const CURRENT_FILE_DIR = fileURLToPath(import.meta.url)

export const findFilesPaths = (source: string, ignore: string[]) => {
    return fg(source, {
        ignore,
        onlyFiles: true,
        deep: Infinity
    })
}

export const trim = (s: string) => {
    return s.trim()
}

export const removeQuote = (s: string) => {
    return s.replace('\'', '').replace('\"','')
}

export const getFileLines = (file: string) =>{
    if(file.includes('\r\n')){
        return file?.split('\r\n')
    }
   return file.split('\n')
}

export const includesPackageName = (text: string, packageName?: string) => {
    //Matches all packages
    const sReg = /from '.*'/g
    
    if (packageName) {
        return text.endsWith(packageName)
    }
    return sReg.test(text)
}

/**
 * Remove bracket
 * @param str
 * @constructor
 */
export const removeParentheses = (str: string) => {
    return str.replace('{', '').replace('}', '')
}

export const getImportContents = (file, packageName?: string) => {
    const list: string[] = []
    let str = ''
    let state = true
    getFileLines(file).forEach(item => {
        if (item.includes(IMPORT)) {
            state = true
            if (includesPackageName(item, packageName)) {
                list.push(removeParentheses(item.match(reg)?.[0]))
                state = false
            } else {
                str += item
            }
        } else {
            if (includesPackageName(item, packageName)) {
                list.push(str)
                str = ''
                state = false
            }
            if (str.includes(IMPORT)) {
                str = ''
            }
            if (state) {
                str += item
                state = false
            }
        }
    })
    return list.map(str => str?.split(',').map(trim)).flat()
}

export const getImportsContent = async (dir: string, filePaths: string[], packageName?: string) => {
    const contents = await Promise.all(filePaths.map(async item => {
        try {
            const file = await fs.readFile(resolve(dir, item), 'utf-8')
            return getImportContents(file, packageName)
        } catch (e) {
            console.error(e)
            return null
        }
    }))
    return [...new Set(contents.flat())].toString()
}

export const getPackageVersion = async () => {
    const json = await fs.readJson(resolve(CURRENT_FILE_DIR, '../../package.json'))
    return json.version
}

export interface CliOptions {
    node?: string
    time?: string
    packageName?: string
    '--'?: string[]
}

export const main = async () => {
    cli
        .version(await getPackageVersion())
        .option('-n, --node', 'Exclude node_modules folder')
        .option('-t, --time', 'Show find time')
        .option('-p, --packageName <packageName>', 'input find package name')
        .help()
    cli.command('')
        .action(run)
    cli.parse()
}

async function run(options: CliOptions = {}) {
    if (options?.time) {
        console.time(c.green('time'))
    }
    try {
        let filePaths = await findFilesPaths('**/**.(ts|tsx)', [...IGNORE])
        if (options?.packageName) {
            console.log(`${c.cyan(await getImportsContent(CURRENT_PATH, filePaths, options.packageName))}`)
        } else {
            console.log(`${c.cyan(await getImportsContent(CURRENT_PATH, filePaths))}`)
        }

    } catch (e) {
        console.error(e)
        cli.outputHelp()
        process.exit(1)
    }
    if (options?.time) {
        console.timeEnd(c.green('time'))
    }
}
